# CLAUDE.md — BAO Flow Design System & Development Rules

> このファイルはプロジェクトルートに配置し、Claude Code が毎回参照するルールブックです。
> デザイン・実装・コミュニケーションの全てのルールをここに集約します。

---

## 開発ルール（厳守）

### コードを書く前に必ず行うこと
1. `docs/db-schema-actual.md` を読み、使用するテーブルの全カラムを確認する
2. 不明な場合は Supabase MCP で `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'テーブル名'` を実行して確認する
3. 要件定義書（`/docs/BAOFlow_要件定義書_v3_2.md`）の該当セクションを読む

### コードを書いた後に必ず行うこと
1. `npm run build` でエラーがないことを確認
2. 変更したページに対して、`npm run dev` でサーバーを起動し `curl http://localhost:3000/対象ページ` を実行してHTTPステータス200を確認
3. Supabase クエリを含む場合、使用している全カラム名が `docs/db-schema-actual.md` に存在することを grep で確認
4. エラーがあれば自分で修正してから完了報告する

### 絶対にやってはいけないこと
- `docs/db-schema-actual.md` を確認せずにカラム名を書くこと
- 存在しないテーブルやカラムを推測で使うこと
- build だけ通して動作確認せずに完了報告すること

---

## 1. プロジェクト概要

**BAO Flow** は、日本のクライアント（カフェ、食品メーカー等）と中国の工場をつなぐパッケージ受発注管理プラットフォーム。

- **Tech Stack**: Next.js (App Router) + TypeScript + Supabase + Vercel
- **UI Framework**: shadcn/ui をベースに、本ドキュメントのデザイントークンでカスタマイズ
- **要件定義書**: `/docs/BAOFlow_要件定義書_v3_2.md` を参照

---

## 2. デザインシステム — F&C Design System

> 正典は `design-system/fc/README.md`(F&C Design System 取り込み版)。トークンの実体は
> `design-system/fc-tokens.css`(`src/styles/globals.css` が import)。コンポーネント実例は
> `design-system/fc/components/`、作法カードは `design-system/fc/guidelines/`。
> 旧デザインシステム(モノクロ+グリーン / Fraunces)は全廃済み。

### 2.1 カラーパレット

出発点は**基本5色のみ**。派生12色で固定し、それ以外の色は作らない。

```
基本5色
  --fc-wasabi:    #E9F056   ← 「今ここ・次にやること」。主要ボタン・選択中・現在値のバー
  --fc-orange:    #FF5C34   ← 緊急・期限・エラーのみ。塗り面には使わず枠線とバーに使う
  --fc-coolblue:  #D7EFFF   ← データの面・顔アイコン・過去のバー
  --fc-cassis:    #351E28   ← ナビの面・本文・基準線
  --fc-sauge:     #AEB8A0   ← 罫線と無効状態のみ(大面積では使わない)

派生12色
  --fc-orange-tint: #FFD8C2 / --fc-bg: #EFEFEA / --fc-card: #FFFFFF /
  --fc-card-soft: #FBFAF6 / --fc-line: #E2E1DA / --fc-ink-soft: #84787D /
  --fc-wasabi-ink: #666C14 / --fc-blue-ink: #33566F / --fc-orange-ink: #B03616 /
  --fc-sauge-ink: #4C5544 / --fc-cassis-tint: #C9A2B8 / --fc-cassis-soft: #9C8290
```

#### 色の3原則(これを外すと F&C に見えない)
1. **色面の文字は同じ色相の濃淡で書く。白文字は一切使わない。**
   Wasabi面→Wasabi Ink、Cool Blue面→Blue Ink、Orange Tint面→Orange Ink、
   Cassis面→Cassis Tint、Sauge面→Sauge Ink。
2. **各インクは対応する色面の上でしか使わない。** 白地で強調したいときはバッジ/ピルに載せる。
3. **Wasabi は作業エリアに1画面1点だけ**(主要ボタン/ひとことカード/現在値のバー、合計2点まで)。
   ブランドピルとサイドバー選択中は固定要素として数えない。

#### カードの色分け(D79)
- 数値・データ → Cool Blue 面
- ひとこと・説明・AIのきづき → Wasabi 面
- 期限・要対応 → Orange Tint 面(警告枠は Orange 1.5px 線)

