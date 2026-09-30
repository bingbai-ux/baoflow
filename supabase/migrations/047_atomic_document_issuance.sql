-- Issue an immutable document snapshot and reserve its number in one transaction.
-- Request IDs survive uncertain retries; identical requests return the saved row.
create table if not exists public.document_issue_requests (
  request_id uuid primary key,
  created_by uuid not null references public.profiles(id),
  payload jsonb not null,
  document_id uuid not null references public.documents(id),
  created_at timestamptz not null default now()
);
alter table public.document_issue_requests enable row level security;
create or replace function public.issue_document_atomic(
  p_request_id uuid,p_deal_id uuid,p_type text,p_metadata jsonb,p_snapshot jsonb
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_payload jsonb; v_saved public.document_issue_requests; v_doc public.documents; v_number text;
  v_approved integer; v_invalid boolean;
begin
  if auth.uid() is null or not coalesce(public.is_staff(),false) then raise exception 'Sales or administrator access required'; end if;
  if p_request_id is null then raise exception 'Request ID is required'; end if;
  if p_type not in ('quotation','invoice','delivery_note','rfq','inventory_cert') then raise exception 'Unsupported document type'; end if;
  if jsonb_typeof(p_metadata) is distinct from 'object' or jsonb_typeof(p_snapshot) is distinct from 'object' then raise exception 'Invalid document payload'; end if;
  v_payload:=jsonb_build_object('deal_id',p_deal_id,'type',p_type,'metadata',p_metadata,'snapshot',p_snapshot);
  perform pg_advisory_xact_lock(hashtextextended('document_issue:'||p_request_id::text,0));
  select * into v_saved from public.document_issue_requests where request_id=p_request_id;
  if found then
    if v_saved.created_by<>auth.uid() or v_saved.payload<>v_payload then raise exception 'Request ID was already used with different input or snapshot'; end if;
    select * into v_doc from public.documents where id=v_saved.document_id;
    if not found then raise exception 'Previously issued document is unavailable'; end if;
    return to_jsonb(v_doc);
  end if;
  if p_deal_id is null then
    if p_type<>'inventory_cert' then raise exception 'Only inventory certificates can be standalone'; end if;
  else
    perform 1 from public.deals where id=p_deal_id and archived_at is null for update;
    if not found then raise exception 'Deal not found or archived'; end if;
    if p_snapshot->'deal'->>'id' is distinct from p_deal_id::text then raise exception 'Snapshot does not belong to this deal'; end if;
    if p_type='rfq' then
      if jsonb_typeof(p_snapshot->'variants') is distinct from 'array' or jsonb_array_length(p_snapshot->'variants')=0 then raise exception 'Register specifications before issuing RFQ'; end if;
    else
      if jsonb_typeof(p_snapshot->'quotes') is distinct from 'array' then raise exception 'Approved quotation snapshot is required'; end if;
      select count(*) filter(where q->>'status'='approved'),bool_or(q->>'status'='approved' and
        (coalesce(q->>'quantity','') !~ '^[1-9][0-9]*$' or coalesce(q->>'total_billing_jpy','') !~ '^[0-9]+(\.[0-9]+)?$'
          or coalesce(q->>'selling_price_jpy','') !~ '^[0-9]+(\.[0-9]+)?$'))
        into v_approved,v_invalid from jsonb_array_elements(p_snapshot->'quotes') q;
      if v_approved=0 or coalesce(v_invalid,false) then raise exception 'Valid approved quotations are required'; end if;
      if exists(select 1 from jsonb_array_elements(p_snapshot->'quotes') q
        where q->>'status'='approved' group by q->>'id' having count(*)>1) then
        raise exception 'Approved quotation IDs must be unique';
      end if;
      perform 1 from public.deal_quotes where deal_id=p_deal_id and status='approved' for share;
      if v_approved<>(select count(*) from public.deal_quotes where deal_id=p_deal_id and status='approved')
        or exists(select 1 from public.deal_quotes live where live.deal_id=p_deal_id and live.status='approved'
          and not exists(select 1 from jsonb_array_elements(p_snapshot->'quotes') q
            where q->>'status'='approved' and q->>'id'=live.id::text))
        or exists(select 1 from jsonb_array_elements(p_snapshot->'quotes') q left join public.deal_quotes live
          on live.id::text=q->>'id' and live.deal_id=p_deal_id and live.status='approved'
          where q->>'status'='approved' and (live.id is null or live.quantity::numeric is distinct from (q->>'quantity')::numeric
            or live.selling_price_jpy is distinct from (q->>'selling_price_jpy')::numeric
            or live.total_billing_jpy is distinct from (q->>'total_billing_jpy')::numeric
            or live.total_billing_tax_jpy is distinct from nullif(q->>'total_billing_tax_jpy','')::numeric)) then
        raise exception 'Approved quotations changed; reload before issuing';
      end if;
    end if;
  end if;
  v_number:=public.reserve_document_number(p_type);
  insert into public.documents(deal_id,document_type,document_number,version,metadata,issued_at,issued_by_user_id)
    values(p_deal_id,p_type::public.document_type,v_number,1,p_metadata||jsonb_build_object('snapshot_version',1,'snapshot',p_snapshot),now(),auth.uid()) returning * into v_doc;
  insert into public.document_issue_requests(request_id,created_by,payload,document_id) values(p_request_id,auth.uid(),v_payload,v_doc.id);
  return to_jsonb(v_doc);
end $$;
revoke all on function public.issue_document_atomic(uuid,uuid,text,jsonb,jsonb) from public,anon;
grant execute on function public.issue_document_atomic(uuid,uuid,text,jsonb,jsonb) to authenticated;
-- Rollback: revoke execute/drop issue_document_atomic. Preserve issued documents,
-- request ledger and counters; revert UI only with issuance disabled.

-- Recover a saved issuance after a browser reload without creating a second document.
create policy document_issue_request_owner_read on public.document_issue_requests
  for select to authenticated using(created_by=auth.uid() and public.is_staff());
grant select on public.document_issue_requests to authenticated;
