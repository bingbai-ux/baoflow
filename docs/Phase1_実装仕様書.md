# BAO Flow v2.0 / Phase 1 実装仕様書

**版数**: v1.0
**作成日**: 2026-04-25
**対象**: Claude Code (Sonnet) + ECC 環境
**前提**: 企画書 v1.1 を読了済み
**目的**: 来週中に動作する Phase 1 をリリースする

---

## 0. 読み方

このドキュメントは Claude Code への発注書。上から順に Sprint 0 → Sprint 4 を実行する。
Sprint 内の各タスクは独立して動作確認できる粒度に分解されている。

**実行原則**：
1. 各 Sprint 完了時に `npm run build` が通ることを必ず確認
2. UI 変更は `npm run dev` で実際に画面を見て確認
3. DB 変更は migration を新規追加（既存 migration は変更しない）
4. 不明点は実装前に質問する。推測で進めない

---

## 1. アーキテクチャ概要

### スタック（既存踏襲）
- Next.js 15 (App Router)
- TypeScript
- Supabase (DB + Auth + Storage)
- Tailwind CSS + デザイントークン
- shadcn/ui（部分採用）

### Phase 1 で扱うテーブル（既存）

| テーブル | 用途 | Phase 1 での扱い |
|---|---|---|
| `deals` | 案件マスター | **新カラム simple_status 追加** |
| `deal_specifications` | 商品仕様 | そのまま使用、UI 整理 |
| `deal_quotes` | 見積 | そのまま使用、UI 整理 |
| `deal_status_history` | ステータス履歴 | simple_status 用に拡張 |
| `clients` | クライアント | そのまま使用 |
| `profiles` | スタッフ | そのまま使用 |
| `documents` | 添付ファイル | 画像管理に使用 |

### Phase 1 で**触らない**テーブル（30+ 個）
factories, factory_users, deal_factory_assignments, deal_samples, deal_factory_payments, deal_shipping, chat_rooms, chat_messages, inventory_items, shipment_orders, catalog_items, product_registry, test_reports など。
存在は許容、データは触らない、UI からも見せない。

---

## 2. ディレクトリ構造（再編後）

```
src/app/
├── (main)/
│   ├── _archive/                 ★ 退避ディレクトリ（新規作成）
│   │   ├── analytics/            ← 退避
│   │   ├── catalog/              ← 退避
│   │   ├── clients/              ← 退避（Phase 2 で復活候補）
│   │   ├── factories/            ← 退避
│   │   ├── inventory/            ← 退避
│   │   ├── logistics/            ← 退避
│   │   ├── payments/             ← 退避
│   │   ├── registry/             ← 退避
│   │   ├── shipments/            ← 退避
│   │   ├── smart-quote/          ← 退避
│   │   ├── staff/                ← 退避
│   │   └── deals_unused/
│   │       ├── chat/             ← deals/[id]/chat から退避
│   │       ├── food-import/      ← deals/[id]/food-import から退避
│   │       ├── customs-invoice/
│   │       ├── samples/
│   │       ├── shipment-wizard/
│   │       ├── smart-quote/
│   │       └── assign-factories/
│   ├── deals/                    ★ Phase 1 のメイン
│   │   ├── page.tsx              ← 案件一覧
│   │   ├── new/page.tsx          ← 新規作成
│   │   └── [id]/
│   │       ├── page.tsx          ← 案件詳細
│   │       ├── edit/page.tsx     ← 案件編集
│   │       ├── designs/page.tsx  ← 画像管理（流用）
│   │       ├── documents/page.tsx← 添付（流用）
│   │       ├── quote/page.tsx    ← 見積詳細
│   │       └── quotes/new/page.tsx← 新規見積
│   ├── settings/page.tsx         ← 残す
│   ├── page.tsx                  ← ダッシュボード（簡略化）
│   └── layout.tsx                ← 残す
├── _archive_factory/             ★ factory/ をリネーム
├── _archive_portal/              ★ portal/ をリネーム
├── auth/                         ← 残す
├── login/                        ← 残す
├── api/                          ← 内部のみ Phase 1 用に整理
└── layout.tsx                    ← 残す

src/lib/actions/
├── deals.ts                      ← Phase 1 で使う（要整理）
├── settings.ts                   ← 残す
├── quotes.ts                     ← Phase 1 で使う
└── _unused/                      ★ 退避ディレクトリ（新規作成）
    ├── chat.ts
    ├── inventory.ts
    ├── logistics.ts
    ├── portal.ts
    ├── factory.ts
    ├── factory-assignments.ts
    ├── samples.ts
    ├── smart-quote.ts
    ├── designs.ts                ← 画像管理だが、Phase 1 用に再実装するため退避
    ├── excel-parse.ts
    ├── payments.ts
    ├── factories.ts
    └── clients.ts                ← Phase 1 では deals 内に含める

src/components/
├── deals/                        ← Phase 1 で使う（要整理）
├── deal-progress-bar.tsx         ← 7 段階に改修
├── status-dot.tsx                ← 残す
├── sidebar.tsx                   ← Phase 1 用に絞る
├── layout/                       ← 残す
├── shared/                       ← 残す
└── _unused/                      ★ 退避
    ├── factory/
    ├── portal/
    └── dashboard/                ← 一旦退避、後で簡略版を新規作成
```

