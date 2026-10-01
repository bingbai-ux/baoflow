-- Local candidate only. Existing immutable packet snapshots store agreed payment rules.
-- No new table, data backfill, credentials or actual payment execution.
create function public.client_payment_conditions(p_total bigint,p_mode text default 'full_prepaid',p_balance text default 'before_shipment') returns jsonb
language plpgsql immutable set search_path=public,pg_temp as $$
declare upfront bigint;shipping bigint;
begin
 if p_total is null or p_mode is null or p_balance is null or p_total<=0 or p_mode not in('full_prepaid','half_prepaid','postpaid') or p_balance not in('before_shipment','after_delivery') then raise exception 'Explicit client payment conditions required';end if;
 if p_mode='full_prepaid' and p_balance<>'before_shipment' or p_mode='postpaid' and p_balance<>'after_delivery' then raise exception 'Client payment timing mismatch';end if;
 upfront=case p_mode when 'full_prepaid' then p_total when 'half_prepaid' then p_total/2+p_total%2 else 0 end;
 shipping=case when p_balance='before_shipment' then p_total else upfront end;
 return jsonb_build_object('mode',p_mode,'balance_due',p_balance,'upfront_jpy',upfront::text,'shipment_required_jpy',shipping::text,'total_jpy',p_total::text,'rounding','half_upfront_ceil_yen');
end$$;
revoke all on function public.client_payment_conditions(bigint,text,text) from public,anon,authenticated;
create function public.preview_client_document_with_terms(p_document_id uuid,p_approval_packet_id uuid default null,p_mode text default 'full_prepaid',p_balance text default 'before_shipment') returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare s jsonb;rules jsonb;
begin
 s=preview_client_document(p_document_id,p_approval_packet_id);
 if s->>'type'='quotation' then rules=client_payment_conditions((s->>'total')::bigint,p_mode,p_balance);
 else select snapshot->'payment_conditions' into rules from client_document_packets where id=p_approval_packet_id;
 rules=coalesce(rules,client_payment_conditions((s->>'total')::bigint));end if;
 return s||jsonb_build_object('payment_conditions',rules);
