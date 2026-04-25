-- ============================================================================
-- BAO Flow v2.0 — 026_master_extension_from_crm.sql
--
-- 目的:
--   営業CRM.xlsx と 管理表たたき.xlsx の差分分析で判明した
--   現行スキーマに欠落している項目を追加する。
--
-- スコープ:
--   - clients : 顧客登録者 / 最終活動日時 / 共有顧客フラグ / 親レコード
--   - factories : 製品カタログ (PDF/file refs)
--   - deals : 発送方法 / 契約番号 / 契約締結日
--   - deal_quotes : Incoterm / 梱包情報フリーテキスト / サンプル製造/発送日数 / 工場提示送料
--   - design_files : product_id / variant_id 紐付け (画像を商品/バリエ単位で管理)
-- ============================================================================

-- 1. clients 拡張 ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='clients' AND column_name='registered_by') THEN
    ALTER TABLE clients ADD COLUMN registered_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='clients' AND column_name='last_activity_at') THEN
    ALTER TABLE clients ADD COLUMN last_activity_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='clients' AND column_name='is_shared') THEN
    ALTER TABLE clients ADD COLUMN is_shared BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='clients' AND column_name='parent_client_id') THEN
    ALTER TABLE clients ADD COLUMN parent_client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
    CREATE INDEX idx_clients_parent_client_id ON clients(parent_client_id) WHERE parent_client_id IS NOT NULL;
  END IF;
END $$;

COMMENT ON COLUMN clients.registered_by IS '026: 顧客を登録したユーザー (profiles.id)';
COMMENT ON COLUMN clients.last_activity_at IS '026: 最終活動日時 (deals 集約のキャッシュとして利用可)';
COMMENT ON COLUMN clients.is_shared IS '026: 共有顧客フラグ (Excel 顧客マスター P 列)';
COMMENT ON COLUMN clients.parent_client_id IS '026: 親会社の顧客レコード (Excel 顧客マスター Q 列)';

-- 2. factories 拡張 ----------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='factories' AND column_name='catalog_files') THEN
    ALTER TABLE factories ADD COLUMN catalog_files JSONB NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;

COMMENT ON COLUMN factories.catalog_files IS
  '026: 製品カタログPDF (Excel 工場マスター K 列). 形式: [{"name":"catalog.pdf","url":"https://...","uploaded_at":"..."}]';

-- 3. deals 拡張 --------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='deals' AND column_name='shipping_method_1') THEN
    ALTER TABLE deals ADD COLUMN shipping_method_1 TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='deals' AND column_name='contract_number') THEN
    ALTER TABLE deals ADD COLUMN contract_number TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='deals' AND column_name='contract_signed_at') THEN
    ALTER TABLE deals ADD COLUMN contract_signed_at TIMESTAMPTZ;
  END IF;
END $$;

COMMENT ON COLUMN deals.shipping_method_1 IS
  '026: 発送方法 (船便/空便/陸送等). Excel 商談管理 I 列';
COMMENT ON COLUMN deals.contract_number IS
  '026: 契約番号 (合同管理). Excel 商談管理 M 列';
COMMENT ON COLUMN deals.contract_signed_at IS
  '026: 契約締結日時 (Excel 商談管理 AW 列「契約締結の有無」をタイムスタンプで保持)';

-- 4. deal_quotes 拡張 -------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='deal_quotes' AND column_name='incoterm') THEN
    ALTER TABLE deal_quotes ADD COLUMN incoterm TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='deal_quotes' AND column_name='packing_info_text') THEN
    ALTER TABLE deal_quotes ADD COLUMN packing_info_text TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='deal_quotes' AND column_name='sample_production_days') THEN
    ALTER TABLE deal_quotes ADD COLUMN sample_production_days INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='deal_quotes' AND column_name='sample_shipping_days') THEN
    ALTER TABLE deal_quotes ADD COLUMN sample_shipping_days INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='deal_quotes' AND column_name='factory_calculated_freight_usd') THEN
    ALTER TABLE deal_quotes ADD COLUMN factory_calculated_freight_usd NUMERIC;
  END IF;
END $$;

COMMENT ON COLUMN deal_quotes.incoterm IS
  '026: Incoterm (EXW/FOB/CIF/DDP/DPU). Excel 商談管理 J 列 / 管理表たたき J 列';
COMMENT ON COLUMN deal_quotes.packing_info_text IS
  '026: 梱包情報フリーテキスト (Excel 商談管理 L 列). 構造化済 carton_* と併存';
COMMENT ON COLUMN deal_quotes.sample_production_days IS
  '026: サンプル製造日数 (Excel 商談管理 W 列)';
COMMENT ON COLUMN deal_quotes.sample_shipping_days IS
  '026: サンプル発送日数 (Excel 商談管理 X 列)';
COMMENT ON COLUMN deal_quotes.factory_calculated_freight_usd IS
  '026: 工場提示の送料合計 USD (いーうーを使わない場合). 管理表たたき X 列';

-- 5. design_files に product_id / variant_id 紐付け ------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='design_files' AND column_name='product_id') THEN
    ALTER TABLE design_files ADD COLUMN product_id UUID REFERENCES deal_products(id) ON DELETE CASCADE;
    CREATE INDEX idx_design_files_product_id ON design_files(product_id) WHERE product_id IS NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='design_files' AND column_name='variant_id') THEN
    ALTER TABLE design_files ADD COLUMN variant_id UUID REFERENCES deal_product_variants(id) ON DELETE CASCADE;
    CREATE INDEX idx_design_files_variant_id ON design_files(variant_id) WHERE variant_id IS NOT NULL;
  END IF;
END $$;

COMMENT ON COLUMN design_files.product_id IS
  '026: 商品単位での画像紐付け (NULL の場合は案件全体の画像)';
COMMENT ON COLUMN design_files.variant_id IS
  '026: バリエーション単位での画像紐付け (詳細箇所別の複数画像対応)';
