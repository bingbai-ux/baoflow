-- ============================================================================
-- BAO Flow v2.0 Phase 1
-- 018_phase1_simple_status.sql
--
-- 目的:
--   - simple_status (7段階) ENUM と関連カラムを追加
--   - deals に Phase 1 用の任意カラム (client_name_text / desired_delivery_date / memo) を追加
--   - deal_status_history を simple_status にも対応
--   - 既存 master_status (M01-M25) は温存・触らない
--
-- 前提:
--   既存テストデータは事前に TRUNCATE 済み (Phase 1 は新規データから運用)
-- ============================================================================

-- 1. simple_status ENUM を作成 (既存なら何もしない)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'simple_status') THEN
    CREATE TYPE simple_status AS ENUM (
      'quoting',           -- 見積中
      'quote_confirmed',   -- 見積確定
      'paid',              -- 入金完了
      'data_confirmed',    -- 最終入稿データ確認完了
      'in_production',     -- 製作中
      'shipped',           -- 工場発送完了
      'delivered'          -- 納品完了
    );
  END IF;
END $$;

-- 2. deals テーブルにカラム追加 (冪等)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'deals' AND column_name = 'simple_status') THEN
    ALTER TABLE deals ADD COLUMN simple_status simple_status NOT NULL DEFAULT 'quoting';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'deals' AND column_name = 'visibility') THEN
    ALTER TABLE deals ADD COLUMN visibility TEXT NOT NULL DEFAULT 'internal';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'deals' AND column_name = 'client_name_text') THEN
    ALTER TABLE deals ADD COLUMN client_name_text TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'deals' AND column_name = 'desired_delivery_date') THEN
    ALTER TABLE deals ADD COLUMN desired_delivery_date DATE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'deals' AND column_name = 'memo') THEN
    ALTER TABLE deals ADD COLUMN memo TEXT;
  END IF;
END $$;

-- 3. deal_status_history を simple_status にも対応 (冪等)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'deal_status_history' AND column_name = 'from_simple_status') THEN
    ALTER TABLE deal_status_history ADD COLUMN from_simple_status simple_status;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'deal_status_history' AND column_name = 'to_simple_status') THEN
    ALTER TABLE deal_status_history ADD COLUMN to_simple_status simple_status;
  END IF;
END $$;

-- 4. インデックス追加 (一覧取得時のソート/絞込用)
CREATE INDEX IF NOT EXISTS idx_deals_simple_status ON deals(simple_status);
CREATE INDEX IF NOT EXISTS idx_deals_visibility ON deals(visibility);

-- 5. コメント
COMMENT ON COLUMN deals.simple_status IS 'Phase 1: シンプル7段階ステータス。master_status とは独立';
COMMENT ON COLUMN deals.visibility IS 'Phase 2 用伏線: internal | client_shared | factory_shared';
COMMENT ON COLUMN deals.client_name_text IS 'Phase 1: clients テーブルと別管理のクライアント名 (テキスト)';
COMMENT ON COLUMN deals.desired_delivery_date IS 'Phase 1: 案件単位の希望納期';
COMMENT ON COLUMN deals.memo IS 'Phase 1: 案件単位のメモ';
