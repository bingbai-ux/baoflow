-- Local candidate only: independent samples; no changes to legacy samples/quotes.
create table public.sample_rounds (
 id uuid primary key default gen_random_uuid(), deal_id uuid not null references public.deals(id),
 product_id uuid not null references public.deal_products(id), variant_id uuid not null references public.deal_product_variants(id),
 factory_id uuid not null references public.factories(id), round_number integer not null check(round_number>0),
 quantity integer not null check(quantity>0), due_date date not null, note text not null,
 status text not null default 'requested' check(status in ('requested','manufacturing','shipping','arrived','approved','revision_requested')),
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),
 unique(deal_id,round_number)
);
create table public.sample_estimates (
 id uuid primary key default gen_random_uuid(),round_id uuid not null references public.sample_rounds(id),
 kind text not null check(kind in ('manufacturing','plate','shipping')),carrier text,
 amount numeric not null check(amount>=0 and amount<1000000000),currency text not null check(currency in ('USD','JPY')),
 basis text not null,created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),
 check((kind='shipping' and carrier in ('UPS','FedEx')) or (kind<>'shipping' and carrier is null))
);
create table public.sample_costs (
 id uuid primary key default gen_random_uuid(), round_id uuid not null references public.sample_rounds(id),
 kind text not null check(kind in ('manufacturing','plate','shipping')), carrier text,
 estimate numeric check(estimate>=0 and estimate<1000000000), amount numeric not null check(amount>=0 and amount<1000000000),
 currency text not null check(currency in ('USD','JPY')), fx jsonb,
 customer_charge_jpy bigint not null check(customer_charge_jpy>=0 and customer_charge_jpy<1000000000),
 basis text not null, confirmed_by uuid not null references public.profiles(id), confirmed_at timestamptz not null default now(),
 voided_at timestamptz,void_reason text,
 check((kind='shipping' and carrier in ('UPS','FedEx')) or (kind<>'shipping' and carrier is null))
);
create table public.sample_payments (
 id uuid primary key default gen_random_uuid(), round_id uuid not null references public.sample_rounds(id),
 amount numeric not null check(amount>0 and amount<1000000000), currency text not null check(currency in ('USD','JPY')),
 paid_on date not null, reference text not null, created_by uuid not null references public.profiles(id),created_at timestamptz not null default now()
);
create table public.sample_invoices (
 id uuid primary key default gen_random_uuid(), deal_id uuid not null references public.deals(id), document_number text not null unique,
 snapshot jsonb not null, status text not null default 'issued' check(status in ('issued','cancelled')),
 previous_invoice_id uuid references public.sample_invoices(id), cancellation_reason text, cancelled_at timestamptz,
 created_by uuid not null references public.profiles(id),created_at timestamptz not null default now()
);
create table public.sample_invoice_lines (
 id uuid primary key default gen_random_uuid(),invoice_id uuid not null references public.sample_invoices(id),
 cost_id uuid not null references public.sample_costs(id),released_at timestamptz, unique(invoice_id,cost_id)
);
create unique index sample_one_active_billing on public.sample_invoice_lines(cost_id) where released_at is null;
create table public.sample_requests (
 id uuid primary key,created_by uuid not null references public.profiles(id),deal_id uuid not null references public.deals(id),
 operation text not null,payload jsonb not null,result jsonb not null,created_at timestamptz not null default now()
);
create table public.sample_mail_receipts (
 invoice_id uuid primary key references public.sample_invoices(id),attempt_id uuid not null default gen_random_uuid(),
 created_by uuid not null references public.profiles(id),payload jsonb not null,
 status text not null default 'attempting' check(status in ('attempting','accepted','unknown','rejected')),
 provider_id text,created_at timestamptz not null default now(),finished_at timestamptz
);
create index sample_rounds_deal on public.sample_rounds(deal_id);
create index sample_costs_round on public.sample_costs(round_id);
create index sample_estimates_round on public.sample_estimates(round_id);
create index sample_payments_round on public.sample_payments(round_id);
create index sample_invoices_deal on public.sample_invoices(deal_id);
create index sample_invoice_lines_invoice on public.sample_invoice_lines(invoice_id);
create index sample_requests_actor on public.sample_requests(created_by,deal_id);
do $$declare t text;begin
 foreach t in array array['sample_rounds','sample_estimates','sample_costs','sample_payments','sample_invoices','sample_invoice_lines','sample_requests','sample_mail_receipts'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy staff_read on public.%I for select to authenticated using ((select public.is_staff())%s)',t,case when t='sample_requests' then ' and created_by=(select auth.uid())' else '' end);
 end loop;
end$$;

-- Preview does not create invoice numbers, tokens, drafts, or reservations.
create function public.preview_sample_invoice(p_deal_id uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare n integer;lines jsonb;subtotal numeric;tax numeric;rate numeric;d record;issuer jsonb;
begin
 if auth.uid() is null or not is_staff() then raise exception 'Sales or administrator required';end if;
 select id,deal_code,deal_name,client_name_text,archived_at into d from deals where id=p_deal_id;
 if not found or d.archived_at is not null then raise exception 'Active deal required';end if;
 if nullif(btrim(d.client_name_text),'') is null then raise exception 'Customer required';end if;
 select company_info_phase1 into issuer from system_settings limit 1;
 if nullif(btrim(issuer->>'name'),'') is null then raise exception 'Invoice issuer required';end if;
 if jsonb_typeof(p_input->'cost_ids') is distinct from 'array' then raise exception 'Select confirmed costs';end if;
 n=jsonb_array_length(p_input->'cost_ids');
 if n<1 or n>100 or n<>(select count(distinct value) from jsonb_array_elements_text(p_input->'cost_ids')) then raise exception 'Unique costs required';end if;
 if coalesce(p_input->>'tax_rate','')!~'^[0-9]+([.][0-9]+)?$' then raise exception 'Confirmed tax required';end if;
 rate=(p_input->>'tax_rate')::numeric;if rate>100 then raise exception 'Invalid tax';end if;
 if coalesce(p_input->>'issue_date','')!~'^\d{4}-\d{2}-\d{2}$' or coalesce(p_input->>'due_date','')!~'^\d{4}-\d{2}-\d{2}$'
 or (p_input->>'due_date')::date<(p_input->>'issue_date')::date then raise exception 'Invoice dates required';end if;
 if nullif(btrim(p_input->>'payment_details'),'') is null or length(p_input->>'payment_details')>2000 then raise exception 'Payment details required';end if;
 select jsonb_agg(jsonb_build_object('cost_id',c.id,'round_number',r.round_number,'quantity',r.quantity,'product_id',r.product_id,'variant_id',r.variant_id,
 'product_description',p.description,'variant_label',v.variant_label,'kind',c.kind,'carrier',c.carrier,'amount',c.amount::text,'currency',c.currency,'customer_charge_jpy',c.customer_charge_jpy::text,'basis',c.basis,'fx',c.fx) order by r.round_number,c.kind,c.id),sum(c.customer_charge_jpy)
 into lines,subtotal from sample_costs c join sample_rounds r on r.id=c.round_id join deal_products p on p.id=r.product_id join deal_product_variants v on v.id=r.variant_id
 where c.id in(select value::uuid from jsonb_array_elements_text(p_input->'cost_ids')) and r.deal_id=p_deal_id and p.deal_id=p_deal_id and v.product_id=p.id
 and c.voided_at is null and not exists(select 1 from sample_invoice_lines l where l.cost_id=c.id and l.released_at is null);
 if coalesce(jsonb_array_length(lines),0)<>n then raise exception 'Costs already billed or not in deal';end if;
 tax=ceil(subtotal*rate/100);if subtotal+tax>9007199254740991 then raise exception 'Amount too large';end if;
 return jsonb_build_object('schema_version',1,'deal_id',d.id,'deal_code',d.deal_code,'deal_name',d.deal_name,'customer_name',d.client_name_text,
 'issue_date',p_input->>'issue_date','due_date',p_input->>'due_date','payment_details',p_input->>'payment_details','tax_rate',rate::text,
 'lines',lines,'issuer',issuer,'subtotal',subtotal::text,'tax',tax::text,'total',(subtotal+tax)::text,'rounding','JPY_TAX_CEIL','manufacturing_price_included',false);
end$$;

-- Narrow atomic writer. Direct table writes stay unavailable to application roles.
create function public.sample_command(p_request_id uuid,p_deal_id uuid,p_operation text,p_input jsonb,p_expected jsonb default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare previous sample_requests;result jsonb;payload jsonb;rid uuid;roundrow sample_rounds;inv sample_invoices;
 next_round integer;amount numeric;charge numeric;fxrate numeric;preview jsonb;v_invoice_id uuid;number text;
begin
 if auth.uid() is null or not is_staff() then raise exception 'Sales or administrator required';end if;
 if p_request_id is null or jsonb_typeof(p_input) is distinct from 'object' or length(p_input::text)>300000 then raise exception 'Request and bounded object input required';end if;
 payload=jsonb_build_object('input',p_input,'expected',p_expected);
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select * into previous from sample_requests where id=p_request_id;
 if found then
 if previous.created_by<>auth.uid() or previous.deal_id<>p_deal_id or previous.operation<>p_operation or previous.payload<>payload then raise exception 'Request has different input';end if;
 return previous.result;end if;
 perform 1 from deals where id=p_deal_id and archived_at is null for update;
 if not found then raise exception 'Active deal required';end if;
 if p_operation='create_round' then
 if not exists(select 1 from deal_products p join deal_product_variants v on v.product_id=p.id where p.id=(p_input->>'product_id')::uuid and v.id=(p_input->>'variant_id')::uuid and p.deal_id=p_deal_id)
 or not exists(select 1 from factories where id=(p_input->>'factory_id')::uuid) then raise exception 'Product variant and factory required';end if;
 if coalesce(p_input->>'quantity','')!~'^[1-9][0-9]*$' or coalesce(p_input->>'due_date','')!~'^\d{4}-\d{2}-\d{2}$' or length(coalesce(p_input->>'note',''))>2000 then raise exception 'Quantity and due date required';end if;
 select greatest(coalesce(max(round_number),0),coalesce((select max(round_number) from deal_samples where deal_id=p_deal_id),0))+1 into next_round from sample_rounds where deal_id=p_deal_id;
 insert into sample_rounds(deal_id,product_id,variant_id,factory_id,round_number,quantity,due_date,note,created_by)
 values(p_deal_id,(p_input->>'product_id')::uuid,(p_input->>'variant_id')::uuid,(p_input->>'factory_id')::uuid,next_round,(p_input->>'quantity')::integer,(p_input->>'due_date')::date,coalesce(p_input->>'note',''),auth.uid()) returning id into rid;
 result=jsonb_build_object('id',rid,'round_number',next_round);
 elsif p_operation in('add_cost','record_estimate','record_payment','set_status') then
 select * into roundrow from sample_rounds where id=(p_input->>'round_id')::uuid and deal_id=p_deal_id for update;
 if not found then raise exception 'Round not in deal';end if;
 if p_operation='set_status' then
 if not ((roundrow.status='requested' and p_input->>'status'='manufacturing') or (roundrow.status='manufacturing' and p_input->>'status'='shipping') or (roundrow.status='shipping' and p_input->>'status'='arrived') or (roundrow.status='arrived' and p_input->>'status' in('approved','revision_requested'))) then raise exception 'Invalid sample transition';end if;
 update sample_rounds set status=p_input->>'status' where id=roundrow.id;result=jsonb_build_object('id',roundrow.id,'status',p_input->>'status');
 else
 if coalesce(p_input->>'amount','')!~'^[0-9]+([.][0-9]+)?$' or coalesce(p_input->>'currency','') not in('USD','JPY') then raise exception 'Confirmed amount and currency required';end if;
 amount=(p_input->>'amount')::numeric;
 if p_operation='record_estimate' then
 if nullif(btrim(p_input->>'basis'),'') is null or length(p_input->>'basis')>2000 then raise exception 'Estimate basis required';end if;
 insert into sample_estimates(round_id,kind,carrier,amount,currency,basis,created_by)
 values(roundrow.id,p_input->>'kind',nullif(p_input->>'carrier',''),amount,p_input->>'currency',p_input->>'basis',auth.uid()) returning id into rid;
 elsif p_operation='add_cost' then
 if coalesce(p_input->>'confirmed','false')<>'true' or nullif(btrim(p_input->>'basis'),'') is null or length(p_input->>'basis')>2000 then raise exception 'Confirm actual cost basis';end if;
 if coalesce(p_input->>'customer_charge_jpy','')!~'^[0-9]+$' then raise exception 'Customer charge required';end if;
 charge=(p_input->>'customer_charge_jpy')::numeric;
 if p_input->>'currency'='USD' then
 if coalesce(p_input#>>'{fx,confirmed}','false')<>'true' or coalesce(p_input#>>'{fx,rate}','')!~'^[0-9]+([.][0-9]+)?$'
 or nullif(btrim(p_input#>>'{fx,reference}'),'') is null or coalesce(p_input#>>'{fx,as_of}','')!~'(Z|[+-]\d{2}:\d{2})$' then raise exception 'Confirmed FX required';end if;
 fxrate=(p_input#>>'{fx,rate}')::numeric;
 if fxrate<=0 or (p_input#>>'{fx,as_of}')::timestamptz>now()+interval '5 minutes' then raise exception 'Invalid FX';end if;
 end if;
 insert into sample_costs(round_id,kind,carrier,estimate,amount,currency,fx,customer_charge_jpy,basis,confirmed_by)
 values(roundrow.id,p_input->>'kind',nullif(p_input->>'carrier',''),nullif(p_input->>'estimate','')::numeric,amount,p_input->>'currency',case when p_input->>'currency'='USD' then p_input->'fx' else null end,charge,p_input->>'basis',auth.uid()) returning id into rid;
 else
 if coalesce(p_input->>'paid_on','')!~'^\d{4}-\d{2}-\d{2}$' or nullif(btrim(p_input->>'reference'),'') is null or length(p_input->>'reference')>2000 or (p_input->>'paid_on')::date>current_date then raise exception 'Payment evidence required';end if;
 insert into sample_payments(round_id,amount,currency,paid_on,reference,created_by) values(roundrow.id,amount,p_input->>'currency',(p_input->>'paid_on')::date,p_input->>'reference',auth.uid()) returning id into rid;
 end if;
 result=jsonb_build_object('id',rid);end if;
 elsif p_operation='issue_invoice' then
 perform c.id from sample_costs c join sample_rounds r on r.id=c.round_id where r.deal_id=p_deal_id and c.id in(select value::uuid from jsonb_array_elements_text(p_input->'cost_ids')) order by c.id for update of c;
 preview=preview_sample_invoice(p_deal_id,p_input);
 if p_expected is null or preview<>p_expected then raise exception 'Preview changed';end if;
 if nullif(p_input->>'previous_invoice_id','') is not null then
 select * into inv from sample_invoices where id=(p_input->>'previous_invoice_id')::uuid and deal_id=p_deal_id;
 if not found or inv.status<>'cancelled' then raise exception 'Cancelled previous invoice required';end if;
 end if;
 v_invoice_id=gen_random_uuid();number='SMP-'||replace(v_invoice_id::text,'-','');
 preview=preview||jsonb_build_object('document_number',number,'created_at',now());
 insert into sample_invoices(id,deal_id,document_number,snapshot,previous_invoice_id,created_by) values(v_invoice_id,p_deal_id,number,preview,nullif(p_input->>'previous_invoice_id','')::uuid,auth.uid());
 insert into sample_invoice_lines(invoice_id,cost_id) select v_invoice_id,value::uuid from jsonb_array_elements_text(p_input->'cost_ids');
 result=jsonb_build_object('id',v_invoice_id,'document_number',number);
 elsif p_operation='void_cost' then
 perform c.id from sample_costs c join sample_rounds r on r.id=c.round_id where c.id=(p_input->>'cost_id')::uuid and r.deal_id=p_deal_id and c.voided_at is null for update of c;
 if not found or exists(select 1 from sample_invoice_lines where cost_id=(p_input->>'cost_id')::uuid and released_at is null) then raise exception 'Unbilled active cost required';end if;
 if nullif(btrim(p_input->>'reason'),'') is null or length(p_input->>'reason')>2000 then raise exception 'Void reason required';end if;
 update sample_costs set voided_at=now(),void_reason=p_input->>'reason' where id=(p_input->>'cost_id')::uuid;
 result=jsonb_build_object('id',p_input->>'cost_id','status','voided');
 elsif p_operation='cancel_invoice' then
 select * into inv from sample_invoices where id=(p_input->>'invoice_id')::uuid and deal_id=p_deal_id for update;
 if not found or inv.status<>'issued' then raise exception 'Issued invoice required';end if;
 if nullif(btrim(p_input->>'reason'),'') is null or length(p_input->>'reason')>2000 then raise exception 'Cancellation reason required';end if;
 update sample_invoices set status='cancelled',cancellation_reason=p_input->>'reason',cancelled_at=now() where id=inv.id;
 update sample_invoice_lines set released_at=now() where invoice_id=inv.id and released_at is null;
 result=jsonb_build_object('id',inv.id,'status','cancelled');
 else raise exception 'Unknown sample operation';end if;
 insert into sample_requests(id,created_by,deal_id,operation,payload,result) values(p_request_id,auth.uid(),p_deal_id,p_operation,payload,result);
 return result;
end$$;
revoke all on function public.preview_sample_invoice(uuid,jsonb),public.sample_command(uuid,uuid,text,jsonb,jsonb) from public,anon;
grant execute on function public.preview_sample_invoice(uuid,jsonb),public.sample_command(uuid,uuid,text,jsonb,jsonb) to authenticated;

create function public.claim_sample_email(p_invoice_id uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare r sample_mail_receipts;
begin
 if auth.uid() is null or not is_staff() then raise exception 'Sales or administrator required';end if;
 perform 1 from sample_invoices where id=p_invoice_id and status='issued' for update;
 if not found then raise exception 'Issued invoice required';end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or length(p_payload::text)>20000 or nullif(p_payload->>'to','') is null or nullif(p_payload->>'from','') is null or coalesce(p_payload->>'pdf_sha256','')!~'^[0-9a-f]{64}$' then raise exception 'Confirmed mail payload required';end if;
 select * into r from sample_mail_receipts where invoice_id=p_invoice_id;
 if found then return jsonb_build_object('claimed',false,'status',r.status);end if;
 insert into sample_mail_receipts(invoice_id,created_by,payload) values(p_invoice_id,auth.uid(),p_payload) returning * into r;
 return jsonb_build_object('claimed',true,'attempt_id',r.attempt_id,'status',r.status);
end$$;
create function public.finish_sample_email(p_invoice_id uuid,p_attempt_id uuid,p_status text,p_provider_id text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not is_staff() then raise exception 'Sales or administrator required';end if;
 if p_status not in('accepted','unknown','rejected') or (p_status='accepted' and nullif(p_provider_id,'') is null) then raise exception 'Invalid mail result';end if;
 update sample_mail_receipts set status=p_status,provider_id=p_provider_id,finished_at=now()
 where invoice_id=p_invoice_id and attempt_id=p_attempt_id and created_by=auth.uid() and status='attempting';
 if not found then raise exception 'Mail attempt mismatch';end if;
end$$;
revoke all on function public.claim_sample_email(uuid,jsonb),public.finish_sample_email(uuid,uuid,text,text) from public,anon;
grant execute on function public.claim_sample_email(uuid,jsonb),public.finish_sample_email(uuid,uuid,text,text) to authenticated;

create function public.keep_sample_record() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if tg_op='DELETE' then raise exception 'Sample history immutable';end if;
 if tg_table_name='sample_rounds' then
 if (to_jsonb(new)-'status')<>(to_jsonb(old)-'status') then raise exception 'Sample round immutable';end if;
 elsif tg_table_name='sample_invoices' then
 if old.status<>'issued' or new.status<>'cancelled' or (to_jsonb(new)-array['status','cancellation_reason','cancelled_at'])<>(to_jsonb(old)-array['status','cancellation_reason','cancelled_at']) then raise exception 'Sample invoice immutable';end if;
 elsif tg_table_name='sample_costs' then
 if old.voided_at is not null or new.voided_at is null or (to_jsonb(new)-array['voided_at','void_reason'])<>(to_jsonb(old)-array['voided_at','void_reason']) then raise exception 'Sample cost immutable';end if;
 elsif tg_table_name='sample_invoice_lines' then
 if old.released_at is not null or new.released_at is null or (to_jsonb(new)-'released_at')<>(to_jsonb(old)-'released_at') then raise exception 'Sample allocation immutable';end if;
 else raise exception 'Sample history immutable';end if;
 return new;
end$$;
revoke all on function public.keep_sample_record() from public,anon,authenticated;
do $$declare t text;begin
 foreach t in array array['sample_rounds','sample_estimates','sample_costs','sample_payments','sample_invoices','sample_invoice_lines','sample_requests'] loop
 execute format('create trigger keep_sample_record before update or delete on public.%I for each row execute function public.keep_sample_record()',t);
 end loop;
end$$;
