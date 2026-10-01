-- Local candidate. Private immutable QC media; separate factory completion and BAO review.
create table public.factory_qc_assets (
 id uuid primary key,order_id uuid not null references public.factory_purchase_orders(id),kind text not null check(kind in('overall_photo','packing_photo','video')),
 object_path text not null unique,mime text not null,byte_size bigint not null check(byte_size>0 and byte_size<=52428800),sha256 text not null check(sha256~'^[0-9a-f]{64}$'),
 created_by uuid not null references public.profiles(id),created_at timestamptz not null default now()
);
create table public.factory_qc_submissions (
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.factory_purchase_orders(id),version integer not null,
 completed_on date not null,quantity integer not null check(quantity>0),asset_ids uuid[] not null,note text not null,
 created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),unique(order_id,version)
);
create table public.factory_qc_reviews (
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.factory_purchase_orders(id),submission_id uuid not null unique references public.factory_qc_submissions(id),
 decision text not null check(decision in('approved','rejected')),note text not null,created_by uuid not null references public.profiles(id),created_at timestamptz not null default now()
);
create table public.factory_qc_requests (
 id uuid primary key,order_id uuid not null references public.factory_purchase_orders(id),created_by uuid not null references public.profiles(id),operation text not null,payload jsonb not null,result jsonb not null,created_at timestamptz not null default now()
);
create index factory_qc_asset_order on public.factory_qc_assets(order_id);
create index factory_qc_submission_order on public.factory_qc_submissions(order_id,version);
create index factory_qc_review_order on public.factory_qc_reviews(order_id);
do $$declare t text;begin foreach t in array array['factory_qc_assets','factory_qc_submissions','factory_qc_reviews','factory_qc_requests'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);
 execute format('create policy staff_read on public.%I for select to authenticated using((select is_staff())%s)',t,case when t='factory_qc_requests' then ' and created_by=(select auth.uid())' else '' end);
 execute format('create policy factory_read_own on public.%I for select to authenticated using(exists(select 1 from factory_purchase_orders o join profiles p on p.factory_id=o.factory_id where o.id=%I.order_id and p.id=(select auth.uid()) and p.role=''factory'')%s)',t,t,case when t='factory_qc_requests' then ' and created_by=(select auth.uid()) and operation in(''register_asset'',''submit_qc'')' else '' end);
 execute format('create trigger keep_factory_qc_history before update or delete on public.%I for each row execute function public.keep_factory_workflow_history()',t);
 end loop;end$$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('factory-qc','factory-qc',false,52428800,array['image/png','image/jpeg','video/mp4']) on conflict(id) do nothing;
do $$begin if not exists(select 1 from storage.buckets where id='factory-qc' and public=false and file_size_limit=52428800 and allowed_mime_types=array['image/png','image/jpeg','video/mp4']) then raise exception 'Existing QC bucket configuration needs explicit review';end if;end$$;
create function public.factory_qc_storage_scope(p_path text,p_write boolean) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$declare oid uuid;aid uuid;begin
 if auth.uid() is null or p_path!~'^[0-9a-f-]{36}/[0-9a-f-]{36}[.](png|jpg|mp4)$' then return false;end if;
 begin oid=split_part(p_path,'/',1)::uuid;aid=split_part(split_part(p_path,'/',2),'.',1)::uuid;exception when invalid_text_representation then return false;end;
 if not p_write and is_staff() then return exists(select 1 from factory_purchase_orders where id=oid);end if;
 return exists(select 1 from factory_purchase_orders o join profiles p on p.factory_id=o.factory_id join deals d on d.id=o.deal_id
 where o.id=oid and p.id=auth.uid() and p.role='factory' and (not p_write or (o.status='ordered' and d.archived_at is null and exists(select 1 from factory_production_starts where order_id=o.id))));
end$$;
revoke all on function public.factory_qc_storage_scope(text,boolean) from public,anon;grant execute on function public.factory_qc_storage_scope(text,boolean) to authenticated;
create policy factory_qc_private_read on storage.objects for select to authenticated using(bucket_id='factory-qc' and factory_qc_storage_scope(name,false));
create policy factory_qc_own_upload on storage.objects for insert to authenticated with check(bucket_id='factory-qc' and owner_id=(select auth.uid())::text and factory_qc_storage_scope(name,true));

create function public.factory_order_ship_ready(p_order_id uuid) returns boolean
language sql security definer set search_path=public,pg_temp as $$
 select exists(select 1 from factory_purchase_orders o join factory_terms_agreements a on a.order_id=o.id join factory_final_terms t on t.id=a.terms_id
 join factory_qc_submissions s on s.order_id=o.id join factory_qc_reviews r on r.submission_id=s.id and r.decision='approved'
 where o.id=p_order_id and o.status='ordered' and s.version=(select max(version) from factory_qc_submissions where order_id=o.id)
 and (t.balance_due='after_delivery' or (select coalesce(sum(amount_usd),0) from factory_bank_acknowledgments where order_id=o.id)>=t.total_usd))