### Next.js ルーティング規則
- `_` で始まるディレクトリは App Router の対象外
- 物理削除せず、`_archive` / `_unused` プレフィックスで無効化

---

## 3. データモデル（追加分のみ）

### 新規 migration: `018_phase1_simple_status.sql`

```sql
-- ============================================================================
-- BAO Flow v2.0 Phase 1
-- simple_status カラム追加
-- 既存 master_status (M01-M25) は温存
-- ============================================================================

-- 1. simple_status の ENUM 型を作成
CREATE TYPE simple_status AS ENUM (
  'quoting',           -- 見積中
  'quote_confirmed',   -- 見積確定
  'paid',              -- 入金完了
  'data_confirmed',    -- 最終入稿データ確認完了
  'in_production',     -- 製作中
  'shipped',           -- 工場発送完了
  'delivered'          -- 納品完了
);

-- 2. deals テーブルにカラム追加
ALTER TABLE deals
  ADD COLUMN simple_status simple_status NOT NULL DEFAULT 'quoting',
  ADD COLUMN visibility TEXT NOT NULL DEFAULT 'internal'; -- Phase 2 への伏線

-- 3. deal_status_history を simple_status にも対応
ALTER TABLE deal_status_history
  ADD COLUMN from_simple_status simple_status,
  ADD COLUMN to_simple_status simple_status;

-- 4. インデックス追加（一覧取得時のソート用）
CREATE INDEX idx_deals_simple_status ON deals(simple_status);
CREATE INDEX idx_deals_visibility ON deals(visibility);

-- 5. 既存データの初期値設定（master_status から推定）
-- 既存案件があれば、おおまかにマッピング
UPDATE deals SET simple_status = CASE
  WHEN master_status IN ('M01','M02','M03','M04','M05','M06','M07','M08','M09','M10') THEN 'quoting'::simple_status
  WHEN master_status = 'M11' THEN 'quote_confirmed'::simple_status
  WHEN master_status IN ('M12','M13','M14') THEN 'quote_confirmed'::simple_status
  WHEN master_status = 'M15' THEN 'paid'::simple_status
  WHEN master_status IN ('M16','M17','M18') THEN 'in_production'::simple_status
  WHEN master_status IN ('M19','M20','M21') THEN 'in_production'::simple_status
  WHEN master_status IN ('M22','M23') THEN 'shipped'::simple_status
  WHEN master_status IN ('M24','M25') THEN 'delivered'::simple_status
  ELSE 'quoting'::simple_status
END
WHERE simple_status = 'quoting';  -- DEFAULT で入った値を上書き

COMMENT ON COLUMN deals.simple_status IS 'Phase 1: シンプル7段階ステータス。master_status とは独立';
COMMENT ON COLUMN deals.visibility IS 'Phase 2 用伏線: internal/client_shared/factory_shared';
```

### types.ts への追加

`src/lib/types.ts` の末尾に追加：

