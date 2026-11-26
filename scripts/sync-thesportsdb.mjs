#!/usr/bin/env node
/**
 * Sync J.League / Shonan Bellmare data from TheSportsDB free API v1 into public/api/v1/*.json
 *
 * Environment variables:
 *   THESPORTSDB_API_KEY    (optional) Default: '123' (TheSportsDB public free API key)
 *   THESPORTSDB_LEAGUE_ID  (optional) Default: '4824' (Japanese J2 League)
 *   THESPORTSDB_SEASON     (optional) Default: auto-computed autumn-spring season (e.g., '2026-2027')
 *   THESPORTSDB_TEAM_ID    (optional) Default: auto-discovered from league standings
 *   THESPORTSDB_TEAM_NAME  (optional) Default: 'Shonan Bellmare'
 *   THESPORTSDB_MAX_ROUNDS (optional) Default: 38
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  formatSeasonLabel,
  toJaCompetitionName,
  toJaStadiumName,
  toJaTeamName,
  toJstIso,
} from './jp-mapping.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_OUT_DIR = path.resolve(__dirname, '../public/api/v1');
const TICKET_URL = 'https://www.jleague-ticket.jp/club/sb/';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveSeasonString(inputSeason) {
  if (inputSeason) {
    const raw = String(inputSeason).trim();
    if (/^\d{4}-\d{4}$/.test(raw)) return raw;
    if (/^\d{4}-\d{2}$/.test(raw)) {
      const start = Number(raw.slice(0, 4));
      return `${start}-${start + 1}`;
    }
    const year = Number(raw);
    if (!Number.isNaN(year)) {
      return year >= 2026 ? `${year}-${year + 1}` : String(year);
    }
  }

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1; // 1-12
  if (year >= 2026) {
    // J.League autumn-spring season starts in August
    return month >= 7 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  }
  return String(year);
}

function getSeasonStartYear(seasonStr) {
  const match = String(seasonStr).match(/^(\d{4})/);
  return match ? Number(match[1]) : new Date().getUTCFullYear();
}

async function readExistingJson(filename) {
  try {
    const raw = await fs.readFile(path.join(API_OUT_DIR, filename), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeJson(filename, data) {
  await fs.mkdir(API_OUT_DIR, { recursive: true });
  await fs.writeFile(
    path.join(API_OUT_DIR, filename),
    `${JSON.stringify(data, null, 2)}\n`,
    'utf8'
  );
}

function mapPosition(rawPos) {
  const p = String(rawPos ?? '').toLowerCase();
  if (p.includes('goal') || p === 'gk' || p === 'g') return 'GK';
  if (p.includes('def') || p.includes('back') || p === 'df' || p === 'd') return 'DF';
  if (p.includes('mid') || p === 'mf' || p === 'm') return 'MF';
  if (p.includes('att') || p.includes('for') || p.includes('strik') || p.includes('wing') || p === 'fw' || p === 'f') {
    return 'FW';
  }
  return 'MF';
}

function parseHeightCm(value) {
  const str = String(value ?? '').trim();
  if (!str) return 0;
  const meters = str.match(/(\d+\.\d+)\s*m/i);
  if (meters) return Math.round(Number(meters[1]) * 100);
  const cm = str.match(/(\d{3})\s*cm/i);
  if (cm) return Number(cm[1]);
  const plain = str.match(/^(\d{3})$/);
  if (plain) return Number(plain[1]);
  return 0;
}

function parseWeightKg(value) {
  const str = String(value ?? '').trim();
  if (!str) return 0;
  const kg = str.match(/(\d{2,3})\s*kg/i);
  if (kg) return Number(kg[1]);
  const plain = str.match(/^(\d{2,3})$/);
  if (plain) return Number(plain[1]);
  return 0;
}

function parseIntSafe(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  const match = String(value ?? '').match(/-?\d+/);
  return match ? Number(match[0]) : 0;
}

function isTargetTeam(name, id, targetName, targetTeamId) {
  if (targetTeamId && id && String(id) === String(targetTeamId)) return true;
  const n = String(name ?? '').toLowerCase();
  if (!n) return false;
  if (targetName && n === targetName.toLowerCase()) return true;
  return n.includes('shonan');
}

function parseKickoffToJst(ev) {
  if (ev.strTimestamp) {
    let ts = String(ev.strTimestamp).trim();
    if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(ts)) {
      ts = `${ts}Z`;
    }
    const parsed = new Date(ts);
    if (!Number.isNaN(parsed.getTime())) {
      return toJstIso(parsed.toISOString());
    }
  }

  if (ev.dateEvent) {
    const timeRaw = String(ev.strTime ?? '05:00:00')
      .trim()
      .replace(/Z$/i, '');
    const timePart = /^\d{2}:\d{2}(:\d{2})?$/.test(timeRaw)
      ? timeRaw.length === 5
        ? `${timeRaw}:00`
        : timeRaw
      : '05:00:00';
    const parsed = new Date(`${ev.dateEvent}T${timePart}Z`);
    if (!Number.isNaN(parsed.getTime())) {
      return toJstIso(parsed.toISOString());
    }
  }

  return toJstIso(new Date().toISOString());
}

function isEventFinished(ev) {
  const status = String(ev.strStatus ?? '').trim().toLowerCase();
  if (
    ['match finished', 'ft', 'aet', 'pen', 'after extra time', 'after penalties'].includes(status)
  ) {
    return true;
  }
  const hasHomeScore =
    ev.intHomeScore !== null &&
    ev.intHomeScore !== undefined &&
    String(ev.intHomeScore).trim() !== '';
  const hasAwayScore =
    ev.intAwayScore !== null &&
    ev.intAwayScore !== undefined &&
    String(ev.intAwayScore).trim() !== '';
  return hasHomeScore && hasAwayScore;
}

export async function syncFromTheSportsDB(options = {}) {
  const apiKey = (options.apiKey ?? process.env.THESPORTSDB_API_KEY ?? '123').trim();
  const leagueId = String(options.leagueId ?? process.env.THESPORTSDB_LEAGUE_ID ?? '4824').trim();
  const seasonStr = resolveSeasonString(options.season ?? process.env.THESPORTSDB_SEASON);
  const seasonYear = getSeasonStartYear(seasonStr);
  const seasonLabel = formatSeasonLabel(seasonYear);
  const targetTeamName = (options.teamName ?? process.env.THESPORTSDB_TEAM_NAME ?? 'Shonan Bellmare').trim();
  let teamId = (options.teamId ?? process.env.THESPORTSDB_TEAM_ID ?? '').trim() || null;
  const maxRounds = Number(options.maxRounds ?? process.env.THESPORTSDB_MAX_ROUNDS ?? 38);

  const skipStandings = Boolean(options.skipStandings);
  const skipMatches = Boolean(options.skipMatches);
  const skipPlayers = Boolean(options.skipPlayers);
  const skipMeta = Boolean(options.skipMeta);

  const baseUrl = `https://www.thesportsdb.com/api/v1/json/${apiKey}`;
  let requestCount = 0;

  async function tsdbGet(endpoint, params = {}, attempt = 1) {
    // Respect free tier rate limit (~30 requests/minute)
    if (requestCount > 0 && requestCount % 25 === 0) {
      console.log('[TheSportsDB] Pausing 62s to respect free-tier rate limit...');
      await sleep(62_000);
    }
    requestCount += 1;

    const url = new URL(`${baseUrl}/${endpoint}`);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, String(v));
      }
    }

    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (res.status === 429 && attempt <= 2) {
      console.warn(`[TheSportsDB] HTTP 429 on ${endpoint}; waiting 62s before retry ${attempt}...`);
      await sleep(62_000);
      return tsdbGet(endpoint, params, attempt + 1);
    }

    if (!res.ok) {
      throw new Error(`TheSportsDB HTTP ${res.status} on ${endpoint}`);
    }

    const text = await res.text();
    if (!text.trim()) return {};
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`TheSportsDB invalid JSON on ${endpoint}: ${text.slice(0, 120)}`);
    }
  }

  console.log(
    `[TheSportsDB] Starting sync: leagueId=${leagueId}, season=${seasonStr} (${seasonLabel}), team="${targetTeamName}"`
  );

  // 1. Standings (also discovers Shonan Bellmare's teamId)
  let standingsUpdated = false;
  let targetPlayed = 0;

  if (!skipStandings || !teamId) {
    const tableRes = await tsdbGet('lookuptable.php', { l: leagueId, s: seasonStr });
    const rows = Array.isArray(tableRes.table) ? tableRes.table : [];

    if (rows.length > 0) {
      const targetRow = rows.find((row) =>
        isTargetTeam(row.strTeam, row.idTeam, targetTeamName, teamId)
      );
      if (targetRow?.idTeam) {
        teamId = String(targetRow.idTeam);
        targetPlayed = parseIntSafe(targetRow.intPlayed);
        console.log(
          `[TheSportsDB] Discovered team: ${targetRow.strTeam} (idTeam=${teamId}, rank=${targetRow.intRank}, played=${targetPlayed})`
        );
      }

      if (!skipStandings) {
        const leagueName = rows[0]?.strLeague || 'J2 League';
        const standingsData = {
          season: seasonLabel,
          competition: toJaCompetitionName(leagueName),
          standings: rows
            .map((row) => ({
              rank: parseIntSafe(row.intRank),
              team: toJaTeamName(row.strTeam),
              played: parseIntSafe(row.intPlayed),
              won: parseIntSafe(row.intWin),
              drawn: parseIntSafe(row.intDraw),
              lost: parseIntSafe(row.intLoss),
              gd: parseIntSafe(row.intGoalDifference),
              points: parseIntSafe(row.intPoints),
              is_target: isTargetTeam(row.strTeam, row.idTeam, targetTeamName, teamId),
            }))
            .sort((a, b) => a.rank - b.rank),
        };

        await writeJson('standings.json', standingsData);
        standingsUpdated = true;
        console.log(`[TheSportsDB] Updated standings.json (${standingsData.standings.length} teams)`);
      }
    } else {
      console.warn('[TheSportsDB] No standings returned from lookuptable.php');
    }
  }

  // 2. Matches
  let matchesUpdated = false;
  if (!skipMatches) {
    const existing = await readExistingJson('matches.json');
    const existingById = new Map((existing?.matches ?? []).map((m) => [String(m.id), m]));
    const eventsById = new Map();

    const collectTargetEvents = (events) => {
      if (!Array.isArray(events)) return 0;
      let added = 0;
      for (const ev of events) {
        if (!ev?.idEvent) continue;
        if (ev.idLeague && String(ev.idLeague) !== leagueId) continue;
        if (ev.strSeason && String(ev.strSeason) !== seasonStr) continue;
        const involvesTarget =
          isTargetTeam(ev.strHomeTeam, ev.idHomeTeam, targetTeamName, teamId) ||
          isTargetTeam(ev.strAwayTeam, ev.idAwayTeam, targetTeamName, teamId);
        if (!involvesTarget) continue;
        eventsById.set(String(ev.idEvent), ev);
        added += 1;
      }
      return added;
    };

    // Fetch round-by-round to bypass the 15-event free limit on eventsseason.php
    let consecutiveEmptyRounds = 0;
    for (let r = 1; r <= maxRounds; r += 1) {
      try {
        const roundRes = await tsdbGet('eventsround.php', {
          id: leagueId,
          r,
          s: seasonStr,
        });
        const roundEvents = Array.isArray(roundRes.events) ? roundRes.events : [];
        if (roundEvents.length === 0) {
          consecutiveEmptyRounds += 1;
          if (r > Math.max(targetPlayed + 2, 20) && consecutiveEmptyRounds >= 4) {
            break;
          }
        } else {
          consecutiveEmptyRounds = 0;
          collectTargetEvents(roundEvents);
        }
      } catch (err) {
        console.warn(`[TheSportsDB] eventsround.php r=${r} failed: ${err.message}`);
      }
    }

    // Supplement with team's recent/next events if teamId is known
    if (teamId) {
      for (const ep of ['eventslast.php', 'eventsnext.php']) {
        try {
          const teamEvRes = await tsdbGet(ep, { id: teamId });
          collectTargetEvents(teamEvRes.results ?? teamEvRes.events ?? []);
        } catch (err) {
          console.warn(`[TheSportsDB] ${ep} failed: ${err.message}`);
        }
      }
    }

    // Fallback to eventsseason.php if round iteration yielded nothing
    if (eventsById.size === 0) {
      try {
        const seasonRes = await tsdbGet('eventsseason.php', { id: leagueId, s: seasonStr });
        collectTargetEvents(seasonRes.events ?? []);
      } catch (err) {
        console.warn(`[TheSportsDB] eventsseason.php failed: ${err.message}`);
      }
    }

    if (eventsById.size > 0) {
      const matches = [...eventsById.values()]
        .map((ev) => {
          const id = String(ev.idEvent);
          const isHome = isTargetTeam(ev.strHomeTeam, ev.idHomeTeam, targetTeamName, teamId);
          const opponentName = isHome ? ev.strAwayTeam : ev.strHomeTeam;
          const finished = isEventFinished(ev);
          const prev = existingById.get(id);

          let result = null;
          if (finished) {
            const bellmareScore = parseIntSafe(isHome ? ev.intHomeScore : ev.intAwayScore);
            const opponentScore = parseIntSafe(isHome ? ev.intAwayScore : ev.intHomeScore);
            result = {
              bellmare_score: bellmareScore,
              opponent_score: opponentScore,
              scorers: prev?.result?.scorers ?? [],
            };
          }

          const rawVenue = ev.strVenue && String(ev.strVenue).trim() ? ev.strVenue : null;
          const stadium = rawVenue
            ? toJaStadiumName(rawVenue)
            : isHome
              ? 'レモンガススタジアム平塚'
              : '未定';

          return {
            id,
            round: ev.intRound ? `第${parseIntSafe(ev.intRound)}節` : '',
            kickoff: parseKickoffToJst(ev),
            is_home: isHome,
            opponent: toJaTeamName(opponentName),
            stadium,
            status: finished ? 'finished' : 'scheduled',
            ticket_url: finished ? null : TICKET_URL,
            result,
            lineup: prev?.lineup ?? null,
            stats: prev?.stats ?? null,
          };
        })
        .sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime());

      const matchesData = {
        season: seasonLabel,
        matches,
      };

      await writeJson('matches.json', matchesData);
      matchesUpdated = true;
      console.log(`[TheSportsDB] Updated matches.json (${matches.length} matches)`);
    } else {
      console.warn('[TheSportsDB] No target team matches found; keeping existing matches.json');
    }
  }

  // 3. Players (only if not already synced by API-Football)
  let playersUpdated = false;
  if (!skipPlayers && teamId) {
    try {
      const existingPlayers = await readExistingJson('players.json');
      const existingByNumber = new Map(
        (existingPlayers?.players ?? []).map((p) => [p.number, p])
      );

      const playersRes = await tsdbGet('lookup_all_players.php', { id: teamId });
      const rawPlayers = playersRes.player ?? playersRes.players ?? [];

      const usedNumbers = new Set();
      const players = [];

      for (const p of Array.isArray(rawPlayers) ? rawPlayers : []) {
        const num = parseIntSafe(p.strNumber);
        if (!num || num <= 0 || usedNumbers.has(num)) continue;
        usedNumbers.add(num);
        const prev = existingByNumber.get(num);
        players.push({
          number: num,
          name: p.strPlayer ?? `#${num}`,
          kana: prev?.name === p.strPlayer ? prev.kana ?? '' : '',
          position: mapPosition(p.strPosition),
          height: parseHeightCm(p.strHeight) || prev?.height || 0,
          weight: parseWeightKg(p.strWeight) || prev?.weight || 0,
          apps: prev?.name === p.strPlayer ? prev.apps ?? 0 : 0,
          goals: prev?.name === p.strPlayer ? prev.goals ?? 0 : 0,
          assists: prev?.name === p.strPlayer ? prev.assists ?? 0 : 0,
        });
      }

      players.sort((a, b) => a.number - b.number);

      if (players.length > 0) {
        await writeJson('players.json', {
          season: seasonLabel,
          players,
        });
        playersUpdated = true;
        console.log(`[TheSportsDB] Updated players.json (${players.length} players)`);
      } else {
        console.warn('[TheSportsDB] No numbered players returned; keeping existing players.json');
      }
    } catch (err) {
      console.warn(`[TheSportsDB] lookup_all_players.php failed: ${err.message}`);
    }
  }

  // 4. Meta
  if (!skipMeta) {
    const metaData = {
      updated_at: toJstIso(new Date().toISOString()),
      schema_version: 1,
    };
    await writeJson('meta.json', metaData);
    console.log(`[TheSportsDB] Updated meta.json (total TheSportsDB requests used: ${requestCount})`);
  }

  return {
    standingsUpdated,
    matchesUpdated,
    playersUpdated,
    requestCount,
    teamId,
    season: seasonStr,
  };
}

// Run standalone if invoked directly
const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  syncFromTheSportsDB().catch((err) => {
    console.error('[TheSportsDB] Sync failed:', err);
    process.exit(1);
  });
}