$$;
revoke all on function public.factory_order_ship_ready(uuid) from public,anon,authenticated;
create function public.factory_qc_context(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$declare workflow jsonb;assets jsonb;submissions jsonb;reviews jsonb;begin
 workflow=factory_order_context(p_order_id);
 select coalesce(jsonb_agg(to_jsonb(a) order by created_at),'[]') into assets from factory_qc_assets a where order_id=p_order_id;
 select coalesce(jsonb_agg(to_jsonb(s) order by version desc),'[]') into submissions from factory_qc_submissions s where order_id=p_order_id;
 select coalesce(jsonb_agg(to_jsonb(r) order by created_at),'[]') into reviews from factory_qc_reviews r where order_id=p_order_id;
 return jsonb_build_object('assets',assets,'submissions',submissions,'reviews',reviews,'ship_ready',factory_order_ship_ready(p_order_id),'today',current_date,'days_remaining',(workflow#>>'{production,expected_completion_on}')::date-current_date);
end$$;
create function public.factory_qc_command(p_request_id uuid,p_order_id uuid,p_operation text,p_input jsonb) returns jsonb
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
 if exists(select 1 from inbound_shipments where purchase_order_id=o.id and status<>'cancelled') or exists(select 1 from deals where id=o.deal_id and simple_status::text in('shipped','delivered')) then raise exception 'Shipment already recorded; explicit correction required';end if;
 if latest.id is not null and not exists(select 1 from factory_qc_reviews where submission_id=latest.id and decision='rejected') then raise exception 'Latest submission pending or approved';end if;
 if jsonb_typeof(p_input->'asset_ids') is distinct from 'array' then raise exception 'Three evidence kinds required';end if;
 select array_agg(value::uuid order by value) into ids from jsonb_array_elements_text(p_input->'asset_ids');
 if coalesce(array_length(ids,1),0)<3 or array_length(ids,1)<>(select count(distinct x) from unnest(ids) x) or (select count(*) from factory_qc_assets where id=any(ids) and order_id=o.id)<>array_length(ids,1) or (select count(distinct kind) from factory_qc_assets where id=any(ids) and order_id=o.id)<>3 then raise exception 'Own overall/packing photos and video required';end if;
 if latest.id is not null and ids=latest.asset_ids then raise exception 'Rework needs revised evidence';end if;
 if coalesce(p_input->>'completion_confirmed','false')<>'true' or coalesce(p_input->>'quantity','')!~'^[1-9][0-9]*$' or (p_input->>'quantity')::numeric<>o.quantity or coalesce(p_input->>'completed_on','')!~'^\d{4}-\d{2}-\d{2}$' or (p_input->>'completed_on')::date>current_date or (p_input->>'completed_on')::date<(workflow#>>'{production,started_on}')::date or nullif(btrim(p_input->>'note'),'') is null or length(p_input->>'note')>2000 then raise exception 'Full order quantity and actual completion evidence required';end if;
 insert into factory_qc_submissions(order_id,version,completed_on,quantity,asset_ids,note,created_by) values(o.id,coalesce(latest.version,0)+1,(p_input->>'completed_on')::date,o.quantity,ids,p_input->>'note',auth.uid()) returning id into rid;result=jsonb_build_object('submission_id',rid,'status','BAO_review_pending');
 elsif p_operation='review_qc' then
 if factory or not is_staff() then raise exception 'BAO staff review required';end if;
 if latest.id is null or latest.id::text is distinct from p_input->>'submission_id' or p_input->>'decision' not in('approved','rejected') or nullif(btrim(p_input->>'note'),'') is null or length(p_input->>'note')>2000 or coalesce(p_input->>'evidence_checked','false')<>'true' then raise exception 'Latest evidence and explicit BAO review required';end if;
 insert into factory_qc_reviews(order_id,submission_id,decision,note,created_by) values(o.id,latest.id,p_input->>'decision',p_input->>'note',auth.uid()) returning id into rid;result=jsonb_build_object('review_id',rid,'decision',p_input->>'decision');
 else raise exception 'Unknown QC operation';end if;
 insert into factory_qc_requests(id,order_id,created_by,operation,payload,result) values(p_request_id,o.id,auth.uid(),p_operation,p_input,result);return result;
end$$;
revoke all on function public.factory_qc_context(uuid),public.factory_qc_command(uuid,uuid,text,jsonb) from public,anon;grant execute on function public.factory_qc_context(uuid),public.factory_qc_command(uuid,uuid,text,jsonb) to authenticated;

create function public.guard_factory_qc_shipment() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$declare oid uuid;begin
 if tg_table_name='deals' then
 if new.simple_status=old.simple_status or new.simple_status::text<>'shipped' then return new;end if;
 for oid in select o.id from factory_purchase_orders o join factory_production_starts s on s.order_id=o.id where o.deal_id=new.id and o.status='ordered' loop if not factory_order_ship_ready(oid) then raise exception 'BAO QC approval and required factory balance receipt before shipment';end if;end loop;
 else
 if new.status='cancelled' then return new;end if;
 if new.purchase_order_id is not null and exists(select 1 from factory_production_starts where order_id=new.purchase_order_id) and not factory_order_ship_ready(new.purchase_order_id) then raise exception 'BAO QC approval and required factory balance receipt before inbound transport';end if;
 end if;return new;
end$$;
revoke all on function public.guard_factory_qc_shipment() from public,anon,authenticated;
create trigger guard_factory_qc_shipment before update of simple_status on public.deals for each row execute function public.guard_factory_qc_shipment();
create trigger guard_factory_qc_inbound before insert or update of purchase_order_id,status on public.inbound_shipments for each row execute function public.guard_factory_qc_shipment();