```typescript
// ============================================================================
// Phase 1: Simple Status (7段階)
// ============================================================================

export type SimpleStatus =
  | 'quoting'
  | 'quote_confirmed'
  | 'paid'
  | 'data_confirmed'
  | 'in_production'
  | 'shipped'
  | 'delivered'

export interface SimpleStatusConfig {
  label: string
  step: number  // 1-7
  color: 'pending' | 'confirmed' | 'warning' | 'active' | 'shipping'
  nextLabel?: string  // 次の段階の表示用
  nextAction?: string // スタッフ向けの次のアクション説明
}

export const SIMPLE_STATUS_CONFIG: Record<SimpleStatus, SimpleStatusConfig> = {
  quoting: {
    label: '見積中',
    step: 1,
    color: 'pending',
    nextLabel: '見積確定',
    nextAction: '見積書を確定する',
  },
  quote_confirmed: {
    label: '見積確定',
    step: 2,
    color: 'confirmed',
    nextLabel: '入金完了',
    nextAction: '請求書を発行し入金を確認',
  },
  paid: {
    label: '入金完了',
    step: 3,
    color: 'warning',
    nextLabel: '最終入稿データ確認完了',
    nextAction: '最終入稿データを確認',
  },
  data_confirmed: {
    label: '最終入稿データ確認完了',
    step: 4,
    color: 'active',
    nextLabel: '製作中',
    nextAction: '工場へ製作開始指示',
  },
  in_production: {
    label: '製作中',
    step: 5,
    color: 'active',
    nextLabel: '工場発送完了',
    nextAction: '工場発送を待つ',
  },
  shipped: {
    label: '工場発送完了',
    step: 6,
    color: 'shipping',
    nextLabel: '納品完了',
    nextAction: '到着を追跡',
  },
  delivered: {
    label: '納品完了',
    step: 7,
    color: 'confirmed',
  },
}

export const SIMPLE_STATUS_ORDER: SimpleStatus[] = [
  'quoting',
  'quote_confirmed',
  'paid',
  'data_confirmed',
  'in_production',
  'shipped',
  'delivered',
]
```

---

## 4. 画面一覧（Phase 1 全 10 画面）

| # | パス | 画面名 | 主要機能 |
|---|---|---|---|
| 1 | `/` | ダッシュボード | 案件サマリ、ステータス別件数 |
| 2 | `/deals` | 案件一覧 | 一覧表示、ステータス絞込、検索 |
| 3 | `/deals/new` | 案件新規作成 | 基本情報入力 |
| 4 | `/deals/[id]` | 案件詳細 | 全情報表示、ステータス更新 |
| 5 | `/deals/[id]/edit` | 案件編集 | 基本情報編集 |
| 6 | `/deals/[id]/quote` | 見積詳細 | 見積一覧、計算結果 |
| 7 | `/deals/[id]/quotes/new` | 見積新規作成 | 商品仕様 + 見積入力 |
| 8 | `/deals/[id]/designs` | 画像管理 | 商品画像のアップロード・閲覧 |
| 9 | `/settings` | 設定 | 為替レート、消費税率など |
| 10 | `/login` | ログイン | 既存流用 |

### サイドバー（Phase 1 版）

```
🏠 ホーム
📋 案件
⚙️ 設定
```

---

## 5. Sprint 計画

### Sprint 0: 環境整理（目標 2-3h）

#### Sprint 0-1: ブランチ作成
```bash
git checkout main
git pull
git checkout -b v1-archive
git push origin v1-archive
git checkout main
git checkout -b v2-phase1
```

#### Sprint 0-2: ディレクトリ退避
`src/app/(main)/` 内に `_archive/` を作成し、§2 のディレクトリ構造に従って退避。
`mv` コマンドで移動（git に履歴を残す）。

