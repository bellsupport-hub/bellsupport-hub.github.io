export const TEAM_COLORS: Record<string, [string, string]> = {
  '湘南ベルマーレ': ['#7BC143', '#005BAC'],
  '湘南': ['#7BC143', '#005BAC'],
  'C大阪': ['#DF006D', '#1D2088'],
  'FC東京': ['#003DA5', '#E60012'],
  'G大阪': ['#003DA5', '#111827'],
  'いわき': ['#DA020E', '#111827'],
  '京都': ['#6B21A8', '#111827'],
  '今治': ['#004EA2', '#FACC15'],
  '仙台': ['#F5B800', '#004B97'],
  '八戸': ['#16A34A', '#FFFFFF'],
  '名古屋': ['#D70C18', '#F59E0B'],
  '大分': ['#005BAC', '#FACC15'],
  '大宮': ['#F97316', '#1E3A8A'],
  '宮崎': ['#FFFFFF', '#111827'],
  '富山': ['#005BAC', '#E2E8F0'],
  '山形': ['#004EA2', '#FACC15'],
  '岡山': ['#9F1239', '#1E293B'],
  '川崎F': ['#00A0E9', '#111827'],
  '広島': ['#5B21B6', '#FACC15'],
  '徳島': ['#004B97', '#16A34A'],
  '新潟': ['#F97316', '#004EA2'],
  '札幌': ['#DC2626', '#111827'],
  '東京V': ['#006A4E', '#C5A059'],
  '柏': ['#FACC15', '#111827'],
  '栃木C': ['#111827', '#E2E8F0'],
  '栃木SC': ['#FACC15', '#1E3A8A'],
  '横浜FC': ['#38BDF8', '#005BAC'],
  '横浜FM': ['#004EA2', '#E60012'],
  '浦和': ['#E60012', '#111827'],
  '清水': ['#F97316', '#FACC15'],
  '甲府': ['#004EA2', '#DC2626'],
  '町田': ['#005BAC', '#FACC15'],
  '相模原': ['#16A34A', '#111827'],
  '磐田': ['#38BDF8', '#1E3A8A'],
  '神戸': ['#991B1B', '#111827'],
  '福岡': ['#1E3A8A', '#94A3B8'],
  '秋田': ['#005BAC', '#111827'],
  '群馬': ['#1E3A8A', '#FACC15'],
  '藤枝': ['#7C3AED', '#FFFFFF'],
  '鳥栖': ['#38BDF8', '#EC4899'],
  '鹿島': ['#B91C1C', '#1E3A8A'],
};

export interface StadiumMasterEntry {
  name: string;
  query?: string;
  isHome?: boolean;
}

export const STADIUM_MASTER: Record<string, StadiumMasterEntry> = {
  'レモンＳ': { name: 'レモンガススタジアム平塚', isHome: true },
  'ＢＭＷス': {
    name: 'レモンガススタジアム平塚（旧Shonan BMWスタジアム平塚）',
    query: 'レモンガススタジアム平塚',
    isHome: true,
  },
  '国立': { name: '国立競技場', isHome: true },
  'いちご': { name: 'いちご宮崎新富サッカー場' },
  'アイスタ': { name: 'IAIスタジアム日本平' },
  'アシさと': { name: 'アシックス里山スタジアム' },
  'カシマ': { name: '県立カシマサッカースタジアム' },
  'メルスタ': {
    name: 'メルカリスタジアム（県立カシマサッカースタジアム）',
    query: '県立カシマサッカースタジアム',
  },
  'カンセキ': { name: 'カンセキスタジアムとちぎ' },
  'ギオンス': { name: '相模原ギオンスタジアム' },
  'クラド': { name: 'クラサスドーム大分' },
  '昭和電ド': {
    name: 'クラサスドーム大分（旧昭和電工ドーム大分）',
    query: 'クラサスドーム大分',
  },
  'サンガＳ': { name: 'サンガスタジアム by KYOCERA' },
  'ソユスタ': { name: 'ソユースタジアム' },
  'デンカＳ': { name: 'デンカビッグスワンスタジアム' },
  'ニッパツ': { name: 'ニッパツ三ツ沢球技場' },
  'ノエスタ': { name: 'ノエビアスタジアム神戸' },
  'ハワスタ': { name: 'ハワイアンズスタジアムいわき' },
  'パナスタ': { name: 'パナソニック スタジアム 吹田' },
  'プラスタ': { name: 'プライフーズスタジアム' },
  'ベススタ': { name: 'ベスト電器スタジアム' },
  'ヤマハ': { name: 'ヤマハスタジアム（磐田）' },
  'ヤンマー': { name: 'ヤンマースタジアム長居' },
  'ユアスタ': { name: 'ユアテックスタジアム仙台' },
  'ヨドコウ': { name: 'ヨドコウ桜スタジアム' },
  '三協Ｆ柏': { name: '三協フロンテア柏スタジアム' },
  '味スタ': { name: '味の素スタジアム' },
  '埼玉': { name: '埼玉スタジアム2002' },
  '富山': { name: '富山県総合運動公園陸上競技場' },
  '日産ス': { name: '日産スタジアム' },
  '札幌ド': {
    name: '大和ハウス プレミストドーム（札幌ドーム）',
    query: '大和ハウス プレミストドーム',
  },
  '札幌厚別': { name: '札幌厚別公園競技場' },
  '正田スタ': { name: '正田醤油スタジアム群馬' },
  '浦和駒場': { name: '浦和駒場スタジアム' },
  '等々力': {
    name: 'Uvanceとどろきスタジアム by Fujitsu（等々力陸上競技場）',
    query: 'Uvanceとどろきスタジアム by Fujitsu',
  },
  'Ｕ等々力': { name: 'Uvanceとどろきスタジアム by Fujitsu' },
  '藤枝サ': { name: '藤枝総合運動公園サッカー場' },
  '豊田ス': { name: '豊田スタジアム' },
  '駅スタ': { name: '駅前不動産スタジアム' },
  '鳴門大塚': { name: '鳴門・大塚スポーツパーク ポカリスエットスタジアム' },
  'ＣＦＳ': { name: 'CITY FOOTBALL STATION' },
  'Ｅスタ': { name: 'エディオンスタジアム広島' },
  'Ｅピース': { name: 'エディオンピースウイング広島' },
  'Ｇスタ': { name: '町田GIONスタジアム' },
  'ＪＦＥス': { name: 'JFE晴れの国スタジアム' },
  'ＪＩＴス': { name: 'JIT リサイクルインク スタジアム' },
  'ＮＡＣＫ': { name: 'NACK5スタジアム大宮' },
  'ＮＤスタ': { name: 'NDソフトスタジアム山形' },
};

export function normalizeTeamKey(name: string): string {
  return String(name || '')
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
    .trim();
}

export function getTeamColors(teamName: string): [string, string] {
  const key = normalizeTeamKey(teamName);
  return TEAM_COLORS[key] ?? ['#94A3B8', '#475569'];
}

export function getStadiumInfo(shortName: string) {
  const info = STADIUM_MASTER[shortName];
  if (info) {
    return {
      short: shortName,
      name: info.name,
      query: info.query ?? info.name,
      isHome: Boolean(info.isHome),
    };
  }
  return {
    short: shortName,
    name: shortName,
    query: shortName,
    isHome: false,
  };
}

export function getGoogleMapsUrl(stadiumNameOrShort: string): string {
  const info = getStadiumInfo(stadiumNameOrShort);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(info.query)}`;
}
