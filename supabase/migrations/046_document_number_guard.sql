-- Preserve historical duplicate numbers, but reject any new collisions from RPC
-- callers or older application writers. Updating other fields on an old duplicate
-- remains possible. This index is intentionally NOT unique.
create index if not exists idx_documents_number_lookup on public.documents(document_number) where document_number is not null;
create or replace function public.guard_document_number_collision()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.document_number is null then return new; end if;
  if tg_op='UPDATE' and new.document_number is not distinct from old.document_number then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('documents:number:' || new.document_number,0));
  if exists(select 1 from public.documents d where d.document_number=new.document_number and d.id<>new.id) then
    raise exception 'Document number is already in use; reserve a new number' using errcode='23505';
  end if;
  return new;
end $$;
revoke all on function public.guard_document_number_collision() from public,anon,authenticated;
drop trigger if exists guard_document_number_collision on public.documents;
create trigger guard_document_number_collision before insert or update of document_number
  on public.documents for each row execute function public.guard_document_number_collision();
-- Rollback: drop trigger guard_document_number_collision on public.documents;
-- drop function public.guard_document_number_collision();
-- Existing documents and 041 reserved counter values must remain intact.
