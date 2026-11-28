#!/usr/bin/env node
/**
 * Parse saved J.League Data Site HTML files in data/raw/ into public/api/v1/ JSON:
 *   - *_日程.html     -> Full season match schedule & results (exact kickoff time, score, H/A, stadium)
 *   - *_出場記録.html -> Builds full season matches (if no 日程.html) + exact starters (11),
 *                        substitutes, scorers (①/②/③), and player apps/goals
 *   - *通算記録*.html -> All-time club record (public/api/v1/club_history.json)
 *
 * File prefix -> SeasonId mapping:
 *   26_27_* / 2026_27_*      -> 2026-27
 *   26_sp_* / 2026_special_* -> 2026-special
 *   25_* / 2025*             -> 2025
 *   24_* / 2024*             -> 2024
 *   23_* / 2023*             -> 2023
 *   22_* / 2022*             -> 2022
 *   21_* / 2021*             -> 2021
 *   20_* / 2020*             -> 2020
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const RAW_DIR = path.join(ROOT_DIR, 'data/raw');
const API_DIR = path.join(ROOT_DIR, 'public/api/v1');
const SEASONS_DIR = path.join(API_DIR, 'seasons');
const PLAYER_IDS_PATH = path.join(ROOT_DIR, 'data/player-ids.json');
const TICKET_URL = 'https://www.jleague-ticket.jp/club/bm/';

const SEASON_DEFAULTS = {
  '2026-27': { label: '2026-27', competition: 'J2リーグ', manager: '長澤 徹', rank: 8 },
  '2026-special': { label: '2026特別大会', competition: 'J2・J3百年構想リーグ', manager: '長澤 徹', rank: 12 },
  '2025': { label: '2025', competition: 'J1リーグ', manager: '山口 智', rank: 19 },
  '2024': { label: '2024', competition: 'J1リーグ', manager: '山口 智', rank: 15 },
  '2023': { label: '2023', competition: 'J1リーグ', manager: '山口 智', rank: 15 },
  '2022': { label: '2022', competition: 'J1リーグ', manager: '山口 智', rank: 12 },
  '2021': { label: '2021', competition: 'J1リーグ', manager: '浮嶋 敏 / 山口 智', rank: 16 },
  '2020': { label: '2020', competition: 'J1リーグ', manager: '浮嶋 敏', rank: 18 },
};

const CIRCLED_NUMS = {
  '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5,
  '⑥': 6, '⑦': 7, '⑧': 8, '⑨': 9,
};

function toHalfWidth(str) {
  return String(str ?? '')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/：/g, ':')
    .replace(/／/g, '/')
    .replace(/－/g, '-')
    .replace(/　/g, ' ');
}

function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTables(html) {
  const tables = [];
  for (const tm of html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)) {
    const rows = [];
    for (const rm of tm[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...rm[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((cm) =>
        stripTags(cm[1])
      );
      rows.push(cells);
    }
    tables.push(rows);
  }
  return tables;
}

function normalizeNameKey(name) {
  return String(name ?? '').replace(/[\s\u3000]+/g, '').trim();
}

function detectSeasonId(filename) {
  const base = path.basename(filename);
  if (/^(26_27|2026[_-]27)/i.test(base)) return '2026-27';
  if (/^(26_sp|2026[_-]sp|百年)/i.test(base)) return '2026-special';
  if (/^(25_|2025)/i.test(base)) return '2025';
  if (/^(24_|2024)/i.test(base)) return '2024';
  if (/^(23_|2023)/i.test(base)) return '2023';
  if (/^(22_|2022)/i.test(base)) return '2022';
  if (/^(21_|2021)/i.test(base)) return '2021';
  if (/^(20_|2020)/i.test(base)) return '2020';
  return null;
}

function parseJDate(dateRaw, timeRaw) {
  const d = toHalfWidth(dateRaw);
  const m = d.match(/(\d{2,4})\/(\d{1,2})\/(\d{1,2})/);
  if (!m) return null;
  let year = Number(m[1]);
  if (year < 100) year += 2000;
  const month = String(Number(m[2])).padStart(2, '0');
  const day = String(Number(m[3])).padStart(2, '0');

  const t = toHalfWidth(timeRaw);
  const tm = t.match(/(\d{1,2}):(\d{2})/);
  const hh = tm ? String(Number(tm[1])).padStart(2, '0') : '14';
  const mm = tm ? tm[2] : '00';
  return `${year}-${month}-${day}T${hh}:${mm}:00+09:00`;
}

function isBellmareHomeStadium(stadium) {
  const s = toHalfWidth(stadium);
  return /レモン|BMW|平塚|国立/.test(s);
}

function parseScheduleHtml(html, seasonId) {
  const tables = extractTables(html);
  const matches = [];

  for (const rows of tables) {
    for (const cells of rows) {
      if (cells.length < 9) continue;
      const roundText = toHalfWidth(cells[2]);
      const roundMatch = roundText.match(/第(\d+)節/);
      if (!roundMatch) continue;
      const roundNum = Number(roundMatch[1]);
      const kickoff = parseJDate(cells[3], cells[4]);
      if (!kickoff) continue;

      const home = cells[5];
      const scoreOrVs = toHalfWidth(cells[6]);
      const away = cells[7];
      const stadium = cells[8];

      const isHome = home.includes('湘南');
      const opponent = isHome ? away : home;
      const scoreMatch = scoreOrVs.match(/^(\d+)\s*-\s*(\d+)$/);
      const finished = Boolean(scoreMatch);

      let result = null;
      if (finished) {
        const homeScore = Number(scoreMatch[1]);
        const awayScore = Number(scoreMatch[2]);
        result = {
          bellmare_score: isHome ? homeScore : awayScore,
          opponent_score: isHome ? awayScore : homeScore,
          scorers: [],
        };
      }

      matches.push({
        id: `${seasonId}-r${roundNum}`,
        round: `第${roundNum}節`,
        kickoff,
        is_home: isHome,
        opponent,
        stadium,
        status: finished ? 'finished' : 'scheduled',
        ticket_url: finished ? null : TICKET_URL,
        result,
        lineup: null,
        stats: null,
      });
    }
  }

  return matches.sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime());
}

function countGoalsInCell(cellText) {
  let total = 0;
  for (const [sym, n] of Object.entries(CIRCLED_NUMS)) {
    if (cellText.includes(sym)) total += n;
  }
  return total;
}

function parseAppearanceHtml(html, seasonId) {
  const tables = extractTables(html);
  const roundDetails = new Map(); // roundNum -> { starters, substitutes, scorers }
  const roundMeta = new Map(); // roundNum -> { roundNum, kickoff, stadium, opponent, bellmare_score, opponent_score, finished }
  const playerStats = new Map(); // number -> { number, name, apps, goals }

  const processedRounds = new Set();

  for (const rows of tables) {
    if (rows.length < 7) continue;
    const headerRow = rows[0];
    if (!headerRow || headerRow[1] !== '節') continue;

    const dateRow = rows[1] ?? [];
    const venueRow = rows[2] ?? [];
    const vsRow = rows[3] ?? [];

    // headerRow: [0:team, 1:'節', 2:'第１節', 3:'第２節', ...]
    // dateRow/venueRow/vsRow: [0:'日'/'会場'/'対', 1:col0, 2:col1, ...]  -> index = c - 1
    // playerRow: [0:No, 1:選手, 2:出場, 3:時間, 4:得点, 5:col0, ...] -> index = c + 3
    const roundCols = [];
    for (let c = 2; c < headerRow.length; c += 1) {
      const m = toHalfWidth(headerRow[c]).match(/第(\d+)節/);
      if (!m) continue;
      const roundNum = Number(m[1]);
      if (processedRounds.has(roundNum)) continue;
      processedRounds.add(roundNum);
      roundCols.push({ roundNum, playerColIdx: c + 3 });

      const metaIdx = c - 1;
      const dateText = dateRow[metaIdx] ?? '';
      const venueText = venueRow[metaIdx] ?? '';
      const vsText = toHalfWidth(vsRow[metaIdx] ?? '');
      const kickoff = parseJDate(dateText, '');

      // vsText format: "大分 ○ 1 - 0", "仙台 ● 1 - 3", "宮崎 △ 0 - 0", "栃木SC ☆ 1 - 1" (PK win), "仙台 ★ 1 - 1" (PK loss)
      const vsMatch = vsText.match(/^(.+?)\s+([○●△☆★])\s*(\d+)\s*-\s*(\d+)/);
      if (kickoff && vsMatch) {
        roundMeta.set(roundNum, {
          roundNum,
          kickoff,
          stadium: venueText || '未定',
          opponent: vsMatch[1].trim(),
          symbol: vsMatch[2],
          bellmare_score: Number(vsMatch[3]),
          opponent_score: Number(vsMatch[4]),
          finished: true,
        });
      }
    }

    // Player rows start at row 6
    for (let r = 6; r < rows.length; r += 1) {
      const cells = rows[r];
      if (cells.length < 5) continue;
      const num = Number(toHalfWidth(cells[0]));
      const name = cells[1]?.trim();
      if (!Number.isInteger(num) || num <= 0 || !name) continue;

      const apps = Number(toHalfWidth(cells[2]).replace(/,/g, '')) || 0;
      const goals = Number(toHalfWidth(cells[4]).replace(/,/g, '')) || 0;

      if (!playerStats.has(num)) {
        playerStats.set(num, { number: num, name, apps, goals });
      }

      for (const { roundNum, playerColIdx } of roundCols) {
        const val = cells[playerColIdx] ?? '';
        if (!val) continue;

        if (!roundDetails.has(roundNum)) {
          roundDetails.set(roundNum, { starters: [], substitutes: [], scorers: [] });
        }
        const rd = roundDetails.get(roundNum);

        if (val.includes('○') || val.includes('▽')) {
          if (!rd.starters.includes(num)) rd.starters.push(num);
        } else if (val.includes('▲') || val.includes('◆') || val.includes('SUB')) {
          if (!rd.substitutes.includes(num)) rd.substitutes.push(num);
        }

        const goalCount = countGoalsInCell(val);
        if (goalCount > 0) {
          const cleanName = name.replace(/\s+/g, '');
          rd.scorers.push(goalCount > 1 ? `${cleanName}(${goalCount})` : cleanName);
        }
      }
    }
  }

  // Build matches array from roundMeta (used when *_日程.html is absent)
  const matchesFromAppearance = [...roundMeta.values()]
    .map((rm) => ({
      id: `${seasonId}-r${rm.roundNum}`,
      round: `第${rm.roundNum}節`,
      kickoff: rm.kickoff,
      is_home: isBellmareHomeStadium(rm.stadium),
      opponent: rm.opponent,
      stadium: rm.stadium,
      status: 'finished',
      ticket_url: null,
      result: {
        bellmare_score: rm.bellmare_score,
        opponent_score: rm.opponent_score,
        scorers: [],
      },
      lineup: null,
      stats: null,
      _symbol: rm.symbol,
    }))
    .sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime());

  return { roundDetails, playerStats, matchesFromAppearance };
}

function parseClubHistoryHtml(html) {
  const tables = extractTables(html);
  const records = [];
  for (const rows of tables) {
    if (rows.length < 2 || rows[0][0] !== 'チーム') continue;
    for (let i = 1; i < rows.length; i += 1) {
      const c = rows[i];
      if (c.length < 13) continue;
      records.push({
        team: c[0],
        competition: toHalfWidth(c[1]),
        total_wins: Number(toHalfWidth(c[2])) || 0,
        wins_90: Number(toHalfWidth(c[3])) || 0,
        wins_et: Number(toHalfWidth(c[4])) || 0,
        wins_pk: Number(toHalfWidth(c[5])) || 0,
        draws: Number(toHalfWidth(c[6])) || 0,
        total_losses: Number(toHalfWidth(c[7])) || 0,
        losses_90: Number(toHalfWidth(c[8])) || 0,
        losses_et: Number(toHalfWidth(c[9])) || 0,
        losses_pk: Number(toHalfWidth(c[10])) || 0,
        goals_for: Number(toHalfWidth(c[11])) || 0,
        goals_against: Number(toHalfWidth(c[12])) || 0,
      });
    }
  }
  return records;
}

async function main() {
  const files = (await fs.readdir(RAW_DIR)).filter((f) => f.endsWith('.html')).sort();
  if (files.length === 0) {
    console.log('[import:html] No .html files found in data/raw/.');
    return;
  }

  let playerIdMap = {};
  try {
    playerIdMap = JSON.parse(await fs.readFile(PLAYER_IDS_PATH, 'utf8'));
  } catch {
    playerIdMap = {};
  }

  const bySeason = new Map();
  let clubHistoryFile = null;

  for (const f of files) {
    if (f.includes('通算記録')) {
      clubHistoryFile = f;
      continue;
    }
    const seasonId = detectSeasonId(f);
    if (!seasonId) {
      console.warn(`[import:html] Skipping unrecognized filename: ${f}`);
      continue;
    }
    if (!bySeason.has(seasonId)) bySeason.set(seasonId, {});
    const entry = bySeason.get(seasonId);
    if (f.includes('日程')) entry.schedule = f;
    else if (f.includes('出場記録')) entry.appearance = f;
  }

  // 1. Club all-time history
  if (clubHistoryFile) {
    const html = await fs.readFile(path.join(RAW_DIR, clubHistoryFile), 'utf8');
    const records = parseClubHistoryHtml(html);
    if (records.length > 0) {
      await fs.writeFile(
        path.join(API_DIR, 'club_history.json'),
        `${JSON.stringify({ updated_at: new Date().toISOString(), records }, null, 2)}\n`,
        'utf8'
      );
      console.log(`[import:html] ${clubHistoryFile} -> club_history.json (${records.length} competitions)`);
    }
  }

  // 2. Per-season schedule + appearances
  for (const [seasonId, group] of bySeason.entries()) {
    const outPath = path.join(SEASONS_DIR, `${seasonId}.json`);
    const def = SEASON_DEFAULTS[seasonId] ?? {
      label: seasonId,
      competition: 'J1リーグ',
      manager: '',
      rank: 0,
    };

    let existing = {
      id: seasonId,
      label: def.label,
      competition: def.competition,
      manager: def.manager,
      note: '',
      summary: { rank: def.rank, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 },
      standings: [],
      matches: [],
      players: [],
    };
    try {
      existing = JSON.parse(await fs.readFile(outPath, 'utf8'));
    } catch {
      // New season file (e.g., 2020, 2021, 2022)
    }

    let matches = existing.matches;
    if (group.schedule) {
      const schedHtml = await fs.readFile(path.join(RAW_DIR, group.schedule), 'utf8');
      matches = parseScheduleHtml(schedHtml, seasonId);
      console.log(`[import:html] ${group.schedule}: parsed ${matches.length} matches`);
    }

    if (group.appearance) {
      const appHtml = await fs.readFile(path.join(RAW_DIR, group.appearance), 'utf8');
      const { roundDetails, playerStats, matchesFromAppearance } = parseAppearanceHtml(
        appHtml,
        seasonId
      );

      // If no separate *_日程.html exists, use the full match list extracted from 出場記録.html!
      if (!group.schedule && matchesFromAppearance.length > 0) {
        matches = matchesFromAppearance;
      }

      // Build/update players list (keeping existing position/height/weight/kana if already known)
      const existingPlayerByNum = new Map((existing.players ?? []).map((p) => [p.number, p]));
      const nextPlayers = [];
      for (const [num, st] of playerStats.entries()) {
        const prev = existingPlayerByNum.get(num);
        const key = normalizeNameKey(st.name);
        const id = prev?.id || playerIdMap[key] || `player-${seasonId}-${num}`;
        playerIdMap[key] = id;

        nextPlayers.push({
          id,
          number: num,
          name: st.name,
          kana: prev?.kana ?? '',
          position: prev?.position ?? (num === 1 || num === 21 || num === 31 || num === 99 ? 'GK' : 'MF'),
          height: prev?.height ?? 0,
          weight: prev?.weight ?? 0,
          apps: st.apps,
          goals: st.goals,
          assists: prev?.assists ?? 0,
        });
      }
      // Keep any extra registered players (0 apps) that were already in existing.players
      for (const [num, prev] of existingPlayerByNum.entries()) {
        if (!playerStats.has(num)) {
          nextPlayers.push(prev);
        }
      }
      existing.players = nextPlayers.sort((a, b) => a.number - b.number);

      const playerByNum = new Map(existing.players.map((p) => [p.number, p]));
      const posOrder = { GK: 0, DF: 1, MF: 2, FW: 3 };
      const sortByPosition = (nums) =>
        [...nums].sort((a, b) => {
          const pa = posOrder[playerByNum.get(a)?.position ?? 'MF'] ?? 2;
          const pb = posOrder[playerByNum.get(b)?.position ?? 'MF'] ?? 2;
          return pa !== pb ? pa - pb : a - b;
        });

      let enrichedMatches = 0;
      for (const m of matches) {
        const rm = m.round.match(/第(\d+)節/);
        if (!rm) continue;
        const rd = roundDetails.get(Number(rm[1]));
        if (!rd) continue;

        if (rd.starters.length > 0) {
          m.lineup = {
            formation: m.lineup?.formation || '3-1-4-2',
            starters: sortByPosition(rd.starters),
            substitutes: sortByPosition(rd.substitutes),
          };
          enrichedMatches += 1;
        }
        if (m.status === 'finished' && m.result && rd.scorers.length > 0) {
          m.result.scorers = rd.scorers;
        }
      }

      console.log(
        `[import:html] ${group.appearance}: ${matches.length} matches (${enrichedMatches} with starters/subs/scorers), ${existing.players.length} players`
      );
    }

    // Recompute summary from finished matches (supporting PK wins ☆ and PK losses ★)
    const finished = matches.filter((m) => m.status === 'finished' && m.result);
    const won = finished.filter(
      (m) => m._symbol === '☆' || m.result.bellmare_score > m.result.opponent_score
    ).length;
    const lost = finished.filter(
      (m) => m._symbol === '★' || m.result.bellmare_score < m.result.opponent_score
    ).length;
    const drawn = finished.length - won - lost;
    const gf = finished.reduce((acc, m) => acc + m.result.bellmare_score, 0);
    const ga = finished.reduce((acc, m) => acc + m.result.opponent_score, 0);

    // Strip internal _symbol helper before saving
    existing.matches = matches.map(({ _symbol, ...rest }) => rest);
    existing.summary = {
      rank: existing.summary?.rank || def.rank,
      played: finished.length,
      won,
      drawn,
      lost,
      gf,
      ga,
      gd: gf - ga,
      points: won * 3 + drawn,
    };

    // Ensure standings always has at least Shonan Bellmare's accurate target row
    if (!Array.isArray(existing.standings) || !existing.standings.some((r) => r.is_target)) {
      existing.standings = [
        {
          rank: existing.summary.rank,
          team: '湘南ベルマーレ',
          played: existing.summary.played,
          won: existing.summary.won,
          drawn: existing.summary.drawn,
          lost: existing.summary.lost,
          gd: existing.summary.gd,
          points: existing.summary.points,
          is_target: true,
        },
      ];
    }

    await fs.writeFile(outPath, `${JSON.stringify(existing, null, 2)}\n`, 'utf8');
  }

  await fs.writeFile(PLAYER_IDS_PATH, `${JSON.stringify(playerIdMap, null, 2)}\n`, 'utf8');
}

main().catch((err) => {
  console.error('[import:html] Failed:', err);
  process.exit(1);
});