#### ステータス表現
バッジ(ピル)5種に統一: 新着=Wasabi面 / 情報=Cool Blue面 / 弱=Sauge面 /
警告=Orange Tint面 / 無彩=BG面+Line枠。必ず文字を入れる(色だけで意味を出さない)。

### 2.2 タイポグラフィ

```
font-family: "Manrope", "M PLUS 2", sans-serif  ← 指定順で英数=Manrope、かな漢字=M PLUS 2
読み込み: next/font(src/app/layout.tsx で --font-manrope / --font-mplus)
```

サイズは5段だけ: **21px/800**(画面タイトル)・**15px/700**(セクション)・**14px/400**(本文)・
**12.5px**(補助・表)・**11px**(バッジ・注釈)。主要な数値は **24px/800**。
数字は常に `font-variant-numeric: tabular-nums`(`.num` ユーティリティ)。
`font-feature-settings: "palt"` を body に適用済み。

- ❌ Fraunces 等のセリフ、monospace フォントは使用禁止
- ✅ `font-display` / `font-body` はどちらも Manrope + M PLUS 2 スタック(互換のため両方残置)

### 2.3 スペーシング & 角丸 & 影

```
余白:      8px の倍数のみ(4px は半歩)。カード内=16px、セクション間=24px、画面左右=26px
タップ対象: 44px 以上(モバイル)

角丸(形で役割が分かる):
  999px  = 操作(ボタン・バッジ・チップ)      → rounded-full / rounded-button
  16px   = カード・リスト行・表の外周          → rounded-card
  12px   = 入力欄・メニュー項目               → rounded-input
  24px   = 画面の外枠・サイドバー             → rounded-frame

影: 画面の外枠1箇所のみ 0 20px 50px rgba(53,30,40,.12)(shadow-frame)。
    カードは浮かせない(線 --fc-line で区切る)。フローティング UI(モーダル・ポップオーバー)のみ例外。
```

### 2.4 コンポーネントスタイル

#### Button(すべてピル)
- **main**: bg Wasabi / 文字 Wasabi Ink / 800。**1画面1つだけ**
- **dark**: bg Cassis / 文字 Cassis Tint / 700(通常のアクション)
- **ghost**: bg Card / 文字 Cassis / 枠 Line
- **danger**: bg Card / 文字 Orange Ink / 枠 Orange
- ホバーは `brightness(.96)`(暗くする)。拡大・移動はしない

#### サイドバー(2層構造の濃い面)
Cassis 面 236px 固定。ブランドは Wasabi の文字ピル。項目は語で示す(アイコン非推奨)。
選択中だけ Wasabi 面 + Wasabi Ink。非選択は Cassis Tint 文字。

#### 入力欄
bg BG / radius 12px / フォーカスで Cassis 枠。checkbox/radio は `accent-color: Cassis`。

#### 表(1行=1件の密な表)
ヘッダー: Card Soft 面 / 11px / Ink Soft。行: 交互に Card / Card Soft、下線 Line。
警告行は Orange Tint 面。選択行は左 3px Cassis 枠。状態は列に固定しバッジで示す。

### 2.5 チャート & データビジュアライゼーション(D78)

塗り面ではなく**線と細いバー**で構成する。
- 過去 = Cool Blue / 現在 = Wasabi / 警告 = Orange / 基準線 = Cassis の 2px 線
- 進捗ドット・ステップ: 過去=Cool Blue、現在=Wasabi、未来=Line
- recharts 等の外部チャートライブラリは使わない(手書き SVG)

### 2.6 アイコン・言葉

- アイコンは原則使わない。**語そのもの**・状態バッジ・色面・顔アイコン(姓1文字、Cool Blue面)で伝える
- 既存の Lucide アイコン使用箇所は許容(新規追加は最小限に)
- やさしい日本語。ボタンは動詞で(「この内容で申請する」)。絵文字は 🔒 と ★ のみ
- 数字は単位必須(`¥530,000`・`8 / 10件`)。裸の % は使わない

---

## 3. 実装ルール

### 3.1 ディレクトリ構造