```bash
cd src/app/\(main\)
mkdir -p _archive
git mv analytics _archive/
git mv catalog _archive/
git mv inventory _archive/
git mv logistics _archive/
git mv payments _archive/
git mv registry _archive/
git mv shipments _archive/
git mv smart-quote _archive/
git mv staff _archive/
git mv clients _archive/
git mv factories _archive/

mkdir -p _archive/deals_unused
cd deals/\[id\]
git mv chat ../../_archive/deals_unused/
git mv food-import ../../_archive/deals_unused/
git mv customs-invoice ../../_archive/deals_unused/
git mv samples ../../_archive/deals_unused/
git mv shipment-wizard ../../_archive/deals_unused/
git mv smart-quote ../../_archive/deals_unused/
git mv assign-factories ../../_archive/deals_unused/
git mv excel-import ../../_archive/deals_unused/
git mv pdf ../../_archive/deals_unused/
cd ../..

cd ../
git mv factory _archive_factory/
git mv portal _archive_portal/
```

#### Sprint 0-3: actions の整理
```bash
cd src/lib/actions
mkdir -p _unused
git mv chat.ts _unused/
git mv inventory.ts _unused/
git mv logistics.ts _unused/
git mv portal.ts _unused/
git mv factory.ts _unused/
git mv factory-assignments.ts _unused/
git mv samples.ts _unused/
git mv smart-quote.ts _unused/
git mv designs.ts _unused/
git mv excel-parse.ts _unused/
git mv payments.ts _unused/
git mv factories.ts _unused/
git mv clients.ts _unused/
```

#### Sprint 0-4: components の整理
```bash
cd src/components
mkdir -p _unused
git mv factory _unused/
git mv portal _unused/
git mv dashboard _unused/
```

#### Sprint 0-5: build エラー修正
- `npm run build` を実行
- import エラーが出るので、Phase 1 で使うファイルから _unused/_archive への参照を削除
- 削除した参照に依存していたコードはコメントアウトか TODO で明示

#### Sprint 0-6: サイドバー絞り込み
`src/components/sidebar.tsx` の `menuStructure` を以下に変更：

```typescript
const menuStructure: MenuCategory[] = [
  {
    items: [{ label: 'ホーム', href: '/', icon: Home }],
  },
  {
    items: [{ label: '案件', href: '/deals', icon: FileText }],
  },
  {
    items: [{ label: '設定', href: '/settings', icon: Settings }],
  },
]
```

#### Sprint 0-7: CLAUDE.md 更新
ルートの `CLAUDE.md` に以下を追記：

```markdown
## Phase 1 作業ルール

### 触らないディレクトリ
以下は Phase 1 のスコープ外。読まない・修正しない・参照しない：
- src/app/(main)/_archive/
- src/app/_archive_factory/
- src/app/_archive_portal/
- src/lib/actions/_unused/
- src/components/_unused/

### Phase 1 のスコープ
- 7 段階の simple_status による案件管理
- 5 機能のみ：案件基本情報 / 商品仕様 / 見積計算 / ステータス管理 / 画像管理
- 詳細は docs/Phase1_実装仕様書.md を参照
```

#### Sprint 0 完了条件
- [ ] `npm run build` がエラーなく通る
- [ ] `npm run dev` でログイン後、サイドバーが「ホーム / 案件 / 設定」だけ
- [ ] `/deals` 画面が表示される（ただし内部の挙動は要修正）
- [ ] git commit が綺麗に分かれている（退避と削除を分ける）

---

### Sprint 1: ステータス基盤（目標 3-4h）

#### Sprint 1-1: DB マイグレーション実行

`supabase/migrations/018_phase1_simple_status.sql` を作成（§3 の SQL）。

```bash
# Supabase CLI または管理画面から実行
supabase db push
# または管理画面で SQL Editor から実行
```

**確認**：既存案件があれば simple_status が NULL でないこと。

#### Sprint 1-2: types.ts 拡張

§3 の types.ts への追加分を反映。

#### Sprint 1-3: 進捗バー改修

`src/components/deal-progress-bar.tsx` を 7 段階版に改修。
旧 25 段階版は `_unused/` に退避してから新規実装。

要件：
- 横並びの 7 つのドット + ラベル
- 現在のステップは塗りつぶし、過去は緑、未来はグレー
- 各ドットの下にラベル（縦書きを許容、PC では横書き）
- クリックで「次のステップへ進める」確認ダイアログ
- レスポンシブ（モバイルでは省略表示）

