-- ============================================================================
-- BAO Flow v2.0 Phase 1
-- 020_phase1_design_storage_path.sql
--
-- 目的:
--   - deal_design_files に storage_path TEXT を追加
--   - file_url (公開 URL) と切り離して、Storage 内の物理パスを保存する
--   - これにより、削除時に Storage から確実に消せる
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deal_design_files' AND column_name = 'storage_path'
  ) THEN
    ALTER TABLE deal_design_files ADD COLUMN storage_path TEXT;
  END IF;
END $$;

COMMENT ON COLUMN deal_design_files.storage_path IS
  'Phase 1: Supabase Storage 内のオブジェクトパス (例: <deal_id>/<filename>)';
