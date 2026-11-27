#!/usr/bin/env node
/**
 * Parse human-pasted plain text files in data/raw/{season}.txt into
 * public/api/v1/seasons/{season}.json.
 *
 * Each text file uses simple section headers:
 *   [META]
 *   [STANDINGS]
 *   [MATCHES]
 *   [PLAYERS]
 *
 * Empty sections are skipped so existing JSON sections are preserved.
 * Stable cross-season player_ids are maintained in data/player-ids.json.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const RAW_DIR = path.join(ROOT_DIR, 'data/raw');
const PLAYER_IDS_PATH = path.join(ROOT_DIR, 'data/player-ids.json');
const SEASONS_OUT_DIR = path.join(ROOT_DIR, 'public/api/v1/seasons');
const TICKET_URL = 'https://www.jleague-ticket.jp/club/sb/';

function normalizeNameKey(name) {
  return String(name ?? '').replace(/[\s\u3000]+/g, '').trim();
}

function toInt(val, fallback = 0) {
  const m = String(val ?? '').replace(/,/g, '').match(/-?\d+/);
  return m ? Number(m[0]) : fallback;
}

function splitRow(line) {
  if (line.includes('\t')) {
    return line.split('\t').map((c) => c.trim());
  }
  if (line.includes(',')) {
    return line.split(',').map((c) => c.trim());
  }
  return line.trim().split(/\s{2,}|\s+/).map((c) => c.trim());
}

function parseSections(rawText) {
  const sections = { META: [], STANDINGS: [], MATCHES: [], PLAYERS: [] };
  let current = null;
  for (const rawLine of rawText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const header = line.match(/^\[(META|STANDINGS|MATCHES|PLAYERS)\]$/i);
    if (header) {
      current = header[1].toUpperCase();
      continue;
    }
    if (current) {
      sections[current].push(rawLine.trimEnd());
    }
  }
  return sections;
}

function parseMeta(lines, fallbackId) {
  const meta = {
    id: fallbackId,
    label: fallbackId,
    competition: 'J1リーグ',
    manager: '',
    note: '',
  };
  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const val = line.slice(idx + 1).trim();
    if (key in meta) meta[key] = val;
  }
  return meta;
}

function parseStandings(lines) {
  const rows = [];
  for (const rawLine of lines) {
    const cols = splitRow(rawLine).filter((c) => c !== '');
    if (cols.length < 7) continue;
    // Skip header row
    if (/順位|rank|チーム/i.test(cols[0]) || /チーム|team/i.test(cols[1])) continue;

    const rank = toInt(cols[0], 0);
    if (rank <= 0) continue;
    const team = cols[1];
    const nums = cols.slice(2).map((c) => toInt(c, 0));

    let played = 0;
    let won = 0;
    let drawn = 0;
    let lost = 0;
    let gd = 0;
    let points = 0;

    // Support J.League Data Site order: [rank, team, points, played, won, drawn, lost, gf, ga, gd]
    if (nums.length >= 8 && nums[2] + nums[3] + nums[4] === nums[1]) {
      points = nums[0];
      played = nums[1];
      won = nums[2];
      drawn = nums[3];
      lost = nums[4];
      gd = nums[7];
    } else if (nums.length >= 6 && nums[1] + nums[2] + nums[3] === nums[0]) {
      // Standard order: [rank, team, played, won, drawn, lost, gd, points] (or with gf, ga)
      played = nums[0];
      won = nums[1];
      drawn = nums[2];
      lost = nums[3];
      if (nums.length >= 8) {
        gd = nums[6];
        points = nums[7];
      } else {
        gd = nums[4];
        points = nums[5];
      }
    } else {
      // Best-effort fallback
      played = nums[0] ?? 0;
      won = nums[1] ?? 0;
      drawn = nums[2] ?? 0;
      lost = nums[3] ?? 0;
      gd = nums[4] ?? 0;
      points = nums[5] ?? won * 3 + drawn;
    }

    rows.push({
      rank,
      team,
      played,
      won,
      drawn,
      lost,
      gd,
      points,
      is_target: team.includes('湘南'),
    });
  }
  return rows.sort((a, b) => a.rank - b.rank);
}

function normalizeDateToJst(dateStr, timeStr, seasonId) {
  const defaultYear = Number(String(seasonId).match(/^(\d{4})/)?.[1] ?? 2026);
  let y = defaultYear;
  let m = 1;
  let d = 1;

  const ymd = String(dateStr).match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymd) {
    y = Number(ymd[1]);
    m = Number(ymd[2]);
    d = Number(ymd[3]);
  } else {
    const md = String(dateStr).match(/(\d{1,2})[\/\-](\d{1,2})/);
    if (!md) return null;
    m = Number(md[1]);
    d = Number(md[2]);
    if (seasonId === '2026-27' && m <= 6) y = defaultYear + 1;
  }

  const tm = String(timeStr ?? '').match(/(\d{1,2}):(\d{2})/);
  const hh = tm ? String(Number(tm[1])).padStart(2, '0') : '14';
  const mm = tm ? tm[2] : '00';
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${hh}:${mm}:00+09:00`;
}

function parseMatches(lines, seasonId) {
  const matches = [];
  for (const rawLine of lines) {
    const cols = splitRow(rawLine).filter((c) => c !== '');
    if (cols.length < 4) continue;
    if (/^節|round|開催日/i.test(cols[0])) continue;

    // Expected simple format (TSV or CSV):
    // round | date | time | H/A | opponent | stadium | score(e.g. 2-1 or -) | scorers(optional, "/" separated)
    const roundNum = toInt(cols[0], 0);
    const round = roundNum > 0 ? `第${roundNum}節` : cols[0];
    const kickoff = normalizeDateToJst(cols[1], cols[2], seasonId);
    if (!kickoff) continue;

    const haRaw = String(cols[3] ?? '').toUpperCase();
    const isHome = haRaw === 'H' || haRaw.includes('HOME') || haRaw.includes('ホーム');
    const opponent = cols[4] ?? '';
    const stadium = cols[5] ?? (isHome ? 'レモンＳ' : '未定');
    const scoreRaw = cols[6] ?? '';
    const scorersRaw = cols[7] ?? '';

    const scoreMatch = String(scoreRaw).match(/(\d+)\s*[-–:]\s*(\d+)/);
    const finished = Boolean(scoreMatch);

    const scorers = scorersRaw
      ? scorersRaw
          .split(/[\/、,]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const id = roundNum > 0 ? `${seasonId}-r${roundNum}` : `${seasonId}-${kickoff.slice(0, 10)}`;

    matches.push({
      id,
      round,
      kickoff,
      is_home: isHome,
      opponent,
      stadium,
      status: finished ? 'finished' : 'scheduled',
      ticket_url: finished ? null : TICKET_URL,
      result: finished
        ? {
            bellmare_score: Number(scoreMatch[1]),
            opponent_score: Number(scoreMatch[2]),
            scorers,
          }
        : null,
      lineup: null,
      stats: null,
    });
  }
  return matches.sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime());
}

function normalizePosition(raw) {
  const p = String(raw ?? '').toUpperCase().trim();
  if (p.includes('GK') || p.includes('GOAL')) return 'GK';
  if (p.includes('DF') || p.includes('DEF')) return 'DF';
  if (p.includes('MF') || p.includes('MID')) return 'MF';
  if (p.includes('FW') || p.includes('FOR')) return 'FW';
  return 'MF';
}

function makeFallbackPlayerId(name, number, seasonId) {
  const ascii = String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return ascii || `player-${seasonId}-${number}`;
}

function parsePlayers(lines, seasonId, playerIdMap) {
  const players = [];
  const usedNumbers = new Set();

  for (const rawLine of lines) {
    const cols = splitRow(rawLine);
    if (cols.length < 3) continue;
    if (/背番号|no|number/i.test(cols[0])) continue;

    // Format: number | name | position | height | weight | apps | goals | assists | kana(optional) | id(optional)
    const number = toInt(cols[0], 0);
    const name = String(cols[1] ?? '').trim();
    if (!number || number <= 0 || !name || usedNumbers.has(number)) continue;
    usedNumbers.add(number);

    const position = normalizePosition(cols[2]);
    const height = toInt(cols[3], 0);
    const weight = toInt(cols[4], 0);
    const apps = toInt(cols[5], 0);
    const goals = toInt(cols[6], 0);
    const assists = toInt(cols[7], 0);
    const kana = String(cols[8] ?? '').trim();
    const explicitId = String(cols[9] ?? '').trim();

    const nameKey = normalizeNameKey(name);
    let id = explicitId || playerIdMap[nameKey];
    if (!id) {
      id = makeFallbackPlayerId(name, number, seasonId);
      playerIdMap[nameKey] = id;
    } else if (explicitId && !playerIdMap[nameKey]) {
      playerIdMap[nameKey] = explicitId;
    }

    players.push({
      id,
      number,
      name,
      kana,
      position,
      height,
      weight,
      apps,
      goals,
      assists,
    });
  }

  return players.sort((a, b) => a.number - b.number);
}

async function loadPlayerIdMap() {
  try {
    return JSON.parse(await fs.readFile(PLAYER_IDS_PATH, 'utf8'));
  } catch {
    return {};
  }
}

async function main() {
  await fs.mkdir(RAW_DIR, { recursive: true });
  await fs.mkdir(SEASONS_OUT_DIR, { recursive: true });

  const playerIdMap = await loadPlayerIdMap();
  const files = (await fs.readdir(RAW_DIR)).filter((f) => f.endsWith('.txt')).sort();

  if (files.length === 0) {
    console.log('No .txt files found in data/raw/.');
    return;
  }

  for (const file of files) {
    const seasonId = file.replace(/\.txt$/, '');
    const rawText = await fs.readFile(path.join(RAW_DIR, file), 'utf8');
    const sections = parseSections(rawText);
    const meta = parseMeta(sections.META, seasonId);

    const outPath = path.join(SEASONS_OUT_DIR, `${seasonId}.json`);
    let existing = null;
    try {
      existing = JSON.parse(await fs.readFile(outPath, 'utf8'));
    } catch {
      existing = null;
    }

    const standings =
      sections.STANDINGS.length > 0 ? parseStandings(sections.STANDINGS) : existing?.standings ?? [];
    const matches =
      sections.MATCHES.length > 0
        ? parseMatches(sections.MATCHES, seasonId)
        : existing?.matches ?? [];
    const players =
      sections.PLAYERS.length > 0
        ? parsePlayers(sections.PLAYERS, seasonId, playerIdMap)
        : existing?.players ?? [];

    // Recompute summary from target standing row if available
    const targetRow = standings.find((r) => r.is_target);
    const finishedMatches = matches.filter((m) => m.status === 'finished' && m.result);
    const gfFromMatches = finishedMatches.reduce((acc, m) => acc + m.result.bellmare_score, 0);
    const gaFromMatches = finishedMatches.reduce((acc, m) => acc + m.result.opponent_score, 0);

    const summary = targetRow
      ? {
          rank: targetRow.rank,
          played: targetRow.played,
          won: targetRow.won,
          drawn: targetRow.drawn,
          lost: targetRow.lost,
          gf: finishedMatches.length === targetRow.played ? gfFromMatches : existing?.summary?.gf ?? 0,
          ga: finishedMatches.length === targetRow.played ? gaFromMatches : existing?.summary?.ga ?? 0,
          gd: targetRow.gd,
          points: targetRow.points,
        }
      : existing?.summary ?? {
          rank: 0,
          played: finishedMatches.length,
          won: finishedMatches.filter((m) => m.result.bellmare_score > m.result.opponent_score).length,
          drawn: finishedMatches.filter((m) => m.result.bellmare_score === m.result.opponent_score).length,
          lost: finishedMatches.filter((m) => m.result.bellmare_score < m.result.opponent_score).length,
          gf: gfFromMatches,
          ga: gaFromMatches,
          gd: gfFromMatches - gaFromMatches,
          points:
            finishedMatches.filter((m) => m.result.bellmare_score > m.result.opponent_score).length * 3 +
            finishedMatches.filter((m) => m.result.bellmare_score === m.result.opponent_score).length,
        };

    const output = {
      id: meta.id,
      label: meta.label || existing?.label || seasonId,
      competition: meta.competition || existing?.competition || 'J1リーグ',
      manager: meta.manager || existing?.manager || '',
      note: meta.note || existing?.note || '',
      summary,
      standings,
      matches,
      players,
    };

    await fs.writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
    console.log(
      `[import:raw] ${file} -> seasons/${seasonId}.json (standings=${standings.length}, matches=${matches.length}, players=${players.length})`
    );
  }

  await fs.writeFile(PLAYER_IDS_PATH, `${JSON.stringify(playerIdMap, null, 2)}\n`, 'utf8');
}

main().catch((err) => {
  console.error('[import:raw] Failed:', err);
  process.exit(1);
});
