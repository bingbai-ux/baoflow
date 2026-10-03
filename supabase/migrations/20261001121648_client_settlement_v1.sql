-- Local candidate: authenticated company-scoped approval/reporting, staff-only bank confirmation.
create table public.client_document_packets (
 id uuid primary key default gen_random_uuid(),document_id uuid not null unique references public.documents(id),deal_id uuid not null references public.deals(id),
 client_id uuid not null references public.clients(id),document_type text not null check(document_type in('quotation','invoice')),
 snapshot jsonb not null,approval_packet_id uuid references public.client_document_packets(id),
 status text not null default 'active' check(status in('active','superseded','cancelled')),cancel_reason text,cancelled_at timestamptz,created_by uuid not null references public.profiles(id),created_at timestamptz not null default now()
);
create table public.client_document_links (
 id uuid primary key default gen_random_uuid(),packet_id uuid not null references public.client_document_packets(id),
 token text not null unique default(replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','')),
 expires_at timestamptz not null default now()+interval '7 days',revoked_at timestamptz,
 created_by uuid not null references public.profiles(id),created_at timestamptz not null default now()
);
create table public.client_document_responses (
 packet_id uuid primary key references public.client_document_packets(id),decision text not null check(decision in('approved','revision_requested')),
 note text not null,created_by uuid not null references public.profiles(id),created_at timestamptz not null default now()
);
create table public.client_payment_reports (
 id uuid primary key default gen_random_uuid(),packet_id uuid not null references public.client_document_packets(id),
 created_by uuid not null references public.profiles(id),amount_jpy bigint not null check(amount_jpy>0),paid_on date not null,reference text not null,
 status text not null default 'pending' check(status in('pending','confirmed','rejected')),review_note text,created_at timestamptz not null default now(),
 unique(packet_id,created_by,amount_jpy,paid_on,reference)
);
create table public.client_payment_receipts (
 id uuid primary key default gen_random_uuid(),report_id uuid not null references public.client_payment_reports(id),packet_id uuid not null references public.client_document_packets(id),
 amount_jpy bigint not null check(amount_jpy>0),received_on date not null,bank_reference text not null unique,
 confirmed_by uuid not null references public.profiles(id),created_at timestamptz not null default now()
);
create table public.client_finance_requests (
 id uuid primary key,created_by uuid not null references public.profiles(id),operation text not null,payload jsonb not null,result jsonb not null,created_at timestamptz not null default now()
);
create table public.client_document_mail_receipts (
 packet_id uuid primary key references public.client_document_packets(id),attempt_id uuid not null default gen_random_uuid(),
 payload jsonb not null,status text not null default 'attempting' check(status in('attempting','accepted','unknown','rejected')),
 created_by uuid not null references public.profiles(id),provider_id text,created_at timestamptz not null default now(),finished_at timestamptz
);
create index client_packets_party on public.client_document_packets(client_id,deal_id);
create index client_links_packet on public.client_document_links(packet_id);
create index client_reports_pending on public.client_payment_reports(status,created_at);
create index client_receipts_packet on public.client_payment_receipts(packet_id);
create index client_receipts_report on public.client_payment_receipts(report_id);
do $$declare t text;begin
 foreach t in array array['client_document_packets','client_document_links','client_document_responses','client_payment_reports','client_payment_receipts','client_finance_requests','client_document_mail_receipts'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);
 execute format('create policy staff_read on public.%I for select to authenticated using ((select is_staff())%s)',t,case when t='client_finance_requests' then ' and created_by=(select auth.uid())' else '' end);
 end loop;
end$$;
create policy client_own_packet on public.client_document_packets for select to authenticated using(exists(select 1 from profiles where id=auth.uid() and role='client' and client_id=client_document_packets.client_id));
create policy client_request_owner on public.client_finance_requests for select to authenticated using(created_by=auth.uid() and operation in('respond_quote','report_payment') and exists(select 1 from profiles pr join client_document_packets p on p.client_id=pr.client_id where pr.id=auth.uid() and pr.role='client' and p.id::text=client_finance_requests.payload->>'packet_id'));
create policy client_own_report on public.client_payment_reports for select to authenticated using(created_by=auth.uid() and exists(select 1 from profiles pr join client_document_packets p on p.client_id=pr.client_id where pr.id=auth.uid() and pr.role='client' and p.id=client_payment_reports.packet_id));

-- Strict public projection of a previously issued snapshot. No factory price/cost ledger.
create function public.preview_client_document(p_document_id uuid,p_approval_packet_id uuid default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare d documents;s jsonb;party uuid;lines jsonb;gross numeric;net numeric;q jsonb;a client_document_packets;company jsonb;banks jsonb;
begin
 if auth.uid() is null or not is_staff() then raise exception 'Sales or administrator required';end if;
 select * into d from documents where id=p_document_id;if not found or d.document_type::text not in('quotation','invoice') then raise exception 'Issued quotation or invoice required';end if;
 s=d.metadata->'snapshot';select client_id into party from deals where id=d.deal_id and archived_at is null;
 if party is null or s#>>'{deal,client_id}' is distinct from party::text then raise exception 'Frozen customer identity required; reissue legacy document';end if;
 if jsonb_typeof(s->'quotes') is distinct from 'array' or jsonb_typeof(s->'products') is distinct from 'array' or jsonb_typeof(s->'variants') is distinct from 'array' or jsonb_typeof(s->'fees') is distinct from 'array' or jsonb_array_length(s->'fees')<>0 then raise exception 'Confirmed allocated costs required';end if;
 lines='[]';gross=0;net=0;
 for q in select value from jsonb_array_elements(s->'quotes') where value->>'status'='approved' order by value->>'id' loop
 if nullif(q->>'variant_id','') is null or not exists(select 1 from jsonb_array_elements(s->'variants') v join jsonb_array_elements(s->'products') p on p->>'id'=v->>'product_id' where v->>'id'=q->>'variant_id') then raise exception 'Frozen product specification binding required';end if;
 if coalesce(q->>'quantity','')!~'^[1-9][0-9]*$' or coalesce(q->>'selling_price_jpy','')!~'^[0-9]+([.][0-9]+)?$' or coalesce(q->>'total_billing_jpy','')!~'^[0-9]+([.][0-9]+)?$' or coalesce(q->>'total_billing_tax_jpy','')!~'^[0-9]+([.][0-9]+)?$' then raise exception 'Confirmed saved net and gross required';end if;
 if (q->>'total_billing_tax_jpy')::numeric<(q->>'total_billing_jpy')::numeric then raise exception 'Invalid saved tax';end if;
 lines=lines||jsonb_build_array(jsonb_build_object('quote_id',q->>'id','variant_id',q->>'variant_id','quantity',q->>'quantity','unit_jpy',q->>'selling_price_jpy','net',q->>'total_billing_jpy','gross',q->>'total_billing_tax_jpy',
 'name',coalesce((select p->>'description' from jsonb_array_elements(s->'products') p join jsonb_array_elements(s->'variants') v on v->>'product_id'=p->>'id' where v->>'id'=q->>'variant_id' limit 1),'商品'),
 'variant',coalesce((select v->>'variant_label' from jsonb_array_elements(s->'variants') v where v->>'id'=q->>'variant_id' limit 1),'旧仕様')));
 gross=gross+(q->>'total_billing_tax_jpy')::numeric;net=net+(q->>'total_billing_jpy')::numeric;
 end loop;
 if jsonb_array_length(lines)=0 or gross<=0 or gross>9007199254740991 or gross<>trunc(gross) then raise exception 'Positive integer invoice amount required';end if;
 if d.document_type::text='invoice' then
 select * into a from client_document_packets where id=p_approval_packet_id and status='active' and document_type='quotation' and deal_id=d.deal_id and client_id=party;
 if not found or not finance_packet_matches_live(a.id) or not exists(select 1 from client_document_responses where packet_id=a.id and decision='approved') or a.snapshot->'lines'<>lines or a.snapshot->>'total'<>gross::text then raise exception 'Current customer approval for this price required';end if;
 if d.issued_at<(select created_at from client_document_responses where packet_id=a.id) then raise exception 'Issue invoice after customer approval';end if;
 if coalesce(d.metadata->>'payment_due_date','')!~'^\d{4}-\d{2}-\d{2}$' then raise exception 'Frozen payment due date required';end if;
 end if;
 company=jsonb_build_object('name',s#>>'{company,name}','address',s#>>'{company,address}','registration_number',s#>>'{company,registration_number}');
 if nullif(company->>'name','') is null then raise exception 'Frozen issuer required';end if;
 select coalesce(jsonb_agg(jsonb_build_object('bank_name',b->>'bank_name','branch_name',b->>'branch_name','account_type',b->>'account_type','account_number',b->>'account_number','account_holder',b->>'account_holder','swift_code',b->>'swift_code')),'[]') into banks from jsonb_array_elements(coalesce(s->'banks','[]')) b;
 return jsonb_build_object('schema_version',1,'document_id',d.id,'type',d.document_type,'number',d.document_number,'version',d.version,'deal_id',d.deal_id,'client_id',party,
 'customer_name',s#>>'{deal,client_name_text}','deal_name',s#>>'{deal,deal_name}','deal_code',s#>>'{deal,deal_code}','issued_at',d.issued_at,
 'due_date',d.metadata->>'payment_due_date','notes',d.metadata->>'notes','lines',lines,'subtotal',net::text,'tax',(gross-net)::text,'total',gross::text,'company',company,'banks',case when d.document_type::text='invoice' then banks else '[]'::jsonb end);
end$$;

-- Token only narrows an authenticated company's access; it never authenticates a bearer.
create function public.client_finance_context(p_packet_id uuid,p_token text default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare p client_document_packets;party uuid;confirmed bigint;reports jsonb;v_decision text;
begin
 select client_id into party from profiles where id=auth.uid() and role='client';
 select * into p from client_document_packets where id=p_packet_id and client_id=party and status='active';
 if auth.uid() is null or party is null or not found then raise exception 'Document unavailable';end if;
 if p_token is not null and not exists(select 1 from client_document_links where packet_id=p.id and token=p_token and revoked_at is null and expires_at>now()) then raise exception 'Link unavailable or expired';end if;
 select decision into v_decision from client_document_responses where packet_id=p.id;
 select coalesce(sum(amount_jpy),0) into confirmed from client_payment_receipts where packet_id=p.id;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'amount_jpy',amount_jpy::text,'paid_on',paid_on,'status',status,'reference',reference) order by created_at),'[]') into reports from client_payment_reports where packet_id=p.id and created_by=auth.uid();
 return jsonb_build_object('packet_id',p.id,'snapshot',p.snapshot,'decision',v_decision,'confirmed_jpy',confirmed::text,'reports',reports,'paid_in_full',p.document_type='invoice' and confirmed>=(p.snapshot->>'total')::bigint);
end$$;

create function public.client_finance_command(p_request_id uuid,p_operation text,p_input jsonb) returns jsonb
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
 if packet.document_type<>'invoice' or (select coalesce(sum(amount_jpy),0) from client_payment_receipts where packet_id=packet.id)<(packet.snapshot->>'total')::bigint then raise exception 'Confirmed full bank receipt required';end if;
 perform set_deal_simple_status(packet.deal_id,'paid','BAO実着金台帳を確認','quote_confirmed');
 end if;result=jsonb_build_object('deal_id',packet.deal_id,'advanced',true);
 else raise exception 'Unknown finance operation';end if;
 end if;
 insert into client_finance_requests(id,created_by,operation,payload,result) values(p_request_id,auth.uid(),p_operation,p_input,result);return result;
end$$;
revoke all on function public.preview_client_document(uuid,uuid),public.client_finance_context(uuid,text),public.client_finance_command(uuid,text,jsonb) from public,anon;
grant execute on function public.preview_client_document(uuid,uuid),public.client_finance_context(uuid,text),public.client_finance_command(uuid,text,jsonb) to authenticated;

create function public.finance_packet_matches_live(p_packet_id uuid) returns boolean language sql security definer set search_path=public,pg_temp as $$
 select exists(select 1 from client_document_packets p join deals d on d.id=p.deal_id and d.client_id=p.client_id and d.archived_at is null
 where p.id=p_packet_id and p.status='active'
 and jsonb_array_length(p.snapshot->'lines')=(select count(*) from deal_quotes where deal_id=p.deal_id and status='approved')
 and not exists(select 1 from jsonb_array_elements(p.snapshot->'lines') l left join deal_quotes q on q.id::text=l->>'quote_id' and q.deal_id=p.deal_id and q.status='approved'
 where q.id is null or q.variant_id::text is distinct from l->>'variant_id' or q.quantity::numeric is distinct from (l->>'quantity')::numeric or q.selling_price_jpy is distinct from (l->>'unit_jpy')::numeric or q.total_billing_jpy is distinct from (l->>'net')::numeric or q.total_billing_tax_jpy is distinct from (l->>'gross')::numeric))
$$;
revoke all on function public.finance_packet_matches_live(uuid) from public,anon,authenticated;
create function public.guard_finance_progress() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.simple_status=old.simple_status or new.simple_status::text not in('quote_confirmed','paid') or not exists(select 1 from client_document_packets where deal_id=new.id) then return new;end if;
 if new.simple_status::text='quote_confirmed' then
 if not exists(select 1 from client_document_packets p join client_document_responses r on r.packet_id=p.id and r.decision='approved' where p.deal_id=new.id and p.document_type='quotation' and finance_packet_matches_live(p.id)) then raise exception 'Customer approval of current price required';end if;
 else
 if not exists(select 1 from client_document_packets p join client_document_packets a on a.id=p.approval_packet_id and a.status='active' join client_document_responses r on r.packet_id=a.id and r.decision='approved'
 where p.deal_id=new.id and p.document_type='invoice' and finance_packet_matches_live(p.id) and (select coalesce(sum(amount_jpy),0) from client_payment_receipts where packet_id=p.id)>=(p.snapshot->>'total')::bigint) then raise exception 'BAO confirmed full bank receipt required';end if;
 end if;return new;
end$$;
revoke all on function public.guard_finance_progress() from public,anon,authenticated;
create trigger guard_finance_progress before update of simple_status on public.deals for each row execute function public.guard_finance_progress();
create function public.guard_client_invoice_issue() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.document_type::text='invoice' and exists(select 1 from client_document_packets where deal_id=new.deal_id and document_type='quotation')
 and not exists(select 1 from client_document_packets p join client_document_responses r on r.packet_id=p.id and r.decision='approved' where p.deal_id=new.deal_id and p.document_type='quotation' and finance_packet_matches_live(p.id)) then raise exception 'Issue invoice after current customer approval';end if;
 return new;
end$$;
revoke all on function public.guard_client_invoice_issue() from public,anon,authenticated;
create trigger guard_client_invoice_issue before insert on public.documents for each row execute function public.guard_client_invoice_issue();

create function public.keep_client_finance_record() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if tg_op='DELETE' then raise exception 'Client finance history immutable';end if;
 if tg_table_name='client_document_packets' then
 if old.status<>'active' or new.status not in('cancelled','superseded') or (to_jsonb(new)-array['status','cancel_reason','cancelled_at'])<>(to_jsonb(old)-array['status','cancel_reason','cancelled_at']) then raise exception 'Published packet immutable';end if;
 elsif tg_table_name='client_document_links' then
 if old.revoked_at is not null or new.revoked_at is null or (to_jsonb(new)-'revoked_at')<>(to_jsonb(old)-'revoked_at') then raise exception 'Client link immutable';end if;
 elsif tg_table_name='client_payment_reports' then
 if old.status<>'pending' or new.status not in('confirmed','rejected') or (to_jsonb(new)-array['status','review_note'])<>(to_jsonb(old)-array['status','review_note']) then raise exception 'Payment report immutable';end if;
 else raise exception 'Client finance history immutable';end if;return new;
end$$;
revoke all on function public.keep_client_finance_record() from public,anon,authenticated;
do $$declare t text;begin foreach t in array array['client_document_packets','client_document_links','client_document_responses','client_payment_reports','client_payment_receipts','client_finance_requests'] loop
 execute format('create trigger keep_client_finance_record before update or delete on public.%I for each row execute function public.keep_client_finance_record()',t);end loop;end$$;
create function public.keep_shared_document() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin if exists(select 1 from client_document_packets where document_id=old.id) then raise exception 'Shared document immutable';end if;if tg_op='DELETE' then return old;end if;return new;end$$;
revoke all on function public.keep_shared_document() from public,anon,authenticated;
create trigger keep_shared_document before update or delete on public.documents for each row execute function public.keep_shared_document();

-- One permanent provider attempt per published packet. Resend is never inferred safe
-- from elapsed time, provider failure, or a failed result-save transaction.
create function public.claim_client_document_email(p_packet_id uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare p client_document_packets;r client_document_mail_receipts;
begin
 if auth.uid() is null or not is_staff() then raise exception 'Sales or administrator required';end if;
 select * into p from client_document_packets where id=p_packet_id for update;
 if not found or p.status<>'active' then raise exception 'Active packet required';end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or length(p_payload::text)>300000 or coalesce(p_payload->>'pdf_sha256','')!~'^[0-9a-f]{64}$' or nullif(p_payload->>'from','') is null or nullif(p_payload->>'to','') is null then raise exception 'Frozen mail payload required';end if;
 if not exists(select 1 from client_document_links where packet_id=p.id and token=p_payload->>'token' and revoked_at is null and expires_at>now()) then raise exception 'Link unavailable or expired';end if;
 select * into r from client_document_mail_receipts where packet_id=p.id;
 if found then return jsonb_build_object('claimed',false,'status',r.status);end if;
 insert into client_document_mail_receipts(packet_id,payload,created_by) values(p.id,p_payload,auth.uid()) returning * into r;
 return jsonb_build_object('claimed',true,'attempt_id',r.attempt_id);
end$$;
create function public.finish_client_document_email(p_packet_id uuid,p_attempt_id uuid,p_status text,p_provider_id text default null) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not is_staff() then raise exception 'Sales or administrator required';end if;
 if p_status not in('accepted','unknown','rejected') or (p_status='accepted' and nullif(p_provider_id,'') is null) then raise exception 'Valid provider outcome required';end if;
 update client_document_mail_receipts set status=p_status,provider_id=p_provider_id,finished_at=now() where packet_id=p_packet_id and attempt_id=p_attempt_id and created_by=auth.uid() and status='attempting';
 if not found then raise exception 'Mail attempt mismatch or already finished';end if;
end$$;
revoke all on function public.claim_client_document_email(uuid,jsonb),public.finish_client_document_email(uuid,uuid,text,text) from public,anon;
grant execute on function public.claim_client_document_email(uuid,jsonb),public.finish_client_document_email(uuid,uuid,text,text) to authenticated;
