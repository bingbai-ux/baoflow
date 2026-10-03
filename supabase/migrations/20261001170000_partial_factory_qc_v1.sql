alter table public.factory_qc_reviews add column rejection_scope text not null default 'all' check(rejection_scope in('all','new_quantity'));
-- Local candidate: cumulative partial completion. No new tables or media access.
create function public.factory_qc_approved_quantity(p_order_id uuid) returns integer
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(max(s.quantity),0) from factory_qc_submissions s join factory_qc_reviews r on r.submission_id=s.id and r.decision='approved' where s.order_id=p_order_id and not exists(select 1 from factory_qc_submissions bad join factory_qc_reviews b on b.submission_id=bad.id and b.decision='rejected' and b.rejection_scope='all' where bad.order_id=s.order_id and bad.version>s.version)
$$;
create function public.factory_qc_reserved_quantity(p_order_id uuid,p_exclude_item uuid default null) returns bigint
language sql volatile security definer set search_path=public,pg_temp as $$
 select (select coalesce(sum(quantity),0) from shipment_plans where order_id=p_order_id)+
 (select coalesce(sum(i.expected_quantity),0)::bigint from inbound_shipment_items i join inbound_shipments s on s.id=i.shipment_id where s.purchase_order_id=p_order_id and s.status<>'cancelled' and (p_exclude_item is null or i.id<>p_exclude_item))
$$;
revoke all on function public.factory_qc_approved_quantity(uuid),public.factory_qc_reserved_quantity(uuid,uuid) from public,anon,authenticated;

