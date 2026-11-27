#!/usr/bin/env node
/**
 * Sync official Shonan Bellmare & J.LEAGUE YouTube RSS feeds, then use Gemini
 * (standard text inference, NO Search Grounding) to filter Bellmare-related videos,
 * assign tags, and link match_id & stable player_ids into public/api/v1/videos.json.
 *
 * Existing videos with `manual_override: true` are NEVER overwritten.
 *
 * Environment variables:
 *   GEMINI_API_KEY   (required for auto-tagging; if unset, adds basic rule-based entries)
 *   GEMINI_MODEL     (optional) Default: 'gemini-3.5-flash-lite'
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_DIR = path.resolve(__dirname, '../public/api/v1');

const API_KEY = process.env.GEMINI_API_KEY?.trim();
const MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite';

const CHANNELS = [
  {
    source: 'bellmare',
    channel_name: '湘南ベルマーレ公式チャンネル',
    channel_id: 'UCc3FnR9YVLyd-c4_uWpzgtA',
    requireKeywordFilter: false,
  },
  {
    source: 'jleague',
    channel_name: 'Jリーグ公式チャンネル',
    channel_id: 'UCyzs0YrgWiL2wdROpajnO1Q', // Jリーグ公式ハイライト動画チャンネル
    requireKeywordFilter: true,
  },
  {
    source: 'jleague',
    channel_name: 'Jリーグ公式チャンネル',
    channel_id: 'UCWc-XpFHPK1SwGcvpFPZ8NA', // Jリーグ公式チャンネル
    requireKeywordFilter: true,
  },
];

const ALLOWED_TAGS = [
  'ハイライト',
  '勝利試合',
  'ゴール集',
  'ダービー',
  'ホーム',
  'アウェイ',
  '劇的勝利・逆転',
  '密着・INSIDE',
  'インタビュー',
  '新体制・イベント',
];

function decodeXmlEntities(str) {
  return String(str ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function toJstIso(date = new Date()) {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(jst.getUTCDate()).padStart(2, '0');
  const hh = String(jst.getUTCHours()).padStart(2, '0');
  const mm = String(jst.getUTCMinutes()).padStart(2, '0');
  const ss = String(jst.getUTCSeconds()).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}+09:00`;
}

function parseAtomFeed(xmlText, channel) {
  const entries = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;
  while ((match = entryRegex.exec(xmlText)) !== null) {
    const block = match[1];
    const ytId = block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]?.trim();
    const title = decodeXmlEntities(block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? '');
    const published = block.match(/<published>([^<]+)<\/published>/)?.[1]?.trim() ?? '';
    const description = decodeXmlEntities(
      block.match(/<media:description>([\s\S]*?)<\/media:description>/)?.[1]?.trim() ?? ''
    );

    if (!ytId || !title) continue;

    if (channel.requireKeywordFilter) {
      const hay = `${title}\n${description}`;
      if (!/(湘南|ベルマーレ|shonan|bellmare)/i.test(hay)) continue;
    }

    entries.push({
      youtube_id: ytId,
      title,
      published_at: published.slice(0, 10) || toJstIso().slice(0, 10),
      description: description.slice(0, 500),
      source: channel.source,
      channel_name: channel.channel_name,
    });
  }
  return entries;
}

async function fetchChannelRss(channel) {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channel_id}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/atom+xml, application/xml, text/xml' },
  });
  if (!res.ok) {
    throw new Error(`RSS HTTP ${res.status} for ${channel.channel_name}`);
  }
  const xml = await res.text();
  return parseAtomFeed(xml, channel);
}

async function loadSeasonsContext() {
  const meta = JSON.parse(await fs.readFile(path.join(API_DIR, 'meta.json'), 'utf8'));
  const seasonIds = (meta.seasons ?? []).map((s) => s.id);
  const matches = [];
  const playersById = new Map();

  for (const sId of seasonIds) {
    try {
      const data = JSON.parse(
        await fs.readFile(path.join(API_DIR, `seasons/${sId}.json`), 'utf8')
      );
      for (const m of data.matches ?? []) {
        matches.push({
          id: m.id,
          season: sId,
          round: m.round,
          date: String(m.kickoff ?? '').slice(0, 10),
          opponent: m.opponent,
          is_home: m.is_home,
        });
      }
      for (const p of data.players ?? []) {
        if (!playersById.has(p.id)) {
          playersById.set(p.id, { id: p.id, name: p.name, number: p.number });
        }
      }
    } catch {
      // Ignore missing season file
    }
  }

  return {
    seasonIds,
    defaultSeason: meta.default_season || '2026-27',
    matches,
    players: [...playersById.values()],
  };
}

function extractJson(text) {
  const trimmed = String(text ?? '').trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error(`Invalid JSON from Gemini: ${trimmed.slice(0, 160)}`);
  }
}

async function classifyWithGemini(candidates, context) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`;

  const prompt = `あなたは湘南ベルマーレ非公式サポーターアプリの編集アシスタントです。
以下のYouTube公式チャンネル新着動画（タイトル・公開日・概要欄テキスト）を仕分けし、JSONのみで返してください。

許可タグ一覧（これ以外のタグは使わないこと）:
${JSON.stringify(ALLOWED_TAGS)}

対応シーズンID一覧:
${JSON.stringify(context.seasonIds)}

既存の試合一覧（match_id 紐づけ用・該当なしなら null）:
${JSON.stringify(context.matches.slice(0, 40))}

登録選手一覧（player_ids 紐づけ用・タイトルや概要欄に明確に登場する選手のみ）:
${JSON.stringify(context.players)}

新着動画候補:
${JSON.stringify(candidates, null, 2)}

出力スキーマ（JSONのみ）:
{
  "classified": [
    {
      "youtube_id": "動画ID",
      "is_bellmare_related": true,
      "season": "2026-27",
      "tags": ["ハイライト", "ホーム"],
      "match_id": "2026-27-r19 または null",
      "player_ids": ["suzuki-akito"]
    }
  ]
}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': API_KEY,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Gemini HTTP ${res.status}: ${text.slice(0, 240)}`);
  }

  const parsed = JSON.parse(text);
  const outText = (parsed?.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p?.text ?? '')
    .join('\n');
  return extractJson(outText);
}

function fallbackRuleClassify(candidate, context) {
  const text = `${candidate.title} ${candidate.description}`;
  const tags = [];
  if (/ハイライト|highlight/i.test(text)) tags.push('ハイライト');
  if (/ゴール集|全.*ゴール|goal collection/i.test(text)) tags.push('ゴール集');
  if (/インタビュー|interview|my way/i.test(text)) tags.push('インタビュー');
  if (/密着|inside|away film|ロッカー/i.test(text)) tags.push('密着・INSIDE');
  if (/新体制|イベント|発表/i.test(text)) tags.push('新体制・イベント');
  if (/ダービー/i.test(text)) tags.push('ダービー');
  if (tags.length === 0) tags.push('密着・INSIDE');

  return {
    youtube_id: candidate.youtube_id,
    is_bellmare_related: true,
    season: context.defaultSeason,
    tags,
    match_id: null,
    player_ids: [],
  };
}

async function main() {
  const videosPath = path.join(API_DIR, 'videos.json');
  const existingData = JSON.parse(await fs.readFile(videosPath, 'utf8'));
  const existingVideos = Array.isArray(existingData.videos) ? existingData.videos : [];
  const existingByYtId = new Map(existingVideos.map((v) => [v.youtube_id, v]));

  const context = await loadSeasonsContext();
  const validSeasonSet = new Set(context.seasonIds);
  const validMatchSet = new Set(context.matches.map((m) => m.id));
  const validPlayerSet = new Set(context.players.map((p) => p.id));
  const validTagSet = new Set(ALLOWED_TAGS);

  const fetched = [];
  for (const ch of CHANNELS) {
    try {
      const items = await fetchChannelRss(ch);
      console.log(`[RSS] ${ch.channel_name} (${ch.channel_id}): ${items.length} relevant entries`);
      fetched.push(...items);
    } catch (err) {
      console.warn(`[RSS] Failed ${ch.channel_name}: ${err.message}`);
    }
  }

  // Only classify videos not yet present in videos.json (never overwrite manual_override: true!)
  const newCandidates = [];
  const seenNew = new Set();
  for (const item of fetched) {
    if (existingByYtId.has(item.youtube_id) || seenNew.has(item.youtube_id)) continue;
    seenNew.add(item.youtube_id);
    newCandidates.push(item);
  }

  if (newCandidates.length === 0) {
    console.log('[YouTube Sync] No new Bellmare-related videos found.');
    return;
  }

  console.log(`[YouTube Sync] Found ${newCandidates.length} new candidate videos.`);

  let classifiedList = [];
  if (API_KEY) {
    try {
      const result = await classifyWithGemini(newCandidates.slice(0, 15), context);
      classifiedList = Array.isArray(result?.classified) ? result.classified : [];
    } catch (err) {
      console.warn(`[Gemini] Classification failed (${err.message}); using rule-based fallback.`);
      classifiedList = newCandidates.map((c) => fallbackRuleClassify(c, context));
    }
  } else {
    console.log('[YouTube Sync] GEMINI_API_KEY not set; using rule-based tagging.');
    classifiedList = newCandidates.map((c) => fallbackRuleClassify(c, context));
  }

  const candidateById = new Map(newCandidates.map((c) => [c.youtube_id, c]));
  let addedCount = 0;

  for (const item of classifiedList) {
    if (!item || item.is_bellmare_related === false) continue;
    const raw = candidateById.get(item.youtube_id);
    if (!raw || existingByYtId.has(raw.youtube_id)) continue;

    const tags = (Array.isArray(item.tags) ? item.tags : []).filter((t) => validTagSet.has(t));
    const season = validSeasonSet.has(item.season) ? item.season : context.defaultSeason;
    const matchId = item.match_id && validMatchSet.has(item.match_id) ? item.match_id : null;
    const playerIds = (Array.isArray(item.player_ids) ? item.player_ids : []).filter((pid) =>
      validPlayerSet.has(pid)
    );

    const newEntry = {
      id: `vid-${raw.youtube_id}`,
      youtube_id: raw.youtube_id,
      title: raw.title,
      source: raw.source,
      channel_name: raw.channel_name,
      season,
      published_at: raw.published_at,
      tags: tags.length > 0 ? tags : ['ハイライト'],
      match_id: matchId,
      player_ids: Array.from(new Set(playerIds)),
      manual_override: false,
    };

    existingVideos.push(newEntry);
    existingByYtId.set(raw.youtube_id, newEntry);
    addedCount += 1;
  }

  if (addedCount === 0) {
    console.log('[YouTube Sync] No new videos added after classification.');
    return;
  }

  existingVideos.sort((a, b) => b.published_at.localeCompare(a.published_at));

  await fs.writeFile(
    videosPath,
    `${JSON.stringify({ updated_at: toJstIso(), videos: existingVideos }, null, 2)}\n`,
    'utf8'
  );
  console.log(`[YouTube Sync] Added ${addedCount} new videos to public/api/v1/videos.json.`);
}

main().catch((err) => {
  console.error('[YouTube Sync] Failed:', err);
  process.exit(1);
});
