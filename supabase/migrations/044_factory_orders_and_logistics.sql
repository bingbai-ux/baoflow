-- Local release candidate. Apply only to new DB after review/staging.
-- Existing rows are retained. No invitations, emails or deployment are performed.
create table public.factory_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  source_quote_id uuid unique references public.deal_quotes(id) on delete set null,
  deal_id uuid not null references public.deals(id),
  factory_id uuid not null references public.factories(id),
  quantity integer not null check(quantity>0),
  unit_price_usd numeric not null check(unit_price_usd>0),
  expected_delivery_date date,
  status text not null default 'ordered' check(status in ('ordered','cancelled')),
  snapshot jsonb not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.factory_purchase_orders enable row level security;
create policy staff_access on public.factory_purchase_orders for all to authenticated using(public.is_staff()) with check(public.is_staff());
create policy factory_read_own on public.factory_purchase_orders for select to authenticated using(public.current_app_role()='factory' and factory_id=public.my_factory_id());
grant select,insert on public.factory_purchase_orders to authenticated;
-- Supabase default privileges may already grant ALL: explicitly remove mutation grants.
revoke update,delete on public.factory_purchase_orders from authenticated,anon;

create or replace function public.create_factory_order_atomic(p_quote_id uuid,p_factory_id uuid,p_order_no text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare q public.deal_quotes; d public.deals; v public.deal_product_variants; existing public.factory_purchase_orders; order_id uuid;
begin
  if auth.uid() is null or not coalesce(public.is_staff(),false) then raise exception '工場発注は営業・管理者のみ利用できます'; end if;
  select * into q from public.deal_quotes where id=p_quote_id;
  if not found then raise exception '採用見積が見つかりません'; end if;
  select * into d from public.deals where id=q.deal_id for update;
  if not found or d.archived_at is not null then raise exception '案件が見つからないかクローズ済みです'; end if;
  if d.simple_status='quoting' then raise exception 'クライアントの見積承認を確認してから工場発注してください'; end if;
  select * into q from public.deal_quotes where id=p_quote_id for update;
  if q.status is distinct from 'approved' or q.quantity is null or q.quantity<=0 or q.factory_unit_price_usd is null or q.factory_unit_price_usd<=0 or q.factory_unit_price_usd::text in ('NaN','Infinity','-Infinity') then raise exception '有効な採用見積が必要です'; end if;
  if q.moq is not null and q.quantity<q.moq then raise exception '最低発注数量を下回っています'; end if;
  if p_factory_id is null or not exists(select 1 from public.factories where id=p_factory_id) then raise exception '発注する工場を選択してください'; end if;
  if q.factory_id is not null and q.factory_id<>p_factory_id then raise exception '工場回答の工場と発注先が一致しません'; end if;
  select * into existing from public.factory_purchase_orders where source_quote_id=q.id;
  if found then
    if existing.factory_id=p_factory_id and existing.status='ordered' then return jsonb_build_object('success',true,'orderId',existing.id,'dealId',d.id); end if;
    raise exception 'この見積は発注済みです。変更には新しい見積を作成してください';
  end if;
  select * into v from public.deal_product_variants where id=q.variant_id;
  if not found or not exists(select 1 from public.deal_products where id=v.product_id and deal_id=d.id) then raise exception 'この案件の商品仕様が必要です'; end if;
  insert into public.factory_purchase_orders(order_no,source_quote_id,deal_id,factory_id,quantity,unit_price_usd,expected_delivery_date,snapshot,created_by)
    values(p_order_no,q.id,d.id,p_factory_id,q.quantity,q.factory_unit_price_usd,d.desired_delivery_date,
      jsonb_build_object('variant_id',v.id,'item_name',coalesce((select nullif(description,'') from public.deal_products where id=v.product_id),'商品')||' ('||coalesce(v.variant_label,'仕様')||')','material',v.material,'width_mm',v.width_mm,'height_mm',v.height_mm,'depth_mm',v.depth_mm,'print_color_count',v.print_color_count,'pcs_per_carton',coalesce(to_jsonb(q)->'factory_response'->'line'->'pcs_per_carton',to_jsonb(v.pcs_per_carton)),'carton_width_cm',to_jsonb(q)->'factory_response'->'line'->'carton_w_cm','carton_height_cm',to_jsonb(q)->'factory_response'->'line'->'carton_h_cm','carton_depth_cm',to_jsonb(q)->'factory_response'->'line'->'carton_d_cm','gross_weight_kg',to_jsonb(q)->'factory_response'->'line'->'gross_weight_kg','production_lead_days',to_jsonb(q)->'factory_response'->'line'->'production_lead_days','quantity',q.quantity,'unit_price_usd',q.factory_unit_price_usd),auth.uid()) returning id into order_id;
  update public.deal_quotes set factory_id=p_factory_id where id=q.id;
  return jsonb_build_object('success',true,'orderId',order_id,'dealId',d.id);
end $$;
revoke all on function public.create_factory_order_atomic(uuid,uuid,text) from public,anon;
grant execute on function public.create_factory_order_atomic(uuid,uuid,text) to authenticated;

alter table public.inbound_shipments add column purchase_order_id uuid references public.factory_purchase_orders(id);
alter table public.inbound_shipments add column source_request_key text unique;
create index inbound_purchase_order_idx on public.inbound_shipments(purchase_order_id);

-- On creation/reassignment only: logistics receipt updates do not need access to internal deals.
create or replace function public.validate_inbound_source()
returns trigger language plpgsql security invoker set search_path=public as $$
declare d public.deals; o public.factory_purchase_orders;
begin
  if NEW.purchase_order_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('factory_inbound:'||NEW.purchase_order_id::text,0));
    select * into o from public.factory_purchase_orders where id=NEW.purchase_order_id;
    if not found or o.status<>'ordered' then raise exception '有効な工場発注が見つかりません'; end if;
    if NEW.deal_id is not null and NEW.deal_id<>o.deal_id then raise exception '工場発注と案件が一致しません'; end if;
    NEW.deal_id:=o.deal_id;
  end if;
  if NEW.deal_id is not null then
    select * into d from public.deals where id=NEW.deal_id;
    if not found then raise exception '入庫元の案件が見つかりません'; end if;
    if NEW.client_id is not null and NEW.client_id is distinct from d.client_id then raise exception '案件と入庫のクライアントが一致しません'; end if;
    NEW.client_id:=d.client_id;
  end if;
  return NEW;
