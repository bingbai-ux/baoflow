# Phase 1.5 完了レポート — BAO Flow v2.0

**完成日**: 2026-04-29
**ブランチ**: `main` @ `b277e5e`
**最終 migration**: `030_sprint9_archive_and_templates.sql`
**スコープ**: Sprint 1-9 (Phase 1 + Phase 1.5)

このドキュメントは Phase 2 開始時に Claude Code が Phase 1.5 全体像を把握するための参照資料です。
仕様書ではなく、**何ができていて何が残っているか** のスナップショット。

---

## A. 機能一覧 (Phase 1 → Sprint 9)

### Phase 1 (基盤): 認証 + 案件 CRUD + 7 段階ステータス
- Supabase Auth ログイン (`/login`)
- 案件 CRUD (`/deals`, `/deals/[id]`)
- `simple_status`: quoting → quote_confirmed → paid → data_confirmed → in_production → shipped → delivered
- 旧 `master_status` (M01-M25) は温存 (Phase 2 で再活用予定)
- 設定画面 (`/settings`): 為替/税率/掛け率/会社情報/銀行口座
- 主要ファイル: `src/app/(main)/page.tsx`, `src/lib/actions/deals.ts`

### Sprint 5 (4 階層構造、migration 023)
- `clients → deals → deal_products → deal_product_variants → deal_quotes` の階層に再構成
- 旧 `deal_specifications` は DROP せず温存
- 計算エンジン: `src/lib/calc/quote-engine.ts` + `logistics-engine.ts`
- 主要コミット: `9ef1036` (Merge v2-sprint5-4layer)

### Sprint 5 v2 (Claude Design 取り込み、migration 024)
- ダッシュボード再設計: KPI 4 タイル / パイプライン / トップクライアント
- `clients` / `factories` 拡張 (short_name, billing_to, tax_id, payment_terms, specialties[], stars 等)
- 主要コミット: `26dc429` (Merge v2-sprint5-design)

### Sprint 6 (マスター画面 + 帳票 + 通信 + モバイル、migration 025-026)
- `/master`: clients/factories の split-pane CRUD + 売上ロールアップ
- 4 種帳票統合 + RFQ 新規 (`document-templates.tsx`)
- `deal_communications`: 通信履歴 (email/wechat/phone/memo/meeting)
- `deal_status_history.kind`: 履歴フィルタチップ用
- 添付ファイル 5 カテゴリ: spec/quote/photo/contract/other
- 主要コミット: `417b654`, `928e68d`, `82ec578`, `c383337`

### Sprint 7 (スプレッド完全化、migration 027-028)
- `/deals` を 49 列 Excel 風スプレッドに統一 (`deal-excel-grid.tsx`)
- インライン編集 (Tab/Enter/Esc キーボードナビ + datalist 候補)
- 列幅 DB 永続化 (`user_preferences.deals_table_column_widths`)
- 商品レベル納品先 (`shipping_address_id` → `client_addresses`)
- 商品サムネイル (`thumbnail_url`)
- masonry 添付ギャラリー (CSS columns)
- ストレージバケット拡張: 全 MIME / 50MB
- 旧遷移ページ廃止 (_legacy_pages/ へ退避)
- 主要コミット: `1563e85` (Merge v2-sprint7-spreadsheet)

### Sprint 8 (外部フォーム + RFQ、migration 029)
- `external_forms` テーブル: 32-char base64url トークン、7 日有効期限、IP/UA ロギング、cancel 機能 (§0.5-5)
- `client_addresses`: 顧客の納品先 (複数登録可)
- `rfq_requests` + `rfq_factory_invitations`: RFQ 機能
- `factories.basic_info_completed`: RFQ 依頼可否フラグ
- `/external/client-registration/[token]` クライアント自己登録
- `/external/factory-registration/[token]` 工場自己登録 (EN+CN bilingual)
- `/external/rfq-response/[token]` 工場 RFQ 回答 (EN+CN bilingual、案件名マスク)
- マスター画面に「+ 招待リンク」ボタン (リンクコピー、メール送信なし)
- スプレッドに「見積依頼」ボタン → 商品 + 工場マルチセレクト → トークン発行
- 主要コミット: `2503004` (Merge v2-sprint8-external-forms)

