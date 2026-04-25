-- ============================================================================
-- BAO Flow v2.0 Sprint 5 v2 (B 案)
-- 024_sprint5v2_master_extension.sql
--
-- 目的:
--   - clients / factories マスターを Claude Design 準拠に拡張
--   - Sprint 6 のマスター画面・ダッシュボード「トップクライアント」用
--   - 既存カラム (industry, phone, email, address, specialties 等) は温存
-- ============================================================================

-- 1. clients 拡張
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='short_name') THEN
    ALTER TABLE clients ADD COLUMN short_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='contact_phone') THEN
    ALTER TABLE clients ADD COLUMN contact_phone TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='billing_to') THEN
    ALTER TABLE clients ADD COLUMN billing_to TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='tax_id') THEN
    ALTER TABLE clients ADD COLUMN tax_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='payment_terms') THEN
    ALTER TABLE clients ADD COLUMN payment_terms TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='tax_rate') THEN
    ALTER TABLE clients ADD COLUMN tax_rate NUMERIC;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='since') THEN
    ALTER TABLE clients ADD COLUMN since DATE;
  END IF;
END $$;

COMMENT ON COLUMN clients.short_name IS 'Sprint 5 v2: 短縮名 (リスト・カードでの表示用)';
COMMENT ON COLUMN clients.billing_to IS 'Sprint 5 v2: 請求書宛先 (会社名と異なる場合)';
COMMENT ON COLUMN clients.tax_id IS 'Sprint 5 v2: インボイス登録番号';
COMMENT ON COLUMN clients.since IS 'Sprint 5 v2: 取引開始日';

-- 2. factories 拡張
DO $$
DECLARE
  col TEXT;
BEGIN
  -- 単純な TEXT カラム
  FOR col IN SELECT unnest(ARRAY['name_cn', 'contact_phone', 'contact_email', 'wechat', 'payment_terms', 'incoterm', 'lead_time_range'])
  LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='factories' AND column_name=col) THEN
      EXECUTE format('ALTER TABLE factories ADD COLUMN %I TEXT', col);
    END IF;
  END LOOP;

  -- 星評価 (1-5)
  FOR col IN SELECT unnest(ARRAY['quality_stars', 'delivery_stars', 'price_stars'])
  LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='factories' AND column_name=col) THEN
      EXECUTE format('ALTER TABLE factories ADD COLUMN %I INTEGER CHECK (%I BETWEEN 1 AND 5)', col, col);
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='factories' AND column_name='since') THEN
    ALTER TABLE factories ADD COLUMN since DATE;
  END IF;
END $$;

COMMENT ON COLUMN factories.name_cn IS 'Sprint 5 v2: 中国語社名';
COMMENT ON COLUMN factories.lead_time_range IS 'Sprint 5 v2: リードタイム範囲 (例: "25-30日")';
COMMENT ON COLUMN factories.quality_stars IS 'Sprint 5 v2: 品質評価 1-5';
COMMENT ON COLUMN factories.delivery_stars IS 'Sprint 5 v2: 納期評価 1-5';
COMMENT ON COLUMN factories.price_stars IS 'Sprint 5 v2: 価格評価 1-5';

-- 3. deals.use_client_master を活用するための補助インデックス
CREATE INDEX IF NOT EXISTS idx_deals_client_id ON deals(client_id) WHERE client_id IS NOT NULL;
