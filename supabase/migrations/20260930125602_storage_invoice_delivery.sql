-- 051 LOCAL CANDIDATE. New billing/delivery RLS changes require separate production review.
-- Existing bills/files/data remain unchanged; no automatic historical stock reconstruction.
alter table public.storage_billing add column snapshot jsonb;
alter table public.storage_billing add column request_id uuid unique;
alter table public.storage_billing add column created_by uuid references public.profiles(id);
create unique index storage_billing_client_month_unique on public.storage_billing(client_id,billing_month)
 where client_id is not null and billing_month is not null;
revoke insert,update,delete,truncate on public.storage_billing from public,anon,authenticated;
grant select on public.storage_billing to authenticated;
create policy client_storage_bill_read on public.storage_billing for select to authenticated
 using (client_id=public.my_client_id() and public.current_app_role()='client');
create policy client_storage_document_read on public.documents for select to authenticated using (
 document_type='storage_invoice' and exists(select 1 from public.storage_billing b
 where b.invoice_document_id=documents.id and b.client_id=public.my_client_id() and public.current_app_role()='client')
);

create table public.document_email_receipts (
 document_id uuid primary key references public.documents(id),
 actor_id uuid not null references public.profiles(id), attempt_id uuid not null unique,
 status text not null check(status in ('attempting','accepted','unknown','rejected')),
 provider_message_id text, started_at timestamptz not null default now(), finished_at timestamptz
);
alter table public.document_email_receipts enable row level security;
revoke all on public.document_email_receipts from public,anon,authenticated;
grant select on public.document_email_receipts to authenticated;
create policy staff_read on public.document_email_receipts for select to authenticated using(public.is_staff());

