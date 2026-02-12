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

## 2. デザインシステム

### 2.1 カラーパレット

モノクロ + グリーンアクセントの2色設計。色数を絞ることでプロフェッショナルな印象を維持する。

```
Background（ベース）
  --bg:             #f2f2f0     ← ページ背景。わずかにウォームなライトグレー
  --bg-elevated:    #ffffff     ← カード、モーダル、ドロップダウン

Surface（カード・パネル）
  --card:           #ffffff
  --card-hover:     #fcfcfb     ← テーブル行ホバー等

Border
  --border:         rgba(0,0,0,0.06)   ← カード、セクション区切り
  --border-solid:   #e8e8e6            ← ボタン枠、入力フィールド

Green Accent（唯一のアクセントカラー）
  --green:          #22c55e     ← アクティブ状態、成功、進捗
  --green-dark:     #15803d     ← テキスト on green背景

Primary（Black）
  --black:          #0a0a0a     ← ボタン、ナビ選択状態、見出し

Text Hierarchy
  --text:           #0a0a0a     ← 見出し、強調テキスト
  --text-mid:       #555555     ← 本文
  --text-sub:       #888888     ← ラベル、補助テキスト
  --text-light:     #bbbbbb     ← プレースホルダー、非活性
  --text-mute:      #dddddd     ← ゲージの目盛り等

Status Colors（ステータスドットのみに使用。背景色にはしない）
  --status-pending:    #bbbbbb  ← 見積中
  --status-confirmed:  #22c55e  ← 仕様確定、納品完了
  --status-warning:    #e5a32e  ← 入金待ち
  --status-active:     #0a0a0a  ← 製造中
  --status-shipping:   #888888  ← 配送中
```

#### カラールール
- ✅ ステータスは **5px ドット + テキスト** で表現（背景色バッジは使わない）
- ✅ グリーンはアクセントのみ。広い面積に使うのは Insight バナーのグラスモーフィズムだけ
- ✅ ボタンは黒（primary）/ 白枠（secondary）/ 透明（ghost）の3種のみ
- ❌ 赤・青・紫などの色は使用禁止（エラーは `--status-warning` のオレンジで統一）
- ❌ グラデーション禁止（Insightバナーの green glassmorphism のみ例外）

### 2.2 タイポグラフィ

3つのフォントを使い分ける。

```
Display / EN 見出し:
  font-family: 'Fraunces', serif
  用途: ページタイトル、英語ナビ、ブランド名、KPI大数字

Body / JA:
  font-family: 'Zen Kaku Gothic New', system-ui, sans-serif
  用途: 日本語全般（見出し、本文、ラベル、ステータス）

Numbers:
  font-family: 'Fraunces', serif
  font-variant-numeric: tabular-nums
  用途: 金額、パーセント、日付、ID、数値全般
```

#### Google Fonts 読み込み

```html
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,900&family=Zen+Kaku+Gothic+New:wght@300;400;500;700;900&display=swap" rel="stylesheet">
```

#### Tailwind CSS 設定

```js
// tailwind.config.ts
fontFamily: {
  display: ["'Fraunces'", 'serif'],
  body: ["'Zen Kaku Gothic New'", 'system-ui', 'sans-serif'],
  // mono は不要。数字は Fraunces + tabular-nums で処理
}
```

#### フォント使い分けルール
- ✅ ページタイトル (`Overview Panel`, `Orders`, `Settings`) → `font-display`
- ✅ 日本語テキスト全般 → `font-body`
- ✅ 数字 (`¥1,240,000`, `71.74%`, `BAO-0231`) → `font-display tabular-nums`
- ✅ ナビゲーションのアクティブタブ → `font-display font-semibold`
- ✅ ナビゲーションの非アクティブタブ → `font-body`
- ✅ KPI大数字はカンマで split し、小数部分を小さく表示 (例: `24,80` → `24` + `,80` 小さめ)
- ❌ monospace フォント（JetBrains Mono, Fira Code 等）は使用禁止

### 2.3 スペーシング & レイアウト

```
Card Border Radius:  20px  (--radius-card: 20px)
Button Radius:       8px   (--radius-button: 8px)
Pill Radius:         20px  (--radius-pill: 9999px)  ← ナビタブ、ステータスバッジ
Input Radius:        10px  (--radius-input: 10px)
Toggle Radius:       11px  (--radius-toggle: 11px)

Card Gap:            8px   ← カード間の隙間（参考画像に精密に合わせた値）
Card Padding:        20px 22px  ← カード内側のパディング
Page Padding:        0 26px     ← ページ左右の余白
Header Height:       52px
```

#### レイアウトルール
- ✅ グリッドは `gap-2` (8px) を基本とする
- ✅ カード内は `p-5` (20px) を基本とする
- ✅ テーブル行のパディングは `py-3 px-3.5` (12px 14px)
- ❌ カード間の gap を 16px 以上にしない（タイトな密度を維持）

### 2.4 コンポーネントスタイル

#### Card
```css
background: var(--card);
border-radius: 20px;
border: 1px solid var(--border);
/* shadow は使わない */
```

#### Button — Primary
```css
background: var(--black);
color: #ffffff;
border-radius: 8px;
padding: 5px 13px;
font-family: var(--font-body);
font-size: 12px;
font-weight: 500;
```

#### Button — Secondary
```css
background: var(--card);
color: var(--text-sub);
border: 1px solid var(--border-solid);
border-radius: 8px;
padding: 5px 13px;
```

#### Nav Tab — Active
```css
background: var(--black);
color: #ffffff;
border-radius: 9999px;
padding: 7px 18px;
font-family: var(--font-display);
font-weight: 600;
font-size: 13px;
```

