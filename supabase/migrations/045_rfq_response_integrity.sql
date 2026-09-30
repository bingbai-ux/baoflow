-- RFQ factory answers remain isolated per quote; never overwrite shared variant packaging.
alter table public.deal_quotes add column if not exists factory_response jsonb;
create or replace function public.ext_rfq_context(p_token text)
returns jsonb language plpgsql security definer set search_path=public stable as $$
declare f public.external_forms; r record;
begin
  select * into f from public.external_forms where token=p_token;
  if not found or f.form_type <> 'rfq_response' or f.status <> 'pending' or f.cancelled_at is not null or f.expires_at < now() then return jsonb_build_object('error','フォームは無効または期限切れです'); end if;
  select req.* into r from public.rfq_requests req join public.rfq_factory_invitations inv on inv.rfq_id=req.id where inv.id=f.related_id and inv.external_form_id=f.id;
  if not found or r.status not in ('open','partially_responded') or not exists(select 1 from public.deals where id=r.deal_id and archived_at is null) then return jsonb_build_object('error','RFQは受付できません'); end if;
  if jsonb_typeof(f.context->'requested_lines') is distinct from 'array' or jsonb_array_length(f.context->'requested_lines')=0 then return jsonb_build_object('error','依頼当時の仕様・数量が不足しています。担当者へ新しいRFQを依頼してください'); end if;
  return jsonb_build_object('rfq',jsonb_build_object('id',r.id,'rfq_number',r.rfq_number,'request_message',r.request_message,'response_deadline',r.response_deadline),
    'products',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'description',coalesce((select line->>'product_description' from jsonb_array_elements(f.context->'requested_lines') line where line->>'product_id'=p.id::text limit 1),p.description),
      'variants',coalesce((select jsonb_agg(jsonb_build_object('id',line->>'variant_id','label',coalesce(line->>'variant_label',''),'width_mm',line->'width_mm','height_mm',line->'height_mm','depth_mm',line->'depth_mm','material',line->'material','print_color_count',line->'print_color_count','pcs_per_carton',line->'pcs_per_carton','requested_quantities',line->'quantities')) from jsonb_array_elements(f.context->'requested_lines') line where line->>'product_id'=p.id::text),'[]'::jsonb)))
      from public.deal_products p where p.id=any(r.product_ids) and p.deal_id=r.deal_id),'[]'::jsonb));
end $$;
revoke all on function public.ext_rfq_context(text) from public;
grant execute on function public.ext_rfq_context(text) to anon,authenticated;

create or replace function public.ext_submit_rfq(p_token text,p_payload jsonb,p_ip text default null,p_ua text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare f public.external_forms; inv record; r record; line jsonb; v_id uuid; p_id uuid; n numeric; key text;
  expected jsonb; snapshot_line jsonb; seen text[] := '{}'; q record; version_no integer; answered integer; total integer; line_key text;
begin
  select * into f from public.external_forms where token=p_token for update;
  if not found or f.form_type <> 'rfq_response' then raise exception 'フォームが見つかりません'; end if;
  if f.status='cancelled' or f.cancelled_at is not null or f.expires_at < now() then raise exception 'フォームは無効または期限切れです'; end if;
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
      for q in select distinct value::text::integer quantity from jsonb_array_elements(snapshot_line->'quantities') order by quantity loop
        if q.quantity < 1 then raise exception '依頼数量が不正です'; end if;
        version_no:=version_no+1;
        insert into public.deal_quotes(deal_id,variant_id,factory_id,quantity,moq,factory_unit_price_usd,status,source_type,version,factory_response)
        values(r.deal_id,v_id,inv.factory_id,q.quantity,(line->>'moq')::integer,(line->>'unit_price_usd')::numeric,'drafting','rfq_response',version_no,
          jsonb_build_object('line',line,'invitation_id',inv.id,'payment_terms',p_payload->'payment_terms','general_notes',p_payload->'general_notes'));
      end loop;
    end if;
  end loop;
  if cardinality(seen) <> jsonb_array_length(expected) then raise exception '依頼されたすべての仕様について回答してください'; end if;
  update public.rfq_factory_invitations set responded_at=now() where id=inv.id;
  select count(*) filter(where responded_at is not null),count(*) into answered,total from public.rfq_factory_invitations where rfq_id=r.id;
  update public.rfq_requests set status=case when answered>=total then 'fully_responded' else 'partially_responded' end where id=r.id;
  update public.external_forms set status='submitted',submitted_at=now(),submitted_by_email=nullif(trim(p_payload->>'factory_email'),''),submission_ip=p_ip,submission_user_agent=p_ua,submission_data=p_payload where id=f.id;
  return jsonb_build_object('success',true,'deal_id',r.deal_id);
end $$;
revoke all on function public.ext_submit_rfq(text,jsonb,text,text) from public;
grant execute on function public.ext_submit_rfq(text,jsonb,text,text) to anon,authenticated;