create or replace function public.factory_qc_command(p_request_id uuid,p_order_id uuid,p_operation text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare workflow jsonb;o factory_purchase_orders;prior factory_qc_requests;latest factory_qc_submissions;asset storage.objects;ids uuid[];rid uuid;result jsonb;factory boolean;
begin
 if auth.uid() is null or p_request_id is null or jsonb_typeof(p_input) is distinct from 'object' or length(p_input::text)>100000 then raise exception 'Authenticated bounded request required';end if;
 workflow=factory_order_context(p_order_id);factory=workflow->>'actor_role'='factory';select * into o from factory_purchase_orders where id=p_order_id;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));select * into prior from factory_qc_requests where id=p_request_id;
 if found then if prior.created_by<>auth.uid() or prior.order_id<>p_order_id or prior.operation<>p_operation or prior.payload<>p_input then raise exception 'Request has different input';end if;return prior.result;end if;
 perform 1 from deals where id=o.deal_id and archived_at is null for update;if not found or o.status<>'ordered' or workflow->'production'='null'::jsonb then raise exception 'Active factory production required';end if;
 perform pg_advisory_xact_lock(hashtextextended('factory_workflow:'||o.id::text,0));
 select * into latest from factory_qc_submissions where order_id=o.id order by version desc limit 1;
 if p_operation='register_asset' then
 if not factory then raise exception 'Own factory evidence required';end if;
 if p_input->>'kind' not in('overall_photo','packing_photo','video') or coalesce(p_input->>'sha256','')!~'^[0-9a-f]{64}$' then raise exception 'Evidence kind and SHA256 required';end if;
 select * into asset from storage.objects where bucket_id='factory-qc' and name=p_input->>'object_path' and owner_id=auth.uid()::text;
 if not found or split_part(asset.name,'/',1)<>o.id::text or not factory_qc_storage_scope(asset.name,true) or asset.user_metadata->>'sha256' is distinct from p_input->>'sha256' or coalesce(asset.metadata->>'size','')!~'^[1-9][0-9]*$' then raise exception 'Own stored evidence required';end if;
 if (p_input->>'kind'='video' and asset.metadata->>'mimetype'<>'video/mp4') or (p_input->>'kind'<>'video' and asset.metadata->>'mimetype' not in('image/png','image/jpeg')) then raise exception 'Evidence media type mismatch';end if;
 insert into factory_qc_assets(id,order_id,kind,object_path,mime,byte_size,sha256,created_by) values(p_request_id,o.id,p_input->>'kind',asset.name,asset.metadata->>'mimetype',(asset.metadata->>'size')::bigint,p_input->>'sha256',auth.uid());result=jsonb_build_object('asset_id',p_request_id);
 elsif p_operation='submit_qc' then
 if not factory then raise exception 'Own factory completion required';end if;
 if exists(select 1 from deals where id=o.deal_id and simple_status::text in('shipped','delivered')) then raise exception 'Shipment already recorded; explicit correction required';end if;
 if latest.id is not null and (not exists(select 1 from factory_qc_reviews where submission_id=latest.id) or factory_qc_approved_quantity(o.id)>=o.quantity) then raise exception 'Latest submission pending or full approved quantity';end if;
 if jsonb_typeof(p_input->'asset_ids') is distinct from 'array' then raise exception 'Three evidence kinds required';end if;
 select array_agg(value::uuid order by value) into ids from jsonb_array_elements_text(p_input->'asset_ids');
 if coalesce(array_length(ids,1),0)<3 or array_length(ids,1)<>(select count(distinct x) from unnest(ids) x) or (select count(*) from factory_qc_assets where id=any(ids) and order_id=o.id)<>array_length(ids,1) or (select count(distinct kind) from factory_qc_assets where id=any(ids) and order_id=o.id)<>3 then raise exception 'Own overall/packing photos and video required';end if;
 if latest.id is not null and not exists(select 1 from factory_qc_assets n where n.id=any(ids) and not exists(select 1 from factory_qc_assets oldasset where oldasset.id=any(latest.asset_ids) and oldasset.sha256=n.sha256)) then raise exception 'Rework needs revised evidence';end if;
 if coalesce(p_input->>'completion_confirmed','false')<>'true' or coalesce(p_input->>'quantity','')!~'^[1-9][0-9]*$' or ((p_input->>'quantity')::numeric>o.quantity or (p_input->>'quantity')::numeric<=factory_qc_approved_quantity(o.id) or (p_input->>'quantity')::numeric<(select coalesce(max(quantity),0) from factory_qc_submissions x join factory_qc_reviews r on r.submission_id=x.id and r.decision='approved' where x.order_id=o.id)) or coalesce(p_input->>'completed_on','')!~'^\d{4}-\d{2}-\d{2}$' or (p_input->>'completed_on')::date>current_date or (p_input->>'completed_on')::date<(workflow#>>'{production,started_on}')::date or nullif(btrim(p_input->>'note'),'') is null or length(p_input->>'note')>2000 then raise exception 'Increasing cumulative quantity and actual completion evidence required';end if;
 insert into factory_qc_submissions(order_id,version,completed_on,quantity,asset_ids,note,created_by) values(o.id,coalesce(latest.version,0)+1,(p_input->>'completed_on')::date,(p_input->>'quantity')::integer,ids,p_input->>'note',auth.uid()) returning id into rid;result=jsonb_build_object('submission_id',rid,'status','BAO_review_pending');
 elsif p_operation='review_qc' then
 if factory or not is_staff() then raise exception 'BAO staff review required';end if;
 if latest.id is null or latest.id::text is distinct from p_input->>'submission_id' or p_input->>'decision' not in('approved','rejected') or nullif(btrim(p_input->>'note'),'') is null or length(p_input->>'note')>2000 or coalesce(p_input->>'evidence_checked','false')<>'true' then raise exception 'Latest evidence and explicit BAO review required';end if;
 if p_input->>'decision'='rejected' and coalesce(p_input->>'rejection_scope','all') not in('all','new_quantity') then raise exception 'Explicit rejection scope required';end if;
 insert into factory_qc_reviews(order_id,submission_id,decision,note,created_by,rejection_scope) values(o.id,latest.id,p_input->>'decision',p_input->>'note',auth.uid(),case when p_input->>'decision'='rejected' then coalesce(p_input->>'rejection_scope','all') else 'all' end) returning id into rid;result=jsonb_build_object('review_id',rid,'decision',p_input->>'decision');
 else raise exception 'Unknown QC operation';end if;
 insert into factory_qc_requests(id,order_id,created_by,operation,payload,result) values(p_request_id,o.id,auth.uid(),p_operation,p_input,result);return result;
end$$;
create or replace function public.factory_order_ship_ready(p_order_id uuid) returns boolean
language sql security definer set search_path=public,pg_temp as $$
 select exists(select 1 from factory_purchase_orders o join factory_terms_agreements a on a.order_id=o.id join factory_final_terms t on t.id=a.terms_id
 join factory_qc_submissions s on s.order_id=o.id join factory_qc_reviews r on r.submission_id=s.id and r.decision='approved'
 where o.id=p_order_id and o.status='ordered' and factory_qc_approved_quantity(o.id)>0 and factory_qc_reserved_quantity(o.id)<=factory_qc_approved_quantity(o.id)
 and (t.balance_due='after_delivery' or (select coalesce(sum(amount_usd),0) from factory_bank_acknowledgments where order_id=o.id)>=t.total_usd))
$$;
create or replace function public.factory_qc_context(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$declare workflow jsonb;assets jsonb;submissions jsonb;reviews jsonb;begin
 workflow=factory_order_context(p_order_id);
 select coalesce(jsonb_agg(to_jsonb(a) order by created_at),'[]') into assets from factory_qc_assets a where order_id=p_order_id;
 select coalesce(jsonb_agg(to_jsonb(s) order by version desc),'[]') into submissions from factory_qc_submissions s where order_id=p_order_id;
 select coalesce(jsonb_agg(to_jsonb(r) order by created_at),'[]') into reviews from factory_qc_reviews r where order_id=p_order_id;
 return jsonb_build_object('assets',assets,'submissions',submissions,'reviews',reviews,'approved_quantity',factory_qc_approved_quantity(p_order_id),'reserved_quantity',factory_qc_reserved_quantity(p_order_id),'ship_ready',factory_order_ship_ready(p_order_id),'today',current_date,'days_remaining',(workflow#>>'{production,expected_completion_on}')::date-current_date);
end$$;
create or replace function public.shipment_context(p_order_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$declare actor text;o factory_purchase_orders;plans jsonb;options jsonb;product jsonb;begin
 actor=shipment_order_role(p_order_id);select * into o from factory_purchase_orders where id=p_order_id;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'quantity',p.quantity,'created_at',p.created_at,'snapshot',case when actor='client' then p.snapshot-'china_address'-'china_source'-'logistics_actor_id' when actor='factory' then p.snapshot-'destination_address'-'recipient'-'phone'-'customer_name'-'logistics_actor_id' else p.snapshot end,'events',(select coalesce(jsonb_agg(case when actor='client' then jsonb_build_object('id',e.id,'kind',e.kind,'occurred_at',e.occurred_at,'tracking_number',e.tracking_number) else to_jsonb(e)-'created_by' end order by array_position(array['factory_dispatched','china_received','inspection_ready','inspection_cleared','international_departed','japan_arrived','out_for_delivery','carrier_delivered'],e.kind)),'[]') from shipment_milestones e where e.plan_id=p.id),'received_quantity',(select coalesce(sum(quantity),0) from shipment_customer_receipts where plan_id=p.id),'receipts',case when actor in('staff','client') then (select coalesce(jsonb_agg(to_jsonb(r)-'created_by'),'[]') from shipment_customer_receipts r where r.plan_id=p.id) else '[]'::jsonb end,'document',case when actor in('staff','client') then (select jsonb_build_object('id',d.id,'number',d.document_number,'mail_status',(select status from shipment_mail_receipts mr where mr.event_key=p.id::text||':delivery')) from shipment_delivery_documents d where d.plan_id=p.id) else null end) order by p.created_at),'[]') into plans from shipment_plans p where p.order_id=o.id and (actor<>'logistics' or p.logistics_actor_id=auth.uid()) and (actor<>'client' or p.client_id=(select client_id from profiles where id=auth.uid()));
 if actor='staff' then
 select jsonb_build_object('partners',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',company_name,'address',address)),'[]') from logistics_partners where is_active and partner_kind='shipping'),'actors',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',coalesce(display_name,'物流担当')||' / '||left(id::text,8))),'[]') from profiles where role::text='logistics'),'customer_default',(select default_delivery_address from clients c join deals d on d.client_id=c.id where d.id=o.deal_id)) into options;
 select jsonb_build_object('address',p.shipping_address_full,'recipient',p.shipping_recipient_name,'phone',p.shipping_phone) into product from deal_products p join deal_product_variants v on v.product_id=p.id where v.id=(o.snapshot->>'variant_id')::uuid;
 end if;
 return jsonb_build_object('actor',actor,'deal_status',(select simple_status from deals where id=o.deal_id),'order',jsonb_build_object('id',o.id,'deal_id',o.deal_id,'number',o.order_no,'quantity',o.quantity,'item_name',o.snapshot->>'item_name'),'qc_approved_quantity',case when actor in('staff','factory') then factory_qc_approved_quantity(o.id) else null end,'qc_available_quantity',case when actor='staff' then greatest(0,factory_qc_approved_quantity(o.id)-factory_qc_reserved_quantity(o.id)) else null end,'ship_ready',factory_order_ship_ready(o.id),'plans',plans,'options',options,'saved_destination',product,'tracking_integration',false,'today',current_date);
