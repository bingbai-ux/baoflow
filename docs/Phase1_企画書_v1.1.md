# BAO Flow v2.0 / Phase 1 企画書

**版数**: v1.1（判断反映版）
**更新日**: 2026-04-25
**作成**: 白 × Claude (Opus)
**ステータス**: Step 1 完了 → Step 2（データモデル設計）へ

---

## 1. プロジェクト概要

### プロジェクト名
**BAO Flow v2.0**（kokon inc. B2B 包材調達プラットフォーム 再生版）

### Phase 1 スコープ
**kokon inc. 仲裁部スタッフ向け 社内業務管理システム**
- クライアント画面・工場画面は Phase 2 以降
- Excel ベースの案件管理からの脱却

### 基本方針
- **既存 BAO Flow v1.0 リポを修正して使う**（新規構築ではない）
- **既存 Supabase プロジェクトを利用**（新規セットアップ不要）
- v1.0 の「詰め込みすぎ」を構造的に解消

### v1.0 失敗要因と v2.0 での対策

| v1.0 の問題 | v2.0 の対策 |
|---|---|
| 60+ 画面、38 テーブル、25 ステータス | **_archive/ に退避し、Phase 1 は 10 画面・7 ステータスに絞る** |
| 全ロール（自社/クライアント/工場）を同時構築 | **段階的**（自社→クライアント→工場） |
| UI をほぼ見ずに実装任せ | **Claude Design で UI/UX 先行設計** |
| ビジネスロジックとテーブル設計の未整合 | **Excel 業務フローを正とし、データモデルを逆算** |

---

## 2. Who / What / Why

### Who（ユーザー）
**kokon inc. 仲裁部スタッフ（数名）**
- 日本側で案件を受注、中国工場と交渉・発注・品質管理・物流手配
- 現状は Excel で全工程を管理

### What（提供価値）
**案件の受注から納品完了までを一元管理する業務システム**
- 1 案件 = 複数商品（サイズ違い・素材違い）
- 各商品に複数の見積パターン（MOQ、単価、送料、掛け率、税）
- 7 段階のシンプルなステータスで業務フローを進行

### Why（なぜ必要か）
1. 情報が散らばる（見積・PO・物流・QC・請求が Excel シートに混在）
2. Excel 管理が煩雑（1 案件 1 シート、列が無限増殖）
3. 計算ミス・入力ミス
4. 画像管理が不便（Excel 貼付の限界）
5. 既存 SaaS では対応できない独自業務（見積 + PO + QC + 物流 + 翻訳 + 中国工場特殊事情）

---

## 3. Phase 1 機能スコープ（5 機能のみ）

| # | 機能群 | 必須要素 |
|---|---|---|
| 1 | **案件基本情報** | 会社名、プロジェクト名、希望納期、担当者 |
| 2 | **商品仕様** | 1 案件に複数商品。サイズ、素材、色（パントンカラー含む）、加工、印刷色数・方法 |
| 3 | **見積計算** | 数量別単価、送料（容積重量/実重量の大きい方）、掛け率、税抜/税込、型代・版代、サンプル費、食品検査費 |
| 4 | **ステータス管理** | **7 段階**（下記 §4 参照） |
| 5 | **画像管理** | 高画質表示、複数画像対応、商品ごとに紐付け |

### Phase 2 送り（Phase 1 では実装しない）
- 権限別ビュー（自社/クライアント/工場の表示分岐）
  - ただし **DB 設計に `visibility` / `owner_role` カラムは仕込んでおく**
- 日英翻訳
- CRM 商談管理連動
- 請求書自動反映
- 工場休業カレンダー連動
- 食品検査チェックによる条件付き列表示切替
- 納期ベースカレンダー共有
- チャット、サンプル、工場振り分け、AI 機能、在庫、物流など旧 v1.0 の大半の機能

---

## 4. ステータス設計（Phase 1 最終版）

### 7 段階ステータス（simple_status カラム）

| # | 日本語 | 英語ID | フェーズ | 次のアクション |
|---|---|---|---|---|
| 1 | 見積中 | quoting | 見積 | 見積書を確定する |
| 2 | 見積確定 | quote_confirmed | 見積 | 請求書発行・入金依頼 |
| 3 | 入金完了 | paid | 発注 | 最終入稿データを確認 |
| 4 | 最終入稿データ確認完了 | data_confirmed | 製作 | 工場へ製作開始指示 |
| 5 | 製作中 | in_production | 製作 | 工場発送を待つ |
| 6 | 工場発送完了 | shipped | 納品 | 到着を追跡 |
| 7 | 納品完了 | delivered | 完了 | — |

