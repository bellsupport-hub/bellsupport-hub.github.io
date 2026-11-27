#!/usr/bin/env node
/**
 * 湘南ベルマーレ公式YouTubeチャンネル（UCc3FnR9YVLyd-c4_uWpzgtA）の
 * 2020年〜現在の全動画を YouTube Data API v3（公式API）で取得し、
 * bellmare_youtube_2020_2026.json に保存するスクリプト。
 *
 * 依存パッケージなし（Node.js 18+ 標準 fetch のみ）。
 *
 * 使い方:
 *   YOUTUBE_API_KEY="AIza..." node scripts/fetch-bellmare-youtube.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

const API_KEY = process.env.YOUTUBE_API_KEY?.trim();
const CHANNEL_ID = 'UCc3FnR9YVLyd-c4_uWpzgtA';
const SINCE_DATE = process.env.SINCE_DATE?.trim() || '2020-01-01';
const SINCE_MS = Date.parse(`${SINCE_DATE}T00:00:00Z`);

if (!API_KEY) {
  console.error('エラー: 環境変数 YOUTUBE_API_KEY を設定してください。');
  console.error('例: YOUTUBE_API_KEY="AIza..." node scripts/fetch-bellmare-youtube.mjs');
  process.exit(1);
}

async function fetchJson(url) {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`YouTube API HTTP ${res.status}: ${data?.error?.message || JSON.stringify(data)}`);
  }
  return data;
}

function parseIsoDurationSec(iso) {
  if (!iso) return null;
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
}

async function main() {
  console.log(`チャンネル ${CHANNEL_ID} の動画一覧を取得中（${SINCE_DATE} 以降）...`);

  const chUrl = new URL('https://www.googleapis.com/youtube/v3/channels');
  chUrl.searchParams.set('part', 'contentDetails,snippet');
  chUrl.searchParams.set('id', CHANNEL_ID);
  chUrl.searchParams.set('key', API_KEY);

  const chData = await fetchJson(chUrl.toString());
  const chItem = chData.items?.[0];
  if (!chItem) {
    throw new Error(`チャンネルが見つかりませんでした: ${CHANNEL_ID}`);
  }

  const channelTitle = chItem.snippet?.title || '湘南ベルマーレ公式チャンネル';
  const uploadsPlaylistId = chItem.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) {
    throw new Error('アップロード動画プレイリストIDを取得できませんでした。');
  }

  console.log(`対象チャンネル: ${channelTitle} (uploads: ${uploadsPlaylistId})`);

  const items = [];
  let pageToken = '';
  let page = 0;
  let reachedOld = false;

  while (!reachedOld) {
    page++;
    const plUrl = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
    plUrl.searchParams.set('part', 'snippet,contentDetails');
    plUrl.searchParams.set('playlistId', uploadsPlaylistId);
    plUrl.searchParams.set('maxResults', '50');
    plUrl.searchParams.set('key', API_KEY);
    if (pageToken) plUrl.searchParams.set('pageToken', pageToken);

    const plData = await fetchJson(plUrl.toString());
    const batch = plData.items || [];
    if (batch.length === 0) break;

    for (const item of batch) {
      const videoId = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
      const publishedAt = item.contentDetails?.videoPublishedAt || item.snippet?.publishedAt;
      if (!videoId || !publishedAt) continue;

      const pubMs = Date.parse(publishedAt);
      if (pubMs < SINCE_MS) {
        reachedOld = true;
        break;
      }

      items.push({
        youtube_id: videoId,
        title: item.snippet?.title || '',
        description: item.snippet?.description || '',
        published_at: publishedAt.slice(0, 10),
        published_at_iso: publishedAt,
      });
    }

    process.stdout.write(`\r  ページ ${page} 取得済み: ${items.length} 件`);
    pageToken = plData.nextPageToken || '';
    if (!pageToken) break;
  }
  console.log('');

  // duration / viewCount を 50件ずつ補完（Shorts判定・確認用）
  const detailMap = new Map();
  for (let i = 0; i < items.length; i += 50) {
    const chunkIds = items.slice(i, i + 50).map((v) => v.youtube_id);
    const vUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
    vUrl.searchParams.set('part', 'contentDetails,statistics');
    vUrl.searchParams.set('id', chunkIds.join(','));
    vUrl.searchParams.set('key', API_KEY);
    const vData = await fetchJson(vUrl.toString());
    for (const v of vData.items || []) {
      const durationSec = parseIsoDurationSec(v.contentDetails?.duration);
      detailMap.set(v.id, {
        duration_sec: durationSec,
        is_short_duration: durationSec !== null && durationSec <= 61,
        view_count: v.statistics?.viewCount ? Number(v.statistics.viewCount) : null,
      });
    }
  }

  const enriched = items.map((v) => ({
    ...v,
    ...(detailMap.get(v.youtube_id) || { duration_sec: null, is_short_duration: false, view_count: null }),
  }));

  const outDir = fs.existsSync('data/raw') ? 'data/raw' : '.';
  const outPath = path.join(outDir, 'bellmare_youtube_2020_2026.json');
  const output = {
    fetched_at: new Date().toISOString(),
    channel_id: CHANNEL_ID,
    channel_name: channelTitle,
    since: SINCE_DATE,
    count: enriched.length,
    videos: enriched,
  };

  fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`\n完了！ ${enriched.length} 件の動画を保存しました -> ${outPath}`);
}

main().catch((err) => {
  console.error('\nエラーが発生しました:', err.message);
  process.exit(1);
});
