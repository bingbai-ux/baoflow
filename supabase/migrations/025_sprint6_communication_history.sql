-- ============================================================================
-- BAO Flow v2.0 Sprint 6
-- 025_sprint6_communication_history.sql
--
-- 目的:
--   - 案件ごとのコミュニケーション履歴 (deal_communications)
--   - RFQ 工場回答 (factory_rfq_responses)、Phase 2 工場画面への伏線
--   - 添付ファイルのカテゴリ分類 (deal_design_files.category)
--   - 履歴の種別フィルタ (deal_status_history.kind)
--   - 帳票タイプに RFQ 追加 (document_type ENUM)
-- ============================================================================

-- 1. deal_communications: 通信履歴
CREATE TABLE IF NOT EXISTS deal_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,

  -- 発信者・宛先
  author_user_id UUID REFERENCES profiles(id),
  author_role TEXT,                          -- 'staff' / 'client' / 'factory'
  channel TEXT NOT NULL,                     -- 'email' / 'wechat' / 'phone' / 'memo' / 'meeting'

  -- 内容
  subject TEXT,
  body TEXT NOT NULL,

  -- ステータス
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  needs_followup BOOLEAN NOT NULL DEFAULT FALSE,
  followup_date DATE,

  -- メタデータ
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- 実際のやり取り時刻
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deal_communications_deal_id ON deal_communications(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_communications_occurred_at ON deal_communications(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_communications_unread ON deal_communications(deal_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_deal_communications_followup
  ON deal_communications(deal_id, followup_date) WHERE needs_followup = TRUE;

COMMENT ON TABLE deal_communications IS 'Sprint 6: 案件ごとのコミュニケーション履歴';
COMMENT ON COLUMN deal_communications.author_role IS 'Phase 2 用伏線: staff / client / factory';
COMMENT ON COLUMN deal_communications.channel IS 'email / wechat / phone / memo / meeting';

-- 2. deal_design_files に category 追加
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='deal_design_files' AND column_name='category') THEN
    ALTER TABLE deal_design_files ADD COLUMN category TEXT;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_deal_design_files_category
  ON deal_design_files(deal_id, category) WHERE category IS NOT NULL;

COMMENT ON COLUMN deal_design_files.category IS
  'Sprint 6: spec / quote / photo / contract / other';

-- 3. deal_status_history に kind 追加
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='deal_status_history' AND column_name='kind') THEN
    ALTER TABLE deal_status_history ADD COLUMN kind TEXT NOT NULL DEFAULT 'status';
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_deal_status_history_kind
  ON deal_status_history(deal_id, kind);

COMMENT ON COLUMN deal_status_history.kind IS
  'Sprint 6: status / edit / variant / attachment / comm / fee';

-- 4. document_type ENUM に rfq を追加
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'rfq'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type')
  ) THEN
    ALTER TYPE document_type ADD VALUE 'rfq';
  END IF;
END $$;

-- 5. factory_rfq_responses: 工場からの見積回答
CREATE TABLE IF NOT EXISTS factory_rfq_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  factory_id UUID REFERENCES factories(id),
  factory_name TEXT,

  -- 回答内容
  unit_price_usd NUMERIC,
  moq INTEGER,
  lead_time_days INTEGER,
  payment_terms TEXT,
  notes TEXT,

  responded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_factory_rfq_responses_rfq
  ON factory_rfq_responses(rfq_document_id);

COMMENT ON TABLE factory_rfq_responses IS
  'Sprint 6: RFQ 送付後の工場回答記録 (Phase 2 工場画面への伏線)';
