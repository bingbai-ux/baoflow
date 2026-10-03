-- Local-only candidate. No transfer execution or bank-account mutation.
create table public.factory_final_terms (
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.factory_purchase_orders(id),version integer not null,
 total_usd numeric(20,4) not null check(total_usd>0),payment_mode text not null check(payment_mode in('full_prepaid','partial_prepaid','postpaid')),
 upfront_usd numeric(20,4) not null check(upfront_usd>=0),balance_due text not null check(balance_due in('before_shipment','after_delivery')),
 lead_days integer not null check(lead_days between 1 and 365),bank_snapshot jsonb not null,note text not null,
 created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),unique(order_id,version),check(upfront_usd<=total_usd)
);
create table public.factory_terms_agreements (
 order_id uuid primary key references public.factory_purchase_orders(id),terms_id uuid not null unique references public.factory_final_terms(id),
 bank_evidence text not null,note text not null,approved_by uuid not null references public.profiles(id),approved_at timestamptz not null default now()
);
create table public.factory_transfer_reports (
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.factory_purchase_orders(id),terms_id uuid not null references public.factory_final_terms(id),
 amount_usd numeric(20,4) not null check(amount_usd>0),sent_on date not null,reference text not null unique,
 created_by uuid not null references public.profiles(id),created_at timestamptz not null default now()
);
create table public.factory_bank_acknowledgments (
 id uuid primary key default gen_random_uuid(),report_id uuid not null references public.factory_transfer_reports(id),order_id uuid not null references public.factory_purchase_orders(id),
 amount_usd numeric(20,4) not null check(amount_usd>0),received_on date not null,bank_reference text not null,
 created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),unique(order_id,bank_reference)
);
create table public.factory_production_starts (
 order_id uuid primary key references public.factory_purchase_orders(id),terms_id uuid not null references public.factory_final_terms(id),
 started_on date not null,expected_completion_on date not null,note text not null,created_by uuid not null references public.profiles(id),created_at timestamptz not null default now()
);
create table public.factory_workflow_requests (
 id uuid primary key,order_id uuid not null references public.factory_purchase_orders(id),created_by uuid not null references public.profiles(id),
 operation text not null,payload jsonb not null,result jsonb not null,created_at timestamptz not null default now()
);
create index factory_terms_order on public.factory_final_terms(order_id,version);
create index factory_transfers_order on public.factory_transfer_reports(order_id);
create index factory_acks_report on public.factory_bank_acknowledgments(report_id);
do $$declare t text;begin
 foreach t in array array['factory_final_terms','factory_terms_agreements','factory_transfer_reports','factory_bank_acknowledgments','factory_production_starts','factory_workflow_requests'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);
 execute format('create policy staff_read on public.%I for select to authenticated using ((select is_staff())%s)',t,case when t='factory_workflow_requests' then ' and created_by=(select auth.uid())' else '' end);
 if t<>'factory_terms_agreements' then execute format('create policy factory_own_read on public.%I for select to authenticated using(exists(select 1 from factory_purchase_orders o join profiles p on p.factory_id=o.factory_id where o.id=%I.order_id and p.id=(select auth.uid()) and p.role=''factory'')%s)',t,t,case when t='factory_workflow_requests' then ' and created_by=(select auth.uid()) and operation in(''propose_terms'',''ack_receipt'',''start_production'')' else '' end);end if;
 end loop;
end$$;

create function public.factory_order_context(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare o factory_purchase_orders;f factories;staff boolean;terms jsonb;agreement jsonb;reports jsonb;acks jsonb;started jsonb;
begin
 staff=is_staff();select * into o from factory_purchase_orders where id=p_order_id;
 if auth.uid() is null or not found or (not staff and not exists(select 1 from profiles where id=auth.uid() and role='factory' and factory_id=o.factory_id)) then raise exception 'Order unavailable';end if;
 select * into f from factories where id=o.factory_id;
 select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('total_usd',t.total_usd::text,'upfront_usd',t.upfront_usd::text) order by version desc),'[]') into terms from factory_final_terms t where order_id=o.id;
 select case when staff then to_jsonb(a) else jsonb_build_object('order_id',a.order_id,'terms_id',a.terms_id,'approved_at',a.approved_at) end into agreement from factory_terms_agreements a where order_id=o.id;
 select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('amount_usd',r.amount_usd::text) order by created_at),'[]') into reports from factory_transfer_reports r where order_id=o.id;
 select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('amount_usd',a.amount_usd::text) order by created_at),'[]') into acks from factory_bank_acknowledgments a where order_id=o.id;
 select to_jsonb(s) into started from factory_production_starts s where order_id=o.id;
 return jsonb_build_object('order',to_jsonb(o)||jsonb_build_object('factory_total_usd',(o.quantity*o.unit_price_usd)::text),'factory_name',f.factory_name,'registered_bank',jsonb_build_object('factory_id',f.id,'source','factories.bank_info','updated_at',f.updated_at,'data',f.bank_info),
 'terms',terms,'agreement',agreement,'transfers',reports,'acknowledgments',acks,'production',started,'deal_status',(select simple_status::text from deals where id=o.deal_id),'actor_role',case when staff then 'staff' else 'factory' end);
