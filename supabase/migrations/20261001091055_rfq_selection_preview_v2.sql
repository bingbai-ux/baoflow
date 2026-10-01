-- Local-only proposal. Existing v1 entrypoints and snapshots are preserved.
create or replace function public.preview_rfq_v2(p_deal_id uuid,p_selection jsonb,p_factory_ids uuid[],p_pending_factories jsonb default '[]',p_deadline date default null,p_message text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare item jsonb; v_quantity numeric; variant public.deal_product_variants; product public.deal_products;
 lines jsonb:='[]'; recipients jsonb; seen text[]:='{}'; qs jsonb; key text; pending jsonb; result jsonb;
begin
 if auth.uid() is null or not coalesce(public.is_staff(),false) then raise exception 'Sales or administrator access required'; end if;
 if not exists(select 1 from public.deals where id=p_deal_id and archived_at is null) then raise exception 'Deal not found or archived'; end if;
 if jsonb_typeof(p_selection) is distinct from 'array' or jsonb_array_length(p_selection)=0 or jsonb_array_length(p_selection)>200 then raise exception 'Select specifications and quantities'; end if;
 if array_position(p_factory_ids,null) is not null or cardinality(p_factory_ids)<>(select count(distinct id) from unnest(p_factory_ids) id) then raise exception 'Duplicate or null selections'; end if;
 if jsonb_typeof(p_pending_factories) is distinct from 'array' or coalesce(cardinality(p_factory_ids),0)+jsonb_array_length(p_pending_factories)=0 then raise exception 'Select products and factories'; end if;
 if length(coalesce(p_message,''))>10000 then raise exception 'Message too long'; end if;
 for item in select value from jsonb_array_elements(p_selection) order by value->>'product_id',value->>'variant_id' loop
  select * into product from public.deal_products where id=(item->>'product_id')::uuid and deal_id=p_deal_id;
  if not found then raise exception 'Products do not belong to this deal'; end if;
  select * into variant from public.deal_product_variants where id=(item->>'variant_id')::uuid and product_id=product.id;
  if not found then raise exception 'Variant does not belong to selected product'; end if;
  key:=product.id::text||':'||variant.id::text;
  if key=any(seen) then raise exception 'Duplicate specification'; end if;
  seen:=array_append(seen,key);
  if jsonb_typeof(item->'quantities') is distinct from 'array' or jsonb_array_length(item->'quantities')=0 or jsonb_array_length(item->'quantities')>100 then raise exception 'Select quantities for every specification'; end if;
  qs:='[]';
  for v_quantity in select value::text::numeric from jsonb_array_elements(item->'quantities') order by 1 loop
   if v_quantity is null or v_quantity::text in ('NaN','Infinity','-Infinity') or v_quantity<1 or v_quantity<>trunc(v_quantity) or v_quantity>2147483647 then raise exception 'Invalid quantity'; end if;
   if qs @> jsonb_build_array(v_quantity) then raise exception 'Duplicate v_quantity'; end if;
   if not exists(select 1 from public.deal_quotes q where q.deal_id=p_deal_id and q.variant_id=variant.id and q.quantity=v_quantity) then raise exception 'Quantity is no longer registered'; end if;
   qs:=qs||jsonb_build_array(v_quantity);
  end loop;
  lines:=lines||jsonb_build_array(jsonb_build_object('product_id',product.id,'product_description',product.description,'product_no',product.product_no,
   'variant_id',variant.id,'variant_label',variant.variant_label,'width_mm',variant.width_mm,'height_mm',variant.height_mm,'depth_mm',variant.depth_mm,
   'material',variant.material,'print_color_count',variant.print_color_count,'print_method',variant.print_method,
   'color_description',variant.color_description,'pantone_colors',variant.pantone_colors,'processing',variant.processing,'pcs_per_carton',variant.pcs_per_carton,'quantities',qs));
 end loop;
 if (select count(*) from public.factories where id=any(p_factory_ids) and basic_info_completed=true)<>cardinality(p_factory_ids) then raise exception 'Factories missing or basic information incomplete'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('factory_id',id,'name',factory_name,'email',coalesce(contact_email,'')) order by id),'[]') into recipients from public.factories where id=any(p_factory_ids);
 if jsonb_array_length(p_pending_factories)<>(select count(distinct lower(trim(value->>'name'))) from jsonb_array_elements(p_pending_factories)) then raise exception 'Duplicate pending factories'; end if;
 for pending in select value from jsonb_array_elements(p_pending_factories) order by lower(trim(value->>'name')) loop
  if jsonb_typeof(pending)<>'object' or coalesce(trim(pending->>'name'),'')='' or length(pending->>'name')>200
   or (coalesce(trim(pending->>'email'),'')<>'' and (pending->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(pending->>'email')>254)) then raise exception 'Invalid pending factory name or email'; end if;
  if exists(select 1 from jsonb_array_elements(recipients) r where lower(trim(r->>'name'))=lower(trim(pending->>'name'))
    or (coalesce(trim(pending->>'email'),'')<>'' and lower(trim(r->>'email'))=lower(trim(pending->>'email')))) then raise exception 'Duplicate pending factories'; end if;
  recipients:=recipients||jsonb_build_array(jsonb_build_object('factory_id',null,'name',trim(pending->>'name'),'email',coalesce(nullif(trim(pending->>'email'),''),'')));
 end loop;
 result:=jsonb_build_object('schema_version',2,'deal_id',p_deal_id,'requested_lines',lines,'recipients',recipients,'response_deadline',p_deadline,'request_message',nullif(trim(p_message),''));
 return result;
