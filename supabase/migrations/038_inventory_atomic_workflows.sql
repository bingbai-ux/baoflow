-- Prepared locally only. Apply after staging validation; never combine with old DB's 031.
-- All RPCs are SECURITY INVOKER: existing RLS remains in force.
-- Errors abort the entire RPC transaction, including inventory trigger writes.

create or replace function public.apply_inventory_delta()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  update public.inventory_items
    set quantity_on_hand = quantity_on_hand + NEW.quantity_delta, updated_at = now()
    where id = NEW.item_id and quantity_on_hand + NEW.quantity_delta >= 0;
  if not found then raise exception '在庫不足、または在庫を更新する権限がありません'; end if;
  return NEW;
end $$;

create or replace function public.ship_shipment_request_atomic(p_request_id uuid)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare r public.shipment_requests; s record; total bigint;
begin
  if auth.uid() is null or not (public.is_staff() or public.is_logistics()) then
    raise exception '出荷を処理する権限がありません';
  end if;
  select * into r from public.shipment_requests where id = p_request_id for update;
  if not found then raise exception '依頼が見つかりません'; end if;
  if r.status in ('shipped', 'delivered') then return jsonb_build_object('success',true); end if;
  if r.status <> 'confirmed' then raise exception '依頼を確認してから出荷してください'; end if;
  perform id from public.shipment_request_items where request_id=r.id order by id for update;
  if not exists (select 1 from public.shipment_request_items where request_id = r.id) then
    raise exception '出荷明細がありません';
  end if;
  -- Stable order avoids deadlocks between requests containing the same items.
  for s in select i.* from public.inventory_items i where i.id in
    (select item_id from public.shipment_request_items where request_id = r.id)
    order by i.id for update
  loop
    if s.client_id is distinct from r.client_id then raise exception '別クライアントの商品は出荷できません'; end if;
    select sum(quantity) into total from public.shipment_request_items where request_id = r.id and item_id = s.id;
    if total > s.quantity_on_hand then raise exception '在庫不足: % (現在 % / 依頼 %)',s.item_name,s.quantity_on_hand,total; end if;
  end loop;
  if (select count(distinct item_id) from public.shipment_request_items where request_id=r.id) <>
     (select count(*) from public.inventory_items where id in (select item_id from public.shipment_request_items where request_id=r.id)) then
    raise exception '在庫アイテムが見つかりません';
  end if;
  insert into public.inventory_transactions(item_id,tx_type,quantity_delta,occurred_on,destination,note,created_by)
    select item_id,'outbound',-sum(quantity)::integer,current_date,r.destination_name,'出荷依頼 '||r.request_no,auth.uid()
    from public.shipment_request_items where request_id=r.id group by item_id order by item_id;
  update public.shipment_requests set status='shipped',shipped_at=now(),shipped_by=auth.uid() where id=r.id;
  return jsonb_build_object('success',true);
end $$;

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