デザイン参考：CLAUDE.md のデザインシステム
- ドット: 5px の丸（status-dot.tsx を流用）
- 色: pending（#bbbbbb）/ active（#0a0a0a）/ confirmed（#22c55e）

#### Sprint 1-4: ステータス更新の Server Action

`src/lib/actions/deals.ts` に追加：

```typescript
export async function updateSimpleStatus(
  dealId: string,
  newStatus: SimpleStatus
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // 現在のステータスを取得
  const { data: current } = await supabase
    .from('deals')
    .select('simple_status')
    .eq('id', dealId)
    .single()

  if (!current) return { success: false, error: '案件が見つかりません' }

  // ステータス更新
  const { error: updateError } = await supabase
    .from('deals')
    .update({
      simple_status: newStatus,
      last_activity_at: new Date().toISOString()
    })
    .eq('id', dealId)

  if (updateError) return { success: false, error: updateError.message }

  // 履歴を記録
  await supabase.from('deal_status_history').insert({
    deal_id: dealId,
    from_simple_status: current.simple_status,
    to_simple_status: newStatus,
    changed_at: new Date().toISOString(),
  })

  revalidatePath(`/deals/${dealId}`)
  revalidatePath('/deals')
  return { success: true }
}

export async function advanceSimpleStatus(
  dealId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: current } = await supabase
    .from('deals')
    .select('simple_status')
    .eq('id', dealId)
    .single()

  if (!current) return { success: false, error: '案件が見つかりません' }

  const currentIndex = SIMPLE_STATUS_ORDER.indexOf(current.simple_status)
  if (currentIndex === -1 || currentIndex === SIMPLE_STATUS_ORDER.length - 1) {
    return { success: false, error: 'これ以上進められません' }
  }

  const nextStatus = SIMPLE_STATUS_ORDER[currentIndex + 1]
  return updateSimpleStatus(dealId, nextStatus)
}
```

#### Sprint 1 完了条件
- [ ] DB に simple_status カラムが存在
- [ ] types.ts に SIMPLE_STATUS_CONFIG が定義
- [ ] 進捗バーが 7 段階で表示される
- [ ] 「次のステップへ進める」ボタンで状態遷移する
- [ ] 履歴が deal_status_history に記録される

---

### Sprint 2: 案件管理 CRUD（目標 4-5h）

#### Sprint 2-1: 案件一覧 `/deals/page.tsx`

要件：
- 案件カード形式で表示（テーブル形式は使わない、デザインシステムに合わせる）
- 各カード：案件名、クライアント名、現在ステータス、最終更新日
- 上部にフィルタ：ステータス絞込（全件 / 7 段階それぞれ）、検索（案件名・クライアント名）
- 右上に「新規案件」ボタン
- 既存の `src/app/(main)/deals/page.tsx` を改修

#### Sprint 2-2: 案件新規作成 `/deals/new/page.tsx`

要件：
- フォーム項目（最小限）：
  - 案件名（必須）
  - クライアント名（テキスト入力、Phase 1 ではマスター連携しない）
  - 希望納期（日付）
  - 担当スタッフ（profiles から選択）
  - メモ（任意）
- 送信後 `/deals/[id]` にリダイレクト
- simple_status は 'quoting' で開始

新規 Server Action：

```typescript
export async function createDeal(input: {
  deal_name: string
  client_name: string  // テキストとして deal_groups に保存するか、専用カラム追加
  desired_delivery_date?: string
  sales_user_id?: string
  memo?: string
}): Promise<{ deal_id: string }> {
  // 実装
}
```

**注意**：既存の deals テーブルには client_id (UUID) はあるが client_name はない。Phase 1 では文字列で持つため、deals に `client_name_text TEXT` カラムを追加する必要がある。

→ migration 018 に追記：
```sql
ALTER TABLE deals
  ADD COLUMN client_name_text TEXT,
  ADD COLUMN desired_delivery_date DATE,
  ADD COLUMN memo TEXT;
```

#### Sprint 2-3: 案件詳細 `/deals/[id]/page.tsx`