end $$;
revoke all on function public.preview_rfq_v2(uuid,jsonb,uuid[],jsonb,date,text) from public,anon;
grant execute on function public.preview_rfq_v2(uuid,jsonb,uuid[],jsonb,date,text) to authenticated;

create or replace function public.create_rfq_v2(
  p_request_id uuid, p_deal_id uuid, p_selection jsonb, p_expected jsonb, p_factory_ids uuid[],
  p_pending_factories jsonb default '[]', p_deadline date default null, p_message text default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_requested_lines jsonb; v_snapshot jsonb; p_product_ids uuid[];
  v_payload jsonb; v_saved public.rfq_creation_requests; v_number text; v_base text; v_next bigint;
  v_rfq uuid; v_inv uuid; v_form uuid; v_token text; v_factory record; v_pending jsonb;
  v_invitations jsonb := '[]'; v_result jsonb;
begin
  if auth.uid() is null or not coalesce(public.is_staff(), false) then raise exception 'Sales or administrator access required'; end if;
  select jsonb_agg(jsonb_build_object('product_id',l.value->'product_id','variant_id',l.value->'variant_id','quantities',(select jsonb_agg(q.value order by q.value::text::numeric) from jsonb_array_elements(l.value->'quantities') q)) order by l.value->>'product_id',l.value->>'variant_id') into p_selection from jsonb_array_elements(p_selection) l;
  select array_agg(distinct (value->>'product_id')::uuid order by (value->>'product_id')::uuid) into p_product_ids from jsonb_array_elements(p_selection);
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
    'factories',(select jsonb_agg(id order by id) from unnest(p_factory_ids) id),'pending',(select coalesce(jsonb_agg(jsonb_build_object('name',trim(value->>'name'),'email',coalesce(nullif(trim(value->>'email'),''),'')) order by lower(trim(value->>'name'))),'[]') from jsonb_array_elements(p_pending_factories)),
    'deadline',p_deadline,'message',nullif(trim(p_message),''),'selection',p_selection,'expected',p_expected);
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  select * into v_saved from public.rfq_creation_requests where request_id=p_request_id;
  if found then
    if v_saved.created_by <> auth.uid() or v_saved.payload <> v_payload then raise exception 'Request ID was already used with different input'; end if;
    return v_saved.result;
  end if;
  perform 1 from public.deals where id=p_deal_id and archived_at is null for update;
  if not found then raise exception 'Deal not found or archived'; end if;
  perform 1 from public.deal_products where deal_id=p_deal_id and id=any(p_product_ids) order by id for share;
  perform 1 from public.deal_product_variants where product_id=any(p_product_ids) order by id for share;
  perform 1 from public.deal_quotes where deal_id=p_deal_id and variant_id in (select id from public.deal_product_variants where product_id=any(p_product_ids)) order by id for share;
  perform 1 from public.factories where id=any(p_factory_ids) order by id for share;
  v_snapshot:=public.preview_rfq_v2(p_deal_id,p_selection,p_factory_ids,p_pending_factories,p_deadline,p_message);
  if v_snapshot is distinct from p_expected then raise exception 'Preview changed. Review again'; end if;
  v_requested_lines:=v_snapshot->'requested_lines';
  v_base := 'RFQ-' || to_char(current_timestamp at time zone 'UTC','YYYYMM') || '-';
  perform pg_advisory_xact_lock(hashtextextended('rfq_requests:'||v_base,0));
  select coalesce(max(substring(rfq_number from length(v_base)+1)::bigint),0)+1 into v_next
    from public.rfq_requests where rfq_number ~ ('^'||v_base||'[0-9]{1,15}$');
  v_number := v_base || lpad(v_next::text,greatest(3,length(v_next::text)),'0');
  insert into public.rfq_requests(deal_id,product_ids,rfq_number,request_message,response_deadline,status,created_by)
    values(p_deal_id,p_product_ids,v_number,nullif(trim(p_message),''),p_deadline,'open',auth.uid()) returning id into v_rfq;
  for v_factory in select id, factory_name, contact_email from public.factories where id=any(p_factory_ids) order by id loop
    insert into public.rfq_factory_invitations(rfq_id,factory_id) values(v_rfq,v_factory.id) returning id into v_inv;
    v_token := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
    insert into public.external_forms(form_type,token,related_id,status,created_by,context)
      values('rfq_response',v_token,v_inv,'pending',auth.uid(),jsonb_build_object('schema_version',2,'requested_lines',v_requested_lines,'request_message',v_snapshot->'request_message','response_deadline',v_snapshot->'response_deadline','recipient',jsonb_build_object('name',v_factory.factory_name,'email',coalesce(v_factory.contact_email,'')))) returning id into v_form;
    update public.rfq_factory_invitations set external_form_id=v_form where id=v_inv;
    v_invitations := v_invitations || jsonb_build_array(jsonb_build_object('invitationId',v_inv,'factoryId',v_factory.id,'factoryName',v_factory.factory_name,'formToken',v_token));
  end loop;
  for v_pending in select value from jsonb_array_elements(coalesce(p_pending_factories,'[]')) loop
    insert into public.rfq_factory_invitations(rfq_id,factory_name_pending,factory_email_pending)
      values(v_rfq,trim(v_pending->>'name'),nullif(trim(v_pending->>'email'),'')) returning id into v_inv;
    v_token := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
    insert into public.external_forms(form_type,token,related_id,status,created_by,context)
      values('rfq_response',v_token,v_inv,'pending',auth.uid(),jsonb_build_object('pending_factory_name',trim(v_pending->>'name'),'pending_factory_email',nullif(trim(v_pending->>'email'),''),'requested_lines',v_requested_lines,'schema_version',2,'request_message',v_snapshot->'request_message','response_deadline',v_snapshot->'response_deadline','recipient',jsonb_build_object('name',trim(v_pending->>'name'),'email',coalesce(nullif(trim(v_pending->>'email'),''),'')))) returning id into v_form;
    update public.rfq_factory_invitations set external_form_id=v_form where id=v_inv;
    v_invitations := v_invitations || jsonb_build_array(jsonb_build_object('invitationId',v_inv,'factoryId',null,'factoryName',trim(v_pending->>'name'),'formToken',v_token));
  end loop;
  v_result := jsonb_build_object('rfqId',v_rfq,'rfqNumber',v_number,'invitations',v_invitations);
  insert into public.rfq_creation_requests(request_id,created_by,payload,result) values(p_request_id,auth.uid(),v_payload,v_result);
  return v_result;
