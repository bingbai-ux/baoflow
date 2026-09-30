-- Local release preparation only. No production application authorized.
-- Rollback: deploy prior actions, drop wizard_atomic(uuid,text,jsonb); retain request ledger.
create table if not exists public.wizard_requests (
  request_id uuid primary key, user_id uuid not null references public.profiles(id),
  operation text not null, payload jsonb not null, result jsonb,
  created_at timestamptz not null default now()
);
alter table public.wizard_requests enable row level security;
create policy wizard_request_owner on public.wizard_requests for all to authenticated
  using (user_id=auth.uid() and public.is_staff())
  with check (user_id=auth.uid() and public.is_staff());
grant select,insert,update on public.wizard_requests to authenticated;

create or replace function public.wizard_atomic(p_request_id uuid,p_operation text,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare r public.wizard_requests; d public.deals; v_deal uuid; v_product uuid; v_variant uuid;
  v_code text; v_prefix text; v_next integer; v_order integer; v_name text; v_result jsonb;
  x jsonb; n integer; i integer:=0; size_value numeric;
begin
  if auth.uid() is null or not coalesce(public.is_staff(),false) then raise exception 'この操作は営業・管理者のみ利用できます'; end if;
  if p_request_id is null or p_operation is null or p_operation not in ('deal','spec','quantity') or jsonb_typeof(p_payload) is distinct from 'object' then raise exception '保存要求が不正です'; end if;
  insert into public.wizard_requests(request_id,user_id,operation,payload)
    values(p_request_id,auth.uid(),p_operation,p_payload) on conflict(request_id) do nothing;
  select * into r from public.wizard_requests where request_id=p_request_id for update;
  if not found or r.user_id is distinct from auth.uid() then raise exception '保存要求の所有者が異なります'; end if;
  if r.operation is distinct from p_operation or r.payload is distinct from p_payload then raise exception '同じ保存要求で内容が変わっています。新しい要求で保存してください'; end if;
  if r.result is not null then return r.result; end if;
  if p_operation='deal' then
    v_name:=btrim(p_payload->>'client_name_text');
    if coalesce(v_name,'')='' then raise exception 'クライアントを選んでください'; end if;
    if jsonb_typeof(p_payload->'items') is distinct from 'array' or jsonb_array_length(p_payload->'items')=0 then raise exception '作るものを選んでください'; end if;
    if exists(select 1 from jsonb_array_elements(p_payload->'items') t where jsonb_typeof(t)<>'string' or btrim(t#>>'{}')='') then raise exception '商品名を入力してください'; end if;
    if nullif(p_payload->>'sales_user_id','') is not null and not exists(select 1 from public.profiles where id=(p_payload->>'sales_user_id')::uuid and role::text in ('admin','sales')) then raise exception '担当者を確認してください'; end if;
    -- Monthly sequence must serialize even when no deal exists yet.
    v_prefix:='PF-'||to_char(current_date,'YYYYMM')||'-';
    perform pg_advisory_xact_lock(hashtext(v_prefix));
    select coalesce(max(substring(deal_code from '[0-9]+$')::integer),0)+1 into v_next from public.deals where deal_code like v_prefix||'%';
    v_code:=v_prefix||lpad(v_next::text,greatest(3,length(v_next::text)), '0');
    insert into public.deals(deal_code,deal_name,client_id,client_name_text,brand_text,desired_delivery_date,sales_user_id,simple_status,visibility,waiting_on)
      values(v_code,v_name||' '||(select string_agg(value,'・') from jsonb_array_elements_text(p_payload->'items'))||' '||to_char(current_date,'FMMM/FMDD'),
      nullif(p_payload->>'client_id','')::uuid,v_name,nullif(btrim(p_payload->>'brand_text'),''),nullif(p_payload->>'desired_delivery_date','')::date,
      coalesce(nullif(p_payload->>'sales_user_id','')::uuid,auth.uid()),'quoting','internal','us') returning id into v_deal;
    for x in select value from jsonb_array_elements(p_payload->'items') loop
      i:=i+1;
      insert into public.deal_products(deal_id,product_no,description,category_l1,is_selected) values(v_deal,i,btrim(x#>>'{}'),btrim(x#>>'{}'),false);
    end loop;
    insert into public.deal_status_history(deal_id,to_status,to_simple_status,changed_by,kind,note)
      values(v_deal,'M01','quoting',auth.uid(),'status','案件作成');
    v_result:=jsonb_build_object('success',true,'dealId',v_deal,'dealCode',v_code);
  else
    v_deal:=(p_payload->>'deal_id')::uuid;
    select * into d from public.deals where id=v_deal for update;
    if not found then raise exception '案件が見つかりません'; end if;
    if d.archived_at is not null then raise exception 'アーカイブ済み案件は変更できません'; end if;
    if p_operation='spec' then
      if coalesce(btrim(p_payload->>'category_l1'),'')='' then raise exception '分類を選んでください'; end if;
      if jsonb_typeof(p_payload->'quantities') is distinct from 'array' or jsonb_array_length(p_payload->'quantities')=0 then raise exception '数量を入力してください'; end if;
      if exists(select 1 from jsonb_array_elements(p_payload->'quantities') q where jsonb_typeof(q)<>'number' or (q#>>'{}')!~'^[1-9][0-9]*$' or (q#>>'{}')::numeric>2147483647) then raise exception '数量は1以上の整数で入力してください'; end if;
      if (select count(*)<>count(distinct value) from jsonb_array_elements(p_payload->'quantities')) then raise exception '数量が重複しています'; end if;
      foreach v_name in array array['width_mm','height_mm','depth_mm'] loop
        if p_payload->>v_name is not null then
          size_value:=(p_payload->>v_name)::numeric;
          if size_value<=0 or size_value::text in ('NaN','Infinity','-Infinity') then raise exception 'サイズは0より大きい値で入力してください'; end if;
        end if;
      end loop;
      v_product:=nullif(p_payload->>'product_id','')::uuid;
      if v_product is not null then
        perform id from public.deal_products where id=v_product and deal_id=v_deal for update;
        if not found then raise exception '商品がこの案件に属していません'; end if;
      else
        select coalesce(max(product_no),0)+1 into v_next from public.deal_products where deal_id=v_deal;
        insert into public.deal_products(deal_id,product_no,description,is_selected) values(v_deal,v_next,btrim(p_payload->>'category_l1'),false) returning id into v_product;
      end if;
      update public.deal_products set description=concat_ws(' / ',nullif(btrim(p_payload->>'category_l1'),''),nullif(btrim(p_payload->>'category_l2'),''),nullif(btrim(p_payload->>'category_l3'),'')),
        category_l1=p_payload->>'category_l1',category_l2=nullif(p_payload->>'category_l2',''),category_l3=nullif(p_payload->>'category_l3','') where id=v_product;
      select coalesce(max(variant_order)+1,0) into v_order from public.deal_product_variants where product_id=v_product;
      insert into public.deal_product_variants(product_id,variant_label,variant_order,width_mm,height_mm,depth_mm,material,print_color_count,print_method,processing,color_description,other_notes,is_selected)
        values(v_product,case when v_order<26 then chr(65+v_order) else '仕様 '||(v_order+1)::text end,v_order,(p_payload->>'width_mm')::numeric,(p_payload->>'height_mm')::numeric,(p_payload->>'depth_mm')::numeric,
        nullif(btrim(p_payload->>'material'),''),nullif(btrim(p_payload->>'print_color_count'),''),nullif(btrim(p_payload->>'print_method'),''),nullif(btrim(p_payload->>'processing'),''),nullif(btrim(p_payload->>'color_description'),''),nullif(btrim(p_payload->>'other_notes'),''),false) returning id into v_variant;
      for x in select value from jsonb_array_elements(p_payload->'quantities') loop
        i:=i+1; insert into public.deal_quotes(deal_id,variant_id,quantity,version,status) values(v_deal,v_variant,(x#>>'{}')::integer,i,'drafting');
      end loop;
      v_result:=jsonb_build_object('success',true,'productId',v_product,'variantId',v_variant);
    else
      if coalesce(p_payload->>'quantity','')!~'^[1-9][0-9]*$' or (p_payload->>'quantity')::numeric>2147483647 then raise exception '数量は1以上の整数で入力してください'; end if;
      n:=(p_payload->>'quantity')::integer; v_variant:=(p_payload->>'variant_id')::uuid;
      if not exists(select 1 from public.deal_product_variants v join public.deal_products p on p.id=v.product_id where v.id=v_variant and p.deal_id=v_deal) then raise exception '仕様がこの案件に属していません'; end if;
      if exists(select 1 from public.deal_quotes where variant_id=v_variant and quantity=n) then raise exception 'この数量の見積はすでにあります'; end if;
      select coalesce(max(version),0)+1 into v_next from public.deal_quotes where variant_id=v_variant;
      insert into public.deal_quotes(deal_id,variant_id,quantity,version,status) values(v_deal,v_variant,n,v_next,'drafting');
      v_result:=jsonb_build_object('success',true);
    end if;
    update public.deals set last_activity_at=now() where id=v_deal;
    insert into public.deal_status_history(deal_id,to_status,changed_by,kind,note) values(v_deal,d.master_status,auth.uid(),'variant',case when p_operation='spec' then '商品仕様と数量を追加' else '見積数量を追加' end);
  end if;
  update public.wizard_requests set result=v_result where request_id=p_request_id;
  return v_result;
end $$;
revoke all on function public.wizard_atomic(uuid,text,jsonb) from public;
grant execute on function public.wizard_atomic(uuid,text,jsonb) to authenticated;
