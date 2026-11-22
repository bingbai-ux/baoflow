-- カタログのAI取込: 大きなカタログ（PDF・画像）をいったん置く、営業・管理者だけの保管場所。
-- 追加のみ。公開しない（URL を知っていても外からは開けない）。読み取りが終わったら画面側で消す。
-- Rollback: drop policy "staff read catalog-imports" / "staff upload catalog-imports" / "staff delete catalog-imports" on storage.objects; delete from storage.buckets where id = 'catalog-imports';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalog-imports', 'catalog-imports', false, 52428800, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

drop policy if exists "staff read catalog-imports" on storage.objects;
create policy "staff read catalog-imports" on storage.objects for select to authenticated
  using (bucket_id = 'catalog-imports' and public.is_staff());
drop policy if exists "staff upload catalog-imports" on storage.objects;
create policy "staff upload catalog-imports" on storage.objects for insert to authenticated
  with check (bucket_id = 'catalog-imports' and public.is_staff());
drop policy if exists "staff delete catalog-imports" on storage.objects;
create policy "staff delete catalog-imports" on storage.objects for delete to authenticated
  using (bucket_id = 'catalog-imports' and public.is_staff());