end$$;

create function public.guard_factory_qc_allocation() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare oid uuid;reserved bigint;quantity numeric;excluded uuid;state text;
begin
 if tg_table_name='shipment_plans' then oid=new.order_id;quantity=new.quantity;
 else select purchase_order_id,status into oid,state from inbound_shipments where id=new.shipment_id;
 if state='cancelled' then return new;end if;quantity=new.expected_quantity;if tg_op='UPDATE' then excluded=old.id;end if;end if;
 if oid is null or not exists(select 1 from factory_production_starts where order_id=oid) then return new;end if;
 perform 1 from factory_purchase_orders where id=oid for update;
 reserved=factory_qc_reserved_quantity(oid,excluded);
 if quantity is null or quantity<=0 or quantity<>trunc(quantity) or reserved+quantity>factory_qc_approved_quantity(oid) then raise exception 'Allocation exceeds QC approved cumulative quantity';end if;
 return new;
end$$;
revoke all on function public.guard_factory_qc_allocation() from public,anon,authenticated;
create trigger guard_factory_qc_allocation before insert on public.shipment_plans for each row execute function public.guard_factory_qc_allocation();
create trigger guard_factory_qc_allocation before insert or update of shipment_id,expected_quantity on public.inbound_shipment_items for each row execute function public.guard_factory_qc_allocation();

