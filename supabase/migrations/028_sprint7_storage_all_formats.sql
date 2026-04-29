-- ============================================================================
-- BAO Flow v2.0 Sprint 7-4-2-A
-- 028_sprint7_storage_all_formats.sql
--
-- 目的:
--   migration 021 で作った deal-images バケットを「全形式対応」に拡張する。
--   - MIME タイプ制限を解除 (allowed_mime_types = NULL)
--   - ファイルサイズ上限を 10MB → 50MB に拡大
--
-- 背景 (§0.5-1):
--   従来は image のみ受け付けていたが、Sprint 7 で添付ファイルを拡張:
--   pdf / zip / ai / psd / eps / sketch / doc / xlsx / etc. を扱う。
--
-- 判断:
--   バケット名 'deal-images' は機能と乖離するが、リネームには既存ファイル
--   移動 + URL 全更新が必要。代わりに名前は維持し、機能だけ拡張する。
--   将来 Phase 2 等で機を見て移行検討。
--
-- 適用: supabase db push 後すぐ反映。RLS ポリシーは migration 021 のまま。
-- ============================================================================

-- 既存バケットがある場合のみ UPDATE (冪等性ガード)。
-- 初回適用環境 (バケット未作成) では何もしない — migration 021 が先に適用されているはず。
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'deal-images') THEN
    UPDATE storage.buckets
    SET
      allowed_mime_types = NULL,           -- NULL = 全 MIME 許可
      file_size_limit = 52428800           -- 50 MB / file (10 MB → 50 MB)
    WHERE id = 'deal-images';
  END IF;
END $$;
