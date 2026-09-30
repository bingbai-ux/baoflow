-- Atomic RFQ creation with retry-safe client request IDs. No email is sent here.
create table if not exists public.rfq_creation_requests (
  request_id uuid primary key,
  created_by uuid not null references public.profiles(id),
  payload jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.rfq_creation_requests enable row level security;

create or replace function public.create_rfq_atomic(
  p_request_id uuid, p_deal_id uuid, p_product_ids uuid[], p_factory_ids uuid[],
  p_pending_factories jsonb default '[]', p_deadline date default null, p_message text default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_requested_lines jsonb;
  v_payload jsonb; v_saved public.rfq_creation_requests; v_number text; v_base text; v_next bigint;
  v_rfq uuid; v_inv uuid; v_form uuid; v_token text; v_factory record; v_pending jsonb;
  v_invitations jsonb := '[]'; v_result jsonb;
begin
  if auth.uid() is null or not coalesce(public.is_staff(), false) then raise exception 'Sales or administrator access required'; end if;
  if p_request_id is null or p_deal_id is null then raise exception 'Request and deal IDs are required'; end if;
  if coalesce(cardinality(p_product_ids),0)=0 or coalesce(cardinality(p_factory_ids),0)+jsonb_array_length(coalesce(p_pending_factories,'[]'))=0 then raise exception 'Select products and factories'; end if;
  if array_position(p_product_ids,null) is not null or array_position(p_factory_ids,null) is not null
    or cardinality(p_product_ids) <> (select count(distinct id) from unnest(p_product_ids) id)
    or cardinality(p_factory_ids) <> (select count(distinct id) from unnest(p_factory_ids) id) then raise exception 'Duplicate or null selections'; end if;
  if jsonb_typeof(coalesce(p_pending_factories,'[]')) <> 'array' then raise exception 'Invalid pending factories'; end if;
  for v_pending in select value from jsonb_array_elements(coalesce(p_pending_factories,'[]')) loop
    if jsonb_typeof(v_pending) <> 'object' or coalesce(trim(v_pending->>'name'),'') = ''
      or length(v_pending->>'name') > 200
      or (coalesce(v_pending->>'email','') <> '' and (v_pending->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(v_pending->>'email') > 254)) then raise exception 'Invalid pending factory name or email'; end if;
  end loop;
  if jsonb_array_length(coalesce(p_pending_factories,'[]')) <> (select count(distinct lower(trim(value->>'name'))) from jsonb_array_elements(coalesce(p_pending_factories,'[]'))) then raise exception 'Duplicate pending factories'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(p_pending_factories,'[]')) p
    group by lower(trim(p->>'email')) having coalesce(lower(trim(p->>'email')),'') <> '' and count(*)>1)
    or exists(select 1 from jsonb_array_elements(coalesce(p_pending_factories,'[]')) p join public.factories f
      on f.id=any(p_factory_ids) and lower(trim(f.factory_name))=lower(trim(p->>'name'))) then raise exception 'Duplicate pending factories'; end if;
  if length(coalesce(p_message,'')) > 10000 then raise exception 'Message too long'; end if;
  v_payload := jsonb_build_object('deal',p_deal_id,'products',(select jsonb_agg(id order by id) from unnest(p_product_ids) id),
    'factories',(select jsonb_agg(id order by id) from unnest(p_factory_ids) id),'pending',coalesce(p_pending_factories,'[]'),
    'deadline',p_deadline,'message',nullif(trim(p_message),''));
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  select * into v_saved from public.rfq_creation_requests where request_id=p_request_id;
  if found then
    if v_saved.created_by <> auth.uid() or v_saved.payload <> v_payload then raise exception 'Request ID was already used with different input'; end if;
    return v_saved.result;
  end if;
  if not exists(select 1 from public.deals where id=p_deal_id) then raise exception 'Deal not found'; end if;
  if (select count(*) from public.deal_products where deal_id=p_deal_id and id=any(p_product_ids)) <> cardinality(p_product_ids) then raise exception 'Products do not belong to this deal'; end if;
  if exists(select 1 from public.deal_products p where p.id=any(p_product_ids) and not exists(select 1 from public.deal_product_variants v where v.product_id=p.id)) then raise exception 'Register product variants before requesting quotes'; end if;
  if exists(select 1 from public.deal_product_variants v where v.product_id=any(p_product_ids) and not exists(select 1 from public.deal_quotes q where q.variant_id=v.id and q.deal_id=p_deal_id and q.quantity>0)) then raise exception 'Enter a positive quote quantity for every requested variant'; end if;
  if (select count(*) from public.factories where id=any(p_factory_ids) and basic_info_completed=true) <> cardinality(p_factory_ids) then raise exception 'Factories missing or basic information incomplete'; end if;
  -- Freeze quantities and customer specifications that the factory was actually asked to quote.
  perform 1 from public.deal_quotes where deal_id=p_deal_id and variant_id in (select id from public.deal_product_variants where product_id=any(p_product_ids)) for share;
  select coalesce(jsonb_agg(jsonb_build_object(
    'product_id',p.id,'product_description',p.description,'variant_id',v.id,'variant_label',v.variant_label,
    'width_mm',v.width_mm,'height_mm',v.height_mm,'depth_mm',v.depth_mm,'material',v.material,
    'print_color_count',v.print_color_count,'pcs_per_carton',v.pcs_per_carton,
    'quantities',coalesce((select jsonb_agg(qty.quantity order by qty.quantity) from
      (select distinct quantity from public.deal_quotes where deal_id=p_deal_id and variant_id=v.id and quantity>0) qty),'[]'::jsonb)
  ) order by p.product_no,v.variant_order),'[]'::jsonb) into v_requested_lines
    from public.deal_products p join public.deal_product_variants v on v.product_id=p.id
    where p.deal_id=p_deal_id and p.id=any(p_product_ids);
  if exists(select 1 from jsonb_array_elements(v_requested_lines) l where jsonb_array_length(l->'quantities')=0) then raise exception 'Enter a positive quote quantity for every requested variant'; end if;
  v_base := 'RFQ-' || to_char(current_timestamp at time zone 'UTC','YYYYMM') || '-';
  perform pg_advisory_xact_lock(hashtextextended('rfq_requests:'||v_base,0));
  select coalesce(max(substring(rfq_number from length(v_base)+1)::bigint),0)+1 into v_next
    from public.rfq_requests where rfq_number ~ ('^'||v_base||'[0-9]{1,15}$');
  v_number := v_base || lpad(v_next::text,greatest(3,length(v_next::text)),'0');
  insert into public.rfq_requests(deal_id,product_ids,rfq_number,request_message,response_deadline,status,created_by)
    values(p_deal_id,p_product_ids,v_number,nullif(trim(p_message),''),p_deadline,'open',auth.uid()) returning id into v_rfq;
  for v_factory in select id, factory_name from public.factories where id=any(p_factory_ids) order by id loop
    insert into public.rfq_factory_invitations(rfq_id,factory_id) values(v_rfq,v_factory.id) returning id into v_inv;
    v_token := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
    insert into public.external_forms(form_type,token,related_id,status,created_by,context)
      values('rfq_response',v_token,v_inv,'pending',auth.uid(),jsonb_build_object('requested_lines',v_requested_lines)) returning id into v_form;
    update public.rfq_factory_invitations set external_form_id=v_form where id=v_inv;
    v_invitations := v_invitations || jsonb_build_array(jsonb_build_object('invitationId',v_inv,'factoryId',v_factory.id,'factoryName',v_factory.factory_name,'formToken',v_token));
  end loop;
  for v_pending in select value from jsonb_array_elements(coalesce(p_pending_factories,'[]')) loop
    insert into public.rfq_factory_invitations(rfq_id,factory_name_pending,factory_email_pending)
      values(v_rfq,trim(v_pending->>'name'),nullif(trim(v_pending->>'email'),'')) returning id into v_inv;
    v_token := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
    insert into public.external_forms(form_type,token,related_id,status,created_by,context)
      values('rfq_response',v_token,v_inv,'pending',auth.uid(),jsonb_build_object('pending_factory_name',trim(v_pending->>'name'),'pending_factory_email',nullif(trim(v_pending->>'email'),''),'requested_lines',v_requested_lines)) returning id into v_form;
    update public.rfq_factory_invitations set external_form_id=v_form where id=v_inv;
    v_invitations := v_invitations || jsonb_build_array(jsonb_build_object('invitationId',v_inv,'factoryId',null,'factoryName',trim(v_pending->>'name'),'formToken',v_token));
  end loop;
  v_result := jsonb_build_object('rfqId',v_rfq,'rfqNumber',v_number,'invitations',v_invitations);
  insert into public.rfq_creation_requests(request_id,created_by,payload,result) values(p_request_id,auth.uid(),v_payload,v_result);
  return v_result;
end;
$$;
revoke all on function public.create_rfq_atomic(uuid,uuid,uuid[],uuid[],jsonb,date,text) from public, anon;
grant execute on function public.create_rfq_atomic(uuid,uuid,uuid[],uuid[],jsonb,date,text) to authenticated;

-- Reload recovery: only the original staff actor may read their saved result.
create policy rfq_creation_request_owner_read on public.rfq_creation_requests
  for select to authenticated using(created_by=auth.uid() and public.is_staff());
grant select on public.rfq_creation_requests to authenticated;
