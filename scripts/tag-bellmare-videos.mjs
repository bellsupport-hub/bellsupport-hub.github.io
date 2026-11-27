#!/usr/bin/env node
/**
 * data/raw/bellmare_youtube_2020_2026.json（湘南ベルマーレ公式 2020〜2026 全動画）を
 * 公式シーズンデータ（全8大会・272試合・111選手）と精密照合してタグ付けし、
 * 既存の Jリーグ公式動画（source: 'jleague'）と統合して public/api/v1/videos.json を生成する。
 */

import fs from 'node:fs';
import path from 'node:path';

const API_DIR = 'public/api/v1';
const RAW_PATH = 'data/raw/bellmare_youtube_2020_2026.json';
const OUT_PATH = path.join(API_DIR, 'videos.json');

const OPPONENT_ALIASES = {
  'C大阪': ['C大阪', 'Ｃ大阪', 'セレッソ大阪', 'セレッソ'],
  'FC東京': ['FC東京', 'ＦＣ東京', '湘南東京', '東京湘南'],
  'G大阪': ['G大阪', 'Ｇ大阪', 'ガンバ大阪', 'ガンバ'],
  'いわき': ['いわきFC', 'いわきＦＣ', 'いわき'],
  '京都': ['京都サンガ', 'サンガ', '京都戦', '湘南vs京都', '京都vs湘南', '湘南京都', '京都湘南'],
  '今治': ['FC今治', 'ＦＣ今治', '今治'],
  '仙台': ['ベガルタ仙台', 'ベガルタ', '仙台'],
  '八戸': ['ヴァンラーレ八戸', 'ヴァンラーレ', '八戸'],
  '名古屋': ['名古屋グランパス', 'グランパス', '名古屋'],
  '大分': ['大分トリニータ', 'トリニータ', '大分'],
  '大宮': ['大宮アルディージャ', 'RB大宮', 'アルディージャ', '大宮'],
  '宮崎': ['テゲバジャーロ宮崎', 'テゲバジャーロ', '宮崎'],
  '富山': ['カターレ富山', 'カターレ', '富山'],
  '山形': ['モンテディオ山形', 'モンテディオ', '山形'],
  '岡山': ['ファジアーノ岡山', 'ファジアーノ', '岡山'],
  '川崎F': ['川崎フロンターレ', '川崎F', '川崎Ｆ', 'フロンターレ', '川崎戦', '湘南川崎', '川崎湘南'],
  '広島': ['サンフレッチェ広島', 'サンフレッチェ', '広島'],
  '徳島': ['徳島ヴォルティス', 'ヴォルティス', '徳島'],
  '新潟': ['アルビレックス新潟', 'アルビレックス', '新潟'],
  '札幌': ['北海道コンサドーレ札幌', 'コンサドーレ', '札幌'],
  '東京V': ['東京ヴェルディ', '東京V', '東京Ｖ', 'ヴェルディ'],
  '柏': ['柏レイソル', 'レイソル', '柏戦', 'vs柏', '湘南柏', '柏湘南'],
  '栃木C': ['栃木シティ', '栃木C', '栃木Ｃ'],
  '栃木SC': ['栃木SC', '栃木ＳＣ'],
  '横浜FC': ['横浜FC', '横浜ＦＣ'],
  '横浜FM': ['横浜F・マリノス', '横浜F･マリノス', '横浜FM', '横浜ＦＭ', 'マリノス'],
  '浦和': ['浦和レッズ', '浦和'],
  '清水': ['清水エスパルス', 'エスパルス', '清水'],
  '甲府': ['ヴァンフォーレ甲府', 'ヴァンフォーレ', '甲府'],
  '町田': ['FC町田ゼルビア', '町田ゼルビア', 'ゼルビア', '町田'],
  '相模原': ['SC相模原', 'ＳＣ相模原', 'S.C. SAGAMIHARA', 'SAGAMIHARA', '相模原'],
  '磐田': ['ジュビロ磐田', 'ジュビロ', '磐田'],
  '神戸': ['ヴィッセル神戸', 'ヴィッセル', '神戸'],
  '福岡': ['アビスパ福岡', 'アビスパ', '福岡'],
  '秋田': ['ブラウブリッツ秋田', 'ブラウブリッツ', '秋田'],
  '群馬': ['ザスパクサツ群馬', 'ザスパ群馬', 'ザスパ', '群馬'],
  '藤枝': ['藤枝MYFC', '藤枝ＭＹＦＣ', '藤枝'],
  '鳥栖': ['サガン鳥栖', 'サガン', '鳥栖'],
  '鹿島': ['鹿島アントラーズ', 'アントラーズ', '鹿島'],
};