end$$;
revoke all on function public.preview_client_document_with_terms(uuid,uuid,text,text) from public,anon;
grant execute on function public.preview_client_document_with_terms(uuid,uuid,text,text) to authenticated;
create function public.client_invoice_threshold(p_packet_id uuid,p_shipping boolean default false) returns bigint
language sql stable security definer set search_path=public,pg_temp as $$
 select case when p_shipping then coalesce((snapshot#>>'{payment_conditions,shipment_required_jpy}')::bigint,(snapshot->>'total')::bigint) else coalesce((snapshot#>>'{payment_conditions,upfront_jpy}')::bigint,(snapshot->>'total')::bigint) end from client_document_packets where id=p_packet_id and document_type='invoice'
$$;
revoke all on function public.client_invoice_threshold(uuid,boolean) from public,anon,authenticated;

create or replace function public.client_finance_command(p_request_id uuid,p_operation text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare prior client_finance_requests;result jsonb;packet client_document_packets;expected jsonb;rid uuid;link client_document_links;report client_payment_reports;amount bigint;received bigint;ctx jsonb;staff boolean;v_decision text;
begin
 if auth.uid() is null or p_request_id is null or jsonb_typeof(p_input) is distinct from 'object' or length(p_input::text)>300000 then raise exception 'Authenticated bounded request required';end if;
 staff=is_staff();perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));select * into prior from client_finance_requests where id=p_request_id;
 if found then if prior.created_by<>auth.uid() or prior.operation<>p_operation or prior.payload<>p_input then raise exception 'Request has different input';end if;return prior.result;end if;
 if p_operation='publish_document' then
 if not staff then raise exception 'Sales or administrator required';end if;
 perform 1 from documents where id=(p_input->>'document_id')::uuid for update;
 perform 1 from deals where id=(select deal_id from documents where id=(p_input->>'document_id')::uuid) for update;
 expected=preview_client_document((p_input->>'document_id')::uuid,nullif(p_input->>'approval_packet_id','')::uuid);
 if p_input->'expected' ? 'payment_conditions' then expected=preview_client_document_with_terms((p_input->>'document_id')::uuid,nullif(p_input->>'approval_packet_id','')::uuid,p_input#>>'{expected,payment_conditions,mode}',p_input#>>'{expected,payment_conditions,balance_due}');end if;
 if expected is distinct from p_input->'expected' then raise exception 'Preview changed';end if;
 if exists(select 1 from client_document_packets where document_id=(p_input->>'document_id')::uuid) then raise exception 'Document already published';end if;
 if expected->>'type'='invoice' and exists(select 1 from client_document_packets where deal_id=(expected->>'deal_id')::uuid and document_type='invoice' and status='active') then raise exception 'Cancel previous unpaid invoice before publishing';end if;
 if expected->>'type'='quotation' then
 if exists(select 1 from client_document_packets where deal_id=(expected->>'deal_id')::uuid and document_type='invoice' and status='active') then raise exception 'Cancel dependent unpaid invoice before quote revision';end if;
 update client_document_packets set status='superseded' where deal_id=(expected->>'deal_id')::uuid and document_type='quotation' and status='active';end if;
 insert into client_document_packets(document_id,deal_id,client_id,document_type,snapshot,approval_packet_id,created_by)
 values((expected->>'document_id')::uuid,(expected->>'deal_id')::uuid,(expected->>'client_id')::uuid,expected->>'type',expected,nullif(p_input->>'approval_packet_id','')::uuid,auth.uid()) returning * into packet;
 insert into client_document_links(packet_id,created_by) values(packet.id,auth.uid()) returning * into link;
 result=jsonb_build_object('packet_id',packet.id,'token',link.token,'expires_at',link.expires_at);
 else
 select * into packet from client_document_packets where id=(p_input->>'packet_id')::uuid;
 if not staff then if p_operation not in('respond_quote','report_payment') then raise exception 'Client response operation required';end if;ctx=client_finance_context(packet.id,p_input->>'token');end if;
 perform 1 from deals where id=packet.deal_id for update;
 select * into packet from client_document_packets where id=(p_input->>'packet_id')::uuid for update;
 if not found or packet.status<>'active' then raise exception 'Active packet required';end if;
 if p_operation in('respond_quote','report_payment') then
 ctx=client_finance_context(packet.id,p_input->>'token');
 if not finance_packet_matches_live(packet.id) then raise exception 'Current approved price required';end if;
 if packet.document_type='invoice' and not exists(select 1 from client_document_packets a join client_document_responses r on r.packet_id=a.id and r.decision='approved' where a.id=packet.approval_packet_id and a.status='active') then raise exception 'Current customer approval required';end if;
 if p_operation='respond_quote' then
 v_decision=p_input->>'decision';if packet.document_type<>'quotation' or v_decision not in('approved','revision_requested') or length(coalesce(p_input->>'note',''))>2000 then raise exception 'Quotation response required';end if;
 if exists(select 1 from client_document_responses where packet_id=packet.id) then raise exception 'Quotation already answered';end if;
 insert into client_document_responses(packet_id,decision,note,created_by) values(packet.id,v_decision,coalesce(p_input->>'note',''),auth.uid());result=jsonb_build_object('packet_id',packet.id,'decision',v_decision);
 else
 if packet.document_type<>'invoice' or coalesce(p_input->>'amount_jpy','')!~'^[1-9][0-9]*$' or coalesce(p_input->>'paid_on','')!~'^\d{4}-\d{2}-\d{2}$' or (p_input->>'paid_on')::date>current_date or nullif(btrim(p_input->>'reference'),'') is null or length(p_input->>'reference')>500 then raise exception 'Payment declaration required';end if;
 amount=(p_input->>'amount_jpy')::bigint;if amount>(packet.snapshot->>'total')::bigint then raise exception 'Declared amount exceeds invoice';end if;
 insert into client_payment_reports(packet_id,created_by,amount_jpy,paid_on,reference) values(packet.id,auth.uid(),amount,(p_input->>'paid_on')::date,btrim(p_input->>'reference'))
 on conflict(packet_id,created_by,amount_jpy,paid_on,reference) do nothing returning id into rid;
 if rid is null then select id into rid from client_payment_reports where packet_id=packet.id and created_by=auth.uid() and amount_jpy=amount and paid_on=(p_input->>'paid_on')::date and reference=btrim(p_input->>'reference');end if;
 result=jsonb_build_object('report_id',rid,'status',(select status from client_payment_reports where id=rid),'payment_confirmed',false);
 end if;
 elsif p_operation='confirm_receipt' then
 if not staff or packet.document_type<>'invoice' then raise exception 'Staff invoice confirmation required';end if;
 select * into report from client_payment_reports where id=(p_input->>'report_id')::uuid and packet_id=packet.id and status='pending' for update;
 if not found or coalesce(p_input->>'amount_jpy','')!~'^[1-9][0-9]*$' or coalesce(p_input->>'received_on','')!~'^\d{4}-\d{2}-\d{2}$' or (p_input->>'received_on')::date>current_date or nullif(btrim(p_input->>'bank_reference'),'') is null or length(p_input->>'bank_reference')>500 or coalesce(p_input->>'bank_confirmed','false')<>'true' then raise exception 'Bank evidence confirmation required';end if;
 amount=(p_input->>'amount_jpy')::bigint;select coalesce(sum(amount_jpy),0) into received from client_payment_receipts where packet_id=packet.id;
 if received+amount>(packet.snapshot->>'total')::bigint then raise exception 'Receipt exceeds outstanding invoice';end if;
 insert into client_payment_receipts(report_id,packet_id,amount_jpy,received_on,bank_reference,confirmed_by) values(report.id,packet.id,amount,(p_input->>'received_on')::date,lower(btrim(p_input->>'bank_reference')),auth.uid()) returning id into rid;
 if (select sum(amount_jpy) from client_payment_receipts where report_id=report.id)>=report.amount_jpy then update client_payment_reports set status='confirmed' where id=report.id;end if;
 result=jsonb_build_object('receipt_id',rid,'confirmed_jpy',received+amount,'paid_in_full',received+amount=(packet.snapshot->>'total')::bigint);
 elsif p_operation='cancel_packet' then
 if not staff or nullif(btrim(p_input->>'reason'),'') is null or length(p_input->>'reason')>2000 then raise exception 'Staff cancellation reason required';end if;
 if exists(select 1 from client_payment_receipts where packet_id=packet.id) then raise exception 'Confirmed funds require explicit accounting correction';end if;
 if exists(select 1 from client_document_packets where approval_packet_id=packet.id and status='active') then raise exception 'Cancel dependent unpaid invoice before its approval';end if;
 update client_document_packets set status='cancelled',cancel_reason=p_input->>'reason',cancelled_at=now() where id=packet.id;
 update client_document_links set revoked_at=now() where packet_id=packet.id and revoked_at is null;
 result=jsonb_build_object('packet_id',packet.id,'status','cancelled');
 elsif p_operation='reject_report' then
 if not staff or nullif(btrim(p_input->>'reason'),'') is null or length(p_input->>'reason')>2000 then raise exception 'Staff rejection reason required';end if;
 if exists(select 1 from client_payment_receipts where report_id=(p_input->>'report_id')::uuid) then raise exception 'Confirmed bank evidence cannot be rejected';end if;
 update client_payment_reports set status='rejected',review_note=p_input->>'reason' where id=(p_input->>'report_id')::uuid and packet_id=packet.id and status='pending';if not found then raise exception 'Pending report required';end if;
 result=jsonb_build_object('report_id',p_input->>'report_id','status','rejected');
 elsif p_operation in('advance_quote','advance_paid') then
 if not staff then raise exception 'Sales or administrator required';end if;
 if p_operation='advance_quote' then
 if packet.document_type<>'quotation' or not exists(select 1 from client_document_responses where packet_id=packet.id and decision='approved') then raise exception 'Customer approval required';end if;
 perform set_deal_simple_status(packet.deal_id,'quote_confirmed', '顧客の発行版承認を確認','quoting');
 else
 if packet.document_type<>'invoice' or (select coalesce(sum(amount_jpy),0) from client_payment_receipts where packet_id=packet.id)<client_invoice_threshold(packet.id) then raise exception 'Confirmed agreed upfront bank receipt required';end if;
 perform set_deal_simple_status(packet.deal_id,'paid','顧客合意の発注条件と必要前払着金を確認（全額入金とは別）','quote_confirmed');
 end if;result=jsonb_build_object('deal_id',packet.deal_id,'advanced',true);
 else raise exception 'Unknown finance operation';end if;
 end if;
 insert into client_finance_requests(id,created_by,operation,payload,result) values(p_request_id,auth.uid(),p_operation,p_input,result);return result;
end$$;

create or replace function public.guard_finance_progress() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.simple_status=old.simple_status or new.simple_status::text not in('quote_confirmed','paid') or not exists(select 1 from client_document_packets where deal_id=new.id) then return new;end if;
 if new.simple_status::text='quote_confirmed' then
 if not exists(select 1 from client_document_packets p join client_document_responses r on r.packet_id=p.id and r.decision='approved' where p.deal_id=new.id and p.document_type='quotation' and finance_packet_matches_live(p.id)) then raise exception 'Customer approval of current price required';end if;
 else
 if not exists(select 1 from client_document_packets p join client_document_packets a on a.id=p.approval_packet_id and a.status='active' join client_document_responses r on r.packet_id=a.id and r.decision='approved'
 where p.deal_id=new.id and p.document_type='invoice' and finance_packet_matches_live(p.id) and (select coalesce(sum(amount_jpy),0) from client_payment_receipts where packet_id=p.id)>=client_invoice_threshold(p.id)) then raise exception 'BAO confirmed agreed upfront bank receipt required';end if;
 end if;return new;
end$$;

create or replace function public.guard_financed_factory_order() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if exists(select 1 from client_document_packets where deal_id=new.deal_id) and not exists(
 select 1 from client_document_packets p join deals d on d.id=p.deal_id where p.deal_id=new.deal_id and p.document_type='invoice' and p.status='active' and finance_packet_matches_live(p.id)
 and d.simple_status::text in('paid','data_confirmed','in_production','shipped','delivered')
 and exists(select 1 from jsonb_array_elements(p.snapshot->'lines') l where l->>'quote_id'=new.source_quote_id::text)
 and (select coalesce(sum(amount_jpy),0) from client_payment_receipts where packet_id=p.id)>=client_invoice_threshold(p.id)) then raise exception 'Formal PO requires current customer invoice and BAO agreed upfront receipt';end if;
 return new;
end$$;


-- A customer balance due before shipment is independent of the factory balance gate.
create function public.guard_client_shipment_payment() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare d uuid;
begin
 if tg_table_name='shipment_plans' then d=new.deal_id;
 else select deal_id into d from shipment_plans where id=new.plan_id;end if;
 perform 1 from deals where id=d for update;
 if exists(select 1 from client_document_packets where deal_id=d) and not exists(
 select 1 from client_document_packets p join client_document_packets a on a.id=p.approval_packet_id and a.status='active'
 join client_document_responses r on r.packet_id=a.id and r.decision='approved'
 where p.deal_id=d and p.document_type='invoice' and finance_packet_matches_live(p.id)
 and (select coalesce(sum(amount_jpy),0) from client_payment_receipts where packet_id=p.id)>=client_invoice_threshold(p.id,true)) then raise exception 'Customer agreed shipment balance not received';end if;
 return new;
end$$;
revoke all on function public.guard_client_shipment_payment() from public,anon,authenticated;
create trigger guard_client_shipment_payment before insert on public.shipment_plans for each row execute function public.guard_client_shipment_payment();
create trigger guard_client_shipment_payment before insert on public.shipment_milestones for each row execute function public.guard_client_shipment_payment();