end $$;
create trigger validate_inbound_source before insert or update of client_id,deal_id,purchase_order_id on public.inbound_shipments for each row execute function public.validate_inbound_source();

-- Approval is a staff task. Warehouses can ship confirmed requests and mark delivery.
create or replace function public.validate_shipment_request_transition()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if NEW.status=OLD.status then return NEW; end if;
  if not coalesce(public.is_staff(),false) and not coalesce(public.is_logistics(),false) then raise exception '出荷状態を変更する権限がありません'; end if;
  if (NEW.status in ('confirmed','cancelled')) and not coalesce(public.is_staff(),false) then raise exception '確認・取消は営業・管理者のみ利用できます'; end if;
  if not ((OLD.status='requested' and NEW.status in ('confirmed','cancelled')) or (OLD.status='confirmed' and NEW.status in ('shipped','cancelled')) or (OLD.status='shipped' and NEW.status='delivered')) then raise exception 'この状態からは変更できません'; end if;
  return NEW;
end $$;
create trigger validate_shipment_request_transition before update of status on public.shipment_requests for each row execute function public.validate_shipment_request_transition();

create or replace function public.create_inbound_shipment_atomic(p_input jsonb,p_shipment_no text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_shipment uuid; v_client uuid; l record; o public.factory_purchase_orders; v_deal uuid; scheduled bigint; existing_plan public.inbound_shipments; existing_quantity bigint;
begin
  if auth.uid() is null or not (public.is_staff() or public.is_logistics()) then raise exception '入庫予定を作成する権限がありません'; end if;
  v_client:=nullif(p_input->>'client_id','')::uuid;
  v_deal:=nullif(p_input->>'deal_id','')::uuid;
  if nullif(p_input->>'purchase_order_id','') is not null then
    -- Immutable orders intentionally have no UPDATE grant; FOR UPDATE would require it.
    perform pg_advisory_xact_lock(hashtextextended('factory_inbound:'||((p_input->>'purchase_order_id')::uuid)::text,0));
    select * into o from public.factory_purchase_orders where id=(p_input->>'purchase_order_id')::uuid;
    if not found or o.status<>'ordered' then raise exception '有効な工場発注が見つかりません'; end if;
    if v_deal is not null and v_deal<>o.deal_id then raise exception '工場発注と案件が一致しません'; end if;
    v_deal:=o.deal_id;
    if jsonb_typeof(p_input->'lines') is distinct from 'array' or jsonb_array_length(p_input->'lines')<>1 then raise exception '工場発注は1明細ずつ入庫予定を作成してください'; end if;
    if nullif(p_input->>'request_key','') is not null then
      select * into existing_plan from public.inbound_shipments where source_request_key=p_input->>'request_key';
      if found then
        select sum(expected_quantity) into existing_quantity from public.inbound_shipment_items where shipment_id=existing_plan.id;
        if existing_plan.purchase_order_id=o.id and existing_plan.status<>'cancelled' and existing_quantity=(p_input->'lines'->0->>'expected_quantity')::numeric then
          return jsonb_build_object('success',true,'shipmentId',existing_plan.id);
        end if;
        raise exception '再試行キーの内容が変わっています。新しい操作として作成してください';
      end if;
    end if;
    select coalesce(sum(i.expected_quantity),0) into scheduled from public.inbound_shipment_items i join public.inbound_shipments s on s.id=i.shipment_id where s.purchase_order_id=o.id and s.status<>'cancelled';
    if jsonb_array_length(p_input->'lines')<>1 or scheduled+(p_input->'lines'->0->>'expected_quantity')::numeric>o.quantity then raise exception '工場発注の未入庫予定数量を超えています'; end if;
  end if;
  if v_deal is not null then
    if v_client is not null and not exists(select 1 from public.deals where id=v_deal and client_id=v_client) then raise exception '案件と入庫のクライアントが一致しません'; end if;
    select client_id into v_client from public.deals where id=v_deal;
    if not found then raise exception '入庫元の案件が見つかりません'; end if;
  end if;
  if jsonb_typeof(p_input->'lines') is distinct from 'array' or jsonb_array_length(p_input->'lines')=0 then raise exception '商品を入力してください'; end if;
  for l in select * from jsonb_to_recordset(p_input->'lines') as x(item_id uuid,item_name text,expected_quantity numeric,expected_cartons numeric) loop
    if nullif(trim(l.item_name),'') is null or l.expected_quantity is null or l.expected_quantity<=0 or l.expected_quantity<>trunc(l.expected_quantity) or l.expected_quantity>2147483647 then raise exception '商品名と1以上の整数数量を入力してください'; end if;
    if l.expected_cartons is not null and (l.expected_cartons<0 or l.expected_cartons<>trunc(l.expected_cartons) or l.expected_cartons>2147483647) then raise exception 'カートン数は0以上の整数で入力してください'; end if;
    if l.item_id is not null and not exists(select 1 from public.inventory_items where id=l.item_id and client_id is not distinct from v_client) then raise exception '入庫先の商品とクライアントが一致しません'; end if;
  end loop;
  insert into public.inbound_shipments(source_request_key,purchase_order_id,shipment_no,client_id,deal_id,carrier_name,tracking_number,eta_date,shipped_on,note,created_by)
    values(nullif(p_input->>'request_key',''),nullif(p_input->>'purchase_order_id','')::uuid,p_shipment_no,v_client,v_deal,nullif(trim(p_input->>'carrier_name'),''),nullif(trim(p_input->>'tracking_number'),''),nullif(p_input->>'eta_date','')::date,nullif(p_input->>'shipped_on','')::date,nullif(trim(p_input->>'note'),''),auth.uid()) returning id into v_shipment;
  insert into public.inbound_shipment_items(shipment_id,item_id,item_name,expected_quantity,expected_cartons)
    select v_shipment,item_id,trim(item_name),expected_quantity::integer,expected_cartons::integer from jsonb_to_recordset(p_input->'lines') as x(item_id uuid,item_name text,expected_quantity numeric,expected_cartons numeric);
  return jsonb_build_object('success',true,'shipmentId',v_shipment);
end $$;


-- Only new transitions into production are checked. Existing production records are untouched.
create or replace function public.require_factory_orders_before_production()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if NEW.simple_status='in_production' and OLD.simple_status is distinct from NEW.simple_status then
    if not exists(select 1 from public.deal_quotes where deal_id=NEW.id and status='approved') or exists(
      select 1 from public.deal_quotes q where q.deal_id=NEW.id and q.status='approved' and not exists(
        select 1 from public.factory_purchase_orders o where o.source_quote_id=q.id and o.status='ordered'
          and o.quantity=q.quantity and o.unit_price_usd=q.factory_unit_price_usd and o.factory_id=q.factory_id)
    ) then raise exception '採用見積の工場発注を登録してから製作を開始してください'; end if;
  end if;
  return NEW;
end $$;
create trigger require_factory_orders_before_production before update of simple_status on public.deals for each row execute function public.require_factory_orders_before_production();

create or replace function public.receive_inbound_shipment_atomic(p_shipment_id uuid,p_received jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare s public.inbound_shipments; l public.inbound_shipment_items; v_item uuid; q integer;
begin
  if auth.uid() is null or not (public.is_staff() or public.is_logistics()) then raise exception '検収する権限がありません'; end if;
  select * into s from public.inbound_shipments where id=p_shipment_id for update;
  if not found then raise exception '入庫予定が見つかりません'; end if;
  if s.status='received' then return jsonb_build_object('success',true); end if;
  if s.status<>'in_transit' then raise exception 'この入庫予定は処理できません'; end if;
  perform id from public.inbound_shipment_items where shipment_id=s.id order by id for update;
  if jsonb_typeof(p_received) is distinct from 'array' or jsonb_array_length(p_received)=0 then raise exception 'すべての明細の受入数を入力してください'; end if;
  if exists(select 1 from jsonb_array_elements(p_received) x where (x->>'received_quantity' ~ '^(0|[1-9][0-9]*)$') is distinct from true) then raise exception '受入数は0以上の整数で入力してください'; end if;
  if (select count(*) from jsonb_array_elements(p_received)) <> (select count(distinct x->>'line_id') from jsonb_array_elements(p_received) x) then raise exception '検収明細が重複しています'; end if;
  if (select count(*) from public.inbound_shipment_items where shipment_id=s.id) <> jsonb_array_length(p_received) or
    exists(select 1 from jsonb_array_elements(p_received) x where not exists(select 1 from public.inbound_shipment_items where shipment_id=s.id and id=(x->>'line_id')::uuid)) then
    raise exception 'すべての明細を一度ずつ検収してください';
  end if;
  perform id from public.inventory_items where id in (select item_id from public.inbound_shipment_items where shipment_id=s.id) order by id for update;
  for l in select * from public.inbound_shipment_items where shipment_id=s.id order by id for update loop
    select (x->>'received_quantity')::integer into q from jsonb_array_elements(p_received) x where (x->>'line_id')::uuid=l.id;
    if s.purchase_order_id is not null and q>l.expected_quantity then raise exception '受入数が工場発注の入庫予定数量を超えています。発注内容を確認してください'; end if;
    v_item:=l.item_id;
    if v_item is not null and not exists(select 1 from public.inventory_items where id=v_item and client_id is not distinct from s.client_id) then raise exception '入庫先の商品とクライアントが一致しません'; end if;
    if q>0 then
      if v_item is null then
        insert into public.inventory_items(client_id,deal_id,item_name,cartons_on_hand,first_arrived_at,created_by)
          values(s.client_id,s.deal_id,l.item_name,l.expected_cartons,current_date,auth.uid()) returning id into v_item;
      end if;
      insert into public.inventory_transactions(item_id,tx_type,quantity_delta,occurred_on,deal_id,note,created_by)
        values(v_item,'inbound',q,current_date,s.deal_id,'入庫予定 '||s.shipment_no||' 検収',auth.uid());
    end if;
    update public.inbound_shipment_items set received_quantity=q,item_id=v_item where id=l.id;
  end loop;
  update public.inbound_shipments set status='received',received_at=now(),received_by=auth.uid() where id=s.id;
  return jsonb_build_object('success',true);
end $$;

