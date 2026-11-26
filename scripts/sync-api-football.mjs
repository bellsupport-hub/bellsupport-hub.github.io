#!/usr/bin/env node
/**
 * Sync J.League / Shonan Bellmare data from API-Football v3 into public/api/v1/*.json
 *
 * Environment variables:
 *   API_FOOTBALL_KEY       (required) API key from https://dashboard.api-football.com/
 *   API_FOOTBALL_TEAM_ID   (optional) Default: auto-discovered or 284 (Shonan Bellmare)
 *   API_FOOTBALL_LEAGUE_ID (optional) Default: auto-discovered current J1/J2 league
 *   API_FOOTBALL_SEASON    (optional) Default: auto-discovered current season year
 *   MAX_DETAIL_FETCH       (optional) Max newly finished matches to fetch lineup/stats for (default: 5)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  formatSeasonLabel,
  toJaCompetitionName,
  toJaRound,
  toJaStadiumName,
  toJaTeamName,
  toJstIso,
} from './jp-mapping.mjs';
import { syncFromTheSportsDB } from './sync-thesportsdb.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_OUT_DIR = path.resolve(__dirname, '../public/api/v1');
const BASE_URL = 'https://v3.football.api-sports.io';
const TICKET_URL = 'https://www.jleague-ticket.jp/club/sb/';

const API_KEY = process.env.API_FOOTBALL_KEY?.trim();

const MAX_DETAIL_FETCH = Number(process.env.MAX_DETAIL_FETCH ?? 5);
let requestCount = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiGet(endpoint, params = {}) {
  // Respect free tier rate limit (10 requests/minute)
  if (requestCount > 0 && requestCount % 9 === 0) {
    console.log('Pausing 62s to respect API-Football free-tier per-minute rate limit...');
    await sleep(62_000);
  }
  requestCount += 1;

  const url = new URL(`${BASE_URL}${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url, {
    headers: {
      'x-apisports-key': API_KEY,
    },
  });

  if (!res.ok) {
    throw new Error(`API-Football HTTP ${res.status} on ${endpoint}`);
  }

  const json = await res.json();
  if (json.errors && Object.keys(json.errors).length > 0) {
    throw new Error(`API-Football error on ${endpoint}: ${JSON.stringify(json.errors)}`);
  }

  return json;
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
  if (p.includes('def') || p === 'df' || p === 'd') return 'DF';
  if (p.includes('mid') || p === 'mf' || p === 'm') return 'MF';
  if (p.includes('att') || p.includes('for') || p === 'fw' || p === 'f') return 'FW';
  return 'MF';
}

function parseIntSafe(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  const match = String(value ?? '').match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function isFinishedStatus(shortStatus) {
  return ['FT', 'AET', 'PEN'].includes(shortStatus);
}

async function resolveTeamAndLeague() {
  let teamId = process.env.API_FOOTBALL_TEAM_ID
    ? Number(process.env.API_FOOTBALL_TEAM_ID)
    : 284;

  if (!process.env.API_FOOTBALL_TEAM_ID) {
    const teamRes = await apiGet('/teams', { search: 'Shonan' });
    const bellmare = (teamRes.response ?? []).find((item) =>
      String(item?.team?.name ?? '').toLowerCase().includes('shonan')
    );
    if (bellmare?.team?.id) {
      teamId = bellmare.team.id;
    }
  }

  let leagueId = process.env.API_FOOTBALL_LEAGUE_ID
    ? Number(process.env.API_FOOTBALL_LEAGUE_ID)
    : null;
  let season = process.env.API_FOOTBALL_SEASON
    ? Number(process.env.API_FOOTBALL_SEASON)
    : null;
  let leagueName = 'J2 League';

  if (!leagueId || !season) {
    const leaguesRes = await apiGet('/leagues', { team: teamId, current: 'true' });
    const leagues = leaguesRes.response ?? [];
    // Prefer domestic J1 / J2 / J3 league over cups
    const domesticLeague =
      leagues.find(
        (l) =>
          l?.league?.type === 'League' &&
          /J[123]\s*League/i.test(String(l?.league?.name ?? ''))
      ) ?? leagues.find((l) => l?.league?.type === 'League') ?? leagues[0];

    if (domesticLeague) {
      leagueId = leagueId ?? domesticLeague.league.id;
      leagueName = domesticLeague.league.name;
      const currentSeasonObj =
        (domesticLeague.seasons ?? []).find((s) => s.current) ??
        domesticLeague.seasons?.at(-1);
      season = season ?? currentSeasonObj?.year ?? new Date().getUTCFullYear();
    } else {
      leagueId = leagueId ?? 99;
      season = season ?? new Date().getUTCFullYear();
    }
  }

  console.log(`Resolved target: teamId=${teamId}, leagueId=${leagueId} (${leagueName}), season=${season}`);
  return { teamId, leagueId, season, leagueName };
}

async function syncStandings(leagueId, season, teamId, leagueName) {
  const res = await apiGet('/standings', { league: leagueId, season });
  const leagueObj = res.response?.[0]?.league;
  const rows = leagueObj?.standings?.[0] ?? [];

  if (rows.length === 0) {
    console.warn('No standings returned from API-Football; keeping existing standings.json');
    return null;
  }

  const standingsData = {
    season: formatSeasonLabel(season),
    competition: toJaCompetitionName(leagueObj?.name ?? leagueName),
    standings: rows.map((row) => ({
      rank: row.rank,
      team: toJaTeamName(row.team?.name),
      played: row.all?.played ?? 0,
      won: row.all?.win ?? 0,
      drawn: row.all?.draw ?? 0,
      lost: row.all?.lose ?? 0,
      gd: row.goalsDiff ?? 0,
      points: row.points ?? 0,
      is_target: row.team?.id === teamId,
    })),
  };

  await writeJson('standings.json', standingsData);
  console.log(`Updated standings.json (${standingsData.standings.length} teams)`);
  return standingsData;
}

async function syncMatches(leagueId, season, teamId) {
  const existing = await readExistingJson('matches.json');
  const existingById = new Map((existing?.matches ?? []).map((m) => [m.id, m]));

  const res = await apiGet('/fixtures', {
    league: leagueId,
    season,
    team: teamId,
  });
  const fixtures = res.response ?? [];

  if (fixtures.length === 0) {
    console.warn('No fixtures returned from API-Football; keeping existing matches.json');
    return null;
  }

  // Sort newest first for detail fetching priority
  const sortedFixtures = [...fixtures].sort(
    (a, b) => new Date(b.fixture.date).getTime() - new Date(a.fixture.date).getTime()
  );

  let detailFetchCount = 0;
  const matches = [];

  for (const item of sortedFixtures) {
    const fixtureId = String(item.fixture.id);
    const isHome = item.teams.home.id === teamId;
    const opponentObj = isHome ? item.teams.away : item.teams.home;
    const finished = isFinishedStatus(item.fixture.status?.short);
    const prev = existingById.get(fixtureId);

    let result = null;
    let lineup = prev?.lineup ?? null;
    let stats = prev?.stats ?? null;

    if (finished) {
      const bellmareScore = isHome ? (item.goals.home ?? 0) : (item.goals.away ?? 0);
      const opponentScore = isHome ? (item.goals.away ?? 0) : (item.goals.home ?? 0);
      let scorers = prev?.result?.scorers ?? [];

      const needsDetails =
        (!lineup || !stats || (bellmareScore > 0 && scorers.length === 0)) &&
        detailFetchCount < MAX_DETAIL_FETCH;

      if (needsDetails) {
        detailFetchCount += 1;
        console.log(`Fetching details for finished fixture ${fixtureId} (${item.league.round})...`);

        const [eventsRes, lineupsRes, statsRes] = await Promise.all([
          apiGet('/fixtures/events', { fixture: fixtureId, team: teamId }),
          apiGet('/fixtures/lineups', { fixture: fixtureId, team: teamId }),
          apiGet('/fixtures/statistics', { fixture: fixtureId, team: teamId }),
        ]);

        // Scorers
        const goalEvents = (eventsRes.response ?? []).filter(
          (ev) => ev.type === 'Goal' && ev.detail !== 'Missed Penalty'
        );
        scorers = goalEvents.map((ev) => {
          const min = ev.time?.extra
            ? `${ev.time.elapsed}+${ev.time.extra}'`
            : `${ev.time?.elapsed ?? ''}'`;
          const playerName = ev.player?.name ?? '不明';
          const ogSuffix = ev.detail === 'Own Goal' ? ' (OG)' : '';
          return `${playerName} ${min}${ogSuffix}`.trim();
        });

        // Lineup
        const teamLineup = lineupsRes.response?.[0];
        if (teamLineup) {
          lineup = {
            formation: teamLineup.formation || '3-1-4-2',
            starters: (teamLineup.startXI ?? [])
              .map((entry) => entry.player?.number)
              .filter((n) => typeof n === 'number'),
            substitutes: (teamLineup.substitutes ?? [])
              .map((entry) => entry.player?.number)
              .filter((n) => typeof n === 'number'),
          };
        }

        // Stats
        const statList = statsRes.response?.[0]?.statistics ?? [];
        if (statList.length > 0) {
          const getStat = (type) =>
            parseIntSafe(statList.find((s) => s.type === type)?.value);
          stats = {
            possession: getStat('Ball Possession'),
            shots: getStat('Total Shots'),
            shots_on_target: getStat('Shots on Goal'),
            corners: getStat('Corner Kicks'),
          };
        }
      }

      result = {
        bellmare_score: bellmareScore,
        opponent_score: opponentScore,
        scorers,
      };
    }

    matches.push({
      id: fixtureId,
      round: toJaRound(item.league?.round),
      kickoff: toJstIso(item.fixture.date),
      is_home: isHome,
      opponent: toJaTeamName(opponentObj?.name),
      stadium: toJaStadiumName(item.fixture.venue?.name),
      status: finished ? 'finished' : 'scheduled',
      ticket_url: finished ? null : TICKET_URL,
      result,
      lineup,
      stats,
    });
  }

  const matchesData = {
    season: formatSeasonLabel(season),
    matches,
  };

  await writeJson('matches.json', matchesData);
  console.log(`Updated matches.json (${matches.length} matches, fetched ${detailFetchCount} detail sets)`);
  return matchesData;
}

async function syncPlayers(leagueId, season, teamId) {
  const squadRes = await apiGet('/players/squads', { team: teamId });
  const squadPlayers = squadRes.response?.[0]?.players ?? [];

  // Fetch season stats (page 1 & 2 if needed, max 2 pages to stay frugal with free tier)
  const statsByPlayerId = new Map();
  try {
    for (let page = 1; page <= 2; page += 1) {
      const statsRes = await apiGet('/players', {
        team: teamId,
        league: leagueId,
        season,
        page,
      });
      for (const entry of statsRes.response ?? []) {
        const pid = entry.player?.id;
        if (!pid) continue;
        const st = entry.statistics?.[0];
        statsByPlayerId.set(pid, {
          height: parseIntSafe(entry.player?.height),
          weight: parseIntSafe(entry.player?.weight),
          apps: st?.games?.appearences ?? 0,
          goals: st?.goals?.total ?? 0,
          assists: st?.goals?.assists ?? 0,
        });
      }
      const totalPages = statsRes.paging?.total ?? 1;
      if (page >= totalPages) break;
    }
  } catch (err) {
    console.warn(
      `API-Football /players season stats unavailable (${err.message}); using /players/squads only.`
    );
  }

  if (squadPlayers.length === 0) {
    console.warn('No squad players returned from API-Football; keeping existing players.json');
    return null;
  }

  const players = squadPlayers
    .filter((p) => typeof p.number === 'number')
    .map((p) => {
      const st = statsByPlayerId.get(p.id);
      return {
        number: p.number,
        name: p.name ?? `#${p.number}`,
        kana: '',
        position: mapPosition(p.position),
        height: st?.height || 0,
        weight: st?.weight || 0,
        apps: st?.apps ?? 0,
        goals: st?.goals ?? 0,
        assists: st?.assists ?? 0,
      };
    })
    .sort((a, b) => a.number - b.number);

  const playersData = {
    season: formatSeasonLabel(season),
    players,
  };

  await writeJson('players.json', playersData);
  console.log(`Updated players.json (${players.length} players)`);
  return playersData;
}

function isPlanOrSeasonRestriction(err) {
  const msg = String(err?.message ?? '').toLowerCase();
  return (
    msg.includes('free plans') ||
    msg.includes('"plan"') ||
    msg.includes('do not have access to this season') ||
    msg.includes('requests limit') ||
    msg.includes('rate limit')
  );
}

async function main() {
  if (!API_KEY) {
    console.log(
      'API_FOOTBALL_KEY is not set. Falling back directly to TheSportsDB free API...'
    );
    await syncFromTheSportsDB();
    return;
  }

  let standingsSynced = false;
  let matchesSynced = false;
  let playersSynced = false;
  let resolvedSeason = process.env.API_FOOTBALL_SEASON
    ? Number(process.env.API_FOOTBALL_SEASON)
    : undefined;

  try {
    const { teamId, leagueId, season, leagueName } = await resolveTeamAndLeague();
    resolvedSeason = season;

    try {
      const standings = await syncStandings(leagueId, season, teamId, leagueName);
      standingsSynced = Boolean(standings);
    } catch (err) {
      console.warn(`API-Football standings failed: ${err.message}`);
      if (!isPlanOrSeasonRestriction(err)) {
        console.warn('Will attempt TheSportsDB fallback for standings.');
      }
    }

    try {
      const matches = await syncMatches(leagueId, season, teamId);
      matchesSynced = Boolean(matches);
    } catch (err) {
      console.warn(`API-Football matches failed: ${err.message}`);
      if (!isPlanOrSeasonRestriction(err)) {
        console.warn('Will attempt TheSportsDB fallback for matches.');
      }
    }

    try {
      const players = await syncPlayers(leagueId, season, teamId);
      playersSynced = Boolean(players);
    } catch (err) {
      console.warn(`API-Football players failed: ${err.message}`);
    }
  } catch (err) {
    console.warn(`API-Football initialization failed (${err.message}); falling back to TheSportsDB.`);
  }

  if (!standingsSynced || !matchesSynced || !playersSynced) {
    console.log(
      `Triggering TheSportsDB free API fallback (standings=${!standingsSynced}, matches=${!matchesSynced}, players=${!playersSynced})...`
    );
    const fallbackResult = await syncFromTheSportsDB({
      season: resolvedSeason,
      skipStandings: standingsSynced,
      skipMatches: matchesSynced,
      skipPlayers: playersSynced,
      skipMeta: true,
    });
    standingsSynced = standingsSynced || fallbackResult.standingsUpdated;
    matchesSynced = matchesSynced || fallbackResult.matchesUpdated;
    playersSynced = playersSynced || fallbackResult.playersUpdated;
  }

  if (!standingsSynced && !matchesSynced && !playersSynced) {
    throw new Error('Neither API-Football nor TheSportsDB returned any updated data.');
  }

  const metaData = {
    updated_at: toJstIso(new Date().toISOString()),
    schema_version: 1,
  };
  await writeJson('meta.json', metaData);
  console.log(`Updated meta.json (total API-Football requests used: ${requestCount})`);
}

main().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