create function public.issue_storage_invoice(p_request_id uuid,p_client_id uuid,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.clients; b public.storage_billing; doc public.documents; issuer jsonb; snap jsonb;
 v_month text; v_issue date; v_due date; amount numeric; tax numeric; total numeric; prefix text; seq bigint; existing_max bigint;
 key text; num numeric;
begin
 if auth.uid() is null or not coalesce(public.is_staff(),false) then raise exception 'Sales or administrator access required'; end if;
 if p_request_id is null or p_client_id is null or jsonb_typeof(p_input) is distinct from 'object' then raise exception 'Invalid invoice request'; end if;
 perform pg_advisory_xact_lock(hashtextextended('storage_invoice:'||p_client_id::text||':'||(p_input->>'month'),0));
 select * into b from public.storage_billing where request_id=p_request_id;
 if found then
  if b.client_id is distinct from p_client_id or b.snapshot->'input' is distinct from p_input then raise exception 'Request ID used with different input'; end if;
  return to_jsonb(b);
 end if;
 select * into c from public.clients where id=p_client_id for share;
 if not found then raise exception 'Client not found'; end if;
 v_month:=p_input->>'month';
 if coalesce(v_month,'')!~'^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'Invalid billing month'; end if;
 v_issue:=(p_input->>'issue_date')::date;v_due:=(p_input->>'due_date')::date;
 if v_issue is null or v_due is null or v_due<v_issue or v_issue>(now() at time zone 'Asia/Tokyo')::date
  or v_month>to_char(v_issue,'YYYY-MM') then raise exception 'Invalid invoice dates'; end if;
 if p_input->'confirmed' is distinct from 'true'::jsonb or coalesce(length(trim(p_input->>'basis')),0) not between 1 and 500
  or coalesce(p_input->>'method','') not in ('end_of_month','mid_month_avg') then raise exception 'Confirmed warehouse billing basis required'; end if;
 if coalesce(p_input->>'recipient','')!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  or length(p_input->>'recipient')>254 or coalesce(length(trim(p_input->>'payment_details')),0) not between 1 and 500 then raise exception 'Recipient and payment details required'; end if;
 foreach key in array array['cartons','monthly_rate','in_count','in_rate','out_count','out_rate','tax_rate'] loop
  if jsonb_typeof(p_input->key) is distinct from 'number' or coalesce(p_input->>key,'')!~'^[0-9]+(\.[0-9]{1,4})?$' then raise exception 'Invalid nonnegative billing number'; end if;
  num:=(p_input->>key)::numeric;
  if num>1000000000 or (key in ('in_count','out_count') and num<>trunc(num)) or (key='tax_rate' and num>100)
   or (key='cartons' and p_input->>'method'='end_of_month' and num<>trunc(num)) then raise exception 'Billing number out of range'; end if;
 end loop;
 if exists(select 1 from public.storage_billing where client_id=p_client_id and billing_month=v_month) then raise exception 'Invoice already exists for client month'; end if;
 select case when nullif(company_info_phase1->>'name','') is not null then company_info_phase1 else company_info end into issuer from public.system_settings limit 1;
 if nullif(issuer->>'name','') is null then raise exception 'Configure invoice issuer before issuance'; end if;
 -- Customer-visible snapshot contains invoice identity fields, never arbitrary settings keys.
 issuer:=jsonb_build_object('name',issuer->'name','address',issuer->'address','phone',issuer->'phone','registration_number',issuer->'registration_number');
 amount:=floor((p_input->>'cartons')::numeric*(p_input->>'monthly_rate')::numeric)
  +floor((p_input->>'in_count')::numeric*(p_input->>'in_rate')::numeric)+floor((p_input->>'out_count')::numeric*(p_input->>'out_rate')::numeric);
 tax:=floor(amount*(p_input->>'tax_rate')::numeric/100);total:=amount+tax;
 if total>9000000000000 then raise exception 'Invoice amount out of range'; end if;
 prefix:='STI-'||to_char(v_issue,'YYYYMM')||'-';
 perform pg_advisory_xact_lock(hashtextextended(prefix,0));
 select coalesce(max(substring(document_number from length(prefix)+1)::bigint),0) into existing_max from public.documents
  where document_number ~ ('^'||prefix||'[0-9]{1,15}$');
 insert into public.document_number_counters(prefix,last_value) values(prefix,existing_max+1)
 on conflict on constraint document_number_counters_pkey do update set last_value=greatest(document_number_counters.last_value,existing_max)+1 returning last_value into seq;
 snap:=jsonb_build_object('version',1,'input',p_input,'client',jsonb_build_object('id',c.id,'name',c.company_name,'address',c.address),
  'issuer',issuer,'subtotal',amount,'tax',tax,'total',total,'currency','JPY','created_at',now(),'confirmed_by',auth.uid(),
  'document_number',prefix||lpad(seq::text,greatest(3,length(seq::text)),'0'));
 insert into public.documents(document_type,document_number,version,metadata,issued_at,issued_by_user_id)
 values('storage_invoice',prefix||lpad(seq::text,greatest(3,length(seq::text)),'0'),1,jsonb_build_object('snapshot',snap,'snapshot_version',1,'client_id',c.id),now(),auth.uid()) returning * into doc;
 insert into public.storage_billing(client_id,billing_month,storage_fee,handling_fee_in,handling_fee_out,total_amount,invoice_document_id,status,snapshot,request_id,created_by)
 values(c.id,v_month,floor((p_input->>'cartons')::numeric*(p_input->>'monthly_rate')::numeric),floor((p_input->>'in_count')::numeric*(p_input->>'in_rate')::numeric),floor((p_input->>'out_count')::numeric*(p_input->>'out_rate')::numeric),total,doc.id,'invoiced',snap,p_request_id,auth.uid()) returning * into b;
 return to_jsonb(b);
end $$;

create function public.claim_storage_invoice_email(p_document_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.storage_billing;r public.document_email_receipts;
begin
 if auth.uid() is null or not coalesce(public.is_staff(),false) then raise exception 'Sales or administrator access required'; end if;
 select * into b from public.storage_billing where invoice_document_id=p_document_id for update;
 if not found or b.snapshot is null then raise exception 'Issued storage invoice required'; end if;
 select * into r from public.document_email_receipts where document_id=p_document_id;
 if found then return jsonb_build_object('claimed',false,'status',r.status); end if;
 insert into public.document_email_receipts(document_id,actor_id,attempt_id,status) values(p_document_id,auth.uid(),gen_random_uuid(),'attempting') returning * into r;
 return jsonb_build_object('claimed',true,'attemptId',r.attempt_id);
end $$;
create function public.finish_storage_invoice_email(p_document_id uuid,p_attempt_id uuid,p_status text,p_provider_id text default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.document_email_receipts;
begin
 if auth.uid() is null or not coalesce(public.is_staff(),false) then raise exception 'Sales or administrator access required'; end if;
 select * into r from public.document_email_receipts where document_id=p_document_id for update;
 if not found or r.actor_id<>auth.uid() or r.attempt_id<>p_attempt_id then raise exception 'Email attempt ownership mismatch'; end if;
 if r.status='accepted' then return; end if;
 if p_status not in ('accepted','unknown','rejected') or (p_status='accepted' and coalesce(length(p_provider_id),0) not between 1 and 300) then raise exception 'Invalid provider receipt'; end if;
 update public.document_email_receipts set status=p_status,provider_message_id=case when p_status='accepted' then p_provider_id end,finished_at=now() where document_id=p_document_id;
end $$;
revoke all on function public.issue_storage_invoice(uuid,uuid,jsonb),public.claim_storage_invoice_email(uuid),public.finish_storage_invoice_email(uuid,uuid,text,text) from public,anon;
grant execute on function public.issue_storage_invoice(uuid,uuid,jsonb),public.claim_storage_invoice_email(uuid),public.finish_storage_invoice_email(uuid,uuid,text,text) to authenticated;
-- Rollback/incident: stop issuance/sending actions, retain invoices/numbers/receipts;
-- never reopen permanent email claims or overwrite an issued invoice snapshot.
