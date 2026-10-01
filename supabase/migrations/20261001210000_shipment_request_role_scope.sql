-- CLI-generated, ordered after Stage12; local candidate only. No new table.
-- A request creator does not retain staff payload access after role/org changes.
create function public.shipment_request_visible(p_order uuid,p_operation text,p_payload jsonb) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select auth.uid() is not null and (is_staff() or exists(select 1 from profiles u where u.id=auth.uid() and (
 (u.role::text='factory' and p_operation='milestone' and p_payload->>'kind'='factory_dispatched' and exists(select 1 from factory_purchase_orders o where o.id=p_order and o.factory_id=u.factory_id)) or
 (u.role::text='logistics' and p_operation='milestone' and p_payload->>'kind'<>'factory_dispatched' and exists(select 1 from shipment_plans p where p.order_id=p_order and p.id::text=p_payload->>'plan_id' and p.logistics_actor_id=u.id)) or
 (u.role::text='client' and p_operation='receive' and exists(select 1 from shipment_plans p where p.order_id=p_order and p.id::text=p_payload->>'plan_id' and p.client_id=u.client_id)))))
$$;
revoke all on function public.shipment_request_visible(uuid,text,jsonb) from public,anon;
grant execute on function public.shipment_request_visible(uuid,text,jsonb) to authenticated;
drop policy actor_request_read on public.shipment_workflow_requests;
create policy actor_request_read on public.shipment_workflow_requests for select to authenticated using(created_by=auth.uid() and shipment_request_visible(order_id,operation,payload));