### Sprint 9 (アーカイブ + 帳票テンプレ、migration 030)
- `deals.archived_at / archived_by / archive_reason / archive_note / tags`
- `system_settings` に帳票定型文 4 種 (quote/invoice/delivery_note/rfq_default_text)
- スプレッド行 ⋯ メニュー → 「案件をクローズ」
- `/archive` ページ: 検索 + ソート + 理由フィルタ + リオーダー
- §0.5-6 編集ロック: アーカイブ済み案件は archive_note / tags のみ編集可
- 帳票発行 UI: 定型文自動投入 + 「定型文に戻す」ボタン
- 案件番号 / 全テキスト コピペボタン
- 設定画面に 4 種定型文 textarea
- 主要コミット: `e60f6e6` (Sprint 9)、`b277e5e` (Merge to main)

---

## B. データモデル最終形 (migration 001-030)

### 主要テーブル階層

```
profiles (auth)
  ↓
clients ──┬─ client_addresses (Sprint 8)
          │
          ↓
        deals (archived_at / tags など Sprint 9 列)
          ├─ deal_products (Sprint 5)
          │    └─ deal_product_variants (Sprint 5)
          │         └─ deal_quotes (variant_id + factory_id を持つ)
          ├─ deal_specifications (旧、温存)
          ├─ deal_design_files (添付、5 カテゴリ)
          ├─ deal_status_history (kind フィルタ対応)
          ├─ deal_communications (Sprint 6)
          ├─ deal_fees
          ├─ deal_samples
          ├─ deal_factory_payments
          ├─ deal_shipping
          └─ deal_schedule

factories (basic_info_completed フラグ)
  ↑
  └─ rfq_factory_invitations ← rfq_requests ← deals
                              ↑
                    external_forms (token, IP/UA, expires_at)
```

### 全テーブル一覧 (主要)

| テーブル | 役割 | 主要 migration |
|---|---|---|
| `profiles` | ユーザー | 010, 014, 016 |
| `clients` | クライアント | 010, 024 |
| `client_addresses` | 配送先 (複数) | 029 |
| `factories` | 工場 (basic_info_completed) | 010, 024, 029 |
| `deals` | 案件 (4 階層トップ) | 010, 018, 023, 027, 030 |
| `deal_products` | 商品 (4 階層 L2) | 023, 027 |
| `deal_product_variants` | バリエ (4 階層 L3) | 023 |
| `deal_quotes` | 見積 (4 階層 L4) | 010, 023, 027 |
| `deal_specifications` | 旧仕様 (温存) | 010 |
| `deal_communications` | 通信履歴 | 025 |
| `deal_design_files` | 添付 (5 カテゴリ) | 002, 025 |
| `deal_status_history` | ステータス遷移 (kind) | 010, 025 |
| `deal_fees` | 別途費用 | 022 |
| `external_forms` | 外部フォームトークン | 029 |
| `rfq_requests` | RFQ | 029 |
| `rfq_factory_invitations` | RFQ → 工場 | 029 |
| `documents` | 帳票発行記録 | 010, 022 |
| `system_settings` | システム設定 (定型文 4 種) | 010, 023, 030 |
| `user_preferences` | ユーザー設定 (列幅等) | 027 |

### Migration 一覧

