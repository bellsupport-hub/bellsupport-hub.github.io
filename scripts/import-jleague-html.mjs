#!/usr/bin/env node
/**
 * Parse saved J.League Data Site HTML files in data/raw/ into public/api/v1/ JSON:
 *   - *_日程.html     -> Full season match schedule & results (kickoff, score, H/A, stadium)
 *   - *_出場記録.html -> Per-match exact starters (11), substitutes, scorers (①/②/③), and player apps/goals
 *   - *通算記録*.html -> All-time club record (public/api/v1/club_history.json)
 *
 * File prefix -> SeasonId mapping:
 *   26_27_*   -> 2026-27
 *   26_sp_* / 2026_special_* -> 2026-special
 *   2025_* / 25_* -> 2025
 *   2024_* / 24_* -> 2024
 *   2023_* / 23_* -> 2023
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
const TICKET_URL = 'https://www.jleague-ticket.jp/club/sb/';

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

function parseScheduleHtml(html, seasonId) {
  const tables = extractTables(html);
  const matches = [];

  for (const rows of tables) {
    for (const cells of rows) {
      if (cells.length < 9) continue;
      // [season, comp, round, date, time, home, scoreOrVs, away, stadium, attendance?, tv?]
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

function parseAppearanceHtml(html) {
  const tables = extractTables(html);
  const roundDetails = new Map(); // roundNum -> { starters: number[], substitutes: number[], scorers: string[] }
  const playerStats = new Map(); // number -> { number, name, apps, goals }

  for (const rows of tables) {
    if (rows.length < 7) continue;
    const headerRow = rows[0];
    if (!headerRow || headerRow[1] !== '節') continue;

    // Map column index (in player rows, offset +3 compared to headerRow:
    // headerRow: [0:team, 1:'節', 2:'第１節', 3:'第２節', ...]
    // playerRow: [0:No, 1:選手, 2:出場, 3:時間, 4:得点, 5:roundCol0, 6:roundCol1, ...]
    const roundCols = [];
    for (let c = 2; c < headerRow.length; c += 1) {
      const m = toHalfWidth(headerRow[c]).match(/第(\d+)節/);
      if (m) {
        roundCols.push({ roundNum: Number(m[1]), playerColIdx: c + 3 });
      }
    }

    // Player rows start at row 6 (row 5 is No. / 選手 / 出場 / 時間 / 得点)
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

        // ○ or ▽ = Starter; ▲ or ◆ or SUB = Substitute
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

  return { roundDetails, playerStats };
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
    let existing = {
      id: seasonId,
      label: seasonId,
      competition: seasonId === '2026-27' ? 'J2リーグ' : 'J1リーグ',
      manager: '',
      note: '',
      summary: { rank: 0, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 },
      standings: [],
      matches: [],
      players: [],
    };
    try {
      existing = JSON.parse(await fs.readFile(outPath, 'utf8'));
    } catch {
      // Use default skeleton
    }

    let matches = existing.matches;
    if (group.schedule) {
      const schedHtml = await fs.readFile(path.join(RAW_DIR, group.schedule), 'utf8');
      matches = parseScheduleHtml(schedHtml, seasonId);
      console.log(`[import:html] ${group.schedule}: parsed ${matches.length} matches`);
    }

    if (group.appearance) {
      const appHtml = await fs.readFile(path.join(RAW_DIR, group.appearance), 'utf8');
      const { roundDetails, playerStats } = parseAppearanceHtml(appHtml);

      // Update player apps/goals from official appearance matrix
      const existingPlayerByNum = new Map((existing.players ?? []).map((p) => [p.number, p]));
      for (const [num, st] of playerStats.entries()) {
        const prev = existingPlayerByNum.get(num);
        if (prev) {
          prev.apps = st.apps;
          prev.goals = st.goals;
        } else {
          const key = normalizeNameKey(st.name);
          const id = playerIdMap[key] || `player-${seasonId}-${num}`;
          playerIdMap[key] = id;
          existingPlayerByNum.set(num, {
            id,
            number: num,
            name: st.name,
            kana: '',
            position: 'MF',
            height: 0,
            weight: 0,
            apps: st.apps,
            goals: st.goals,
            assists: 0,
          });
        }
      }
      existing.players = [...existingPlayerByNum.values()].sort((a, b) => a.number - b.number);

      // Position sort helper so GK is always index 0 in starters array (for formation pitch UI)
      const posOrder = { GK: 0, DF: 1, MF: 2, FW: 3 };
      const sortByPosition = (nums) =>
        [...nums].sort((a, b) => {
          const pa = posOrder[existingPlayerByNum.get(a)?.position ?? 'MF'] ?? 2;
          const pb = posOrder[existingPlayerByNum.get(b)?.position ?? 'MF'] ?? 2;
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
        `[import:html] ${group.appearance}: enriched ${enrichedMatches} matches with exact starters/subs/scorers & ${playerStats.size} players`
      );
    }

    // Recompute summary from finished matches
    const finished = matches.filter((m) => m.status === 'finished' && m.result);
    const won = finished.filter((m) => m.result.bellmare_score > m.result.opponent_score).length;
    const drawn = finished.filter((m) => m.result.bellmare_score === m.result.opponent_score).length;
    const lost = finished.filter((m) => m.result.bellmare_score < m.result.opponent_score).length;
    const gf = finished.reduce((acc, m) => acc + m.result.bellmare_score, 0);
    const ga = finished.reduce((acc, m) => acc + m.result.opponent_score, 0);

    existing.matches = matches;
    existing.summary = {
      ...existing.summary,
      played: finished.length,
      won,
      drawn,
      lost,
      gf,
      ga,
      gd: gf - ga,
      points: won * 3 + drawn,
    };

    await fs.writeFile(outPath, `${JSON.stringify(existing, null, 2)}\n`, 'utf8');
    console.log(
      `[import:html] Wrote seasons/${seasonId}.json (${finished.length} finished / ${matches.length} total matches, ${existing.players.length} players)`
    );
  }

  await fs.writeFile(PLAYER_IDS_PATH, `${JSON.stringify(playerIdMap, null, 2)}\n`, 'utf8');
}

main().catch((err) => {
  console.error('[import:html] Failed:', err);
  process.exit(1);
});