### DB 戦略（S2 採用の意味）

- 既存 `master_status`（M01-M25）カラムは**温存**（データも UI からも触らない）
- 新 `simple_status` カラムを追加し、Phase 1 はこちらのみ使用
- 旧カラムを削除するかは Phase 2 以降で判断

### DB 設計の伏線（Phase 2 への布石）

```sql
-- 将来の権限制御用カラムを先に仕込む
ALTER TABLE deals ADD COLUMN visibility TEXT DEFAULT 'internal';
-- 値の候補: 'internal' | 'client_shared' | 'factory_shared'
```

---

## 5. 成功指標

### 定性指標
- 仲裁部スタッフがストレス軽減を実感
- リリース後 2-4 週間で担当スタッフへヒアリング
- 「Excel に戻りたい」と言われないこと

### 定量指標
- **Excel での管理時間が月 X 時間削減**
- X は Phase 1 リリース前に現状計測（ベースライン設定）
- 目標値は計測結果を見てから設定（根拠なき数値目標は置かない）

### その他期待効果
- Phase 2・3 への土台（データモデル・業務フローが整理される）
- v1.0 の反省の具現化

---

## 6. リポ扱い戦略（C: ハイブリッド）

### ディレクトリ構造の変更

```
src/app/
├── (main)/
│   ├── deals/            ← Phase 1 で使う
│   ├── settings/         ← Phase 1 で使う
│   ├── page.tsx          ← ダッシュボード（簡略化）
│   └── _archive/         ← ★ Phase 1 で使わない画面を退避
│       ├── analytics/
│       ├── catalog/
│       ├── clients/      ← Phase 2 で復活候補
│       ├── factories/    ← Phase 2 で復活候補
│       ├── inventory/
│       ├── logistics/
│       ├── payments/
│       ├── registry/
│       ├── shipments/
│       ├── smart-quote/
│       ├── staff/
│       └── deals/[id]/
│           ├── chat/
│           ├── food-import/
│           ├── customs-invoice/
│           ├── samples/
│           ├── shipment-wizard/
│           ├── smart-quote/
│           └── assign-factories/
├── factory/              → _archive_factory/ にリネーム
├── portal/               → _archive_portal/ にリネーム
├── auth/                 ← 残す
└── login/                ← 残す

src/lib/actions/
├── deals.ts              ← Phase 1 で使う（ただし要整理）
├── clients.ts            ← Phase 1 で使う（案件に紐づく会社情報）
├── settings.ts           ← 残す
└── _unused/              ← ★ 使わない actions を退避
    ├── chat.ts
    ├── inventory.ts
    ├── logistics.ts
    ├── portal.ts
    ├── factory.ts
    ├── factory-assignments.ts
    ├── samples.ts
    ├── smart-quote.ts
    ├── designs.ts
    ├── excel-parse.ts
    ├── quotes.ts        ← 要精査（Phase 1 で一部使う可能性）
    ├── payments.ts
    └── factories.ts     ← 要精査
```

### Next.js のルーティング規則活用
- `_` で始まるディレクトリは Next.js App Router のルーティング対象外
- ファイルは残るが、URL からアクセス不可

### Claude Code への指示
- CLAUDE.md に `_archive/` / `_unused/` を読まない指示を明記
- Phase 1 作業で token を消費しない

---

## 7. タイムライン

**Phase 1 完成: 来週中（2026-05-02 までに動作するものをリリース）**

### Step 進行表

| Step | 内容 | 状態 |
|---|---|---|
| Step 1 | 深掘り壁打ち（企画書作成） | **完了** |
| Step 2 | コア設計（データモデル・API・画面一覧） | 次 |
| Step 3 | UI/UX 設計（Claude Design） | 未着手 |
| Step 4 | 実装仕様書（Claude Code 発注書） | 未着手 |
| Step 5 | Sprint 実装（Claude Code / Sonnet） | 未着手 |

### Sprint 実装の想定

