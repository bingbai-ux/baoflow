-- Generated with Supabase CLI; ordered after Stage10 to preserve dependency order.
-- No new tables. Explicit pre-PO customer-approved price replacement only.
create function public.preview_client_price_reissue(p_packet_id uuid,p_document_id uuid,p_approval_packet_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare old client_document_packets;a client_document_packets;s jsonb;totals jsonb;origins jsonb;
begin
 if auth.uid() is null or not is_staff() then raise exception 'Sales or administrator required';end if;
 select * into old from client_document_packets where id=p_packet_id and status='active' and document_type='invoice';if not found then raise exception 'Current invoice required';end if;
 if exists(select 1 from client_document_packets where document_id=p_document_id) or exists(select 1 from factory_purchase_orders where deal_id=old.deal_id) or exists(select 1 from client_payment_reports where packet_id=any(client_payment_family(old.id)) and status='pending') then raise exception 'Pre-order new document and reviewed bank reports required';end if;
 select * into a from client_document_packets where id=p_approval_packet_id and status='active' and document_type='quotation' and deal_id=old.deal_id and client_id=old.client_id;
 if not found or a.snapshot->>'reprices_invoice_id' is distinct from old.id::text then raise exception 'Explicit customer-approved price replacement required';end if;
 s=preview_client_document_with_terms(p_document_id,a.id);totals=client_payment_totals(old.id);
 if s->>'type'<>'invoice' or s->>'client_id'<>old.client_id::text or s->>'deal_id'<>old.deal_id::text or a.snapshot->>'payment_carry_jpy' is distinct from totals->>'net_jpy' or (totals->>'net_jpy')::bigint>(s->>'total')::bigint then raise exception 'Customer-approved cash allocation changed or excess funds require refund';end if;
 select jsonb_agg(x::text order by x::text) into origins from unnest(client_payment_family(old.id)) x;
 return s||jsonb_build_object('payment_origin_packet_ids',origins,'replaces_packet_id',old.id,'reissue_kind','customer_reapproved_price','reprices_invoice_id',old.id,'payment_carry_jpy',totals->>'net_jpy');
end$$;
revoke all on function public.preview_client_price_reissue(uuid,uuid,uuid) from public,anon;grant execute on function public.preview_client_price_reissue(uuid,uuid,uuid) to authenticated;

create or replace function public.client_finance_command(p_request_id uuid,p_operation text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare prior client_finance_requests;result jsonb;packet client_document_packets;expected jsonb;rid uuid;link client_document_links;report client_payment_reports;amount bigint;received bigint;ctx jsonb;staff boolean;v_decision text;totals jsonb;send_state jsonb;new_packet client_document_packets;
begin
 if auth.uid() is null or p_request_id is null or jsonb_typeof(p_input) is distinct from 'object' or length(p_input::text)>300000 then raise exception 'Authenticated bounded request required';end if;
 staff=is_staff();perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));select * into prior from client_finance_requests where id=p_request_id;
 if found then if prior.created_by<>auth.uid() or prior.operation<>p_operation or prior.payload<>p_input then raise exception 'Request has different input';end if;if p_operation='reserve_document_resend' then return prior.result||jsonb_build_object('claimed',false);end if;return prior.result;end if;
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
 select * into new_packet from client_document_packets where deal_id=(expected->>'deal_id')::uuid and document_type='invoice' and status='active';
 if found then
 if not staff or p_input->>'reprice_invoice_id' is distinct from new_packet.id::text or coalesce(p_input->>'reprice_confirmed','false')<>'true' or nullif(btrim(p_input->>'reason'),'') is null or length(p_input->>'reason')>2000 or exists(select 1 from factory_purchase_orders where deal_id=new_packet.deal_id) then raise exception 'Explicit pre-order repricing required';end if;
 if exists(select 1 from client_payment_reports where packet_id=any(client_payment_family(new_packet.id)) and status='pending') then raise exception 'Review pending bank reports before repricing';end if;
 totals=client_payment_totals(new_packet.id);
 if (totals->>'net_jpy')::bigint>(expected->>'total')::bigint then raise exception 'Refund excess actual funds before repricing';end if;
 expected=expected||jsonb_build_object('reprices_invoice_id',new_packet.id,'payment_carry_jpy',totals->>'net_jpy');
 end if;
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
 if p_input->>'decision'='approved' and packet.snapshot ? 'reprices_invoice_id' and coalesce(p_input->>'payment_carry_confirmed','false')<>'true' then raise exception 'Customer payment carry confirmation required';end if;
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
 amount=(p_input->>'amount_jpy')::bigint;received=(client_payment_totals(packet.id)->>'net_jpy')::bigint;
 if received+amount>(packet.snapshot->>'total')::bigint then raise exception 'Receipt exceeds outstanding invoice';end if;
 insert into client_payment_receipts(report_id,packet_id,amount_jpy,received_on,bank_reference,confirmed_by) values(report.id,packet.id,amount,(p_input->>'received_on')::date,lower(btrim(p_input->>'bank_reference')),auth.uid()) returning id into rid;
 if (select sum(amount_jpy) from client_payment_receipts where report_id=report.id)>=report.amount_jpy then update client_payment_reports set status='confirmed' where id=report.id;end if;
 result=jsonb_build_object('receipt_id',rid,'confirmed_jpy',received+amount,'paid_in_full',received+amount=(packet.snapshot->>'total')::bigint);
 elsif p_operation='cancel_packet' then
 if not staff or nullif(btrim(p_input->>'reason'),'') is null or length(p_input->>'reason')>2000 then raise exception 'Staff cancellation reason required';end if;
 if (client_payment_totals(packet.id)->>'net_jpy')::bigint>0 then raise exception 'Confirmed funds require explicit accounting correction';end if;
 if exists(select 1 from client_document_packets where approval_packet_id=packet.id and status='active') then raise exception 'Cancel dependent unpaid invoice before its approval';end if;
 update client_document_packets set status='cancelled',cancel_reason=p_input->>'reason',cancelled_at=now() where id=packet.id;
 update client_document_links set revoked_at=now() where packet_id=packet.id and revoked_at is null;
 result=jsonb_build_object('packet_id',packet.id,'status','cancelled');

 elsif p_operation in('reissue_invoice','reissue_priced_invoice') then
 if not staff or nullif(btrim(p_input->>'reason'),'') is null or length(p_input->>'reason')>2000 or coalesce(p_input->>(case when p_operation='reissue_priced_invoice' then 'payment_allocation_confirmed' else 'same_obligation_confirmed' end),'false')<>'true' then raise exception 'Staff identical obligation confirmation required';end if;
 perform 1 from documents where id=(p_input->>'document_id')::uuid for update;
 if p_operation='reissue_priced_invoice' then expected=preview_client_price_reissue(packet.id,(p_input->>'document_id')::uuid,(p_input->>'approval_packet_id')::uuid);else expected=preview_client_reissue(packet.id,(p_input->>'document_id')::uuid);end if;if expected is distinct from p_input->'expected' then raise exception 'Preview changed';end if;
 update client_document_packets set status='superseded',cancel_reason=p_input->>'reason' where id=packet.id;
 update client_document_links set revoked_at=now() where packet_id=packet.id and revoked_at is null;
 insert into client_document_packets(document_id,deal_id,client_id,document_type,snapshot,approval_packet_id,created_by) values((expected->>'document_id')::uuid,packet.deal_id,packet.client_id,'invoice',expected,case when p_operation='reissue_priced_invoice' then (p_input->>'approval_packet_id')::uuid else packet.approval_packet_id end,auth.uid()) returning * into new_packet;
 insert into client_document_links(packet_id,created_by) values(new_packet.id,auth.uid()) returning * into link;
 result=jsonb_build_object('packet_id',new_packet.id,'token',link.token,'expires_at',link.expires_at,'replaced_packet_id',packet.id,'payment_totals',client_payment_totals(new_packet.id));
 elsif p_operation='renew_link' then
 if not staff or not finance_packet_matches_live(packet.id) then raise exception 'Staff current packet required';end if;
 if exists(select 1 from client_document_links where packet_id=packet.id and revoked_at is null and expires_at>now()) then raise exception 'Existing link is still valid';end if;
 update client_document_links set revoked_at=now() where packet_id=packet.id and revoked_at is null;
 insert into client_document_links(packet_id,created_by) values(packet.id,auth.uid()) returning * into link;
 result=jsonb_build_object('packet_id',packet.id,'token',link.token,'expires_at',link.expires_at);
 elsif p_operation='record_refund' then
 if not staff or packet.document_type<>'invoice' or coalesce(p_input->>'bank_confirmed','false')<>'true' or coalesce(p_input->>'amount_jpy','')!~'^[1-9][0-9]*$' or coalesce(p_input->>'refunded_on','')!~'^\d{4}-\d{2}-\d{2}$' or (p_input->>'refunded_on')::date>current_date or nullif(btrim(p_input->>'bank_reference'),'') is null or length(p_input->>'bank_reference')>500 or nullif(btrim(p_input->>'reason'),'') is null or length(p_input->>'reason')>2000 then raise exception 'Actual manual bank refund evidence required';end if;
 totals=client_payment_totals(packet.id);amount=(p_input->>'amount_jpy')::bigint;
 if amount>(totals->>'net_jpy')::bigint or (p_input->>'refunded_on')::date<(select max(received_on) from client_payment_receipts where packet_id=any(client_payment_family(packet.id))) or exists(select 1 from client_payment_receipts where bank_reference=lower(btrim(p_input->>'bank_reference'))) then raise exception 'Refund exceeds received funds or bank evidence conflicts';end if;
 result=jsonb_build_object('refund_jpy',amount::text,'net_jpy',((totals->>'net_jpy')::bigint-amount)::text,'money_transfer_executed',false);
 elsif p_operation='reserve_document_resend' then
 if not staff or not finance_packet_matches_live(packet.id) or coalesce(p_input->>'recipient_requested','false')<>'true' or nullif(btrim(p_input->>'reason'),'') is null or length(p_input->>'reason')>2000 or jsonb_typeof(p_input->'mail_payload') is distinct from 'object' or coalesce(p_input#>>'{mail_payload,pdf_sha256}','')!~'^[0-9a-f]{64}$' or nullif(p_input#>>'{mail_payload,from}','') is null or p_input#>>'{mail_payload,to}' is distinct from (select email from clients where id=packet.client_id) then raise exception 'Staff current packet and explicit recipient resend request required';end if;
 send_state=client_document_send_state(packet.id);if send_state->>'status' is distinct from 'accepted' or send_state->>'can_resend' is distinct from 'true' then raise exception 'Previous send uncertain; no resend allowed';end if;
 if not exists(select 1 from client_document_links where packet_id=packet.id and token=p_input#>>'{mail_payload,token}' and revoked_at is null and expires_at>now()) then raise exception 'Current valid link required';end if;
 result=jsonb_build_object('attempt_id',p_request_id,'previous_attempt_id',send_state->>'attempt_id','status','reserved','claimed',true);
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
 if packet.document_type<>'invoice' or (client_payment_totals(packet.id)->>'net_jpy')::bigint<client_invoice_threshold(packet.id) then raise exception 'Confirmed agreed upfront bank receipt required';end if;
 perform set_deal_simple_status(packet.deal_id,'paid','顧客合意の発注条件と必要前払着金を確認（全額入金とは別）','quote_confirmed');
 end if;result=jsonb_build_object('deal_id',packet.deal_id,'advanced',true);
 else raise exception 'Unknown finance operation';end if;
 end if;
 insert into client_finance_requests(id,created_by,operation,payload,result) values(p_request_id,auth.uid(),p_operation,p_input,result);return result;
end$$;
create or replace function public.client_finance_context(p_packet_id uuid,p_token text default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare p client_document_packets;party uuid;confirmed bigint;reports jsonb;v_decision text;totals jsonb;
begin
 select client_id into party from profiles where id=auth.uid() and role='client';
 select * into p from client_document_packets where id=p_packet_id and client_id=party and status='active';
 if auth.uid() is null or party is null or not found then raise exception 'Document unavailable';end if;
 if p_token is not null and not exists(select 1 from client_document_links where packet_id=p.id and token=p_token and revoked_at is null and expires_at>now()) then raise exception 'Link unavailable or expired';end if;
 select decision into v_decision from client_document_responses where packet_id=p.id;
 totals=client_payment_totals(p.id);confirmed=(totals->>'net_jpy')::bigint;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'amount_jpy',amount_jpy::text,'paid_on',paid_on,'status',status,'reference',reference) order by created_at),'[]') into reports from client_payment_reports where packet_id=any(client_payment_family(p.id)) and created_by=auth.uid();
 return jsonb_build_object('packet_id',p.id,'snapshot',p.snapshot,'decision',v_decision,'confirmed_jpy',confirmed::text,'payment_totals',totals,'reports',reports,'current_price',finance_packet_matches_live(p.id),'paid_in_full',p.document_type='invoice' and confirmed>=(p.snapshot->>'total')::bigint);
end$$;

create or replace function public.staff_client_finance_summary(p_deal_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare rows jsonb;
begin
 if auth.uid() is null or not is_staff() then raise exception 'Sales or administrator required';end if;
 select coalesce(jsonb_agg(jsonb_build_object('packet_id',p.id,'document_type',p.document_type,'status',p.status,'current_price',finance_packet_matches_live(p.id),'decision',(select decision from client_document_responses where packet_id=p.id),'upfront_jpy',coalesce(p.snapshot#>>'{payment_conditions,upfront_jpy}',p.snapshot->>'total'),'payment_totals',client_payment_totals(p.id),'send_state',client_document_send_state(p.id),'valid_link',exists(select 1 from client_document_links l where l.packet_id=p.id and l.revoked_at is null and l.expires_at>now())) order by p.created_at desc),'[]') into rows from client_document_packets p where p.deal_id=p_deal_id;return rows;
end$$;
revoke all on function public.staff_client_finance_summary(uuid) from public,anon;grant execute on function public.staff_client_finance_summary(uuid) to authenticated;

