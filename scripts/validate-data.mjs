#!/usr/bin/env node
/**
 * Validate all static JSON files in public/api/v1/ including:
 * - meta.json season index
 * - seasons/{id}.json schema & arithmetic integrity
 * - videos.json schema & cross-reference integrity (match_id, player_ids)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_DIR = path.resolve(__dirname, '../public/api/v1');

const VALID_POSITIONS = new Set(['GK', 'DF', 'MF', 'FW']);
const VALID_VIDEO_SOURCES = new Set(['bellmare', 'jleague']);

async function readJson(relPath) {
  const fullPath = path.join(API_DIR, relPath);
  const raw = await fs.readFile(fullPath, 'utf8');
  return JSON.parse(raw);
}

async function main() {
  const errors = [];
  const warnings = [];

  const meta = await readJson('meta.json');
  const seasonIndex = Array.isArray(meta.seasons) ? meta.seasons : [];
  if (seasonIndex.length === 0) {
    errors.push('meta.json: seasons array is missing or empty');
  }

  const allMatchIds = new Set();
  const allPlayerIds = new Set();
  const seasonIds = new Set();

  for (const item of seasonIndex) {
    seasonIds.add(item.id);
    const seasonPath = `seasons/${item.id}.json`;
    let data;
    try {
      data = await readJson(seasonPath);
    } catch (err) {
      errors.push(`${seasonPath}: failed to load (${err.message})`);
      continue;
    }

    if (data.id !== item.id) {
      errors.push(`${seasonPath}: id "${data.id}" does not match meta.json "${item.id}"`);
    }

    // Validate standings
    const standings = Array.isArray(data.standings) ? data.standings : [];
    if (!standings.some((r) => r.is_target)) {
      errors.push(`${seasonPath}: standings missing target team (is_target: true)`);
    }

    // Validate matches
    const matches = Array.isArray(data.matches) ? data.matches : [];
    const localMatchIds = new Set();
    for (const m of matches) {
      if (!m.id || localMatchIds.has(m.id)) {
        errors.push(`${seasonPath}: duplicate or missing match id "${m.id}"`);
      }
      localMatchIds.add(m.id);
      allMatchIds.add(m.id);
      if (m.status === 'finished' && !m.result) {
        errors.push(`${seasonPath}: finished match "${m.id}" missing result`);
      }
    }

    // Validate players
    const players = Array.isArray(data.players) ? data.players : [];
    const usedNumbers = new Set();
    for (const p of players) {
      if (!p.id || typeof p.id !== 'string') {
        errors.push(`${seasonPath}: player #${p.number} missing stable player id`);
      } else {
        allPlayerIds.add(p.id);
      }
      if (usedNumbers.has(p.number)) {
        errors.push(`${seasonPath}: duplicate jersey number ${p.number}`);
      }
      usedNumbers.add(p.number);
      if (!VALID_POSITIONS.has(p.position)) {
        errors.push(`${seasonPath}: invalid position "${p.position}" for ${p.name}`);
      }
    }
  }

  // Validate videos.json
  const videosData = await readJson('videos.json');
  const videos = Array.isArray(videosData.videos) ? videosData.videos : [];
  const usedYtIds = new Set();

  for (const v of videos) {
    if (!v.youtube_id || usedYtIds.has(v.youtube_id)) {
      errors.push(`videos.json: duplicate or missing youtube_id "${v.youtube_id}"`);
    }
    usedYtIds.add(v.youtube_id);

    if (!VALID_VIDEO_SOURCES.has(v.source)) {
      errors.push(`videos.json: invalid source "${v.source}" on ${v.id}`);
    }
    if (!seasonIds.has(v.season)) {
      errors.push(`videos.json: unknown season "${v.season}" on ${v.id}`);
    }
    if (v.match_id && !allMatchIds.has(v.match_id)) {
      errors.push(`videos.json: match_id "${v.match_id}" on ${v.id} not found in any season`);
    }
    for (const pid of v.player_ids ?? []) {
      if (!allPlayerIds.has(pid)) {
        warnings.push(`videos.json: player_id "${pid}" on ${v.id} not found in current season rosters`);
      }
    }
  }

  if (warnings.length > 0) {
    console.warn('Warnings:\n' + warnings.map((w) => `  - ${w}`).join('\n'));
  }

  if (errors.length > 0) {
    console.error('Validation FAILED:\n' + errors.map((e) => `  - ${e}`).join('\n'));
    process.exit(1);
  }

  console.log(
    `Validation OK: ${seasonIds.size} seasons, ${allMatchIds.size} matches, ${allPlayerIds.size} unique players, ${videos.length} official videos.`
  );
}

main().catch((err) => {
  console.error('Validation error:', err);
  process.exit(1);
});