-- Parent and children are inserted in one transaction. Invalid lines never leave empty parents.
create or replace function public.create_shipment_request_atomic(p_input jsonb,p_request_no text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_client uuid; v_request uuid; l record; v_role text;
begin
  if auth.uid() is null then raise exception 'ログインしてください'; end if;
  v_role:=public.current_app_role();
  if v_role='client' then v_client:=public.my_client_id();
  elsif public.is_staff() then v_client:=nullif(p_input->>'client_id','')::uuid;
  else raise exception '出荷依頼を作成する権限がありません'; end if;
  if v_client is null then raise exception 'クライアントが特定できません'; end if;
  if nullif(trim(p_input->>'destination_name'),'') is null then raise exception 'お届け先を入力してください'; end if;
  if jsonb_typeof(p_input->'items') is distinct from 'array' or jsonb_array_length(p_input->'items')=0 then raise exception '商品を選択してください'; end if;
  for l in select * from jsonb_to_recordset(p_input->'items') as x(item_id uuid,quantity numeric,note text) loop
    if l.quantity is null or l.quantity<=0 or l.quantity<>trunc(l.quantity) or l.quantity>2147483647 then raise exception '数量は1以上の整数で入力してください'; end if;
    if not exists(select 1 from public.inventory_items where id=l.item_id and client_id=v_client) then raise exception 'このクライアントの商品を選択してください'; end if;
  end loop;
  insert into public.shipment_requests(request_no,client_id,status,destination_name,destination_address,desired_date,note,requested_by)
    values(p_request_no,v_client,'requested',trim(p_input->>'destination_name'),nullif(trim(p_input->>'destination_address'),''),nullif(p_input->>'desired_date','')::date,nullif(trim(p_input->>'note'),''),auth.uid()) returning id into v_request;
  insert into public.shipment_request_items(request_id,item_id,quantity,note)
    select v_request,item_id,quantity::integer,nullif(trim(note),'') from jsonb_to_recordset(p_input->'items') as x(item_id uuid,quantity numeric,note text);
  return jsonb_build_object('success',true,'requestNo',p_request_no);
end $$;

create or replace function public.create_inbound_shipment_atomic(p_input jsonb,p_shipment_no text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_shipment uuid; v_client uuid; l record;
begin
  if auth.uid() is null or not (public.is_staff() or public.is_logistics()) then raise exception '入庫予定を作成する権限がありません'; end if;
  v_client:=nullif(p_input->>'client_id','')::uuid;
  if jsonb_typeof(p_input->'lines') is distinct from 'array' or jsonb_array_length(p_input->'lines')=0 then raise exception '商品を入力してください'; end if;
  for l in select * from jsonb_to_recordset(p_input->'lines') as x(item_id uuid,item_name text,expected_quantity numeric,expected_cartons numeric) loop
    if nullif(trim(l.item_name),'') is null or l.expected_quantity is null or l.expected_quantity<=0 or l.expected_quantity<>trunc(l.expected_quantity) or l.expected_quantity>2147483647 then raise exception '商品名と1以上の整数数量を入力してください'; end if;
    if l.expected_cartons is not null and (l.expected_cartons<0 or l.expected_cartons<>trunc(l.expected_cartons) or l.expected_cartons>2147483647) then raise exception 'カートン数は0以上の整数で入力してください'; end if;
    if l.item_id is not null and not exists(select 1 from public.inventory_items where id=l.item_id and client_id is not distinct from v_client) then raise exception '入庫先の商品とクライアントが一致しません'; end if;
  end loop;
  insert into public.inbound_shipments(shipment_no,client_id,deal_id,carrier_name,tracking_number,eta_date,shipped_on,note,created_by)
    values(p_shipment_no,v_client,nullif(p_input->>'deal_id','')::uuid,nullif(trim(p_input->>'carrier_name'),''),nullif(trim(p_input->>'tracking_number'),''),nullif(p_input->>'eta_date','')::date,nullif(p_input->>'shipped_on','')::date,nullif(trim(p_input->>'note'),''),auth.uid()) returning id into v_shipment;
  insert into public.inbound_shipment_items(shipment_id,item_id,item_name,expected_quantity,expected_cartons)
    select v_shipment,item_id,trim(item_name),expected_quantity::integer,expected_cartons::integer from jsonb_to_recordset(p_input->'lines') as x(item_id uuid,item_name text,expected_quantity numeric,expected_cartons numeric);
  return jsonb_build_object('success',true);
end $$;

revoke all on function public.ship_shipment_request_atomic(uuid), public.receive_inbound_shipment_atomic(uuid,jsonb), public.create_shipment_request_atomic(jsonb,text), public.create_inbound_shipment_atomic(jsonb,text) from public;
grant execute on function public.ship_shipment_request_atomic(uuid), public.receive_inbound_shipment_atomic(uuid,jsonb), public.create_shipment_request_atomic(jsonb,text), public.create_inbound_shipment_atomic(jsonb,text) to authenticated;

create or replace function public.record_inventory_transaction_atomic(p_input jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare i public.inventory_items; q numeric; d integer; c numeric; kind text;
begin
  if auth.uid() is null or not (public.is_staff() or public.is_logistics()) then raise exception '在庫を変更する権限がありません'; end if;
  q:=(p_input->>'quantity')::numeric; kind:=p_input->>'tx_type'; c:=(p_input->>'cartons_delta')::numeric;
  if q is null or q=0 or q<>trunc(q) or abs(q)>2147483647 or kind is null or kind not in ('inbound','outbound','adjust') then raise exception '数量は0以外の整数で入力してください'; end if;
  if c is not null and (c<>trunc(c) or abs(c)>2147483647) then raise exception 'カートン数は整数で入力してください'; end if;
  select * into i from public.inventory_items where id=(p_input->>'item_id')::uuid for update;
  if not found then raise exception '在庫アイテムが見つかりません'; end if;
  d:=case kind when 'inbound' then abs(q)::integer when 'outbound' then -abs(q)::integer else q::integer end;
  if i.quantity_on_hand::bigint+d<0 then raise exception '在庫が足りません（現在 %）',i.quantity_on_hand; end if;
  if c is not null and coalesce(i.cartons_on_hand,0)::bigint+c<0 then raise exception 'カートン数が足りません'; end if;
  insert into public.inventory_transactions(item_id,tx_type,quantity_delta,occurred_on,destination,note,created_by)
    values(i.id,kind,d,coalesce(nullif(p_input->>'occurred_on','')::date,current_date),nullif(trim(p_input->>'destination'),''),nullif(trim(p_input->>'note'),''),auth.uid());
  if c is not null then update public.inventory_items set cartons_on_hand=coalesce(cartons_on_hand,0)+c::integer where id=i.id; end if;
  return jsonb_build_object('success',true);
end $$;

create or replace function public.create_inventory_item_atomic(p_input jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_item uuid; q numeric; c numeric;
begin
  if auth.uid() is null or not (public.is_staff() or public.is_logistics()) then raise exception '在庫を登録する権限がありません'; end if;
  q:=(p_input->>'first_quantity')::numeric; c:=(p_input->>'first_cartons')::numeric;
  if nullif(trim(p_input->>'item_name'),'') is null or q is null or q<=0 or q<>trunc(q) or q>2147483647 then raise exception '商品名と1以上の整数数量を入力してください'; end if;
  if c is not null and (c<0 or c<>trunc(c) or c>2147483647) then raise exception 'カートン数は0以上の整数で入力してください'; end if;
  insert into public.inventory_items(client_id,deal_id,item_name,item_code,spec_note,unit,cartons_on_hand,warehouse_name,location_note,first_arrived_at,note,created_by)
    values(nullif(p_input->>'client_id','')::uuid,nullif(p_input->>'deal_id','')::uuid,trim(p_input->>'item_name'),nullif(trim(p_input->>'item_code'),''),nullif(trim(p_input->>'spec_note'),''),coalesce(nullif(trim(p_input->>'unit'),''),'個'),c::integer,nullif(trim(p_input->>'warehouse_name'),''),nullif(trim(p_input->>'location_note'),''),nullif(p_input->>'first_arrived_at','')::date,nullif(trim(p_input->>'note'),''),auth.uid()) returning id into v_item;
  insert into public.inventory_transactions(item_id,tx_type,quantity_delta,occurred_on,note,created_by)
    values(v_item,'inbound',q::integer,coalesce(nullif(p_input->>'first_arrived_at','')::date,current_date),'初回入庫',auth.uid());
  return jsonb_build_object('success',true,'itemId',v_item);
end $$;
revoke all on function public.record_inventory_transaction_atomic(jsonb),public.create_inventory_item_atomic(jsonb) from public;
grant execute on function public.record_inventory_transaction_atomic(jsonb),public.create_inventory_item_atomic(jsonb) to authenticated;

-- Protect the direct REST insert route too; an own request cannot name another client's item.
drop policy if exists "client_insert_own" on public.shipment_request_items;
create policy "client_insert_own" on public.shipment_request_items
  for insert to authenticated with check (
    exists (select 1 from public.shipment_requests r
      join public.inventory_items i on i.id=shipment_request_items.item_id
      where r.id=shipment_request_items.request_id and r.client_id=public.my_client_id()
        and i.client_id=r.client_id and r.status='requested')
  );

-- Ledger edits/deletes do not reverse apply_inventory_delta. Use compensating adjustment rows.
revoke update, delete on public.inventory_transactions from authenticated;
