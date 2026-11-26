# BellSupport Hub（湘南ベルマーレ 非公式サポーターアプリ）

> **※非公式サポーターアプリ**  
> 本アプリは湘南ベルマーレおよびJリーグとは一切関係のない個人の非公式アプリです。  
> クラブ公式のエンブレム・ロゴ・マスコット画像、選手の実写写真、公式記事や楽曲歌詞の無断転載は行っていません。

## 主な機能

- **ホーム**：次節カード（Jリーグチケットリンク付）、直近戦績バッジ（W/D/L）、ミニ順位表（湘南ベルマーレ行ハイライト・全順位展開）
- **試合・観戦**：すべて / 予定 / 結果 / 観戦済フィルタ、各試合の「観戦済」トグル（`localStorage` 保存＆勝敗・勝率自動集計）、試合詳細（3-1-4-2フォーメーション図・控え・スタッツ）
- **選手名鑑**：ポジションフィルタ（GK/DF/MF/FW）＋背番号・選手名・カナ検索、出場・ゴール・アシスト表示
- **スタジアム・応援**：レモンガススタジアム平塚の徒歩/平塚駅北口11番バス案内（土日祝/平日切替・神奈中公式リンク）、チャント集（検索・カテゴリフィルタ・片手で見やすい大文字拡大表示）
- **オフライン対応**：`public/api/v1/*.json` を `fetch` し `localStorage` にキャッシュ。通信失敗・オフライン時も初期データで表示崩れなく動作します。

## 静的JSON API（GitHub Pages配信）

- `public/api/v1/meta.json`
- `public/api/v1/standings.json`
- `public/api/v1/matches.json`
- `public/api/v1/players.json`
- `public/api/v1/stadium_guide.json`

## 開発・ビルド

```bash
npm install
npm run dev
npm run build
```

## 実データ自動連携（Gemini API + Google Search Grounding + GitHub Actions）

[scripts/sync-gemini-search.mjs](scripts/sync-gemini-search.mjs) と [.github/workflows/sync-data.yml](.github/workflows/sync-data.yml) により、Google 公式の Gemini API（Google Search Grounding 有効）を使って湘南ベルマーレの順位表・試合日程＆結果・選手名鑑を取得し、数値検算などの自動バリデーションを通したうえで `public/api/v1/*.json` を更新・GitHub Pages に反映します。

### 設定手順（3ステップ）

1. [Google AI Studio](https://aistudio.google.com/apikey) で無料 API キーを取得します。
2. このリポジトリの **Settings → Secrets and variables → Actions → New repository secret** で以下を登録します。
   - Name: `GEMINI_API_KEY`
   - Secret: 取得した Gemini API キー
3. **Actions → Sync J.League Data → Run workflow** を実行すると、実データが取得され自動的に GitHub Pages へ再デプロイされます（以降は試合翌朝の月・木・日 07:00 JST に自動実行）。

## 公開URL（GitHub Pages）

- アプリ本体：`https://bellsupport-hub.github.io/`
- JSON配信例：`https://bellsupport-hub.github.io/api/v1/meta.json`
