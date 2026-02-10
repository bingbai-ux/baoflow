-- ============================================================================
-- Phase 2: クライアントユーザーのセットアップ
-- profiles に client_id を追加し、テスト用クライアントユーザーを設定
-- ============================================================================

-- profiles テーブルに client_id カラムを追加（なければ）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
  END IF;
END $$;

-- テスト用: 既存のクライアントに対応するprofilesレコードを更新
-- ※ Auth ユーザーは Supabase ダッシュボードで手動作成するので、
--   profiles の UPDATE 文のみ。auth.users の id が必要。

-- 例: クライアント「ROAST WORKS」のユーザーを設定する場合
-- UPDATE profiles
-- SET role = 'client', client_id = (SELECT id FROM clients WHERE company_name = 'ROAST WORKS')
-- WHERE id = 'AUTH_USER_UUID_HERE';

-- 全クライアントの一覧を表示（参考用）
-- SELECT c.id, c.company_name FROM clients c ORDER BY c.company_name;

-- ============================================================================
-- クライアントユーザー作成手順:
-- 1. Supabase ダッシュボード > Authentication > Users で新規ユーザーを作成
-- 2. 作成されたユーザーの UUID をコピー
-- 3. 以下のようなUPDATE文を実行:
--
-- UPDATE profiles
-- SET role = 'client', client_id = 'CLIENT_UUID_HERE'
-- WHERE id = 'AUTH_USER_UUID_HERE';
-- ============================================================================
