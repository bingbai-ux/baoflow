-- ============================================================================
-- BAO Flow v2.0 Sprint 7
-- 027_sprint7_shipping_per_product.sql
--
-- 目的:
--   1. 商品ごとの納品先 (Excel C23 相当 — 1案件で複数納品先に対応)
--   2. 商品サムネイル (スプレッド表に画像を直接表示)
--   3. ユーザー別の表示設定 (列幅 / 列表示 / ピン留め)
--   4. 添付ファイルの種別判定 (image / pdf / zip / design / document / other)
--
-- 根拠: 14_Sprint7-9_実装指示書 §2-1 + §0.5-1
-- 適用: supabase db push 後、CRUD 想定
-- ============================================================================

-- 1. deal_products に納品先フィールド (商品ごとに納品先を指定可能に) -----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='deal_products' AND column_name='shipping_address_label') THEN
    ALTER TABLE deal_products ADD COLUMN shipping_address_label TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='deal_products' AND column_name='shipping_address_full') THEN
    ALTER TABLE deal_products ADD COLUMN shipping_address_full TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='deal_products' AND column_name='shipping_recipient_name') THEN
    ALTER TABLE deal_products ADD COLUMN shipping_recipient_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='deal_products' AND column_name='shipping_phone') THEN
    ALTER TABLE deal_products ADD COLUMN shipping_phone TEXT;
  END IF;
  -- shipping_address_id は client_addresses (Sprint 8 で作成) への将来参照用。
  -- Sprint 7 時点では FK は張らない (テーブル未作成のため)。
  -- Sprint 8 の migration 028 で ALTER TABLE ... ADD CONSTRAINT で追加する。
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='deal_products' AND column_name='shipping_address_id') THEN
    ALTER TABLE deal_products ADD COLUMN shipping_address_id UUID;
  END IF;
END $$;

COMMENT ON COLUMN deal_products.shipping_address_label IS
  'Sprint 7: 納品先のラベル ("石津様 青山" 等)';
COMMENT ON COLUMN deal_products.shipping_address_full IS
  'Sprint 7: 納品先の完全住所 (Excel C23 相当)';
COMMENT ON COLUMN deal_products.shipping_recipient_name IS
  'Sprint 7: 受取人氏名';
COMMENT ON COLUMN deal_products.shipping_phone IS
  'Sprint 7: 受取人電話番号';
COMMENT ON COLUMN deal_products.shipping_address_id IS
  'Sprint 7: client_addresses (Sprint 8 で作成) への参照。FK は migration 028 で追加';

-- 2. deal_products に主画像 URL (スプレッド表サムネイル) -----------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='deal_products' AND column_name='thumbnail_url') THEN
    ALTER TABLE deal_products ADD COLUMN thumbnail_url TEXT;
  END IF;
END $$;

COMMENT ON COLUMN deal_products.thumbnail_url IS
  'Sprint 7: スプレッド表示用サムネイル URL (フル画像は deal_design_files で管理)';

-- 3. deals に column_widths (将来の案件単位カラム幅オーバーライド用) ------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='deals' AND column_name='column_widths') THEN
    ALTER TABLE deals ADD COLUMN column_widths JSONB NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END $$;

COMMENT ON COLUMN deals.column_widths IS
  'Sprint 7: 案件ごとの列幅オーバーライド (将来用、現状は user_preferences で十分)';

-- 4. user_preferences テーブル新規 (ユーザー単位の表示設定) --------------------
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  deals_table_column_widths JSONB NOT NULL DEFAULT '{}'::jsonb,
  deals_table_visible_columns TEXT[] DEFAULT NULL,  -- NULL = 全列表示、配列指定で絞り込み
  pinned_deal_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE user_preferences IS
  'Sprint 7: ユーザー別の表示設定 (列幅 / 列表示 / ピン留め)';
COMMENT ON COLUMN user_preferences.deals_table_column_widths IS
  '例: { "description": 240, "size": 120, "material": 180 }';
COMMENT ON COLUMN user_preferences.deals_table_visible_columns IS
  'NULL = 全列表示、配列指定で表示する列キーを絞り込み';
COMMENT ON COLUMN user_preferences.pinned_deal_ids IS
  'ユーザーがピン留めした案件 ID (将来機能用、Sprint 7 では UI 未実装)';

-- updated_at 自動更新トリガ (関数 update_updated_at_column は migration 010 で定義済) -
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_preferences_updated_at') THEN
    CREATE TRIGGER update_user_preferences_updated_at
      BEFORE UPDATE ON user_preferences
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- RLS: 自分のレコードのみ操作可 ------------------------------------------------
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can view own preferences" ON user_preferences;
CREATE POLICY "users can view own preferences"
  ON user_preferences FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users can insert own preferences" ON user_preferences;
CREATE POLICY "users can insert own preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users can update own preferences" ON user_preferences;
CREATE POLICY "users can update own preferences"
  ON user_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- 5. deal_design_files の添付ファイル拡張 (§0.5-1 確定事項) -------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='deal_design_files' AND column_name='file_type') THEN
    ALTER TABLE deal_design_files ADD COLUMN file_type TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='deal_design_files' AND column_name='file_extension') THEN
    ALTER TABLE deal_design_files ADD COLUMN file_extension TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='deal_design_files' AND column_name='file_size_bytes') THEN
    ALTER TABLE deal_design_files ADD COLUMN file_size_bytes BIGINT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='deal_design_files' AND column_name='thumbnail_generated') THEN
    ALTER TABLE deal_design_files ADD COLUMN thumbnail_generated BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

COMMENT ON COLUMN deal_design_files.file_type IS
  'Sprint 7 (§0.5-1): 種別カテゴリ — image / pdf / zip / design / document / other';
COMMENT ON COLUMN deal_design_files.file_extension IS
  'Sprint 7 (§0.5-1): 拡張子 — jpg / png / pdf / zip / ai / psd / eps / sketch / etc.';
COMMENT ON COLUMN deal_design_files.file_size_bytes IS
  'Sprint 7 (§0.5-1): ファイルサイズ (バイト)';
COMMENT ON COLUMN deal_design_files.thumbnail_generated IS
  'Sprint 7 (§0.5-1): PDF 1ページ目サムネイルなどの生成済フラグ';