revoke all on function public.shipment_context(uuid) from public,anon;
grant execute on function public.shipment_context(uuid) to authenticated;
-- Reactivating or reassigning an existing warehouse plan must reserve its items again.
create function public.guard_factory_qc_inbound_reactivation() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare ownqty numeric;reserved bigint;
begin
 if new.status='cancelled' or new.purchase_order_id is null or not exists(select 1 from factory_production_starts where order_id=new.purchase_order_id) then return new;end if;
 perform 1 from factory_purchase_orders where id=new.purchase_order_id for update;
 select coalesce(sum(expected_quantity),0) into ownqty from inbound_shipment_items where shipment_id=new.id;
 reserved=factory_qc_reserved_quantity(new.purchase_order_id);
 if old.status<>'cancelled' and old.purchase_order_id=new.purchase_order_id then reserved=reserved-ownqty;end if;
 if reserved+ownqty>factory_qc_approved_quantity(new.purchase_order_id) then raise exception 'Warehouse reactivation exceeds QC approved cumulative quantity';end if;
 return new;
end$$;
revoke all on function public.guard_factory_qc_inbound_reactivation() from public,anon,authenticated;
create trigger guard_factory_qc_inbound_reactivation before update of status,purchase_order_id on public.inbound_shipments for each row execute function public.guard_factory_qc_inbound_reactivation();