要件：
- 上部: 案件名、クライアント名、ステータス進捗バー（7段階）、「次のステップへ進める」ボタン
- 中央: タブまたはセクション
  - 基本情報（案件名、クライアント、希望納期、担当、メモ）
  - 商品仕様（複数表示、新規追加ボタン）
  - 見積（一覧表示、新規追加ボタン、合計金額表示）
  - 画像（サムネイル一覧、新規追加ボタン）
- 既存の `src/app/(main)/deals/[id]/page.tsx` を大幅に改修
  - 旧 page.tsx には Phase 1 で使わない要素（factory_assignments, samples, payments など）が大量にある。これらを削除

#### Sprint 2-4: 案件編集 `/deals/[id]/edit/page.tsx`

新規作成と同じフォームで、現在値が入った状態。

#### Sprint 2 完了条件
- [ ] 案件一覧が表示され、ステータスフィルタが効く
- [ ] 新規案件作成 → 詳細表示 → 編集 → 保存 が一連で動く
- [ ] 各画面でデザインシステムが適用されている（CLAUDE.md 参照）

---

### Sprint 3: 商品仕様 + 見積（目標 4-5h）

#### Sprint 3-1: 商品仕様 CRUD

`/deals/[id]/specifications/new/page.tsx`（新規作成）と関連する編集画面。

deal_specifications テーブルの全カラムは多い（30+）が、Phase 1 では以下に絞る：

| カラム | 用途 | UI |
|---|---|---|
| product_name | 商品名 | 必須 |
| product_category | カテゴリ | 自由入力 |
| height_mm, width_mm, depth_mm | サイズ | 数値 |
| material_category | 素材 | 自由入力 |
| print_colors | 印刷色数 | 自由入力 |
| printing_method | 印刷方法 | 自由入力 |
| processing_list | 加工 | チェックボックス（deboss, emboss, foil 等） |
| reference_images | 参考画像URL | Phase 1 では Sprint 4 で対応 |
| specification_memo | メモ | テキストエリア |

**他のカラムは入力 UI を出さない**（NULL のまま）。Phase 2 で必要に応じて追加。

#### Sprint 3-2: 見積 CRUD と計算

`/deals/[id]/quotes/new/page.tsx`（既存改修）。

deal_quotes テーブルの主要カラム：
- quantity（数量）
- factory_unit_price_usd（工場単価 USD）
- plate_fee_usd（版代）
- other_fees_usd（その他費用）
- exchange_rate（為替レート）
- cost_ratio（掛け率）

**簡略化**：
- Phase 1 では送料計算は手入力（other_fees_usd に含める）
- 容積重量計算は Phase 2 で実装
- 既存の cost-engine.ts を流用

UI:
1. 数量入力
2. 工場単価入力（USD）
3. 版代・その他費用入力
4. 為替レート（settings からデフォルト取得、上書き可）
5. 掛け率（settings からデフォルト取得、上書き可）
6. → 自動計算で「販売単価 JPY」「請求合計（税抜・税込）」を表示
7. 確定ボタンで保存

#### Sprint 3-3: 見積一覧 `/deals/[id]/quote/page.tsx`

複数見積を一覧表示。MOQ 違いで複数バージョン作成可能。

#### Sprint 3 完了条件
- [ ] 1 案件に複数の商品仕様を登録できる
- [ ] 1 案件に複数の見積（数量別）を登録できる
- [ ] 為替レート・掛け率を入れると税込価格まで自動計算される
- [ ] 既存の cost-engine.ts が機能する

---

### Sprint 4: 画像管理 + 仕上げ（目標 3-4h）

#### Sprint 4-1: 画像アップロード

`/deals/[id]/designs/page.tsx`（既存を改修）。

要件：
- ドラッグ＆ドロップで複数画像アップロード
- Supabase Storage に保存
- バケット名: `deal-images`（既存があれば流用）
- 画像のサムネイル一覧
- クリックで拡大表示（lightbox）
- 削除機能
- 各画像にメモ追加可（任意）

実装：
- documents テーブル（または deal_design_files テーブル）に保存
- storage_url, file_name, file_size, deal_id を記録

