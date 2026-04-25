-- ============================================================================
-- BAO Flow v2.0 Phase 1
-- 019_phase1_default_cost_ratio.sql
--
-- 目的:
--   - system_settings に default_cost_ratio (デフォルト掛け率) を追加
--   - これまで createQuote 内でハードコード 0.55 だったものを設定値で持つ
--
-- 備考:
--   - 既存の default_sample_cost_rate はサンプル費率で別物 (温存)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_settings' AND column_name = 'default_cost_ratio'
  ) THEN
    ALTER TABLE system_settings
      ADD COLUMN default_cost_ratio NUMERIC(5, 4) DEFAULT 0.55;
  END IF;
END $$;

-- 既存行に値を設定 (NULL のまま運用したくないため)
UPDATE system_settings
SET default_cost_ratio = 0.55
WHERE default_cost_ratio IS NULL;

COMMENT ON COLUMN system_settings.default_cost_ratio IS
  'Phase 1: デフォルト掛け率 (原価/販売価格)。例: 0.55 → 原価率 55%';
