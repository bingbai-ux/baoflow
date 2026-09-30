-- Local proposal only: apply after 045, no production application authorized.
create table public.rfq_answer_imports (
 invitation_id uuid primary key references public.rfq_factory_invitations(id),
 factory_id uuid not null references public.factories(id),
 created_by uuid not null references public.profiles(id),
 imported_at timestamptz not null default now(),
 answer jsonb not null,
 quote_ids uuid[] not null
);
alter table public.rfq_answer_imports enable row level security;
revoke all on public.rfq_answer_imports from public,anon,authenticated;
grant select on public.rfq_answer_imports to authenticated;
create policy staff_read on public.rfq_answer_imports for select to authenticated using(public.is_staff());
create or replace function public.import_pending_rfq_answer(p_deal_id uuid,p_invitation_id uuid,p_factory_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare f public.external_forms; inv public.rfq_factory_invitations; r public.rfq_requests; saved public.rfq_answer_imports;
 expected jsonb; snapshot_line jsonb; line jsonb; p_id uuid; v_id uuid; n numeric; key text; seen text[]:='{}'; quantities jsonb;
 version_no integer; quote_id uuid; quote_ids uuid[]:='{}'; qty numeric;
begin
 if auth.uid() is null or not coalesce(public.is_staff(),false) then raise exception 'Sales or administrator access required'; end if;
 -- Same lock order as ext_submit_rfq: form, invitation, RFQ, deal.
 select e.* into f from public.external_forms e join public.rfq_factory_invitations i on i.external_form_id=e.id where i.id=p_invitation_id for update of e;
 if not found or f.form_type<>'rfq_response' or f.status<>'submitted' or f.cancelled_at is not null then raise exception 'Submitted factory answer is required'; end if;
 select * into inv from public.rfq_factory_invitations where id=p_invitation_id and external_form_id=f.id and id=f.related_id for update;
 if not found then raise exception 'Invitation link mismatch'; end if;
 select * into r from public.rfq_requests where id=inv.rfq_id for update;
 if not found or r.deal_id is distinct from p_deal_id then raise exception 'Invitation does not belong to this deal'; end if;
 perform 1 from public.deals where id=p_deal_id and archived_at is null for update;
 if not found then raise exception 'Deal not found or archived'; end if;
 select * into saved from public.rfq_answer_imports where invitation_id=inv.id;
 if found then
  if saved.factory_id is distinct from p_factory_id or saved.answer is distinct from f.submission_data then raise exception 'Answer was imported with different input'; end if;
  return jsonb_build_object('success',true,'quoteIds',saved.quote_ids,'replayed',true);
 end if;
 if inv.factory_id is not null or nullif(trim(inv.factory_name_pending),'') is null then raise exception 'Only an unregistered factory answer can be imported'; end if;
 if not exists(select 1 from public.factories where id=p_factory_id and basic_info_completed=true) then raise exception 'Select a registered factory with complete basic information'; end if;
 expected:=f.context->'requested_lines';
 if jsonb_typeof(expected) is distinct from 'array' or jsonb_array_length(expected)=0 then raise exception 'Original specification snapshot is required'; end if;
 if jsonb_typeof(f.submission_data->'products') is distinct from 'array' then raise exception 'Saved answer is invalid'; end if;
 for line in select value from jsonb_array_elements(f.submission_data->'products') loop
  p_id:=(line->>'product_id')::uuid; v_id:=(line->>'variant_id')::uuid;
  if not coalesce(p_id=any(r.product_ids),false) or not exists(select 1 from public.deal_products where id=p_id and deal_id=p_deal_id)
    or not exists(select 1 from public.deal_product_variants where id=v_id and product_id=p_id) then raise exception 'Answer specification does not belong to this deal'; end if;
  select value into snapshot_line from jsonb_array_elements(expected) where value->>'product_id'=p_id::text and value->>'variant_id'=v_id::text;
  if not found or (p_id::text||':'||v_id::text)=any(seen) then raise exception 'Unrequested or duplicate specification'; end if;
  seen:=array_append(seen,p_id::text||':'||v_id::text);
  foreach key in array array['unit_price_usd','moq','pcs_per_carton','carton_w_cm','carton_h_cm','carton_d_cm','gross_weight_kg','production_lead_days'] loop
   n:=nullif(line->>key,'')::numeric;
   if n is null or n::text in ('NaN','Infinity','-Infinity') or n<0 or (key<>'production_lead_days' and n=0) then raise exception 'Invalid saved answer numbers'; end if;
   if key in ('moq','pcs_per_carton','production_lead_days') and (n<>trunc(n) or n>2147483647) then raise exception 'Invalid saved answer integers'; end if;
  end loop;
  quantities:=snapshot_line->'quantities';
  if jsonb_typeof(quantities) is distinct from 'array' or jsonb_array_length(quantities)=0 then raise exception 'Original quantities are required'; end if;
  select coalesce(max(version),0) into version_no from public.deal_quotes where deal_id=p_deal_id;
  for qty in select distinct value::text::numeric from jsonb_array_elements(quantities) order by 1 loop
   if qty is null or qty::text in ('NaN','Infinity','-Infinity') or qty<=0 or qty<>trunc(qty) or qty>2147483647 then raise exception 'Invalid original quantity'; end if;
   version_no:=version_no+1;
   insert into public.deal_quotes(deal_id,variant_id,factory_id,quantity,moq,factory_unit_price_usd,status,source_type,version,factory_response)
   values(p_deal_id,v_id,p_factory_id,qty::integer,(line->>'moq')::integer,(line->>'unit_price_usd')::numeric,'drafting','rfq_response',version_no,
    jsonb_build_object('line',line,'invitation_id',inv.id,'payment_terms',f.submission_data->'payment_terms','general_notes',f.submission_data->'general_notes')) returning id into quote_id;
   quote_ids:=array_append(quote_ids,quote_id);
  end loop;
 end loop;
 if cardinality(seen)<>jsonb_array_length(expected) or cardinality(quote_ids)=0 then raise exception 'Every requested specification must have an answer'; end if;
 insert into public.rfq_answer_imports values(inv.id,p_factory_id,auth.uid(),now(),f.submission_data,quote_ids);
 update public.rfq_factory_invitations set factory_id=p_factory_id where id=inv.id;
 return jsonb_build_object('success',true,'quoteIds',quote_ids,'replayed',false);
end $$;
revoke all on function public.import_pending_rfq_answer(uuid,uuid,uuid) from public,anon;
grant execute on function public.import_pending_rfq_answer(uuid,uuid,uuid) to authenticated;
-- Rollback: disable import UI/RPC, retain saved answers, quotes and import ledger.
