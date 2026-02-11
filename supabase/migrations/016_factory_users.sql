-- ============================================================================
-- Phase 3: 工場ユーザーのセットアップ
-- profiles に factory_id を追加
-- ============================================================================

-- profiles テーブルに factory_id カラムを追加（なければ）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'factory_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN factory_id UUID REFERENCES factories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 工場ユーザー作成手順:
-- 1. Supabase ダッシュボード > Authentication > Users で新規ユーザーを作成
-- 2. 作成されたユーザーの UUID をコピー
-- 3. 以下のようなUPDATE文を実行:
--
-- UPDATE profiles
-- SET role = 'factory', factory_id = 'FACTORY_UUID_HERE'
-- WHERE id = 'AUTH_USER_UUID_HERE';
-- ============================================================================

-- 全工場の一覧を表示（参考用）
-- SELECT f.id, f.factory_name FROM factories f ORDER BY f.factory_name;
