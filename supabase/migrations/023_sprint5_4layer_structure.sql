-- ============================================================================
-- BAO Flow v2.0 Sprint 5 (Phase 1.5 拡張)
-- 023_sprint5_4layer_structure.sql
--
-- 目的:
--   - clients → deals → deal_products → deal_product_variants → deal_quotes の4階層を構築
--   - Excel の37+項目 (PCS/CTN, CARTONMEAS, G.W, 容積重量, 送料計算等) を保存可能に
--   - 旧 deal_specifications は DROP しない (Phase 2 用に温存)
--   - 022 (Phase 1.5: deal_fees + 帳票 metadata) は維持、共存
-- ============================================================================

-- 1. deals 拡張: クライアントマスター連携フラグ
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='deals' AND column_name='use_client_master') THEN
    ALTER TABLE deals ADD COLUMN use_client_master BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;
COMMENT ON COLUMN deals.use_client_master IS
  'TRUE: client_id を使う / FALSE: client_name_text を使う (Phase 1 互換)';

-- 2. deal_products テーブル新設
CREATE TABLE IF NOT EXISTS deal_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,

  product_no INTEGER NOT NULL,            -- 案件内の商品番号 (1, 2, 3...)
  description TEXT NOT NULL,              -- "Plastic Bag", "Paper Bag" 等

  -- Excel D, E, F, G 列
  factory_staff_code TEXT,                -- code (NA / AL / JT / RI 工場担当者略称)
  production_process TEXT,
  food_grade_status TEXT,                 -- '*' / '●' / '同' / NULL
  food_inspection_status TEXT,            -- '*' / '●' / '同' / NULL

  product_memo TEXT,
  is_selected BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(deal_id, product_no)
);
CREATE INDEX IF NOT EXISTS idx_deal_products_deal_id ON deal_products(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_products_is_selected ON deal_products(is_selected);
COMMENT ON TABLE deal_products IS
  'Sprint 5: 案件内の商品グルーピング (Excel #列、Plastic Bag / Paper Bag 等)';

-- 3. deal_product_variants テーブル新設
CREATE TABLE IF NOT EXISTS deal_product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES deal_products(id) ON DELETE CASCADE,

  variant_label TEXT NOT NULL,            -- 'small' / 'medium' / 'large' / '8oz' 等
  variant_order INTEGER NOT NULL DEFAULT 0,

  -- サイズ (Excel K, L, M)
  width_mm NUMERIC,
  height_mm NUMERIC,
  depth_mm NUMERIC,

  -- 素材・色 (Excel N, O, P)
  material TEXT,
  color_description TEXT,
  pantone_colors TEXT,

  -- 加工・印刷 (Excel Q, R, S, T)
  processing TEXT,
  other_notes TEXT,
  print_color_count TEXT,
  print_method TEXT,

  -- カートン・物流 (Excel Y, AA-AC, AD)
  pcs_per_carton INTEGER,
  carton_width_cm NUMERIC,
  carton_height_cm NUMERIC,
  carton_depth_cm NUMERIC,
  gross_weight_kg NUMERIC,

  -- リードタイム (Excel AX, AY, AZ)
  production_lead_days INTEGER,
  shipping_lead_days INTEGER,
  food_inspection_days INTEGER,

  -- 納品先 (Excel BB)
  shipping_address TEXT,

  is_selected BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_variants_product_id ON deal_product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_is_selected ON deal_product_variants(is_selected);
COMMENT ON TABLE deal_product_variants IS
  'Sprint 5: 商品のサイズ/仕様バリエーション (small / medium / large 等)';

-- 4. deal_quotes に variant_id および追加カラム
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='deal_quotes' AND column_name='variant_id') THEN
    ALTER TABLE deal_quotes
      ADD COLUMN variant_id UUID REFERENCES deal_product_variants(id) ON DELETE CASCADE;
    CREATE INDEX idx_deal_quotes_variant_id ON deal_quotes(variant_id);
  END IF;
END $$;

DO $$
DECLARE
  col TEXT;
BEGIN
  FOR col IN SELECT unnest(ARRAY[
    'shipping_weight_kg',
    'volumetric_weight_kg',
    'actual_weight_total_kg',
    'china_freight_yuan',
    'china_freight_usd',
    'domestic_china_freight_usd',
    'pantone_color_fee_usd',
    'food_inspection_fee_yuan',
    'sample_cost_usd',
    'sample_shipping_usd',
    'yuan_to_usd_rate'
  ])
  LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='deal_quotes' AND column_name=col) THEN
      EXECUTE format('ALTER TABLE deal_quotes ADD COLUMN %I NUMERIC', col);
    END IF;
  END LOOP;
END $$;

-- moq は 010 で既にあるが念のため
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='deal_quotes' AND column_name='moq') THEN
    ALTER TABLE deal_quotes ADD COLUMN moq INTEGER;
  END IF;
END $$;

COMMENT ON COLUMN deal_quotes.variant_id IS
  'Sprint 5: バリエーション (deal_product_variants.id) への紐付け';
COMMENT ON COLUMN deal_quotes.shipping_weight_kg IS
  'Sprint 5: 送料計算重量 (max(容積重量, 実重量))';
COMMENT ON COLUMN deal_quotes.volumetric_weight_kg IS
  'Sprint 5: 容積重量 ceil(縦×横×高さ/5000) × カートン数';
COMMENT ON COLUMN deal_quotes.actual_weight_total_kg IS
  'Sprint 5: 実重量合計 = G.W × カートン数';

-- 5. deal_fees に variant_id を追加 (Phase 1.5 との連携)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='deal_fees' AND column_name='variant_id') THEN
    ALTER TABLE deal_fees
      ADD COLUMN variant_id UUID REFERENCES deal_product_variants(id) ON DELETE SET NULL;
    CREATE INDEX idx_deal_fees_variant_id ON deal_fees(variant_id);
  END IF;
END $$;

-- 6. system_settings に新規項目追加
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='system_settings' AND column_name='default_china_freight_rate_yuan_per_kg') THEN
    ALTER TABLE system_settings ADD COLUMN default_china_freight_rate_yuan_per_kg NUMERIC DEFAULT 7.0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='system_settings' AND column_name='default_yuan_to_usd_rate') THEN
    ALTER TABLE system_settings ADD COLUMN default_yuan_to_usd_rate NUMERIC DEFAULT 7.2;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='system_settings' AND column_name='default_pantone_color_fee_yuan') THEN
    ALTER TABLE system_settings ADD COLUMN default_pantone_color_fee_yuan NUMERIC DEFAULT 11775;
  END IF;
END $$;

UPDATE system_settings
SET
  default_china_freight_rate_yuan_per_kg = COALESCE(default_china_freight_rate_yuan_per_kg, 7.0),
  default_yuan_to_usd_rate = COALESCE(default_yuan_to_usd_rate, 7.2),
  default_pantone_color_fee_yuan = COALESCE(default_pantone_color_fee_yuan, 11775);