```
001 initial_schema             - 初期スキーマ (旧)
002 design_files               - 添付ファイル
003 product_registry           - 品目台帳
010 rebuild_schema             - 完全リビルド (Phase 1 ベース)
011 seed_data                  - 初期データ
013-017 (各種 fix / users / messages)
018 phase1_simple_status       - 7 段階ステータス
019 phase1_default_cost_ratio  - 掛け率
020 phase1_design_storage_path
021 phase1_storage_bucket
022 phase1_fees_and_documents
023 sprint5_4layer_structure   - 4 階層化 ★
024 sprint5v2_master_extension - クライアント/工場拡張
025 sprint6_communication_history
026 master_extension_from_crm
027 sprint7_shipping_per_product   - 商品納品先 / 列幅 / サムネイル
028 sprint7_storage_all_formats     - ストレージ拡張 (50MB / 全 MIME)
029 sprint8_external_forms_rfq     - 外部フォーム + RFQ ★
030 sprint9_archive_and_templates  - アーカイブ + 定型文 ★
```

---

## C. 累積既知問題リスト (優先度別)

### 高 (Phase 2 で必ず対応)

1. **RLS 未実装**
   - 全テーブル `authenticated_full_access` ポリシー (誰でも全アクセス可)
   - Phase 2 で role-based RLS を本格設計
   - 場所: `010_rebuild_schema.sql` のポリシー全般

2. **クライアント / 工場画面が未実装**
   - Phase 1.5 では admin/sales のみ。client / factory ロールは画面なし
   - 4 階層データはあるが view が未整備

3. **メール通知未実装**
   - `src/lib/utils/email.ts` は雛形のみ
   - Sprint 6/7/8/9 全てで「メール送信は実装しない、リンクコピーのみ」と明記
   - Phase 2 で Resend 統合予定

### 中 (Phase 2 で扱うべき)

4. **Sprint 8 引き継ぎ #1: 工場別見積 3 階層 UI**
   - `deal_quotes.factory_id` データ層は揃っているが、スプレッド UI は工場別グループ表示してない
   - 商品 → 工場別バリエ → 見積バージョン の 3 階層、採用フラグ工場間切替
   - **Phase 2 でクライアント/工場画面と一緒に再設計**
   - 関連: `src/components/deals/deals-nested-table.tsx`

5. **旧 `deal_specifications` 温存**
   - Sprint 5 で 4 階層に移行したが旧テーブルは DROP せず保持
   - 帳票テンプレ (`document-templates.tsx`) は両対応 (spec/variant)
   - Phase 2 で deal_specifications を完全廃止できるか判断

6. **as never キャスト (型不整合)**
   - `src/components/settings/settings-form.tsx:78` `} as never)`
   - `src/app/(main)/deals/page.tsx:152` 等多数
   - Phase 2 で Supabase 型生成 (`supabase gen types`) 導入し解消

7. **pending 工場 RFQ 回答後の昇格フロー**
   - Sprint 8 hand-off #2 で external_form は発行されるようになった (Sprint 9 で対応)
   - 工場が回答後、`factories` マスターへ手動昇格する UI は未実装
   - 関連: `src/lib/actions/rfq.ts`

### 低 (Phase 2 余力次第)

8. **モバイル UI は読取中心 (Sprint 6 仕様)**
   - スプレッドのインライン編集は < 768px で非対応
   - Phase 2 で必要に応じてモバイル編集 UI

9. **添付ファイルバージョン管理は未実装**
   - 「上書きアップロード = 新版」の概念なし
   - `deal_design_files.version` カラムはあるが UI は未配線

10. **ファクトリー画面のロード時に display_name のみフェッチ**
    - 全フィールドは取得していないため、後続クリックで個別フェッチ発生
    - 軽微なパフォーマンス改善余地

---

## D. 累積動作確認未実施項目

### Sprint 7 (スプレッド完全化)
- ❌ 49 列のうち全列の Tab/Enter キーボードナビ実機検証
- ❌ 列幅リサイズ後にデバイスを変えても永続化されること
- ❌ 商品サムネイル差し替え時の Storage cleanup

### Sprint 8 (外部フォーム + RFQ)
- ❌ 7 日経過したトークンが期待通り `expired` になること
- ❌ submission_ip / submission_user_agent が実際に記録されていること
- ❌ cancelled トークンへのアクセスでエラー表示
- ❌ pending factory への RFQ → 自己登録 → 紐付けフロー全体 (Sprint 9 で external_form 発行は実装、後段は未検証)

