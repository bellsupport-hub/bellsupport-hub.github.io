import type { HubDataBundle } from '../types';

export const FALLBACK_DATA: HubDataBundle = {
  meta: {
    updated_at: '2026-11-26T20:40:00+09:00',
    schema_version: 1,
  },
  standings: {
    season: '2026-27',
    competition: 'J2リーグ',
    standings: [
      { rank: 1, team: '〇〇FC', played: 17, won: 11, drawn: 4, lost: 2, gd: 18, points: 37, is_target: false },
      { rank: 2, team: '△△ユナイテッド', played: 17, won: 10, drawn: 5, lost: 2, gd: 14, points: 35, is_target: false },
      { rank: 3, team: '湘南ベルマーレ', played: 17, won: 10, drawn: 4, lost: 3, gd: 12, points: 34, is_target: true },
      { rank: 4, team: '□□シティ', played: 17, won: 9, drawn: 5, lost: 3, gd: 9, points: 32, is_target: false },
      { rank: 5, team: '◇◇サンガ', played: 17, won: 8, drawn: 6, lost: 3, gd: 7, points: 30, is_target: false },
    ],
  },
  matches: {
    season: '2026-27',
    matches: [
      {
        id: '2026-j2-18',
        round: '第18節',
        kickoff: '2026-11-29T14:00:00+09:00',
        is_home: false,
        opponent: 'カターレ富山',
        stadium: '富山県総合運動公園陸上競技場',
        status: 'scheduled',
        ticket_url: 'https://www.jleague-ticket.jp/club/sb/',
        result: null,
        lineup: null,
        stats: null,
      },
      {
        id: '2026-j2-17',
        round: '第17節',
        kickoff: '2026-11-25T19:00:00+09:00',
        is_home: true,
        opponent: 'ヴァンフォーレ甲府',
        stadium: 'レモンガススタジアム平塚',
        status: 'finished',
        ticket_url: null,
        result: {
          bellmare_score: 1,
          opponent_score: 0,
          scorers: ["鈴木章斗 68'"],
        },
        lineup: {
          formation: '3-1-4-2',
          starters: [1, 4, 8, 22, 33, 14, 7, 13, 2, 10, 29],
          substitutes: [21, 3, 15, 18, 20, 9, 11],
        },
        stats: {
          possession: 54,
          shots: 12,
          shots_on_target: 5,
          corners: 6,
        },
      },
    ],
  },
  players: {
    season: '2026-27',
    players: [
      { number: 1, name: '選手A（GKサンプル）', kana: 'センシュ エー', position: 'GK', height: 188, weight: 82, apps: 17, goals: 0, assists: 0 },
      { number: 4, name: '選手B（DFサンプル）', kana: 'センシュ ビー', position: 'DF', height: 184, weight: 78, apps: 16, goals: 1, assists: 0 },
      { number: 8, name: '選手C（DFサンプル）', kana: 'センシュ シー', position: 'DF', height: 182, weight: 76, apps: 17, goals: 2, assists: 1 },
      { number: 22, name: '選手D（DFサンプル）', kana: 'センシュ ディー', position: 'DF', height: 180, weight: 74, apps: 15, goals: 0, assists: 1 },
      { number: 7, name: '選手E（MFサンプル）', kana: 'センシュ イー', position: 'MF', height: 175, weight: 70, apps: 17, goals: 3, assists: 4 },
      { number: 14, name: '選手F（MFサンプル）', kana: 'センシュ エフ', position: 'MF', height: 172, weight: 67, apps: 16, goals: 2, assists: 3 },
      { number: 29, name: '鈴木 章斗', kana: 'スズキ アキト', position: 'FW', height: 179, weight: 72, apps: 17, goals: 8, assists: 2 },
      { number: 10, name: '選手G（FWサンプル）', kana: 'センシュ ジー', position: 'FW', height: 181, weight: 75, apps: 15, goals: 5, assists: 3 },
    ],
  },
  stadiumGuide: {
    stadium: {
      name: 'レモンガススタジアム平塚',
      address: '神奈川県平塚市大原1-1（平塚市総合公園内）',
      walk_info: 'JR平塚駅北口より徒歩約25〜30分（大通りを直進・平坦ルート）',
      bus_boarding: 'JR平塚駅北口 11番乗り場（直行シャトルバス / 約10分）',
      bus_official_url: 'https://www.kanachu.co.jp/',
      bus_schedules: {
        weekend: [
          { note: 'キックオフ3時間前〜1時間前', interval: '約10〜15分間隔で臨時直行便運行' },
          { note: 'キックオフ1時間前〜直前', interval: '満員になり次第順次発車' },
          { note: '試合終了後（復路）', interval: '総合公園西側乗り場より平塚駅行き随時運行' },
        ],
        weekday: [
          { note: 'キックオフ2時間半前〜直前', interval: '約15〜20分間隔で直行便運行（帰宅ラッシュ時間帯は余裕をもって移動推奨）' },
          { note: '路線バス併用', interval: '平塚駅北口4番乗り場「平塚駅北口行（循環）」等も利用可能' },
        ],
      },
    },
    chants: [
      {
        id: 'chant-victory',
        category: 'チーム',
        title: '勝利へのチャント（サンプル）',
        timing: '試合開始前・チャンス時',
        lyrics: 'オーオー 湘南ベルマーレ\n勝利を掴み取れ\n緑と青の誇りを胸に\n最後まで走り抜け',
      },
      {
        id: 'chant-suzuki',
        category: '選手',
        player_number: 29,
        title: '鈴木章斗 チャント（サンプル）',
        timing: '出場時・ゴール時',
        lyrics: 'アキト ゴールを決めろ\n湘南のストライカー 鈴木章斗',
      },
    ],
  },
};