| Sprint | 内容 | 想定時間 |
|---|---|---|
| Sprint 0 | リポ整理（_archive 退避、build 通す） | 1-2h |
| Sprint 0 | simple_status カラム追加 | 30min |
| Sprint 1 | ステータス UI 実装（7段階プログレスバー） | 2-3h |
| Sprint 1 | 案件基本情報 CRUD | 2-3h |
| Sprint 2 | 商品仕様 CRUD | 3-4h |
| Sprint 2 | 見積計算の厳密化 | 3-4h |
| Sprint 3 | 画像管理改善 | 2-3h |
| Sprint 3 | ダッシュボード簡略化 | 1-2h |
| Sprint 4 | 総合動作確認 | 2-3h |

**合計 17-25h**。1日 6-8h で **3-4日**。

---

## 8. 技術前提

| 領域 | 採用 |
|---|---|
| フロント | **Next.js 15**（App Router）→ 既存踏襲 |
| バックエンド | **Supabase**（既存プロジェクト利用） |
| ホスティング | **Vercel** → 既存踏襲 |
| デザインシステム | **旧リポの CLAUDE.md を踏襲**（Fraunces + Zen Kaku Gothic + モノクロ+緑アクセント） |
| 開発ツール | Claude Code（Sonnet）+ ECC |
| 言語 | TypeScript |
| UI ライブラリ | shadcn/ui + カスタムデザイントークン |

---

## 9. 継承資産と廃棄資産

### 継承（そのまま使う）
- 環境構築: package.json, tsconfig, tailwind.config, next.config
- 認証: src/lib/supabase/, middleware.ts, src/app/auth/, src/app/login/
- 型定義の骨格: src/lib/types.ts（ただし不要型を整理）
- デザインシステム: CLAUDE.md, design-system/
- 計算ロジック候補: src/lib/calc/（要精査）
- 既存 DB スキーマ: migrations 001-017（テーブルは残す、simple_status だけ追加）

### 修正して使う
- src/app/(main)/deals/: 案件一覧・詳細（UI は大幅改修）
- src/components/deal-progress-bar.tsx: 7 段階に合わせて改修
- src/components/deals/: 案件関連コンポーネント（要整理）

### 退避（_archive/, _unused/ へ）
- §6 のディレクトリ構造参照

---

## 10. 決定ログ

| 日付 | 決定事項 | 根拠 |
|---|---|---|
| 2026-04-24 | プロジェクト名を BAO Flow v2.0 に | v1.0 との連続性、再生の明示 |
| 2026-04-24 | Phase 戦略: 自社 → クライアント → 工場 | v1.0 失敗要因「全員向け同時構築」を回避 |
| 2026-04-24 | 業務モデル再設計（ルート B） | Excel 煩雑化の本質は業務設計の問題 |
| 2026-04-24 | Phase 1 は 5 機能に絞る | 「詰め込みすぎ」を構造的に回避 |
| 2026-04-24 | 権限別ビューは Phase 2 送り、DB に伏線 | UI は現在、モデルは未来 |
| 2026-04-24 | 条件付き列表示切替は Phase 2 送り | Phase 1 で工場画面がないため不要 |
| 2026-04-24 | タイムライン: 来週中 | 白の判断、ECC を使った高速開発前提 |
| 2026-04-25 | リポ扱い: C ハイブリッド | 安全・クリーン・Phase 2 での復活可能 |
| 2026-04-25 | DB: D1 既存 Supabase 利用 | env 再設定の時間を節約 |
| 2026-04-25 | ステータス: S2 + 7 段階 | Excel 一致・既存破壊ゼロ・学習コスト低 |
| 2026-04-25 | 7 段階目: 納品完了を末尾に追加 | 業務の終端を明確化、発送≠完了 |

---

## 11. オープン課題（Step 2 で解決）

### 高優先
1. **データモデル設計（ER 図レベル）**
   - 既存 38 テーブルのうちどれを使い、どう関連付けるか
   - simple_status 追加の具体的なマイグレーション SQL
2. **画面一覧の確定**
   - Phase 1 で必要な画面（想定 10 画面前後）
   - 各画面の目的・主要要素
3. **API 契約（Server Actions の interface）**
   - 案件 CRUD、見積計算、ステータス更新の入出力

### 中優先
4. 計算ロジックの厳密化（容積重量、送料、税込換算）
5. 画像ストレージの方針（Supabase Storage 利用の前提で問題ないか）
6. 認証の整理（既存の認証方式を Phase 1 にどう適用するか）

### 低優先（Phase 2 以降で）
7. 権限モデル詳細
8. 翻訳機能
9. 通知機能