### Sprint 9 (アーカイブ + 帳票)
- ❌ Phase 1.5 全体動作確認 (Phase 1〜6 シナリオ) は **白側で実施予定 (スキップで main マージ済)**
- ❌ アーカイブ済み案件の編集ロックを各 4 update 関数で実機検証 (archive_note/tags 以外がブロックされること)
- ❌ リオーダー時の deal_products 大量コピー時のパフォーマンス
- ❌ 定型文の改行が PDF 印刷で保たれること

### 全体
- ❌ E2E テスト整備 (Phase 1 から「Phase 2 送り」と明記されている)
- ❌ Lighthouse / バンドルサイズ最適化 (現状 /deals は 147 kB First Load)

---

## E. Phase 2 への引き継ぎ事項

### 必ず引き継ぐ

1. **Sprint 8 hand-off #1: 工場別見積 3 階層 UI** (上記 C-4)
   - データ層は完了。UI 改修のみ
   - クライアント/工場画面と一緒に設計するため Phase 2 へ

2. **Sprint 9 で Phase 2 送りにした項目**
   - 工場別 3 階層 UI (上記)
   - pending factory 昇格 UI

3. **累積技術負債**
   - `as never` キャスト一掃 (Supabase 型生成導入)
   - 旧 `deal_specifications` 廃止判断
   - RLS 本格実装

### 仕様書として残すもの

- `docs/Sprint7-9_実装指示書_v1.1.md` — Sprint 7-9 の経緯
- `docs/db-schema-actual.md` — 実 DB スキーマ
- `docs/CODEMAPS/*` — 各 Sprint 後の codemap
- `CLAUDE.md` — デザイン + 開発ルール (Phase 2 でも踏襲)

---

## F. Phase 2 スコープ提案

### F-1. クライアント画面 (外部公開)
- `/client/[invitation_token]` または認証付き `/client/dashboard`
- 自分の案件一覧 (visibility = 'client_shared' のみ)
- 見積書 / 請求書 / 納品書 閲覧
- 案件ステータス確認
- メッセージング (deal_communications の client チャンネル)

### F-2. 工場画面 (外部公開)
- `/factory/dashboard` (factories.id に紐付くユーザー)
- 自分宛の RFQ 一覧
- 見積回答フォーム (Sprint 8 の anonymous フォームを認証付きに昇格)
- 案件ステータス確認
- 工場別見積 3 階層 UI (Sprint 8 hand-off #1)

### F-3. 権限制御の本格実装 (RLS)
- `auth.uid()` ベースの RLS ポリシー
- ロール別ビュー: admin / sales / client / factory
- visibility カラム (internal / client_shared / factory_shared) を実際に適用
- pending factory の自己登録 → 認証付きユーザーへ昇格

### F-4. メール通知 (Resend 統合)
- `src/lib/utils/email.ts` の実装
- ステータス変更時の自動メール (M06, M11, M14, M22, M25 等)
- 招待リンクのメール送信 (Sprint 8/9 でリンクコピーのみだった機能)
- RFQ 依頼通知

### F-5. その他検討事項
- E2E テスト整備 (Playwright 推奨)
- 経営分析ダッシュボード強化 (Phase 1 で雛形のみ)
- AI モード (`deals.ai_mode`) の実機能化
- 在庫保管管理 (`inventory` 関連、Phase 1 雛形のみ)

---

## 補足: コミットハッシュ早見表

```
Phase 1.5 完成: b277e5e (main, 2026-04-29)
  ├ Sprint 9:  e60f6e6
  ├ Sprint 8:  2503004 (merge)
  ├ Sprint 7:  1563e85 (merge)
  ├ Sprint 6 fixes: 928e68d / 82ec578 / c383337
  ├ Sprint 6:  417b654 (merge)
  ├ Sprint 5v2: 26dc429 (merge)
  └ Sprint 5:  9ef1036 (merge)
```

---

**Phase 1.5 完成 — Phase 2 開始前準備完了**
