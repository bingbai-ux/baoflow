-- ============================================================================
-- BAO Flow v2.0 Phase 1.5
-- 022_phase1_fees_and_documents.sql
--
-- 目的:
--   - 見積を商品仕様に紐付ける (deal_quotes.spec_id)
--   - 型代/版代/パントン指定/サンプル/食品検査などのワンショット費用を保存 (deal_fees)
--   - 帳票発行用の会社情報/銀行口座/デフォルト配送先を system_settings に追加
--   - 帳票単位のメタデータ (支払期日等) を保存 (documents.metadata)
-- ============================================================================

-- 1. deal_quotes に spec_id を追加 (商品との紐付け)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='deal_quotes' AND column_name='spec_id') THEN
    ALTER TABLE deal_quotes
      ADD COLUMN spec_id UUID REFERENCES deal_specifications(id) ON DELETE SET NULL;
    CREATE INDEX idx_deal_quotes_spec_id ON deal_quotes(spec_id);
  END IF;
END $$;

COMMENT ON COLUMN deal_quotes.spec_id IS 'Phase 1: 対応する商品仕様 (deal_specifications.id)。NULL は案件全体見積';

-- 2. deal_fees テーブル (ワンショット費用)
CREATE TABLE IF NOT EXISTS deal_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  spec_id UUID REFERENCES deal_specifications(id) ON DELETE CASCADE,
  fee_type TEXT NOT NULL,    -- 'plate' | 'pantone' | 'sample_make' | 'sample_ship' | 'food_inspection' | 'other'
  label TEXT,                -- 表示用ラベル (例: "型代 (¥18,900×2colors)")
  amount_jpy NUMERIC(12, 2),
  amount_usd NUMERIC(12, 2),
  amount_cny NUMERIC(12, 2),
  is_one_time BOOLEAN NOT NULL DEFAULT TRUE,
  is_initial_only BOOLEAN NOT NULL DEFAULT FALSE,  -- 初回製作時のみ等
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deal_fees_deal_id ON deal_fees(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_fees_spec_id ON deal_fees(spec_id);
CREATE INDEX IF NOT EXISTS idx_deal_fees_fee_type ON deal_fees(fee_type);

COMMENT ON TABLE deal_fees IS
  'Phase 1: 案件・商品単位のワンショット費用 (型代/版代/パントン/サンプル/食品検査等)';

-- 3. system_settings に Phase 1 用 JSONB と配送先を追加
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='system_settings' AND column_name='company_info_phase1') THEN
    ALTER TABLE system_settings ADD COLUMN company_info_phase1 JSONB;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='system_settings' AND column_name='bank_accounts_phase1') THEN
    ALTER TABLE system_settings ADD COLUMN bank_accounts_phase1 JSONB;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='system_settings' AND column_name='default_shipping_address') THEN
    ALTER TABLE system_settings ADD COLUMN default_shipping_address TEXT;
  END IF;
END $$;

COMMENT ON COLUMN system_settings.company_info_phase1 IS
  'Phase 1: 帳票出力用会社情報 {name, name_en, address, phone, email, registration_number, representative}';
COMMENT ON COLUMN system_settings.bank_accounts_phase1 IS
  'Phase 1: 振込先銀行口座 [{bank_name, branch_name, account_type, account_number, account_holder}]';

-- 4. documents.metadata と issued_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='documents' AND column_name='metadata') THEN
    ALTER TABLE documents ADD COLUMN metadata JSONB;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='documents' AND column_name='issued_at') THEN
    ALTER TABLE documents ADD COLUMN issued_at TIMESTAMPTZ DEFAULT now();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='documents' AND column_name='issued_by_user_id') THEN
    ALTER TABLE documents ADD COLUMN issued_by_user_id UUID;
  END IF;
END $$;

COMMENT ON COLUMN documents.metadata IS
  'Phase 1: 帳票単位のメタデータ {payment_due_date, recipient_suffix, billed_amount_jpy, ...}';