#### Sprint 4-2: ダッシュボード簡略化

`/page.tsx` をシンプルに：
- 案件ステータス別の件数（7 つのカード）
- 直近更新された案件 5 件
- それ以外は表示しない

旧 `src/components/dashboard/` は使わず、シンプルに直接実装。

#### Sprint 4-3: 設定画面

`/settings/page.tsx`：
- 為替レート（USD/JPY）
- 消費税率（%）
- デフォルト掛け率
- 自分のプロフィール情報

system_settings テーブルを使う。

#### Sprint 4-4: 総合確認

- [ ] 案件作成 → 商品仕様追加 → 見積作成 → 画像追加 → ステータス進める → 完了 まで通る
- [ ] エラー処理（必須項目未入力など）が適切
- [ ] モバイル表示（スマホ）でも崩れない
- [ ] CLAUDE.md のデザインシステムに準拠している
- [ ] Lighthouse パフォーマンススコア 80 以上

---

## 6. 設計判断のリマインド

### Do
- 既存テーブル・スキーマを活かす（追加はしても削除はしない）
- デザインシステム（モノクロ + 緑アクセント）を厳守
- Server Actions で実装（API Routes は使わない）
- 型定義を types.ts に集約
- Phase 1 の 5 機能から外れる実装はしない

### Don't
- 新規テーブルを作らない（既存で十分）
- master_status を触らない（温存）
- _archive/ や _unused/ のコードを参照しない
- 「ついでに」を作らない（スコープを守る）
- 25 段階の進捗バーを残さない（7 段階のみに統一）

---

## 7. リスクと対策

### リスク 1: 既存コードの参照が広範囲

`_unused/` に退避した actions が、Phase 1 で使うコードから参照されている可能性。

**対策**：Sprint 0-5 で build を通す段階で全て解消する。1〜2時間想定。

### リスク 2: deal_specifications の 30+ カラム

UI で全部出さなくても DB 側は NULL 許容なので問題ない。ただし、既存の Server Action が必須前提で書かれている可能性。

**対策**：deals.ts の create/update を Phase 1 用に簡略版で書き直す。

### リスク 3: 認証まわり

既存の認証は profiles + clients + factories の複数テーブルに依存。Phase 1 では profiles のみ使う。

**対策**：middleware.ts と auth/ は触らない。Phase 1 のスタッフは全員 profiles に登録済みである前提。

### リスク 4: cost-engine.ts の互換性

既存の計算エンジンは USD ベース。SHIBUichi Excel は JPY/USD/元 混在。

**対策**：Phase 1 では USD ベースのみサポート。元建ての見積は USD に換算してから入力するルールにする。

---

## 8. 完成判定基準

Phase 1 の完成 = 以下が全て満たされた状態：

- [ ] 仲裁部スタッフが案件を新規登録できる
- [ ] 商品仕様を複数登録できる
- [ ] 見積を作成し、税込価格まで自動計算される
- [ ] 画像を複数枚アップロードして閲覧できる
- [ ] ステータスを 7 段階で更新できる
- [ ] 一覧でステータス別に絞り込める
- [ ] スマホでも見られる
- [ ] 全画面でデザインシステムが統一されている
- [ ] `npm run build` がクリーン
- [ ] Vercel にデプロイ済み
- [ ] スタッフが 1 案件を最初から最後まで操作できた

---

## 9. 進捗報告タイミング

各 Sprint 完了時に白へ報告。
報告内容：
- 完了したタスク
- 未完了の理由（あれば）
- 次の Sprint で気になる点
- 全体何 % 完了したか

---

## 10. 次の Step

この仕様書を Claude Code に渡し、Sprint 0 から実行開始。

**白がやること**：
1. この仕様書を確認、修正があれば指示
2. Claude Code を起動し、リポを開く
3. Sprint 0 を開始させる（このファイルを `docs/Phase1_実装仕様書.md` として配置）
4. Sprint ごとに進捗を確認

**Claude (Opus) がやること**：
1. Sprint 進行中に Claude Code から質問が来たら回答
2. 詰まった部分の設計判断
3. Sprint 完了後のレビュー
