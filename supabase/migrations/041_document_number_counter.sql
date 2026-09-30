-- Reserve unique numbers atomically. Existing documents, including duplicate historic
-- numbers, are preserved. A gap after a failed issuance is intentional and safe.
create table if not exists public.document_number_counters (
  prefix text primary key,
  last_value bigint not null check (last_value >= 0)
);
alter table public.document_number_counters enable row level security;

create or replace function public.reserve_document_number(p_type text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prefix text;
  v_base text;
  v_existing bigint;
  v_next bigint;
begin
  if not coalesce(public.is_staff(), false) then
    raise exception 'Sales or administrator access required';
  end if;
  v_prefix := case p_type when 'quotation' then 'QUO' when 'invoice' then 'INV'
    when 'delivery_note' then 'DLV' when 'rfq' then 'RFQ' when 'inventory_cert' then 'CRT' end;
  if v_prefix is null then raise exception 'Unsupported document type'; end if;
  v_base := v_prefix || '-' || to_char(current_timestamp at time zone 'UTC', 'YYYYMM') || '-';
  perform pg_advisory_xact_lock(hashtextextended(v_base, 0));
  select coalesce(max(substring(document_number from length(v_base) + 1)::bigint), 0)
    into v_existing from public.documents
    where document_number ~ ('^' || v_base || '[0-9]{1,15}$');
  insert into public.document_number_counters(prefix, last_value) values(v_base, v_existing + 1)
    on conflict(prefix) do update set last_value = greatest(document_number_counters.last_value, v_existing) + 1
    returning last_value into v_next;
  return v_base || lpad(v_next::text, greatest(3, length(v_next::text)), '0');
end;
$$;
revoke all on function public.reserve_document_number(text) from public, anon;
grant execute on function public.reserve_document_number(text) to authenticated;
