-- ============================================================================
-- BAO Flow v2.0 Phase 1
-- 021_phase1_storage_bucket.sql
--
-- 目的:
--   - Supabase Storage に deal-images バケットを作成
--   - 公開バケット (画像 URL を <img> で直接参照)
--   - 認証ユーザーのみアップロード/削除可、誰でも閲覧可
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'deal-images',
  'deal-images',
  true,
  10485760,  -- 10 MB / file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 既存ポリシーがある場合に備えて DROP IF EXISTS で冪等化
DROP POLICY IF EXISTS "Public read deal-images" ON storage.objects;
CREATE POLICY "Public read deal-images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'deal-images');

DROP POLICY IF EXISTS "Authenticated upload deal-images" ON storage.objects;
CREATE POLICY "Authenticated upload deal-images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'deal-images');

DROP POLICY IF EXISTS "Authenticated delete deal-images" ON storage.objects;
CREATE POLICY "Authenticated delete deal-images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'deal-images');
