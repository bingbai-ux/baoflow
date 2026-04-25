# 旧 BAO Flow 分析結果 & 方針判断リクエスト

**分析日**: 2026-04-25
**分析対象**: /mnt/user-data/uploads/baoflow.zip

---

## Executive Summary

旧 BAO Flow は **エンタープライズ級の超大規模システム** として設計されている。
「詰め込みすぎ」は過少評価だった。v1.0 は以下の規模：

| 指標 | 数値 |
|---|---|
| 画面数 | **60+ 画面**（main 45 + factory 8 + portal 10） |
| DB テーブル数 | **38 個** |
| ステータス段階 | **25 段階**（M01-M25） |
| Server Actions 総行数 | **4,102 行** |
| TS/TSX 全 LOC | **27,399 行** |
| 要件定義書セクション数 | **68** |

**これは「小規模チーム + 工場が使うツール」ではなく、フォワーダー業・商社機能まで含めた統合プラットフォームの設計**になっている。

---

## 主要テーブル（38 個の内訳）

| カテゴリ | テーブル | Phase 1 関連度 |
|---|---|---|
| ユーザー | profiles, clients, factories, factory_users, client_users | △ 一部使う |
| **案件管理** | **deals, deal_groups, deal_specifications, deal_design_files** | **◎ コア** |
| **見積** | **deal_quotes, deal_shipping_options, deal_schedule** | **◎ コア** |
| サンプル | deal_samples, deal_sample_summary | × Phase 2 |
| 工場割当 | deal_factory_assignments | × Phase 2 |
| 支払 | deal_factory_payments, transactions | × Phase 2 |
| 出荷 | deal_shipping, deal_packing_lists, deal_actuals | △ 一部 |
| ステータス | deal_status_history | ◎ コア |
| ドキュメント | documents | △ 画像管理として流用可 |
| チャット | chat_rooms, chat_messages, message_templates | × Phase 2 |
| 通知 | notifications, stale_alerts | × Phase 2 |
| AI | ai_action_logs | × 削除 |
| 在庫 | inventory_items, inventory_movements | × Phase 2 |
| 出荷指示 | shipment_orders, shipment_order_items | × Phase 2 |
| 物流 | logistics_notifications, logistics_agents, storage_billing | × Phase 2 |
| カタログ | catalog_items, product_registry | × Phase 2 |
| 食品検査 | test_reports | × Phase 2 |
| 設定 | system_settings | △ 残す |
| 価格 | price_records | × Phase 2 |

**Phase 1 で本当に使うテーブルは 5-8 個程度**。残り 30 個は「放置」か「削除」。

---

## 致命的なミスマッチ：ステータス設計

### 旧リポのステータス（M01-M25、25段階）

```
M01 見積もり依頼受付
M02 営業確認・工場選定中
M03 工場見積もり依頼送信済み
M04 工場回答待ち
M05 工場回答受領・原価計算完了
M06 クライアントへ見積もり提示
M07 クライアント検討中
M08 クライアント修正依頼
M09 見積もり再調整中
M10 見積もり再提示
M11 クライアント承認
M12 請求書発行
M13 クライアント入金待ち
M14 クライアント入金確認
M15 工場へ前払い
M16 工場入金確認・製造開始待ち
M17 製造開始
M18 製造中
M19 製造完了・検品
M20 工場残金支払い
M21 発送準備・パッキングリスト作成
M22 発送済み
M23 輸送中
M24 到着・検品
M25 納品完了
```

### SHIBUichi Excel のステータス（7段階）

```
見積中 → 見積確定 → 入金完了 → 最終入稿データ確認完了 → 製作中 → 工場発送完了
```

**25 段階 vs 7 段階**。設計思想が全く違う。旧システムは「全工程を細かくトラッキング」、Excel は「業務のマイルストーンだけ追う」。

**Phase 1 では Excel 側の 7 段階に寄せるべき**。25 段階は仲裁部スタッフには過剰。

---

## 画面構成の問題

### main（自社向け）45 画面

- analytics, catalog, clients, **deals**, factories, inventory, logistics, payments, registry, settings, shipments, smart-quote, staff
- deals/[id] 配下だけで **14 画面**（chat, designs, documents, customs-invoice, excel-import, food-import, pdf, quote, quotes/new, samples/new, shipment-wizard, smart-quote, assign-factories, edit）

### factory（工場向け）8 画面、portal（クライアント向け）10 画面

Phase 1 では factory / portal は**完全に触らない**（ただし削除もしない、Phase 2 で使う可能性）。

---

## 継承可能な資産

### ◎ 積極的に再利用

1. **環境構築全般**: package.json, tsconfig, tailwind, next.config, supabase 接続設定
2. **デザインシステム**: CLAUDE.md に定義された完成されたデザイントークン（Fraunces + Zen Kaku Gothic + モノクロ+緑アクセント）
3. **型定義の骨格**: src/lib/types.ts の基本型（deal, quote, spec 等）
4. **calc/ ディレクトリ**: 計算ロジック（容積重量、送料、税）
5. **supabase migration 001-003, 010**: スキーマの骨格部分
6. **認証まわり**: src/lib/supabase/, middleware.ts

### △ 部分的に流用

