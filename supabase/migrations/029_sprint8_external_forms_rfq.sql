-- ============================================================================
-- BAO Flow v2.0 Sprint 8
-- 029_sprint8_external_forms_rfq.sql
--
-- 目的:
--   1. client_addresses: 顧客の納品先 (複数登録可) — Sprint 7 で予約していた
--      shipping_address_id FK の参照先テーブル
--   2. external_forms: 外部入力フォームのトークン管理 (§0.5-5 anonymous 対応:
--      submission_ip / submission_user_agent / cancelled_at / cancelled_by を
--      含む。expires_at のデフォルトは 7 日)
--   3. rfq_requests: 見積依頼 (deal × 商品サブセット × 工場群)
--   4. rfq_factory_invitations: 1 RFQ → 複数工場の招待
--   5. deal_quotes(factory_id) インデックス追加
--   6. clients / factories に自己登録フラグ
--   7. Sprint 7 引き継ぎ #1: deal_products.shipping_address_id の FK 追加
--
-- 適用後:
--   - 外部フォームへのアクセスは全て server action 経由 (token 検証付き)
--   - RLS は今 migration では設定しない (Phase 2 で role-based に再設計)
-- ============================================================================

-- 1. client_addresses ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  label TEXT NOT NULL,                       -- "本社" "渋谷店" "石津様" 等
  recipient_name TEXT,
  postal_code TEXT,
  address_line1 TEXT NOT NULL,               -- 都道府県＋市区町村
  address_line2 TEXT,                        -- 番地・建物名
  phone TEXT,
  email TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_client_addresses_client_id ON client_addresses(client_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_client_addresses_updated_at') THEN
    CREATE TRIGGER update_client_addresses_updated_at
      BEFORE UPDATE ON client_addresses
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 2. external_forms (§0.5-5 anonymous + IP/UA + cancel) ---------------------
CREATE TABLE IF NOT EXISTS external_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  form_type TEXT NOT NULL,                   -- 'client_self_registration' | 'factory_self_registration' | 'rfq_response'
  token TEXT NOT NULL UNIQUE,                -- crypto.randomBytes(24).toString('base64url') — 32 chars

  -- 紐付け (form_type による)
  related_id UUID,                           -- client_id, factory_id, rfq_factory_invitation_id 等

  -- ライフサイクル
  status TEXT NOT NULL DEFAULT 'pending',    -- 'pending' | 'submitted' | 'expired' | 'cancelled'
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),  -- §0.5-5: 7 日デフォルト
  submitted_at TIMESTAMPTZ,
  submitted_by_email TEXT,

  -- §0.5-5 anonymous 補強
  submission_ip TEXT,                        -- 送信時の IP (audit 用)
  submission_user_agent TEXT,                -- 送信時の UA (audit 用)
  cancelled_at TIMESTAMPTZ,                  -- スタッフが無効化した時刻
  cancelled_by UUID REFERENCES profiles(id), -- 無効化したスタッフ

  -- メタデータ
  created_by UUID REFERENCES profiles(id),
  context JSONB,                             -- フォーム固有の前提情報 (商品リスト、工場名等)
  submission_data JSONB,                     -- 送信内容 (生 payload)

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_external_forms_token ON external_forms(token);
CREATE INDEX IF NOT EXISTS idx_external_forms_type_status ON external_forms(form_type, status);