```
baoflow/
├── CLAUDE.md                    ← このファイル
├── docs/
│   └── BAOFlow_要件定義書_v3_2.md
├── design-system/
│   ├── fc-tokens.css            ← F&C デザイントークン(CSS カスタムプロパティ)
│   ├── fc/                      ← F&C Design System 正典(README/components/guidelines)
│   ├── components.md            ← コンポーネントカタログ
│   └── screenshots/             ← 参考スクリーンショット
├── src/
│   ├── app/
│   │   ├── layout.tsx           ← フォント読み込み、グローバルレイアウト
│   │   ├── page.tsx             ← ダッシュボード（Overview）
│   │   ├── deals/               ← 案件管理
│   │   │   ├── page.tsx         ← 案件一覧
│   │   │   └── [id]/page.tsx    ← 案件詳細
│   │   ├── quotes/              ← 見積もり管理
│   │   ├── clients/             ← クライアント管理
│   │   ├── factories/           ← 工場管理
│   │   ├── payments/            ← 出入金管理
│   │   ├── inventory/           ← 在庫保管管理
│   │   ├── analytics/           ← 経営分析
│   │   ├── chat/                ← チャット
│   │   └── settings/            ← システム設定
│   ├── components/
│   │   ├── ui/                  ← shadcn/ui ベースの共通コンポーネント
│   │   ├── layout/
│   │   │   ├── header.tsx       ← 白ヘッダー（ロゴ + ナビ + 検索 + ユーザー）
│   │   │   ├── sidebar.tsx      ← 設定画面のサイドバー
│   │   │   └── page-header.tsx  ← サブヘッダー（タイトル + 日付フィルター）
│   │   ├── dashboard/
│   │   │   ├── insight-banner.tsx
│   │   │   ├── kpi-card.tsx
│   │   │   ├── gauge.tsx
│   │   │   ├── barcode-bars.tsx
│   │   │   ├── candle-chart.tsx
│   │   │   └── pipeline-bar.tsx
│   │   ├── deals/
│   │   │   ├── deal-table.tsx
│   │   │   ├── deal-status-dot.tsx
│   │   │   ├── progress-bar-client.tsx   ← 7ステップ
│   │   │   ├── progress-bar-sales.tsx    ← 25ステップ
│   │   │   └── progress-bar-factory.tsx  ← 6ステップ
│   │   └── shared/
│   │       ├── big-num.tsx      ← KPI 大数字コンポーネント
│   │       ├── status-dot.tsx
│   │       └── card-label.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   └── types.ts        ← Supabase 自動生成型
│   │   ├── calc/
│   │   │   └── cost-engine.ts   ← 原価計算エンジン
│   │   └── utils.ts
│   └── styles/
│       └── globals.css          ← fc-tokens.css を import + Tailwind
├── supabase/
│   └── migrations/              ← DB マイグレーション
├── tailwind.config.ts
├── next.config.ts
└── package.json
```

### 3.2 コーディング規約

- **言語**: TypeScript strict mode
- **コンポーネント**: React Server Components をデフォルトに。`"use client"` は必要な場合のみ
- **スタイリング**: Tailwind CSS + CSS カスタムプロパティ（`design-system/fc-tokens.css`）
- **State管理**: React hooks + Supabase リアルタイム。外部状態ライブラリは使わない
- **データフェッチ**: Server Components で直接 Supabase クエリ。Client Components では `useSWR` or `react-query`
- **フォーム**: `react-hook-form` + `zod` でバリデーション
- **日付**: `date-fns`（日本語ロケール対応）
- **PDF生成**: `@react-pdf/renderer`
- **チャート**: 軽量なカスタム SVG コンポーネント（recharts は使わない。v7 の手書き SVG を踏襲）

### 3.3 命名規則

```
ファイル名:     kebab-case     (deal-table.tsx, cost-engine.ts)
コンポーネント:  PascalCase     (DealTable, CostEngine)
変数・関数:     camelCase      (getDealById, calculateCost)
CSS変数:       --kebab-case   (--text-sub, --border-solid)
DB テーブル:    snake_case     (deal_items, factory_quotes)
API ルート:    kebab-case     (/api/deals, /api/quote-calc)
```

### 3.4 Supabase ルール

- RLS (Row Level Security) を全テーブルに適用
- `auth.uid()` でユーザーを識別
- マスターステータス (M01〜M25) は `deal_status` enum で管理
- 金額は全て **整数 (cents/銭)** で保存。表示時に `/100` で変換
- 為替レートは `exchange_rates` テーブルで日次保存

### 3.5 Phase 1 実装スコープ