const DERBY_OPPONENTS = new Set(['横浜FM', '横浜FC', '川崎F', '相模原']);

function normalizeText(s) {
  return String(s || '')
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/髙/g, '高')
    .replace(/邊|邉/g, '辺')
    .replace(/齊|齋/g, '斉')
    .replace(/澤/g, '沢')
    .replace(/廣/g, '広')
    .replace(/濱/g, '浜')
    .replace(/﨑/g, '崎')
    .replace(/\s+/g, '');
}

function normalizeTeamKey(name) {
  return String(name || '').replace(/[Ａ-Ｚａ-ｚ０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0)).trim();
}

function detectSeason(title, publishedAt) {
  if (/2026[\/\-]27|26[\/\-]27|J2リーグ/i.test(title)) return '2026-27';
  if (/百年構想/i.test(title)) return '2026-special';
  if (publishedAt >= '2026-07-01') return '2026-27';
  if (publishedAt >= '2026-01-01') return '2026-special';
  const y = publishedAt.slice(0, 4);
  if (['2025', '2024', '2023', '2022', '2021', '2020'].includes(y)) return y;
  return '2026-27';
}

function extractRoundNum(title) {
  const m = title.match(/第\s*(\d+)\s*節/);
  return m ? Number(m[1]) : null;
}

