# Excel Source Files (BAO Flow CRM Import 2026-04-25)

このディレクトリは外部Excel原本のスナップショットです。Supabaseへのインポート元として保存しています。

## ファイル

### `営業CRM.xlsx`
- シート: 商談管理 / 顧客マスター / 工場マスター / 営業チームマスター
- インポート対象: 顧客 12社 + 工場 12社 → migration 026 適用後に投入済

### `管理表たたき【工場⇄クライアント兼用オーダー_見積書】.xlsx`
- シート: クライアント用見積もり表
- 商品/バリエ/見積の56列フォーマット
- スキーマ突合用のリファレンス。データインポートはまだ実施していません(管理表側は商品マスターのフォーマット定義としてのみ利用)

## インポート手順 (再実行時)

```bash
# 1. ベースインポート (clients + factories)
node scripts/import-master-from-excel.js
supabase db query --linked -f /tmp/import-master.sql

# 2. registered_by + is_shared バックフィル
node scripts/backfill-clients-from-excel.js
supabase db query --linked -f /tmp/backfill-clients.sql

# 3. assigned_sales_ids 更新
node scripts/update-sales-ids-from-excel.js
supabase db query --linked -f /tmp/update-sales-ids.sql
```

すべて `ON CONFLICT DO NOTHING` または `IF NOT EXISTS` パターンなので冪等(再実行しても重複しない)。

## 営業担当者プロフィール

| display_name | email | role | profile_id |
|---|---|---|---|
| 氷 白 | bing.bai@foodandcompany.co.jp | admin | 2ffbfab9-… |
| Makiko Ogata | makiko.ogata@foodandcompany.co.jp | sales | 2e940179-… (推定email、要確認) |

Makiko 氏のメールが推定値の場合は `UPDATE auth.users SET email = ... WHERE id = '2e940179-...'` で修正可。

## migration 026 で追加されたカラム

詳細は `supabase/migrations/026_master_extension_from_crm.sql` 参照。

| テーブル | 追加カラム |
|---|---|
| clients | registered_by / last_activity_at / is_shared / parent_client_id |
| factories | catalog_files (jsonb) |
| deals | shipping_method_1 / contract_number / contract_signed_at |
| deal_quotes | incoterm / packing_info_text / sample_production_days / sample_shipping_days / factory_calculated_freight_usd |
| design_files | product_id / variant_id |