end$$;

create function public.factory_workflow_command(p_request_id uuid,p_order_id uuid,p_operation text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare o factory_purchase_orders;f factories;t factory_final_terms;a factory_terms_agreements;r factory_transfer_reports;prior factory_workflow_requests;
 staff boolean;factory boolean;result jsonb;rid uuid;v_total numeric;amount numeric;credited numeric;sent numeric;upfront numeric;mode text;balance text;days integer;bank jsonb;v_start date;
begin
 if auth.uid() is null or p_request_id is null or jsonb_typeof(p_input) is distinct from 'object' or length(p_input::text)>100000 then raise exception 'Authenticated bounded request required';end if;
 staff=is_staff();select * into o from factory_purchase_orders where id=p_order_id;
 factory=exists(select 1 from profiles where id=auth.uid() and role='factory' and factory_id=o.factory_id);
 if not found or not (staff or factory) then raise exception 'Order unavailable';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));select * into prior from factory_workflow_requests where id=p_request_id;
 if found then if prior.created_by<>auth.uid() or prior.order_id<>p_order_id or prior.operation<>p_operation or prior.payload<>p_input then raise exception 'Request has different input';end if;return prior.result;end if;
 perform 1 from deals where id=o.deal_id and archived_at is null for update;if not found or o.status<>'ordered' then raise exception 'Active order required';end if;
 perform pg_advisory_xact_lock(hashtextextended('factory_workflow:'||o.id::text,0));
 select * into f from factories where id=o.factory_id;select * into a from factory_terms_agreements where order_id=o.id;
 if p_operation='propose_terms' then
 if not factory then raise exception 'Own factory proposal required';end if;
 if a.order_id is not null then raise exception 'Agreed terms require explicit revision process';end if;
 bank=jsonb_build_object('factory_id',f.id,'source','factories.bank_info','updated_at',f.updated_at,'data',f.bank_info);
 if f.bank_info is null or f.bank_info in('null'::jsonb,'{}'::jsonb,'""'::jsonb) or coalesce(btrim(f.bank_info->>'raw'),'')='' then raise exception 'Registered bank original required; contact staff';end if;
 if p_input->'expected_bank' is distinct from bank then raise exception 'Registered bank changed; review source';end if;
 if coalesce(p_input->>'total_usd','')!~'^[0-9]+([.][0-9]{1,4})?$' or coalesce(p_input->>'upfront_usd','')!~'^[0-9]+([.][0-9]{1,4})?$' or coalesce(p_input->>'lead_days','')!~'^[1-9][0-9]*$' or length(coalesce(p_input->>'note',''))>2000 then raise exception 'Explicit amounts and production lead days required';end if;
 v_total=(p_input->>'total_usd')::numeric;upfront=(p_input->>'upfront_usd')::numeric;days=(p_input->>'lead_days')::integer;mode=p_input->>'payment_mode';balance=p_input->>'balance_due';
 if v_total<>o.quantity*o.unit_price_usd then raise exception 'Final price differs from PO; revise adopted quote and order first';end if;
 if days not between 1 and 365 or mode not in('full_prepaid','partial_prepaid','postpaid') or balance not in('before_shipment','after_delivery') or not ((mode='full_prepaid' and upfront=v_total and balance='before_shipment') or (mode='partial_prepaid' and upfront>0 and upfront<v_total) or (mode='postpaid' and upfront=0 and balance='after_delivery')) then raise exception 'Explicit full/partial/postpaid terms required';end if;
 insert into factory_final_terms(order_id,version,total_usd,payment_mode,upfront_usd,balance_due,lead_days,bank_snapshot,note,created_by)
 values(o.id,coalesce((select max(version) from factory_final_terms where order_id=o.id),0)+1,v_total,mode,upfront,balance,days,bank,coalesce(p_input->>'note',''),auth.uid()) returning id into rid;result=jsonb_build_object('terms_id',rid);
 elsif p_operation='agree_terms' then
 if not staff then raise exception 'Staff agreement required';end if;
 select * into t from factory_final_terms where id=(p_input->>'terms_id')::uuid and order_id=o.id;
 if not found or t.version<>(select max(version) from factory_final_terms where order_id=o.id) then raise exception 'Latest factory terms required';end if;
 bank=jsonb_build_object('factory_id',f.id,'source','factories.bank_info','updated_at',f.updated_at,'data',f.bank_info);
 if bank is distinct from t.bank_snapshot or p_input->'expected_terms' is distinct from (to_jsonb(t)||jsonb_build_object('total_usd',t.total_usd::text,'upfront_usd',t.upfront_usd::text)) then raise exception 'Terms or registered bank changed';end if;
 if coalesce(p_input->>'bank_verified','false')<>'true' or nullif(btrim(p_input->>'bank_evidence'),'') is null or length(p_input->>'bank_evidence')>2000 or nullif(btrim(p_input->>'note'),'') is null or length(p_input->>'note')>2000 then raise exception 'Bank source verification and agreement evidence required';end if;
 insert into factory_terms_agreements(order_id,terms_id,bank_evidence,note,approved_by) values(o.id,t.id,p_input->>'bank_evidence',p_input->>'note',auth.uid());result=jsonb_build_object('terms_id',t.id,'agreed',true);
 elsif p_operation in('report_transfer','ack_receipt','start_production') then
 if a.order_id is null then raise exception 'Staff-agreed final terms required';end if;select * into t from factory_final_terms where id=a.terms_id;
 if p_operation='report_transfer' then
 if not staff then raise exception 'Staff transfer report required';end if;
 bank=jsonb_build_object('factory_id',f.id,'source','factories.bank_info','updated_at',f.updated_at,'data',f.bank_info);
 if bank is distinct from t.bank_snapshot then raise exception 'Registered bank changed; stop transfer instructions and verify';end if;
 if coalesce(p_input->>'amount_usd','')!~'^[0-9]+([.][0-9]{1,4})?$' or coalesce(p_input->>'sent_on','')!~'^\d{4}-\d{2}-\d{2}$' or (p_input->>'sent_on')::date>current_date or nullif(btrim(p_input->>'reference'),'') is null or length(p_input->>'reference')>500 or coalesce(p_input->>'sent_confirmed','false')<>'true' then raise exception 'Actual manual transfer report required';end if;
 amount=(p_input->>'amount_usd')::numeric;select coalesce(sum(amount_usd),0) into sent from factory_transfer_reports where order_id=o.id;
 if amount<=0 or sent+amount>t.total_usd then raise exception 'Transfer exceeds agreed total';end if;
 insert into factory_transfer_reports(order_id,terms_id,amount_usd,sent_on,reference,created_by) values(o.id,t.id,amount,(p_input->>'sent_on')::date,lower(btrim(p_input->>'reference')),auth.uid()) returning id into rid;result=jsonb_build_object('report_id',rid,'factory_receipt_confirmed',false);
 elsif p_operation='ack_receipt' then
 if not factory then raise exception 'Own factory bank acknowledgment required';end if;
 select * into r from factory_transfer_reports where id=(p_input->>'report_id')::uuid and order_id=o.id;
 if not found or coalesce(p_input->>'amount_usd','')!~'^[0-9]+([.][0-9]{1,4})?$' or coalesce(p_input->>'received_on','')!~'^\d{4}-\d{2}-\d{2}$' or (p_input->>'received_on')::date>current_date or (p_input->>'received_on')::date<r.sent_on or nullif(btrim(p_input->>'bank_reference'),'') is null or length(p_input->>'bank_reference')>500 or coalesce(p_input->>'bank_confirmed','false')<>'true' then raise exception 'Actual factory bank evidence required';end if;
 amount=(p_input->>'amount_usd')::numeric;select coalesce(sum(amount_usd),0) into credited from factory_bank_acknowledgments where report_id=r.id;
 if amount<=0 or credited+amount>r.amount_usd then raise exception 'Acknowledgment exceeds reported transfer';end if;
 insert into factory_bank_acknowledgments(report_id,order_id,amount_usd,received_on,bank_reference,created_by) values(r.id,o.id,amount,(p_input->>'received_on')::date,lower(btrim(p_input->>'bank_reference')),auth.uid()) returning id into rid;result=jsonb_build_object('acknowledgment_id',rid);
 else
 if not factory then raise exception 'Own factory production start required';end if;
 select coalesce(sum(amount_usd),0) into credited from factory_bank_acknowledgments where order_id=o.id;
 if credited<t.upfront_usd then raise exception 'Factory-confirmed upfront receipt required';end if;
 if coalesce(p_input->>'started_on','')!~'^\d{4}-\d{2}-\d{2}$' or (p_input->>'started_on')::date>current_date or nullif(btrim(p_input->>'note'),'') is null or length(p_input->>'note')>2000 then raise exception 'Actual production start required';end if;
 v_start=(p_input->>'started_on')::date;
 if v_start<a.approved_at::date then raise exception 'Production start precedes agreed final terms';end if;
 if exists(select 1 from factory_bank_acknowledgments where order_id=o.id and received_on>v_start) then raise exception 'Start date precedes required receipt evidence';end if;
 insert into factory_production_starts(order_id,terms_id,started_on,expected_completion_on,note,created_by) values(o.id,t.id,v_start,v_start+t.lead_days,p_input->>'note',auth.uid());result=jsonb_build_object('order_id',o.id,'started_on',v_start,'expected_completion_on',v_start+t.lead_days);
 end if;
 elsif p_operation='advance_production' then
 if not staff then raise exception 'Staff progression required';end if;
 if not exists(select 1 from factory_production_starts where order_id=o.id) or exists(select 1 from factory_purchase_orders p where p.deal_id=o.deal_id and p.status='ordered' and not exists(select 1 from factory_production_starts s where s.order_id=p.id)) then raise exception 'All active orders need factory-confirmed production starts';end if;
 perform set_deal_simple_status(o.deal_id,'in_production','全工場の製造開始記録を確認','data_confirmed');result=jsonb_build_object('deal_id',o.deal_id,'advanced',true);
 else raise exception 'Unknown factory operation';end if;
 insert into factory_workflow_requests(id,order_id,created_by,operation,payload,result) values(p_request_id,o.id,auth.uid(),p_operation,p_input,result);return result;
