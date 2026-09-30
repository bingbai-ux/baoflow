-- LOCAL PROPOSAL ONLY. Public file serving stays unchanged; review separately before private migration.
-- Refuse to silently leave unknown permissive writers OR-ed with the new policies.
do $$ begin
 if exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and cmd in ('INSERT','DELETE','UPDATE','ALL') and policyname not in ('Authenticated upload deal-images','Authenticated delete deal-images','Staff upload deal-images','Staff delete deal-images')) then
  raise exception 'Review unknown Storage write policies before applying';
 end if;
end $$;
drop policy if exists "Authenticated upload deal-images" on storage.objects;
drop policy if exists "Authenticated delete deal-images" on storage.objects;
drop policy if exists "Staff upload deal-images" on storage.objects;
drop policy if exists "Staff delete deal-images" on storage.objects;
create policy "Staff upload deal-images" on storage.objects for insert to authenticated with check (
 bucket_id='deal-images' and public.is_staff() and split_part(name,'/',2)<>'' and
 exists(select 1 from public.deals d where d.id::text=split_part(name,'/',1) and d.archived_at is null)
);
create policy "Staff delete deal-images" on storage.objects for delete to authenticated using (
 bucket_id='deal-images' and public.is_staff() and split_part(name,'/',2)<>'' and
 exists(select 1 from public.deals d where d.id::text=split_part(name,'/',1))
);
-- Whole-table privileges are not protected by RLS. No public app needs TRUNCATE.
do $$ declare r record; begin
 for r in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') loop
  execute format('revoke truncate on table public.%I from public,anon,authenticated',r.relname);
 end loop;
end $$;
alter default privileges in schema public revoke truncate on tables from public,anon,authenticated;
-- Default privilege change covers this migration executor only; review other creator roles before release.
-- Rollback: keep denied external writers. Restore only explicitly reviewed grants/policies,
-- never restore broad authenticated upload/delete or blanket table privileges.
