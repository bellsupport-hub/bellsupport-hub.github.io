export const TEAM_NAME_JA = {
  'Shonan Bellmare': '湘南ベルマーレ',
  'Hokkaido Consadole Sapporo': '北海道コンサドーレ札幌',
  'Consadole Sapporo': '北海道コンサドーレ札幌',
  'Vegalta Sendai': 'ベガルタ仙台',
  'Blaublitz Akita': 'ブラウブリッツ秋田',
  'Montedio Yamagata': 'モンテディオ山形',
  'Iwaki': 'いわきFC',
  'Iwaki FC': 'いわきFC',
  'Mito Hollyhock': '水戸ホーリーホック',
  'Tochigi SC': '栃木SC',
  'Thespakusatsu Gunma': 'ザスパ群馬',
  'Thespa Gunma': 'ザスパ群馬',
  'Omiya Ardija': 'RB大宮アルディージャ',
  'RB Omiya Ardija': 'RB大宮アルディージャ',
  'JEF United Chiba': 'ジェフユナイテッド千葉',
  'JEF United': 'ジェフユナイテッド千葉',
  'Kashiwa Reysol': '柏レイソル',
  'FC Tokyo': 'FC東京',
  'Tokyo Verdy': '東京ヴェルディ',
  'Machida Zelvia': 'FC町田ゼルビア',
  'Kawasaki Frontale': '川崎フロンターレ',
  'Yokohama F. Marinos': '横浜F・マリノス',
  'Yokohama FC': '横浜FC',
  'Ventforet Kofu': 'ヴァンフォーレ甲府',
  'Albirex Niigata': 'アルビレックス新潟',
  'Kataller Toyama': 'カターレ富山',
  'Shimizu S-Pulse': '清水エスパルス',
  'Jubilo Iwata': 'ジュビロ磐田',
  'Júbilo Iwata': 'ジュビロ磐田',
  'Fujieda MYFC': '藤枝MYFC',
  'Nagoya Grampus': '名古屋グランパス',
  'Kyoto Sanga': '京都サンガF.C.',
  'Gamba Osaka': 'ガンバ大阪',
  'Cerezo Osaka': 'セレッソ大阪',
  'Vissel Kobe': 'ヴィッセル神戸',
  'Fagiano Okayama': 'ファジアーノ岡山',
  'Sanfrecce Hiroshima': 'サンフレッチェ広島',
  'Renofa Yamaguchi': 'レノファ山口FC',
  'Tokushima Vortis': '徳島ヴォルティス',
  'Ehime FC': '愛媛FC',
  'FC Imabari': 'FC今治',
  'Avispa Fukuoka': 'アビスパ福岡',
  'Sagan Tosu': 'サガン鳥栖',
  'V-Varen Nagasaki': 'V・ファーレン長崎',
  'Roasso Kumamoto': 'ロアッソ熊本',
  'Oita Trinita': '大分トリニータ',
  'Kagoshima United': '鹿児島ユナイテッドFC',
  'Tegevajaro Miyazaki': 'テゲバジャーロ宮崎',
  'Vanraure Hachinohe': 'ヴァンラーレ八戸',
  'Urawa Red Diamonds': '浦和レッズ',
  'Urawa': '浦和レッズ',
  'Kashima Antlers': '鹿島アントラーズ',
};

export const STADIUM_NAME_JA = {
  'Lemon Gas Stadium Hiratsuka': 'レモンガススタジアム平塚',
  'Shonan BMW Stadium Hiratsuka': 'レモンガススタジアム平塚',
  'Toyama Athletic Stadium': '富山県総合運動公園陸上競技場',
  'JIT Recycle Ink Stadium': 'JIT リサイクルインク スタジアム',
  'Yamanashi Chuo Bank Stadium': 'JIT リサイクルインク スタジアム',
  'Sapporo Dome': '大和ハウス プレミストドーム',
  'Daiwa House Premist Dome': '大和ハウス プレミストドーム',
  'Yurtec Stadium Sendai': 'ユアテックスタジアム仙台',
  'ND Soft Stadium Yamagata': 'NDソフトスタジアム山形',
  'Hawaiians Stadium Iwaki': 'ハワイアンズスタジアムいわき',
  'NACK5 Stadium Omiya': 'NACK5スタジアム大宮',
  'Fukuda Denshi Arena': 'フクダ電子アリーナ',
  'NHK Spring Mitsuzawa Football Stadium': 'ニッパツ三ツ沢球技場',
  'Denka Big Swan Stadium': 'デンカビッグスワンスタジアム',
  'Yamaha Stadium': 'ヤマハスタジアム（磐田）',
  'Fujieda Soccer Stadium': '藤枝総合運動公園サッカー場',
  'Pocari Sweat Stadium': '鳴門・大塚スポーツパーク ポカリスエットスタジアム',
  'Ekimae Real Estate Stadium': '駅前不動産スタジアム',
  'Resonac Dome Oita': 'クラサスドーム大分',
  'Showa Denko Dome Oita': 'クラサスドーム大分',
  'Imabari Satoyama Stadium': 'アシックス里山スタジアム',
};

export function toJaTeamName(name) {
  if (!name) return '';
  return TEAM_NAME_JA[name] ?? name;
}

export function toJaStadiumName(name) {
  if (!name) return '未定';
  return STADIUM_NAME_JA[name] ?? name;
}

export function toJaCompetitionName(name) {
  if (!name) return 'Jリーグ';
  if (name.includes('J1')) return 'J1リーグ';
  if (name.includes('J2')) return 'J2リーグ';
  if (name.includes('J3')) return 'J3リーグ';
  return name;
}

export function toJaRound(round) {
  if (!round) return '';
  const match = round.match(/(\d+)\s*$/);
  if (match) {
    return `第${match[1]}節`;
  }
  return round;
}

export function toJstIso(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  const jstMs = date.getTime() + 9 * 60 * 60 * 1000;
  const jst = new Date(jstMs);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(jst.getUTCDate()).padStart(2, '0');
  const hh = String(jst.getUTCHours()).padStart(2, '0');
  const mm = String(jst.getUTCMinutes()).padStart(2, '0');
  const ss = String(jst.getUTCSeconds()).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}+09:00`;
}

export function formatSeasonLabel(seasonYear) {
  const year = Number(seasonYear);
  if (Number.isNaN(year)) return String(seasonYear);
  // J.League shifted to autumn-spring (e.g., 2026-27) starting 2026
  if (year >= 2026) {
    return `${year}-${String((year + 1) % 100).padStart(2, '0')}`;
  }
  return String(year);
}