end$$;
revoke all on function public.factory_order_context(uuid),public.factory_workflow_command(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.factory_order_context(uuid),public.factory_workflow_command(uuid,uuid,text,jsonb) to authenticated;

create function public.keep_factory_workflow_history() returns trigger language plpgsql set search_path=public,pg_temp as $$begin raise exception 'Factory workflow history immutable';end$$;
revoke all on function public.keep_factory_workflow_history() from public,anon,authenticated;
do $$declare t text;begin foreach t in array array['factory_final_terms','factory_terms_agreements','factory_transfer_reports','factory_bank_acknowledgments','factory_production_starts','factory_workflow_requests'] loop
 execute format('create trigger keep_factory_workflow_history before update or delete on public.%I for each row execute function public.keep_factory_workflow_history()',t);end loop;end$$;

create function public.guard_financed_factory_order() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if exists(select 1 from client_document_packets where deal_id=new.deal_id) and not exists(
 select 1 from client_document_packets p join deals d on d.id=p.deal_id where p.deal_id=new.deal_id and p.document_type='invoice' and p.status='active' and finance_packet_matches_live(p.id)
 and d.simple_status::text in('paid','data_confirmed','in_production','shipped','delivered')
 and exists(select 1 from jsonb_array_elements(p.snapshot->'lines') l where l->>'quote_id'=new.source_quote_id::text)
 and (select coalesce(sum(amount_jpy),0) from client_payment_receipts where packet_id=p.id)>=(p.snapshot->>'total')::bigint) then raise exception 'Formal PO requires current customer invoice and BAO full receipt';end if;
 return new;
end$$;
revoke all on function public.guard_financed_factory_order() from public,anon,authenticated;
create trigger guard_financed_factory_order before insert on public.factory_purchase_orders for each row execute function public.guard_financed_factory_order();
create function public.guard_factory_production_progress() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.simple_status=old.simple_status or new.simple_status::text<>'in_production' or not exists(select 1 from factory_final_terms t join factory_purchase_orders o on o.id=t.order_id where o.deal_id=new.id) then return new;end if;
 if not exists(select 1 from factory_purchase_orders where deal_id=new.id and status='ordered') or exists(select 1 from factory_purchase_orders o where o.deal_id=new.id and o.status='ordered' and not exists(select 1 from factory_production_starts s where s.order_id=o.id)) then raise exception 'All active orders need factory-confirmed production starts';end if;
 return new;
end$$;
revoke all on function public.guard_factory_production_progress() from public,anon,authenticated;
create trigger guard_factory_production_progress before update of simple_status on public.deals for each row execute function public.guard_factory_production_progress();
