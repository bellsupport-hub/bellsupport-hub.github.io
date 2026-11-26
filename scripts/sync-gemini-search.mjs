#!/usr/bin/env node
/**
 * Sync Shonan Bellmare / J2 League data using Gemini API with Google Search Grounding
 * into public/api/v1/*.json.
 *
 * Environment variables:
 *   GEMINI_API_KEY   (required) API key from https://aistudio.google.com/apikey
 *   GEMINI_MODEL     (optional) Default: 'gemini-3.5-flash-lite'
 *   SEASON_LABEL     (optional) Default: auto-computed (e.g., '2026-27')
 *   COMPETITION_NAME (optional) Default: 'J2リーグ'
 *   SYNC_PLAYERS     (optional) 'true' to force refreshing players.json
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_OUT_DIR = path.resolve(__dirname, '../public/api/v1');
const TICKET_URL = 'https://www.jleague-ticket.jp/club/sb/';

const API_KEY = process.env.GEMINI_API_KEY?.trim();
const MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite';
const COMPETITION_NAME = process.env.COMPETITION_NAME?.trim() || 'J2リーグ';
const FORCE_SYNC_PLAYERS = String(process.env.SYNC_PLAYERS ?? '').toLowerCase() === 'true';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toJstIso(dateInput = new Date()) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return String(dateInput);
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(jst.getUTCDate()).padStart(2, '0');
  const hh = String(jst.getUTCHours()).padStart(2, '0');
  const mm = String(jst.getUTCMinutes()).padStart(2, '0');
  const ss = String(jst.getUTCSeconds()).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}+09:00`;
}

function getTodayJstDate() {
  return toJstIso(new Date()).slice(0, 10);
}

function resolveSeasonLabel() {
  if (process.env.SEASON_LABEL?.trim()) return process.env.SEASON_LABEL.trim();
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  if (year >= 2026) {
    const startYear = month >= 7 ? year : year - 1;
    return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
  }
  return String(year);
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

function extractJsonFromText(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) {
    throw new Error('Empty response text from Gemini');
  }

  // Prefer fenced ```json ... ``` block if present
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    // Fallback: slice from first '{' to last '}'
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
    }
    throw new Error(`Could not parse JSON from Gemini response: ${trimmed.slice(0, 200)}`);
  }
}

let apiCallCount = 0;

async function callGeminiWithSearch(prompt, attempt = 1) {
  apiCallCount += 1;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': API_KEY,
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      tools: [{ google_search: {} }],
    }),
  });

  if ((res.status === 429 || res.status === 503) && attempt <= 3) {
    const waitMs = attempt * 15_000;
    console.warn(`[Gemini] HTTP ${res.status}; retrying in ${waitMs / 1000}s (attempt ${attempt})...`);
    await sleep(waitMs);
    return callGeminiWithSearch(prompt, attempt + 1);
  }

  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`Gemini API HTTP ${res.status}: ${bodyText.slice(0, 300)}`);
  }

  const json = JSON.parse(bodyText);
  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .map((p) => (typeof p?.text === 'string' ? p.text : ''))
    .join('\n')
    .trim();

  const searchQueries =
    json?.candidates?.[0]?.groundingMetadata?.webSearchQueries ?? [];
  if (searchQueries.length > 0) {
    console.log(`[Gemini] Grounding queries: ${searchQueries.join(' | ')}`);
  }

  return extractJsonFromText(text);
}

function toInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function normalizePosition(raw) {
  const p = String(raw ?? '').toUpperCase().trim();
  if (p === 'GK' || p.includes('GOAL')) return 'GK';
  if (p === 'DF' || p.includes('DEF')) return 'DF';
  if (p === 'MF' || p.includes('MID')) return 'MF';
  if (p === 'FW' || p.includes('FOR') || p.includes('ATT')) return 'FW';
  return 'MF';
}

function normalizeKickoffJst(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  // Already ISO with timezone
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?[+-]\d{2}:\d{2}$/.test(s)) {
    const normalized = s.length === 22 ? `${s.slice(0, 16)}:00${s.slice(16)}` : s;
    const d = new Date(normalized);
    return Number.isNaN(d.getTime()) ? null : toJstIso(d);
  }
  // Date + time without timezone -> treat as JST
  const localMatch = s.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})(?::(\d{2}))?$/);
  if (localMatch) {
    return `${localMatch[1]}T${localMatch[2]}:${localMatch[3] ?? '00'}+09:00`;
  }
  // Date only -> default 14:00 JST
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return `${s}T14:00:00+09:00`;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : toJstIso(d);
}

async function syncStandings(seasonLabel, todayJst) {
  const prompt = `今日は ${todayJst}（JST）です。
Google 検索を使って、${seasonLabel} シーズンの ${COMPETITION_NAME} の最新順位表（全チーム分）を調べてください。

出力は **JSON のみ**（説明文や前置きは一切不要）で、以下の厳密なスキーマに従ってください：
{
  "season": "${seasonLabel}",
  "competition": "${COMPETITION_NAME}",
  "standings": [
    {
      "rank": 1,
      "team": "日本語の正式チーム名（例: 湘南ベルマーレ）",
      "played": 17,
      "won": 11,
      "drawn": 4,
      "lost": 2,
      "gd": 18,
      "points": 37,
      "is_target": false
    }
  ]
}

ルール：
- 湘南ベルマーレの行のみ "is_target": true、それ以外は false にしてください。
- 数値（rank, played, won, drawn, lost, gd, points）はすべて整数にしてください。
- 必ず won + drawn + lost = played かつ won * 3 + drawn = points を確認してください（勝ち点剥奪等がない限り）。
- 最新の検索結果に基づき、推測や架空チーム名（〇〇FC等）は絶対に含めないでください。`;

  const raw = await callGeminiWithSearch(prompt);
  const rows = Array.isArray(raw?.standings) ? raw.standings : [];

  if (rows.length < 10) {
    console.warn(`[Gemini] Standings returned only ${rows.length} rows; keeping existing standings.json`);
    return false;
  }

  let mathMismatchCount = 0;
  const cleaned = rows
    .filter((r) => r && typeof r.team === 'string' && r.team.trim() && !/[〇〇△△□□◇◇]/.test(r.team))
    .map((r, idx) => {
      const team = r.team.trim();
      const played = Math.max(0, toInt(r.played));
      const won = Math.max(0, toInt(r.won));
      const drawn = Math.max(0, toInt(r.drawn));
      const lost = Math.max(0, toInt(r.lost));
      const gd = toInt(r.gd);
      const points = Math.max(0, toInt(r.points));

      if (won + drawn + lost !== played || won * 3 + drawn !== points) {
        mathMismatchCount += 1;
      }

      return {
        rank: toInt(r.rank, idx + 1),
        team,
        played,
        won,
        drawn,
        lost,
        gd,
        points,
        is_target: team.includes('湘南'),
      };
    })
    .sort((a, b) => a.rank - b.rank);

  const hasTarget = cleaned.some((r) => r.is_target);
  if (!hasTarget) {
    console.warn('[Gemini] Standings missing 湘南ベルマーレ; keeping existing standings.json');
    return false;
  }
  if (mathMismatchCount > 3) {
    console.warn(
      `[Gemini] Standings failed arithmetic validation on ${mathMismatchCount} rows; keeping existing standings.json`
    );
    return false;
  }

  const standingsData = {
    season: seasonLabel,
    competition: COMPETITION_NAME,
    standings: cleaned,
  };

  await writeJson('standings.json', standingsData);
  console.log(
    `[Gemini] Updated standings.json (${cleaned.length} teams, arithmetic warnings: ${mathMismatchCount})`
  );
  return true;
}

async function syncMatches(seasonLabel, todayJst) {
  const existing = await readExistingJson('matches.json');
  const existingRealMatches = (existing?.matches ?? []).filter(
    (m) => m && !['2026-j2-18', '2026-j2-17'].includes(String(m.id))
  );

  const prompt = `今日は ${todayJst}（JST）です。
Google 検索を使って、${seasonLabel} シーズン ${COMPETITION_NAME} における **湘南ベルマーレ** の試合結果（直近の終了試合）および今後の試合日程（予定試合）を調べてください。
可能な限り今シーズンの終了済み試合（最低でも直近10試合以上）と、今後の予定試合（最低でも今後5試合以上）を含めてください。

出力は **JSON のみ**（説明文や前置きは一切不要）で、以下の厳密なスキーマに従ってください：
{
  "season": "${seasonLabel}",
  "matches": [
    {
      "id": "${seasonLabel.slice(0, 4)}-j2-r17",
      "round": "第17節",
      "kickoff": "2026-11-25T19:00:00+09:00",
      "is_home": true,
      "opponent": "日本語の対戦相手チーム名",
      "stadium": "日本語のスタジアム名",
      "status": "finished",
      "ticket_url": null,
      "result": {
        "bellmare_score": 1,
        "opponent_score": 0,
        "scorers": ["選手名 68'"]
      },
      "lineup": null,
      "stats": null
    }
  ]
}

ルール：
- "id" は "${seasonLabel.slice(0, 4)}-j2-r{節番号}"（例: "${seasonLabel.slice(0, 4)}-j2-r17"）の形式にしてください。
- "kickoff" は必ず日本時間 ISO8601（"+09:00"）にしてください。時刻未定の場合は "14:00:00+09:00" としてください。
- 終了済みの試合は "status": "finished", "ticket_url": null とし、"result" に湘南ベルマーレの得点（bellmare_score）と相手の得点（opponent_score）を正確に入れてください。得点者（湘南側のみ）が分かれば "scorers" に ["選手名 68'"] 形式で入れ、不明なら [] にしてください。
- 未開催の試合は "status": "scheduled", "ticket_url": "${TICKET_URL}", "result": null にしてください。
- "lineup" と "stats" は不確かなら null にしてください（推測で埋めないでください）。
- 検索結果で確認できた事実のみを出力し、架空の試合は絶対に含めないでください。`;

  const raw = await callGeminiWithSearch(prompt);
  const incoming = Array.isArray(raw?.matches) ? raw.matches : [];

  if (incoming.length === 0) {
    console.warn('[Gemini] No matches returned; keeping existing matches.json');
    return false;
  }

  // Merge by normalized round key (e.g., "第17節") or id so existing lineup/stats/scorers are preserved
  const mergedByKey = new Map();
  for (const m of existingRealMatches) {
    const key = m.round?.trim() || String(m.id);
    mergedByKey.set(key, m);
  }

  let validCount = 0;
  for (const m of incoming) {
    if (!m || typeof m.opponent !== 'string' || !m.opponent.trim()) continue;
    const kickoff = normalizeKickoffJst(m.kickoff);
    if (!kickoff) continue;

    const roundMatch = String(m.round ?? '').match(/(\d+)/);
    const roundNum = roundMatch ? Number(roundMatch[1]) : null;
    const round = roundNum ? `第${roundNum}節` : String(m.round ?? '').trim();
    const id = roundNum
      ? `${seasonLabel.slice(0, 4)}-j2-r${roundNum}`
      : String(m.id || `match-${kickoff.slice(0, 10)}`);

    const key = round || id;
    const prev = mergedByKey.get(key);
    const isFinished = m.status === 'finished' && m.result && typeof m.result === 'object';

    let result = null;
    if (isFinished) {
      const incomingScorers = Array.isArray(m.result.scorers)
        ? m.result.scorers.filter((s) => typeof s === 'string' && s.trim())
        : [];
      result = {
        bellmare_score: Math.max(0, toInt(m.result.bellmare_score)),
        opponent_score: Math.max(0, toInt(m.result.opponent_score)),
        scorers: incomingScorers.length > 0 ? incomingScorers : (prev?.result?.scorers ?? []),
      };
    }

    const isHome = Boolean(m.is_home);
    const stadium =
      typeof m.stadium === 'string' && m.stadium.trim()
        ? m.stadium.trim()
        : isHome
          ? 'レモンガススタジアム平塚'
          : '未定';

    mergedByKey.set(key, {
      id,
      round,
      kickoff,
      is_home: isHome,
      opponent: m.opponent.trim(),
      stadium,
      status: isFinished ? 'finished' : 'scheduled',
      ticket_url: isFinished ? null : TICKET_URL,
      result,
      lineup: prev?.lineup ?? null,
      stats: prev?.stats ?? null,
    });
    validCount += 1;
  }

  if (validCount === 0) {
    console.warn('[Gemini] No valid matches parsed; keeping existing matches.json');
    return false;
  }

  const matches = [...mergedByKey.values()].sort(
    (a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime()
  );

  await writeJson('matches.json', {
    season: seasonLabel,
    matches,
  });
  console.log(`[Gemini] Updated matches.json (${matches.length} total matches, ${validCount} refreshed)`);
  return true;
}

async function syncPlayers(seasonLabel, todayJst) {
  const existing = await readExistingJson('players.json');
  const hasSamplePlayers = (existing?.players ?? []).some((p) =>
    String(p?.name ?? '').includes('サンプル')
  );

  if (!FORCE_SYNC_PLAYERS && !hasSamplePlayers && (existing?.players?.length ?? 0) >= 15) {
    console.log(
      `[Gemini] players.json already has ${existing.players.length} real players (set SYNC_PLAYERS=true to force refresh).`
    );
    return false;
  }

  const prompt = `今日は ${todayJst}（JST）です。
Google 検索を使って、${seasonLabel} シーズンの **湘南ベルマーレ** のトップチーム登録選手一覧（背番号・選手名・カタカナ読み・ポジション・身長cm・体重kg）を調べてください。

出力は **JSON のみ**（説明文や前置きは一切不要）で、以下の厳密なスキーマに従ってください：
{
  "season": "${seasonLabel}",
  "players": [
    {
      "number": 1,
      "name": "選手名（日本語）",
      "kana": "センシュメイ（全角カタカナ、不明なら空文字）",
      "position": "GK",
      "height": 185,
      "weight": 80,
      "apps": 0,
      "goals": 0,
      "assists": 0
    }
  ]
}

ルール：
- "position" は必ず "GK", "DF", "MF", "FW" のいずれかにしてください。
- "number" は重複しない正の整数にしてください。
- 検索結果で確認できた実在の登録選手のみを出力し、架空選手・サンプル表記は絶対に含めないでください。
- 身長・体重・出場数・ゴール・アシストが不明な場合は 0 にしてください。`;

  const raw = await callGeminiWithSearch(prompt);
  const list = Array.isArray(raw?.players) ? raw.players : [];

  const usedNumbers = new Set();
  const players = [];
  for (const p of list) {
    const num = toInt(p?.number);
    const name = String(p?.name ?? '').trim();
    if (!num || num <= 0 || usedNumbers.has(num) || !name || name.includes('サンプル')) {
      continue;
    }
    usedNumbers.add(num);
    players.push({
      number: num,
      name,
      kana: String(p?.kana ?? '').trim(),
      position: normalizePosition(p?.position),
      height: Math.max(0, toInt(p?.height)),
      weight: Math.max(0, toInt(p?.weight)),
      apps: Math.max(0, toInt(p?.apps)),
      goals: Math.max(0, toInt(p?.goals)),
      assists: Math.max(0, toInt(p?.assists)),
    });
  }

  players.sort((a, b) => a.number - b.number);

  if (players.length < 15) {
    console.warn(`[Gemini] Only ${players.length} players returned; keeping existing players.json`);
    return false;
  }

  await writeJson('players.json', {
    season: seasonLabel,
    players,
  });
  console.log(`[Gemini] Updated players.json (${players.length} players)`);
  return true;
}

async function main() {
  if (!API_KEY) {
    console.log(
      'GEMINI_API_KEY is not set. Skipping live sync.\n' +
        'Add GEMINI_API_KEY in GitHub repository Settings -> Secrets and variables -> Actions.'
    );
    process.exit(0);
  }

  const seasonLabel = resolveSeasonLabel();
  const todayJst = getTodayJstDate();
  console.log(`[Gemini] Starting sync (model=${MODEL}, season=${seasonLabel}, date=${todayJst})`);

  let updatedAny = false;

  try {
    const ok = await syncStandings(seasonLabel, todayJst);
    updatedAny = updatedAny || ok;
  } catch (err) {
    console.error('[Gemini] Standings sync failed:', err.message);
  }

  try {
    const ok = await syncMatches(seasonLabel, todayJst);
    updatedAny = updatedAny || ok;
  } catch (err) {
    console.error('[Gemini] Matches sync failed:', err.message);
  }

  try {
    const ok = await syncPlayers(seasonLabel, todayJst);
    updatedAny = updatedAny || ok;
  } catch (err) {
    console.error('[Gemini] Players sync failed:', err.message);
  }

  if (!updatedAny) {
    throw new Error('Gemini sync did not produce any validated updates.');
  }

  await writeJson('meta.json', {
    updated_at: toJstIso(new Date()),
    schema_version: 1,
  });
  console.log(`[Gemini] Updated meta.json (total Gemini API calls: ${apiCallCount})`);
}

main().catch((err) => {
  console.error('[Gemini] Sync failed:', err);
  process.exit(1);
});