要件定義書 Section 8 に準拠。以下を Phase 1 として実装:

1. ユーザー認証（Supabase Auth — 営業・管理者）
2. 案件管理 CRUD + マスターステータス M01〜M25
3. 原価計算エンジン（自動計算 + 複数配送 + 複数数量 + Wise/Alibaba 手数料）
4. 工場 Excel 自動読み取り（AI パース — Claude API 連携）
5. 顧客マスター
6. 工場マスター
7. 帳票 PDF 自動生成（見積書・請求書・納品書 + インボイス番号対応）
8. 工場支払い管理（前払い/残金・Wise/Alibaba）
9. 出入金管理
10. 営業ダッシュボード + 停滞アラート + 支払いアラート
11. リピート注文機能
12. デザインデータ管理（バージョン管理・最終確定フラグ）
13. 複数サンプルラウンド管理
14. システム設定画面
15. 経営分析ダッシュボード
16. 支払い最適化アドバイザー
17. 品目登録台帳（簡易版）
18. 価格データ自動蓄積（裏側で記録開始）

---

## 4. デザイン参考

### 4.1 出典
- `design-system/fc/README.md` — F&C Design System 正典(色の3原則・言葉の作り方・部品追加の作法)
- `design-system/fc/components/` — 27個の参照コンポーネント(.jsx + .d.ts + .prompt.md)
- `design-system/fc/guidelines/` — 18枚の作法カード(禁止例つき)
- `design-system/fc/HANDOFF.md` — 他システムへ広げるときの受け渡しガイド

### 4.2 デザインの原則
1. **2層構造**: 濃い Cassis 面のナビ + 白い作業エリア。濃い面はナビだけ
2. **色は基本5色+派生12色のみ**: それ以外を作らない
3. **一覧は1行=1件の密な表**: 状態は列に固定する
4. **背景は無地**: 写真・グラデーション・テクスチャ・透明度・ぼかしは使わない
5. **動きは控えめ**: 120–180ms で色と不透明度だけ。跳ね・拡大・スライドインはしない

---

## 5. やってはいけないこと

- ❌ **色面に白文字**(色面の文字は同じ色相のインクで書く)
- ❌ 基本5色+派生12色以外の色を作る(赤・青・紫・緑の独自色は禁止。エラーは Orange 系)
- ❌ Orange を塗り面に使う(枠線とバーのみ。面は Orange Tint)
- ❌ Wasabi を1画面に2点以上置く
- ❌ Fraunces・Zen Kaku 等の旧フォント、monospace フォントを使う
- ❌ カード影 (box-shadow) を使う(枠は線のみ。例外はフローティング UI と画面外枠)
- ❌ recharts, chart.js 等の外部チャートライブラリを使う
- ❌ Material UI, Ant Design, Chakra UI 等の外部UIライブラリを使う
- ❌ 写真・イラスト・グラデーション・テクスチャ背景
- ❌ ボタン・バッジ・チップをピル(rounded-full)以外にする
- ❌ 余白に 8px の倍数以外を使う(4px は半歩としてのみ可)
- ❌ emoji をUIに使う(🔒 と ★ のみ例外)

---

## Phase 1 作業ルール（v2.0）

### 触らないディレクトリ
以下は Phase 1 のスコープ外。読まない・修正しない・参照しない：
- `src/app/(main)/_archive/`
- `src/app/_archive_factory/`
- `src/app/_archive_portal/`
- `src/lib/actions/_unused/`
- `src/components/_unused/`

これらは過去の v1.0 のコードで、Phase 2 以降で復活させる可能性があるため
削除せず保管している。Phase 1 では存在しないものとして扱う。

### Phase 1 のスコープ（5 機能のみ）
1. 案件基本情報（案件名・クライアント名・希望納期・担当・メモ）
2. 商品仕様（サイズ・素材・色・加工・印刷）
3. 見積計算（数量別単価・送料・掛け率・税）
4. ステータス管理（7 段階の simple_status）
5. 画像管理（高画質・複数画像）

### Phase 1 のステータス（7 段階）
quoting → quote_confirmed → paid → data_confirmed → in_production → shipped → delivered

旧 master_status（M01-M25）は温存して触らない。simple_status のみ使用。