end;
$$;
revoke all on function public.create_rfq_v2(uuid,uuid,jsonb,jsonb,uuid[],jsonb,date,text) from public, anon;
grant execute on function public.create_rfq_v2(uuid,uuid,jsonb,jsonb,uuid[],jsonb,date,text) to authenticated;

-- RFQ factory answers remain isolated per quote; never overwrite shared variant packaging.
alter table public.deal_quotes add column if not exists factory_response jsonb;
create or replace function public.ext_rfq_context(p_token text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp stable as $$
declare f public.external_forms; r record;
begin
  select * into f from public.external_forms where token=p_token;
  if not found or f.form_type <> 'rfq_response' or f.status <> 'pending' or f.cancelled_at is not null or f.expires_at is null or f.expires_at <= now() then return jsonb_build_object('error','フォームは無効または期限切れです'); end if;
  select req.* into r from public.rfq_requests req join public.rfq_factory_invitations inv on inv.rfq_id=req.id where inv.id=f.related_id and inv.external_form_id=f.id;
  if not found or r.status not in ('open','partially_responded') or not exists(select 1 from public.deals where id=r.deal_id and archived_at is null) then return jsonb_build_object('error','RFQは受付できません'); end if;
  if jsonb_typeof(f.context->'requested_lines') is distinct from 'array' or jsonb_array_length(f.context->'requested_lines')=0 then return jsonb_build_object('error','依頼当時の仕様・数量が不足しています。担当者へ新しいRFQを依頼してください'); end if;
  return jsonb_build_object('schema_version',coalesce(f.context->'schema_version','1'::jsonb),'rfq',jsonb_build_object('id',r.id,'rfq_number',r.rfq_number,'request_message',case when f.context->>'schema_version'='2' then f.context->'request_message' else to_jsonb(r.request_message) end,'response_deadline',case when f.context->>'schema_version'='2' then f.context->'response_deadline' else to_jsonb(r.response_deadline) end),
    'products',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'description',coalesce((select line->>'product_description' from jsonb_array_elements(f.context->'requested_lines') line where line->>'product_id'=p.id::text limit 1),p.description),
      'variants',coalesce((select jsonb_agg(jsonb_build_object('id',line->>'variant_id','label',coalesce(line->>'variant_label',''),'width_mm',line->'width_mm','height_mm',line->'height_mm','depth_mm',line->'depth_mm','material',line->'material','print_color_count',line->'print_color_count','pcs_per_carton',line->'pcs_per_carton','print_method',line->'print_method','processing',line->'processing','color_description',line->'color_description','pantone_colors',line->'pantone_colors','requested_quantities',line->'quantities')) from jsonb_array_elements(f.context->'requested_lines') line where line->>'product_id'=p.id::text),'[]'::jsonb)))
      from public.deal_products p where p.id=any(r.product_ids) and p.deal_id=r.deal_id),'[]'::jsonb));