function main() {
  const meta = JSON.parse(fs.readFileSync(path.join(API_DIR, 'meta.json'), 'utf8'));
  const seasonsData = new Map();
  const playerPatterns = [];
  const seenPlayerIds = new Set();

  for (const sMeta of meta.seasons) {
    const sData = JSON.parse(fs.readFileSync(path.join(API_DIR, 'seasons', `${sMeta.id}.json`), 'utf8'));
    seasonsData.set(sMeta.id, sData);
    for (const p of sData.players) {
      if (seenPlayerIds.has(p.id)) continue;
      seenPlayerIds.add(p.id);
      const normFull = normalizeText(p.name);
      const tokens = [normFull];
      // カタカナ1語登録名（ウェリントン、ルキアン、タリク等）や明確な外国人名はそのまま追加
      const parts = p.name.trim().split(/\s+/);
      if (parts.length === 1 && parts[0].length >= 3) {
        tokens.push(normalizeText(parts[0]));
      }
      // 外国人2語名で特徴的なカタカナ姓/名（4文字以上）
      if (parts.length === 2 && /^[ァ-ヶー・]+$/.test(parts[0]) && /^[ァ-ヶー・]+$/.test(parts[1])) {
        if (parts[1].length >= 4 && !['シルバ', 'ジュニオール', 'サントス'].includes(parts[1])) {
          tokens.push(normalizeText(parts[1]));
        }
      }
      playerPatterns.push({
        id: p.id,
        name: p.name,
        tokens: [...new Set(tokens)].filter((t) => t.length >= 3),
      });
    }
  }

  const raw = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));
  const existing = JSON.parse(fs.readFileSync(OUT_PATH, 'utf8'));

  // 既存の Jリーグ公式動画（source: 'jleague'）はそのまま保持
  const jleagueVideos = (existing.videos || []).filter((v) => v.source === 'jleague');
  const existingBellmareById = new Map(
    (existing.videos || []).filter((v) => v.source === 'bellmare').map((v) => [v.youtube_id, v])
  );

  const taggedBellmare = [];

  for (const v of raw.videos) {
    const title = v.title || '';
    const desc = v.description || '';
    const pubDate = v.published_at;
    const pubMs = Date.parse(`${pubDate}T12:00:00+09:00`);
    const season = detectSeason(title, pubDate);
    const sData = seasonsData.get(season);

    const isCupOrYouth = /ルヴァン|ルヴァン|YLC|天皇杯|COPA\s*BELLMARE|トレーニングマッチ|TRM|U[-ーｰ]?18|U[-ーｰ]?15|U[-ーｰ]?11|ユース|ジュニア/i.test(title);
    const isShort = Boolean(v.is_short_duration) || /#shorts?/i.test(`${title} ${desc}`);

    // 1. 試合マッチング（リーグ戦のみ）
    let matchedMatch = null;
    if (!isCupOrYouth && sData) {
      const roundNum = extractRoundNum(title);
      const normTitle = normalizeText(title);
      let bestScore = -1;

      for (const m of sData.matches) {
        const opKey = normalizeTeamKey(m.opponent);
        const aliases = OPPONENT_ALIASES[opKey] || [opKey];
        const opMatched = aliases.some((al) => normTitle.includes(normalizeText(al)));
        if (!opMatched) continue;

        const mRound = extractRoundNum(m.round);
        const mMs = Date.parse(m.kickoff);
        const diffDays = (pubMs - mMs) / (1000 * 60 * 60 * 24);

        let score = 0;
        if (roundNum !== null && mRound === roundNum) {
          score += 100;
        }
        // 試合前14日〜試合後21日以内
        if (diffDays >= -14 && diffDays <= 21) {
          score += 50 - Math.abs(diffDays);
        } else if (roundNum === null) {
          // 節番号も無く日付も離れている場合はスキップ（総集編等での誤紐づけ防止）
          continue;
        }

        if (score > bestScore) {
          bestScore = score;
          matchedMatch = m;
        }
      }
    }

    // 2. 選手マッチング（タイトル＋概要欄先頭400文字）
    const normTitle = normalizeText(title);
    const normHeadDesc = normalizeText(desc.slice(0, 400));
    const playerIdSet = new Set();

    for (const pp of playerPatterns) {
      if (pp.tokens.some((tok) => normTitle.includes(tok))) {
        playerIdSet.add(pp.id);
      } else if (pp.tokens.some((tok) => normHeadDesc.includes(tok))) {
        // 概要欄は過剰ヒット防止のため6名未満の時のみ補完
        if (playerIdSet.size < 6) playerIdSet.add(pp.id);
      }
    }

    // 3. タグ付与
    const tagSet = new Set();
    const isTrailer =
      /Trailer|トレーラー|煽り|PV|プロモーション|告知/i.test(title) ||
      (matchedMatch && pubMs < Date.parse(matchedMatch.kickoff) - 12 * 3600 * 1000 && /KO|第\d+節|vs|VS/i.test(title) && !/インタビュー|開幕戦に向けて|会見/i.test(title));

    if (/ハイライト|HIGHLIGHT/i.test(title) || (/^【\s*湘南ベルマーレ\s*】\s*vs/i.test(title) && (v.duration_sec || 0) >= 180)) {
      tagSet.add('ハイライト');
    }
    if (/ゴール|GOAL|プロ初ゴール|決勝弾|同点弾|先制弾|先制点|追加点|ゴラッソ|フリーキック/i.test(title)) {
      tagSet.add('ゴール');
    }
    if (/CLIP\s*OF\s*THE\s*MATCH|セーブ|ビッグセーブ|スーパーセーブ|プレー|パフォーマンス|ヒールパス|クロス|跳躍|ボール奪取|初スタメン|初出場|デビュー/i.test(title)) {
      tagSet.add('好プレー・CLIP');
    }
    if (/MATCH\s*REPORT|MATCH\s*REVIEW|マッチレポート|BELLLOG|INSIDE|密着|AWAY\s*FILM|HOME\s*FILM|FIRST\s*DAY|ロッカー|舞台裏|裏側|潜入|ONE\s*DAY/i.test(title)) {
      tagSet.add('密着・INSIDE');
    }
    if (/マン・オブ・ザ・マッチ|ALL\s*IN\.?賞|表彰|MOM|MVP/i.test(title)) {
      tagSet.add('表彰・MOM');
    }
    if (/インタビュー|コメント|会見|トーク|対談|MY\s*WAY|想い|開幕戦に向けて|一言|メッセージ|^「.+」\s*[\u4e00-\u9faf]{2,}/i.test(title)) {
      tagSet.add('インタビュー・コメント');
    }
    if (/Training\s*Report|CAMP\s*REPORT|トレーニング|練習|キャンプ|TRM/i.test(title)) {
      tagSet.add('トレーニング・キャンプ');
    }
    if (/企画|クイズ|Quiz|質問|対決|チャレンジ|バラエティ|料理|誕生日|バースデー|心理戦|スピベル|ファンベル|ベルトーーク|定点カメラ|無人カメラ|自撮り|ベルっち|やってみた|決定戦|スタグル|アピール|選手紹介/i.test(title)) {
      tagSet.add('選手企画');
    }
    if (isTrailer) {
      tagSet.add('試合予告・Trailer');
    }
    if (/新加入|加入|移籍|ようこそ|FIRST\s*DAY|契約|引退|退団|卒業/i.test(title)) {
      tagSet.add('新加入・移籍');
    }
    if (/新体制|イベント|フェス|ナイト|暴れん坊|感謝|地域|プロジェクト|Project|ホームタウン|七夕|ヒサと共に|SB-CAMPUS|クラウドファンディング|UNIFORM|ユニフォーム|グッズ|フードパーク|Bfesday|ecoデー|百年構想|KICK\s*OFF\s*MOVIE|CLIMAX|GRAND\s*FINAL/i.test(title)) {
      tagSet.add('クラブ・イベント');
    }
    if (/ルヴァン|ルヴァン|YLC|天皇杯/i.test(title)) {
      tagSet.add('カップ戦');
    }
    if (/U[-ーｰ]?18|U[-ーｰ]?15|U[-ーｰ]?11|COPA\s*BELLMARE|ユース|アカデミー|ジュニア|スクール/i.test(title)) {
      tagSet.add('アカデミー');
    }
    if (/日本代表|U[-ーｰ]?(?:23|22|21|20|19)代表/i.test(title)) {
      tagSet.add('日本代表');
    }

    // 紐づいた試合の公式結果から事実タグを付与（試合後動画のみ）
    if (matchedMatch) {
      tagSet.add(matchedMatch.is_home ? 'ホーム' : 'アウェイ');
      if (DERBY_OPPONENTS.has(normalizeTeamKey(matchedMatch.opponent)) || /ダービー/.test(title)) {
        tagSet.add('ダービー');
      }
      if (!isTrailer && matchedMatch.status === 'finished' && matchedMatch.result) {
        const { bellmare_score: b, opponent_score: o } = matchedMatch.result;
        if (b > o) tagSet.add('勝利試合');
        if (o === 0) tagSet.add('クリーンシート');
      }
    } else if (/ダービー/.test(title)) {
      tagSet.add('ダービー');
    }

    if (isShort) {
      tagSet.add('Shorts');
    }

    if (tagSet.size === 0) {
      tagSet.add('クラブ・その他');
    }

    // 既存手動編集エントリがあればタグを正規化して統合
    const LEGACY_TAG_MAP = {
      '新体制・イベント': 'クラブ・イベント',
      'ゴール集': 'ゴール',
      'インタビュー': 'インタビュー・コメント',
    };
    const prev = existingBellmareById.get(v.youtube_id);
    if (prev?.manual_override) {
      for (const t of prev.tags || []) tagSet.add(LEGACY_TAG_MAP[t] || t);
      for (const pid of prev.player_ids || []) playerIdSet.add(pid);
    }

    taggedBellmare.push({
      id: `vid-${v.youtube_id}`,
      youtube_id: v.youtube_id,
      title,
      source: 'bellmare',
      channel_name: raw.channel_name || '湘南ベルマーレ公式チャンネル',
      season,
      published_at: pubDate,
      tags: [...tagSet],
      match_id: matchedMatch ? matchedMatch.id : (prev?.match_id || null),
      player_ids: [...playerIdSet],
      manual_override: true,
    });
  }

  // Jリーグ公式動画＋ベルマーレ公式全動画を公開日降順で統合
  const merged = [...jleagueVideos, ...taggedBellmare].sort((a, b) =>
    b.published_at.localeCompare(a.published_at)
  );

  const outObj = {
    updated_at: new Date().toISOString().replace(/\.\d{3}Z$/, '+09:00'),
    videos: merged,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(outObj, null, 2) + '\n', 'utf8');

  // 統計出力
  const tagCounts = {};
  let withMatch = 0;
  let withPlayer = 0;
  const bySeason = {};
  for (const v of merged) {
    if (v.match_id) withMatch++;
    if (v.player_ids.length > 0) withPlayer++;
    bySeason[v.season] = (bySeason[v.season] || 0) + 1;
    for (const t of v.tags) tagCounts[t] = (tagCounts[t] || 0) + 1;
  }

  console.log(`Generated ${OUT_PATH}: ${merged.length} videos (bellmare: ${taggedBellmare.length}, jleague: ${jleagueVideos.length})`);
  console.log(`Linked to match: ${withMatch}, Linked to players: ${withPlayer}`);
  console.log('By season:', bySeason);
  console.log('Tag counts:', Object.entries(tagCounts).sort((a, b) => b[1] - a[1]));
}

main();