#### Nav Tab — Inactive
```css
background: transparent;
color: var(--text-sub);
font-family: var(--font-body);
font-weight: 400;
```

#### Status Dot
```css
width: 5px;
height: 5px;
border-radius: 50%;
/* color は statusMap から取得 */
```

#### Toggle Switch
```css
width: 42px;
height: 22px;
border-radius: 11px;
/* Active: background: var(--green) */
/* Inactive: background: var(--border-solid) */
/* Thumb: 18x18px white circle with subtle shadow */
```

#### Input Field
```css
background: var(--bg);
border-radius: 10px;
padding: 7px 14px;
font-size: 12px;
border: none;
/* Focus: border: 1px solid var(--border-solid) */
```

#### Table
```css
/* Header */
font-size: 11px;
font-weight: 500;
color: var(--text-light);
font-family: var(--font-body);
padding: 10px 14px;
border-bottom: 1px solid var(--border);

/* Row */
padding: 12px 14px;
border-bottom: 1px solid var(--border);
/* Hover: background: var(--card-hover) */

/* Amount column: text-align: right, font-display tabular-nums, font-semibold */
```

### 2.5 チャート & データビジュアライゼーション

#### Barcode Bars（細かいバーチャート）
- バー幅: 1.5px〜2px、ギャップ: 0.8px
- デフォルト: `var(--black)` opacity 0.12
- ハイライト（末尾2本）: `var(--green)` opacity 1.0

#### Gauge（セミサーキュラー）
- ストローク幅: 6px
- トラック: `var(--border-solid)`
- 進捗: `#ccc`
- エンドポイント: `var(--green)` 5px ドット
- 目盛り: 21本、5刻みで太く

#### Candlestick Chart
- 上昇: `var(--green)` opacity 0.7
- 下降: `var(--black)` opacity 0.15
- ヒゲ: strokeWidth 0.8

#### Pipeline Bars
- 水平バー、高さ 4px、border-radius 2px
- 最終ステージ: `var(--green)` opacity 0.7
- その他: `var(--black)` opacity 0.10〜0.30（ステージが進むほど濃い）

### 2.6 Insight Banner（グラスモーフィズム）

唯一グラデーションが許されるコンポーネント。

```css
/* Background */
background: linear-gradient(140deg, 
  rgba(34,197,94,0.22) 0%, 
  rgba(34,197,94,0.40) 35%, 
  rgba(22,163,74,0.28) 60%, 
  rgba(34,197,94,0.12) 100%
);
border-radius: 20px;
overflow: hidden;
height: 185px;

/* Floating glass cards (3枚) */
background: rgba(255,255,255,0.20〜0.35);
backdrop-filter: blur(6px〜8px);
border: 1px solid rgba(255,255,255,0.25〜0.35);
border-radius: 16px;
transform: rotate(±2〜5deg);
```

### 2.7 アイコン

- **Lucide React** を使用（shadcn/ui のデフォルト）
- サイズ: 15px（カードラベル）、14px（アクション）、13px（インライン）
- ストローク幅: 1.8
- 色: `var(--text-sub)` がデフォルト

---

## 3. 実装ルール

### 3.1 ディレクトリ構造

```
baoflow/
├── CLAUDE.md                    ← このファイル
├── docs/
│   └── BAOFlow_要件定義書_v3_2.md
├── design-system/
│   ├── tokens.css               ← CSS カスタムプロパティ
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
│       └── globals.css          ← tokens.css を import + Tailwind
├── supabase/
│   └── migrations/              ← DB マイグレーション
├── tailwind.config.ts
├── next.config.ts
└── package.json
```

### 3.2 コーディング規約

- **言語**: TypeScript strict mode
- **コンポーネント**: React Server Components をデフォルトに。`"use client"` は必要な場合のみ
- **スタイリング**: Tailwind CSS + CSS カスタムプロパティ（`design-system/tokens.css`）
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

### 4.1 参考にしたUI

- **Synetica / Daxa Dashboard** — カード密度、ゲージ、バーコードチャート、グラスモーフィズムバナー
- **atics HR Dashboard** — プログレスバーカード、カラーリング

### 4.2 デザインの原則

1. **情報密度を高く保つ**: カード間 8px、コンパクトなパディング。一画面に多くの情報を表示
2. **色を削ぎ落とす**: モノクロ + グリーンの2色で十分。色が多いと安っぽくなる
3. **数字を美しく**: Fraunces のセリフ数字は KPI の品格を上げる。tabular-nums で整列
4. **日本語の視認性**: Zen Kaku Gothic New は画面上の可読性が高い
5. **チャートは細かく**: バーコード風の細い棒、キャンドルスティック、目盛り付きゲージ。粗いチャートは NG

---

## 5. やってはいけないこと

- ❌ JetBrains Mono, Fira Code, Source Code Pro 等の monospace フォントを使う
- ❌ Inter, Roboto, Arial 等の汎用サンセリフを使う
- ❌ 紫、ピンク、青のアクセントカラーを追加する
- ❌ カード影 (box-shadow) を使う（ボーダーのみ）
- ❌ recharts, chart.js 等の外部チャートライブラリを使う
- ❌ Material UI, Ant Design, Chakra UI 等の外部UIライブラリを使う
- ❌ カード間の gap を 16px 以上にする
- ❌ border-radius を 20px 以外にする（ボタン・入力・ピルは例外）
- ❌ フォントサイズを 14px 以上にする（ページタイトルと KPI 大数字は例外）
- ❌ emoji をUIに使う