- src/app/(main)/deals/: 案件一覧・詳細の UI パターン
- src/components/deal-progress-bar.tsx: ステータス表示コンポーネント
- src/components/deals/: 案件関連コンポーネント

### × 削除または無視

- src/app/factory/: Phase 2 送り（削除せず放置）
- src/app/portal/: Phase 2 送り（削除せず放置）
- src/app/(main)/{analytics,catalog,inventory,logistics,payments,registry,shipments,smart-quote,staff}/: Phase 1 では不要
- src/app/(main)/deals/[id]/{chat,food-import,customs-invoice,samples,shipment-wizard,smart-quote,assign-factories}/: Phase 1 では不要
- chat, inventory, logistics, AI, smart-quote 関連の actions
- 対応する migration（後半のもの）

---

## v2.0 Phase 1 への示唆

### 戦略判断：2つの選択肢

#### 選択肢 A: ブランチ切って使わない画面を「隠す」

旧コードは残したまま、ナビゲーションから消す。URL 直打ちでのみアクセス可能。

| メリット | デメリット |
|---|---|
| 安全（壊さない） | リポの見通しが悪い |
| いつでも復活可能 | Claude Code が混乱する可能性 |
| 最速で動く | 「使わないコード」がスタッフに見える |

#### 選択肢 B: 使わないコードを**物理削除**（別ブランチに退避）

`v2-phase1` ブランチを切り、不要な app/components/actions/migrations を削除。
`v1-archive` ブランチを作って元コードを退避。

| メリット | デメリット |
|---|---|
| リポがクリーンになる | 削除範囲の判断ミスで壊す可能性 |
| Claude Code が扱いやすい | Phase 2 で「あれ、使いたかった」が起きる可能性 |
| スタッフの認知負荷が減る | 削除作業に時間がかかる |

#### 選択肢 C: ハイブリッド

- 物理削除: 明らかに使わない画面（analytics, AI, smart-quote 等）
- 非表示: 将来使う可能性がある画面（factory, portal）
- 継承: deals, quotes, 認証、デザインシステム

---

## 重要な警告

### 警告 1: DB スキーマのリビルド問題

旧リポには `010_rebuild_schema.sql` がある。過去に既に一度スキーマを作り直している。
**Phase 1 で再度リビルドすると、既存データが飛ぶ**。

→ 対策: 既存 DB にはテーブルを**追加**する形で対応するか、完全新規 Supabase プロジェクトを用意する。

### 警告 2: ステータス設計の不整合

M01-M25 は deal_status_history や notifications 等 **複数テーブルから参照されている**。
「7 段階に減らす」決断をすると、関連テーブルもすべて調整が必要。

→ 対策: Phase 1 では status を **新カラム `simple_status` として追加**。旧 `master_status` は温存。
段階的に新カラムに移行する戦略が安全。

### 警告 3: 25 → 7 段階マッピング

Excel 7 段階と旧 M01-M25 のマッピング：

| Excel | 旧システム |
|---|---|
| 見積中 | M01-M10 |
| 見積確定 | M11 |
| 入金完了 | M14 |
| 最終入稿データ確認完了 | （該当なし、新設必要） |
| 製作中 | M17, M18 |
| 工場発送完了 | M22 |

「最終入稿データ確認完了」に相当するものが旧システムにない。Phase 1 で新設する。

---

## 白への判断リクエスト

以下 3 つを決めてほしい：

### 判断 1: リポ扱い戦略（A / B / C）
- A: 全部残して非表示
- B: 不要物を物理削除
- **C: ハイブリッド（推奨）**

### 判断 2: DB 戦略
- D1: 既存 Supabase プロジェクトを使う（既存データは残る）
- D2: 新規 Supabase プロジェクトを作る（クリーンスタート）

### 判断 3: ステータス戦略
- S1: 25 段階を維持（Excel の 7 段階はビュー側でマッピング）
- S2: 7 段階に絞る（新 simple_status カラム追加、推奨）
- S3: 25 段階完全廃止、7 段階で書き換え（リスク大）

---

## Phase 1 完成ターゲット（来週中）への現実的ルート

判断が C + D1 + S2 の場合、大まかな作業量：

| 作業 | 想定時間 | Sprint |
|---|---|---|
| リポ整理（不要削除・非表示化） | 1-2h | Sprint 0 |
| deals テーブルに simple_status カラム追加 | 30min | Sprint 0 |
| Excel の 7 段階 UI 実装 | 2-3h | Sprint 1 |
| 案件基本情報 CRUD | 2-3h | Sprint 1 |
| 商品仕様 CRUD | 3-4h | Sprint 2 |
| 見積計算の厳密化 | 3-4h | Sprint 2 |
| 画像管理改善 | 2-3h | Sprint 3 |
| ステータス UI 統合 | 2-3h | Sprint 3 |
| 総合テスト | 2-3h | Sprint 4 |

**合計 17-25h**。1日 6-8h で **3-4日**。来週中は現実的。

---

## 次のアクション

白が上記 3 判断を下したら、以下を実行：

1. Step 2: データモデル設計（新チャット）
2. Step 3: Claude Design で UI/UX 設計
3. Step 4: Claude Code 向け実装仕様書
4. Step 5: Sprint 実装開始