-- 3. rfq_requests ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rfq_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,

  -- 依頼情報
  product_ids UUID[] NOT NULL,               -- 対象商品 (チェックボックス選択結果)
  rfq_number TEXT NOT NULL UNIQUE,           -- 'RFQ-2026-001' 等 (server side で採番)
  request_message TEXT,                      -- 依頼者のメッセージ

  -- ステータス
  status TEXT NOT NULL DEFAULT 'open',       -- 'open' | 'partially_responded' | 'fully_responded' | 'closed'

  -- 期限
  response_deadline DATE,

  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rfq_requests_deal_id ON rfq_requests(deal_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_rfq_requests_updated_at') THEN
    CREATE TRIGGER update_rfq_requests_updated_at
      BEFORE UPDATE ON rfq_requests
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 4. rfq_factory_invitations ------------------------------------------------
CREATE TABLE IF NOT EXISTS rfq_factory_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES rfq_requests(id) ON DELETE CASCADE,
  factory_id UUID REFERENCES factories(id),

  -- 工場が未登録の場合はメールアドレスのみで先送りも可
  factory_name_pending TEXT,                 -- factories マスターにない場合
  factory_email_pending TEXT,

  external_form_id UUID REFERENCES external_forms(id),  -- 工場用 RFQ 回答フォームのトークン

  -- 状態
  invitation_sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rfq_invitations_rfq_id ON rfq_factory_invitations(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_invitations_factory_id ON rfq_factory_invitations(factory_id);

-- 5. deal_quotes に factory_id インデックス追加 (見積は工場に紐づく) ------
CREATE INDEX IF NOT EXISTS idx_deal_quotes_factory_id ON deal_quotes(factory_id);

-- 6. clients に自己登録フラグ ------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='clients' AND column_name='self_registered_at') THEN
    ALTER TABLE clients ADD COLUMN self_registered_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='clients' AND column_name='self_registration_form_id') THEN
    ALTER TABLE clients ADD COLUMN self_registration_form_id UUID
      REFERENCES external_forms(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 7. factories に自己登録フラグ + 必須登録チェック --------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='factories' AND column_name='self_registered_at') THEN
    ALTER TABLE factories ADD COLUMN self_registered_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='factories' AND column_name='self_registration_form_id') THEN
    ALTER TABLE factories ADD COLUMN self_registration_form_id UUID
      REFERENCES external_forms(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='factories' AND column_name='basic_info_completed') THEN
    ALTER TABLE factories ADD COLUMN basic_info_completed BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

-- 8. Sprint 7 引き継ぎ #1: deal_products.shipping_address_id の FK 追加 -----
-- migration 027 で UUID カラムだけ作成、Sprint 8 で client_addresses が
-- 出来たので FK 制約をここで追加。
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'deal_products_shipping_address_id_fkey'
  ) THEN
    ALTER TABLE deal_products
      ADD CONSTRAINT deal_products_shipping_address_id_fkey
      FOREIGN KEY (shipping_address_id) REFERENCES client_addresses(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 9. コメント -----------------------------------------------------------------
COMMENT ON TABLE client_addresses IS
  'Sprint 8: 顧客の納品先 (複数登録可)。deal_products.shipping_address_id から参照される';
COMMENT ON TABLE external_forms IS
  'Sprint 8 (§0.5-5): 外部入力フォームのトークン管理。anonymous 対応で IP/UA ロギング、7 日有効期限、cancel 機能';
COMMENT ON TABLE rfq_requests IS
  'Sprint 8: 見積依頼 (deal × 商品サブセット × 工場群)';
COMMENT ON TABLE rfq_factory_invitations IS
  'Sprint 8: 1 RFQ → 複数工場の招待。工場ごとに external_form トークンを発行';
COMMENT ON COLUMN external_forms.expires_at IS
  '§0.5-5: デフォルト 7 日。短期化により anonymous リスクを軽減';
COMMENT ON COLUMN external_forms.submission_ip IS
  '§0.5-5: 送信時の IP (audit 用、不審な回答の検出)';
COMMENT ON COLUMN external_forms.submission_user_agent IS
  '§0.5-5: 送信時の User-Agent';
COMMENT ON COLUMN external_forms.cancelled_at IS
  '§0.5-5: スタッフが手動でトークンを無効化した時刻';
COMMENT ON COLUMN factories.basic_info_completed IS
  'Sprint 8: 工場の基本情報入力完了フラグ。FALSE の工場には RFQ 依頼を送れない (§3-2-3 仕様)';