end $$;
revoke all on function public.ext_rfq_context(text) from public;
grant execute on function public.ext_rfq_context(text) to anon,authenticated;

create or replace function public.ext_submit_rfq(p_token text,p_payload jsonb,p_ip text default null,p_ua text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare f public.external_forms; inv record; r record; line jsonb; v_id uuid; p_id uuid; n numeric; key text;
  expected jsonb; snapshot_line jsonb; seen text[] := '{}'; q record; version_no integer; answered integer; total integer; line_key text;
begin
  select * into f from public.external_forms where token=p_token for update;
  if not found or f.form_type <> 'rfq_response' then raise exception 'フォームが見つかりません'; end if;
  if f.status='cancelled' or f.cancelled_at is not null or f.expires_at is null or f.expires_at <= now() then raise exception 'フォームは無効または期限切れです'; end if;
  if f.status='submitted' then
    if f.submission_data = p_payload then return jsonb_build_object('success',true,'replayed',true); end if;
    raise exception 'このフォームは既に送信されています';
  end if;
  if f.status <> 'pending' then raise exception 'フォームは受付できません'; end if;
  select * into inv from public.rfq_factory_invitations where id=f.related_id and external_form_id=f.id for update;
  if not found then raise exception 'RFQ招待が見つかりません'; end if;
  select * into r from public.rfq_requests where id=inv.rfq_id for update;
  if not found or r.status not in ('open','partially_responded') then raise exception 'RFQは受付を終了しました'; end if;
  perform 1 from public.deals where id=r.deal_id and archived_at is null for update;
  if not found then raise exception '案件は受付できません'; end if;
  expected := f.context->'requested_lines';
  if jsonb_typeof(expected) is distinct from 'array' or jsonb_array_length(expected)=0 then raise exception '依頼当時の仕様・数量が不足しています。担当者へ新しいRFQを依頼してください'; end if;
  if jsonb_typeof(p_payload->'products') is distinct from 'array' or jsonb_array_length(p_payload->'products')=0 then raise exception '商品別の回答を入力してください'; end if;
  for line in select value from jsonb_array_elements(p_payload->'products') loop
    p_id := (line->>'product_id')::uuid; v_id := nullif(line->>'variant_id','')::uuid;
    if not coalesce(p_id=any(r.product_ids),false) or not exists(select 1 from public.deal_products where id=p_id and deal_id=r.deal_id) then raise exception 'このRFQに含まれない商品です'; end if;
    if v_id is null or not exists(select 1 from public.deal_product_variants where id=v_id and product_id=p_id) then raise exception '商品仕様が一致しません。営業担当へ数量・仕様の確認を依頼してください'; end if;
    select value into snapshot_line from jsonb_array_elements(expected) where value->>'product_id'=p_id::text and value->>'variant_id'=v_id::text;
    if not found then raise exception 'このRFQで依頼されていない仕様です'; end if;
    line_key := p_id::text || ':' || v_id::text;
    if f.context->>'schema_version'='2' then
      n:=nullif(line->>'quantity','')::numeric;
      if n is null or n::text in ('NaN','Infinity','-Infinity') or n<1 or n<>trunc(n) or n>2147483647 or not (snapshot_line->'quantities' @> jsonb_build_array(n)) then raise exception 'Unrequested quantity'; end if;
      line_key:=line_key||':'||n::text;
    end if;
    if line_key=any(seen) then raise exception '同じ仕様の回答が重複しています'; end if;
    seen := array_append(seen,line_key);
    foreach key in array array['unit_price_usd','moq','pcs_per_carton','carton_w_cm','carton_h_cm','carton_d_cm','gross_weight_kg','production_lead_days'] loop
      n:=nullif(line->>key,'')::numeric;
      if n is null or n::text in ('NaN','Infinity','-Infinity') or n < 0 or (key <> 'production_lead_days' and n=0) then raise exception '単価・MOQ・入り数・カートン・重量・日数を正しく入力してください'; end if;
      if key in ('moq','pcs_per_carton','production_lead_days') and (n<>trunc(n) or n>2147483647) then raise exception 'MOQ・入り数・日数は整数で入力してください'; end if;
    end loop;
    if jsonb_typeof(snapshot_line->'quantities') is distinct from 'array' or jsonb_array_length(snapshot_line->'quantities')=0 then raise exception '依頼数量が未設定です。営業担当へ確認してください'; end if;
    -- Unregistered factory answers stay on the invitation until staff registers the factory.
    if inv.factory_id is not null then
      select coalesce(max(version),0) into version_no from public.deal_quotes where deal_id=r.deal_id;
      for q in select distinct value::text::integer quantity from jsonb_array_elements(snapshot_line->'quantities') where f.context->>'schema_version' is distinct from '2' or value::text::numeric=(line->>'quantity')::numeric order by quantity loop
        if q.quantity < 1 then raise exception '依頼数量が不正です'; end if;
        version_no:=version_no+1;
        insert into public.deal_quotes(deal_id,variant_id,factory_id,quantity,moq,factory_unit_price_usd,status,source_type,version,factory_response)
        values(r.deal_id,v_id,inv.factory_id,q.quantity,(line->>'moq')::integer,(line->>'unit_price_usd')::numeric,'drafting','rfq_response',version_no,
          jsonb_build_object('line',line,'invitation_id',inv.id,'payment_terms',p_payload->'payment_terms','general_notes',p_payload->'general_notes'));
      end loop;
    end if;
  end loop;
  if cardinality(seen) <> (case when f.context->>'schema_version'='2' then (select sum(jsonb_array_length(value->'quantities')) from jsonb_array_elements(expected)) else jsonb_array_length(expected) end) then raise exception '依頼されたすべての仕様について回答してください'; end if;
  update public.rfq_factory_invitations set responded_at=now() where id=inv.id;
  select count(*) filter(where responded_at is not null),count(*) into answered,total from public.rfq_factory_invitations where rfq_id=r.id;
  update public.rfq_requests set status=case when answered>=total then 'fully_responded' else 'partially_responded' end where id=r.id;
  update public.external_forms set status='submitted',submitted_at=now(),submitted_by_email=nullif(trim(p_payload->>'factory_email'),''),submission_ip=p_ip,submission_user_agent=p_ua,submission_data=p_payload where id=f.id;
  return jsonb_build_object('success',true,'deal_id',r.deal_id);
end $$;
revoke all on function public.ext_submit_rfq(text,jsonb,text,text) from public;
grant execute on function public.ext_submit_rfq(text,jsonb,text,text) to anon,authenticated;

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
  if not found then raise exception 'Unrequested specification'; end if;
  key:=p_id::text||':'||v_id::text;
  if f.context->>'schema_version'='2' then
   qty:=nullif(line->>'quantity','')::numeric;
   if qty is null or qty::text in ('NaN','Infinity','-Infinity') or qty<1 or qty<>trunc(qty) or qty>2147483647 or not(snapshot_line->'quantities' @> jsonb_build_array(qty)) then raise exception 'Unrequested quantity'; end if;
   key:=key||':'||qty::text;
  end if;
  if key=any(seen) then raise exception 'Unrequested or duplicate specification'; end if;
  seen:=array_append(seen,key);
  foreach key in array array['unit_price_usd','moq','pcs_per_carton','carton_w_cm','carton_h_cm','carton_d_cm','gross_weight_kg','production_lead_days'] loop
   n:=nullif(line->>key,'')::numeric;
   if n is null or n::text in ('NaN','Infinity','-Infinity') or n<0 or (key<>'production_lead_days' and n=0) then raise exception 'Invalid saved answer numbers'; end if;
   if key in ('moq','pcs_per_carton','production_lead_days') and (n<>trunc(n) or n>2147483647) then raise exception 'Invalid saved answer integers'; end if;
  end loop;
  quantities:=snapshot_line->'quantities';
  if jsonb_typeof(quantities) is distinct from 'array' or jsonb_array_length(quantities)=0 then raise exception 'Original quantities are required'; end if;
  select coalesce(max(version),0) into version_no from public.deal_quotes where deal_id=p_deal_id;
  for qty in select distinct value::text::numeric from jsonb_array_elements(quantities) where f.context->>'schema_version' is distinct from '2' or value::text::numeric=(line->>'quantity')::numeric order by 1 loop
   if qty is null or qty::text in ('NaN','Infinity','-Infinity') or qty<=0 or qty<>trunc(qty) or qty>2147483647 then raise exception 'Invalid original quantity'; end if;
   version_no:=version_no+1;
   insert into public.deal_quotes(deal_id,variant_id,factory_id,quantity,moq,factory_unit_price_usd,status,source_type,version,factory_response)
   values(p_deal_id,v_id,p_factory_id,qty::integer,(line->>'moq')::integer,(line->>'unit_price_usd')::numeric,'drafting','rfq_response',version_no,
    jsonb_build_object('line',line,'invitation_id',inv.id,'payment_terms',f.submission_data->'payment_terms','general_notes',f.submission_data->'general_notes')) returning id into quote_id;
   quote_ids:=array_append(quote_ids,quote_id);
  end loop;
 end loop;
 if cardinality(seen)<>(case when f.context->>'schema_version'='2' then (select sum(jsonb_array_length(value->'quantities')) from jsonb_array_elements(expected)) else jsonb_array_length(expected) end) or cardinality(quote_ids)=0 then raise exception 'Every requested specification must have an answer'; end if;
 insert into public.rfq_answer_imports values(inv.id,p_factory_id,auth.uid(),now(),f.submission_data,quote_ids);
 update public.rfq_factory_invitations set factory_id=p_factory_id where id=inv.id;
 return jsonb_build_object('success',true,'quoteIds',quote_ids,'replayed',false);
end $$;
revoke all on function public.import_pending_rfq_answer(uuid,uuid,uuid) from public,anon;
grant execute on function public.import_pending_rfq_answer(uuid,uuid,uuid) to authenticated;
-- Rollback: disable import UI/RPC, retain saved answers, quotes and import ledger.

alter table public.rfq_email_receipts add column if not exists mail_payload jsonb;
create or replace function public.claim_rfq_email_v2(p_invitation_id uuid,p_mail_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb; recipient jsonb;
begin
 if auth.uid() is null or not coalesce(public.is_staff(),false) then raise exception 'Sales or administrator access required'; end if;
 if jsonb_typeof(p_mail_payload) is distinct from 'object' or coalesce(p_mail_payload->>'to','')='' or coalesce(p_mail_payload->>'from','')='' or coalesce(p_mail_payload->>'subject','')='' or coalesce(p_mail_payload->>'html','')='' or length(p_mail_payload::text)>100000 then raise exception 'Invalid email preview'; end if;
 select f.context->'recipient' into recipient from public.external_forms f join public.rfq_factory_invitations i on i.external_form_id=f.id where i.id=p_invitation_id and f.context->>'schema_version'='2' for share of f;
 if found and recipient->>'email' is distinct from p_mail_payload->>'to' then raise exception 'Email recipient changed'; end if;
 result:=public.claim_rfq_email(p_invitation_id);
 if result->>'claimed'='true' then update public.rfq_email_receipts set mail_payload=p_mail_payload where invitation_id=p_invitation_id; end if;
 return result;
end $$;
revoke all on function public.claim_rfq_email_v2(uuid,jsonb) from public,anon;
grant execute on function public.claim_rfq_email_v2(uuid,jsonb) to authenticated;
create or replace function public.keep_rfq_v2_snapshot()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if old.form_type='rfq_response' and old.context->>'schema_version'='2' and (new.context is distinct from old.context or new.form_type is distinct from old.form_type or new.related_id is distinct from old.related_id) then raise exception 'RFQ snapshot is immutable; create a new request'; end if;
 return new;
end $$;
revoke all on function public.keep_rfq_v2_snapshot() from public,anon,authenticated;
create trigger keep_rfq_v2_snapshot before update on public.external_forms for each row execute function public.keep_rfq_v2_snapshot();
-- Rollback: disable v2 create/send UI; preserve v2 forms, immutable answers and permanent receipts.