### Phase 1 で使うテーブル
- `deals`（simple_status, visibility, client_name_text, desired_delivery_date, memo を追加）
- `deal_specifications`（既存、UI で出すカラムを絞る）
- `deal_quotes`（既存）
- `deal_status_history`（from_simple_status, to_simple_status を追加）
- `profiles`（既存）
- `documents`（画像管理用、流用）

### 詳細
- 全体仕様: `docs/Phase1_実装仕様書.md`
- 背景: `docs/Phase1_企画書_v1.1.md`
- 旧リポの状況: `docs/旧BAOFlow_分析結果.md`

---

## Sprint 6 作業ルール (マスター画面 / 帳票拡張 / コミュニケーション / モバイル)

### スコープ
- マスター画面 `/master` (clients / factories の split-pane CRUD、売上ロールアップ)
- 帳票 4 種統合 + RFQ 新規 + 既存帳票の `variant_id` 対応 (Sprint 5 の負債解消)
- コミュニケーションタブ (案件単位の通信履歴、フォローアップ)
- 履歴タイムライン完全版 (フィルタチップ + 統合ビュー)
- 添付ファイル カテゴリ拡張 (5 カテゴリ: spec/quote/photo/contract/other)
- モバイル対応 (読取中心、< 768px レスポンシブ)

### 新規テーブル
- `deal_communications`: 通信履歴 (channel: email/wechat/phone/memo/meeting)
- `factory_rfq_responses`: RFQ 工場回答 (Phase 2 工場画面の伏線)

### 既存テーブル拡張
- `deal_design_files.category`: ファイル分類
- `deal_status_history.kind`: 履歴フィルタ用 (status/edit/variant/attachment/comm/fee)
- `document_type` ENUM に `'rfq'` 追加

### migration 番号
- 022〜024 適用済 → Sprint 6 は **025 から**

### Sprint 6 で扱わない (Phase 2 送り)
- インライン編集完全版、案件詳細モーダル化、既読管理 profile 別、メール通知、
  ファイルバージョン実装、自動テスト整備

---

## Sprint 5 v2 作業ルール (Claude Design 採用、見た目刷新)

### 方針 (B 案)
- Sprint 5 v1 の **4 階層データモデル** (`deals → deal_products → deal_product_variants → deal_quotes`) は**温存**
- Claude Design (`docs/design_handoff_baoflow_deals/`) のデザインを取り込む
- inline style ではなく **Tailwind 化** (既存 codebase と統一)
- 「1 商品 1 案件」方針は**採用しない** (現在の階層構造で表現)

### 取り込み対象
- `dashboard.jsx` → `/page.tsx` 再設計 (KPI 4 タイル / パイプライン / 要対応 / トップクライアント / アクティビティ)
- `v5-nested.jsx` → `/deals/page.tsx` の見た目寄せ (30px 行 / フォント 11-12px / ホバー色)
- `deal-detail-modal.jsx` → `/deals/[id]/page.tsx` 4 タブ化 (詳細 / 履歴 / 添付 / コミ準備中)

### 追加で拡張するテーブル
- `clients`: short_name / billing_to / tax_id / payment_terms / since / industry 等
- `factories`: name_cn / specialties[] / 各 stars / lead_time_range 等

### migration 番号
- 022 (Phase 1.5) と 023 (Sprint 5 v1) は適用済 → Sprint 5 v2 は **024 から**

---

## Sprint 5 作業ルール (Phase 1.5: 4 階層構造)

### 階層構造
```
clients (クライアント) — 既存
  └─ deals (案件) — 既存
       └─ deal_products (商品) — 新規
            └─ deal_product_variants (バリエーション) — 新規
                 └─ deal_quotes (見積) — variant_id を持つ
```

### 重要ルール
- **旧 `deal_specifications` テーブルは DROP しない** (Phase 2 用に温存)
- **新規挿入は `deal_products` + `deal_product_variants` に対して**実施 (deal_specifications には書き込まない)
- 計算ロジックは `src/lib/calc/logistics-engine.ts` (容積重量・送料) と
  `src/lib/calc/quote-engine.ts` (統合見積) に集約
- 既存 Phase 1.5 の `deal_quotes.spec_id` は残す (NULL 許容)、新規見積は `variant_id` を使う
- 帳票発行 (`/documents`) は 4 階層対応に書き換え (variant 経由)
- migration 番号: 022 は Phase 1.5 で取得済み、Sprint 5 は **023 から**
