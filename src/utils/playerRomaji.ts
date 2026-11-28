/**
 * 選手名のローマ字表記マップ（全8大会・過去選手含む）
 * クロスシーズンIDがローマ字（例: "kozuki-soichiro"）の場合は自動整形し、
 * 数値ID（例: "player-2020-1"）の場合は下記の氏名辞書から正確なローマ字を返す。
 */
const PLAYER_ROMAJI_BY_NAME: Record<string, string> = {
  '藤井 智也': 'Tomoya FUJII',
  '蓑田 広大': 'Kodai MINODA',
  '柴田 徹': 'Toru SHIBATA',
  '岡庭 愁人': 'Shuto OKANIWA',
  '鈴木 淳之介': 'Junnosuke SUZUKI',
  '根本 凌': 'Ryo NEMOTO',
  '大岩 一貴': 'Kazuki OIWA',
  'ルイス フェリッピ': 'Luiz PHELLYPE',
  '糸原 紘史郎': 'Koshiro ITOHARA',
  'キム ミンテ': 'KIM Min Tae',
  '二田 理央': 'Rio NITTA',
  '吉田 舜': 'Shun YOSHIDA',
  'ディサロ 燦シルヴァーノ': 'Akira Silvano DISARO',
  '山田 直輝': 'Naoki YAMADA',
  '馬渡 洋樹': 'Hiroki MAWATARI',
  '富居 大樹': 'Daiki TOMII',
  '吉田 新': 'Arata YOSHIDA',
  '石原 広教': 'Hirokazu ISHIHARA',
  '山下 敬大': 'Keita YAMASHITA',
  'タリク': 'TARIK',
  '山本 脩斗': 'Shuto YAMAMOTO',
  '永木 亮太': 'Ryota NAGAKI',
  'ミケル アグ': 'Mikel AGU',
  '若月 大和': 'Yamato WAKATSUKI',
  '立川 小太郎': 'Kotaro TACHIKAWA',
  '中野 嘉大': 'Yoshihiro NAKANO',
  '谷 晃生': 'Kosei TANI',
  '古林 将太': 'Shota KOBAYASHI',
  'ウェリントン': 'WELLINGTON',
  '瀬川 祐輔': 'Yusuke SEGAWA',
  '米本 拓司': 'Takuji YONEMOTO',
  '堀田 大暉': 'Daiki HOTTA',
  '原 直生': 'Naoki HARA',
  '高橋 諒': 'Ryo TAKAHASHI',
  '梅崎 司': 'Tsukasa UMESAKI',
  '石原 直樹': 'Naoki ISHIHARA',
  '平松 昇': 'Sho HIRAMATSU',
  '毛利 駿也': 'Shunya MORI',
  '名古 新太郎': 'Shintaro NAGO',
  '中村 駿': 'Shun NAKAMURA',
  '三幸 秀稔': 'Hidetoshi MIYUKI',
  '柴田 壮介': 'Sosuke SHIBATA',
  '石川 玄大': 'Gendai ISHIKAWA',
  'ウェリントン ジュニオール': 'Wellington JUNIOR',
  'オリベイラ': 'OLIVEIRA',
  '金子 大毅': 'Daiki KANEKO',
  '馬渡 和彰': 'Kazuaki MAWATARI',
  '坂 圭祐': 'Keisuke SAKA',
  '指宿 洋史': 'Hiroshi IBUSUKI',
  '中川 寛斗': 'Hiroto NAKAGAWA',
  '福田 晃斗': 'Akito FUKUTA',
  '齊藤 未月': 'Mitsuki SAITO',
  '松田 天馬': 'Temma MATSUDA',
  '岩崎 悠人': 'Yuto IWASAKI',
  '後藤 雅明': 'Masaaki GOTO',
  '鈴木 冬一': 'Toichi SUZUKI',
};

function capitalize(word: string): string {
  if (!word) return '';
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function getPlayerRomaji(id: string, name: string): string {
  const normalizedName = name.replace(/\s+/g, ' ').trim();
  if (PLAYER_ROMAJI_BY_NAME[normalizedName]) {
    return PLAYER_ROMAJI_BY_NAME[normalizedName];
  }
  // Cross-season romaji IDs like "kozuki-soichiro" -> "Soichiro KOZUKI"
  if (/^[a-z]+(-[a-z]+)+$/.test(id) && !id.startsWith('player-')) {
    const parts = id.split('-');
    if (parts.length === 2) {
      return `${capitalize(parts[1])} ${parts[0].toUpperCase()}`;
    }
    return parts.map((p, idx) => (idx === 0 ? p.toUpperCase() : capitalize(p))).join(' ');
  }
  if (/^[a-z]{3,}$/.test(id)) {
    return id.toUpperCase();
  }
  return '';
}

const WIKIPEDIA_TITLE_OVERRIDES: Record<string, string> = {
  'ウェリントン': 'ウェリントン_(サッカー選手)',
  'タリク': 'タリク・エルユヌシ',
  'オリベイラ': 'オリベイラ_(サッカー選手)',
  'ファビアン ゴンザレス': 'ファビアン・ゴンザレス',
  'アルトゥール シルバ': 'アルトゥール・シルバ',
  'ポープ ウィリアム': 'ポープ・ウィリアム',
  'キム ミンテ': 'キム・ミンテ',
  'ソン ボムグン': 'ソン・ボムグン',
  'ルイス フェリッピ': 'ルイス・フェリッピ',
  'ミケル アグ': 'ミケル・アグ',
  'ウェリントン ジュニオール': 'ウェリントン・ジュニオール',
  'ディサロ 燦シルヴァーノ': 'ディサロ燦シルヴァーノ',
  'ルキアン': 'ルキアン・アラウージョ・デ・アルメイダ',
  '高橋 諒': '高橋諒_(サッカー選手)',
  '髙橋 直也': '高橋直也_(サッカー選手)',
  '中村 駿': '中村駿_(サッカー選手)',
  '鈴木 雄斗': '鈴木雄斗',
};

export function getPlayerWikipediaUrl(name: string): string {
  const normalized = name.replace(/\s+/g, ' ').trim();
  const override = WIKIPEDIA_TITLE_OVERRIDES[normalized];
  if (override) {
    return `https://ja.wikipedia.org/wiki/${encodeURIComponent(override)}`;
  }
  // カタカナ2語名（外国人選手）は中黒繋ぎ、日本人選手はスペース除去で直接記事URLへ
  const parts = normalized.split(' ');
  const isKatakanaForeign =
    parts.length >= 2 && parts.every((part) => /^[ァ-ヶー・]+$/.test(part));
  const articleTitle = isKatakanaForeign ? parts.join('・') : parts.join('');
  return `https://ja.wikipedia.org/wiki/${encodeURIComponent(articleTitle)}`;
}
