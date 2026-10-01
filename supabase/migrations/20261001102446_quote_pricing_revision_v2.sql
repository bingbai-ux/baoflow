-- Local proposal: confirmed mass-production price revisions; no legacy backfill.
alter table public.deal_quotes add column if not exists pricing_snapshot jsonb;
create table public.quote_pricing_requests(
 request_id uuid primary key, created_by uuid not null references public.profiles(id),
 deal_id uuid not null references public.deals(id), payload jsonb not null,
 quote_id uuid not null references public.deal_quotes(id), created_at timestamptz not null default now()
);
create table public.quote_cost_lines(
 id uuid primary key default gen_random_uuid(), quote_id uuid not null references public.deal_quotes(id),
 line_key text not null, kind text not null, name text not null, amount numeric not null check(amount>=0),
 currency text not null check(currency in ('USD','JPY')), amount_usd numeric not null check(amount_usd>=0),
 unique(quote_id,line_key), unique(quote_id,name)
);
alter table public.quote_pricing_requests enable row level security;
alter table public.quote_cost_lines enable row level security;
revoke all on public.quote_pricing_requests,public.quote_cost_lines from public,anon,authenticated;
grant select on public.quote_pricing_requests,public.quote_cost_lines to authenticated;
create policy quote_pricing_owner_read on public.quote_pricing_requests for select to authenticated using(created_by=auth.uid() and public.is_staff());
create policy quote_cost_staff_read on public.quote_cost_lines for select to authenticated using(public.is_staff());

create function public.preview_quote_pricing_v2(p_quote_id uuid,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp stable as $$
declare q public.deal_quotes; line jsonb; kind text; rate numeric; tax numeric; val numeric; total numeric; unit numeric; sell numeric; ratio numeric;
 lines jsonb:='[]'; keys text[]:='{}'; names text[]:='{}'; n text; amount numeric; converted numeric;
begin
 if auth.uid() is null or not coalesce(public.is_staff(),false) then raise exception 'Sales or administrator access required'; end if;
 select * into q from public.deal_quotes where id=p_quote_id;
 if not found or not exists(select 1 from public.deals where id=q.deal_id and archived_at is null) then raise exception 'Quote unavailable or archived'; end if;
 if q.variant_id is null or not exists(select 1 from public.deal_product_variants v join public.deal_products p on p.id=v.product_id where v.id=q.variant_id and p.deal_id=q.deal_id) then raise exception 'Specification binding required'; end if;
 if q.quantity is null or q.quantity<=0 or q.factory_unit_price_usd is null or q.factory_unit_price_usd<=0 or q.factory_unit_price_usd::text in ('NaN','Infinity','-Infinity') then raise exception 'Quantity and factory price required'; end if;
 if jsonb_typeof(p_input) is distinct from 'object' or coalesce(p_input->>'mode','') not in ('ratio','selling_price') then raise exception 'Invalid pricing input'; end if;
 rate:=(p_input->'fx'->>'rate')::numeric;tax:=(p_input->>'tax_rate')::numeric;val:=(p_input->>'value')::numeric;
 if rate is null or rate<=0 or rate::text in ('NaN','Infinity','-Infinity') or p_input->'fx'->>'confirmed' is distinct from 'true' or coalesce(trim(p_input->'fx'->>'reference'),'')='' or length(p_input->'fx'->>'reference')>500 or coalesce(p_input->'fx'->>'as_of','')='' then raise exception 'Confirmed manual FX reference and date required'; end if;
 if p_input->'fx'->>'as_of' !~* '(Z|[+-][0-9]{2}:[0-9]{2})$' then raise exception 'Timezone required'; end if;
 if (p_input->'fx'->>'as_of')::timestamptz>now()+interval '5 minutes' then raise exception 'FX date cannot be in the future'; end if;
 if tax is null or tax<0 or tax>100 or tax::text in ('NaN','Infinity','-Infinity') or val is null or val<=0 or val::text in ('NaN','Infinity','-Infinity') or (p_input->>'mode'='ratio' and val>1) or (p_input->>'mode'='selling_price' and val<>trunc(val)) then raise exception 'Invalid ratio, selling unit or tax'; end if;
 if jsonb_typeof(p_input->'cost_lines') is distinct from 'array' or jsonb_array_length(p_input->'cost_lines')>100 then raise exception 'Confirmed cost lines required'; end if;
 foreach kind in array array['plate','color','domestic_freight','international_freight','other'] loop
  if (select count(*) from jsonb_array_elements(p_input->'cost_lines') l where l->>'kind'=kind)<>1 then raise exception 'Confirm each mandatory cost exactly once'; end if;
 end loop;
 total:=q.quantity*q.factory_unit_price_usd;
 for line in select value from jsonb_array_elements(p_input->'cost_lines') order by value->>'key' loop
  n:=trim(line->>'name');amount:=(line->>'amount')::numeric;
  if coalesce(line->>'key','')='' or length(line->>'key')>100 or line->>'key'=any(keys) or coalesce(n,'')='' or length(n)>200 or lower(n)=any(names)
   or coalesce(line->>'kind','') not in ('plate','color','domestic_freight','international_freight','other','custom') or coalesce(line->>'currency','') not in ('USD','JPY') or line->>'confirmed' is distinct from 'true'
   or amount is null or amount<0 or amount::text in ('NaN','Infinity','-Infinity') then raise exception 'Missing, duplicate or unconfirmed cost'; end if;
  if line->>'kind'='custom' and n~*'(版代|プレート|plate|sample|サンプル)' then raise exception 'Plate belongs to its own line; sample belongs to separate billing'; end if;
  keys:=array_append(keys,line->>'key');names:=array_append(names,lower(n));
  converted:=case when line->>'currency'='USD' then amount else amount/rate end;total:=total+converted;
  lines:=lines||jsonb_build_array(jsonb_build_object('key',line->>'key','kind',line->>'kind','name',n,'amount',amount::text,'currency',line->>'currency','confirmed',true,'amount_usd',converted::text));
 end loop;
 unit:=total/q.quantity;sell:=case when p_input->>'mode'='ratio' then ceil(unit*rate/val) else val end;
 if sell<unit*rate then raise exception 'Selling price below cost'; end if;
 ratio:=case when p_input->>'mode'='ratio' then val else unit*rate/sell end;
 if sell*q.quantity>9007199254740991 or ceil(sell*q.quantity*(1+tax/100))>9007199254740991 then raise exception 'Amount exceeds safe range'; end if;
 return jsonb_build_object('schema_version',1,'source_quote_id',q.id,'deal_id',q.deal_id,'variant_id',q.variant_id,'factory_id',q.factory_id,'quantity',q.quantity,'factory_unit_price_usd',q.factory_unit_price_usd::text,'factory_response',q.factory_response,
  'mode',p_input->>'mode','input_value',val::text,'fx',jsonb_build_object('kind','manual_confirmed','rate',rate::text,'reference',trim(p_input->'fx'->>'reference'),'as_of',to_char((p_input->'fx'->>'as_of')::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),
  'tax_rate',tax::text,'cost_lines',lines,'total_cost_usd',(total)::text,'unit_cost_usd',(unit)::text,'cost_ratio',(ratio)::text,'selling_price_jpy',(sell)::text,'total_billing_jpy',(sell*q.quantity)::text,'total_billing_tax_jpy',(ceil(sell*q.quantity*(1+tax/100)))::text,'rounding','JPY_UNIT_CEIL_TAX_TOTAL_CEIL','sample_costs_included',false);
end $$;
revoke all on function public.preview_quote_pricing_v2(uuid,jsonb) from public,anon;
grant execute on function public.preview_quote_pricing_v2(uuid,jsonb) to authenticated;

create function public.save_quote_pricing_v2(p_request_id uuid,p_quote_id uuid,p_input jsonb,p_expected jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare saved public.quote_pricing_requests;q public.deal_quotes;payload jsonb;snapshot jsonb;created public.deal_quotes;line jsonb;version_no integer;
begin
 if auth.uid() is null or not coalesce(public.is_staff(),false) then raise exception 'Sales or administrator access required'; end if;
 if p_request_id is null then raise exception 'Request ID required'; end if;
 payload:=jsonb_build_object('quote_id',p_quote_id,'input',p_input,'expected',p_expected);
 perform pg_advisory_xact_lock(hashtextextended('quote_pricing:'||p_request_id::text,0));
 select * into saved from public.quote_pricing_requests where request_id=p_request_id;
 if found then
  if saved.created_by<>auth.uid() or saved.payload<>payload then raise exception 'Request ID already used with different input'; end if;
  return jsonb_build_object('quote_id',saved.quote_id,'deal_id',saved.deal_id);
 end if;
 select * into q from public.deal_quotes where id=p_quote_id;
 if not found then raise exception 'Quote unavailable'; end if;
 perform 1 from public.deals where id=q.deal_id and archived_at is null for update;
 if not found then raise exception 'Deal unavailable or archived'; end if;
 perform 1 from public.deal_quotes where id=p_quote_id for share;
 select * into q from public.deal_quotes where id=p_quote_id;
 perform 1 from public.deal_product_variants where id=q.variant_id for share;
 perform 1 from public.deal_products where id=(select product_id from public.deal_product_variants where id=q.variant_id) for share;
 snapshot:=public.preview_quote_pricing_v2(p_quote_id,p_input);
 if snapshot is distinct from p_expected then raise exception 'Preview changed; review again'; end if;
 select coalesce(max(version),0)+1 into version_no from public.deal_quotes where deal_id=q.deal_id;
 insert into public.deal_quotes(deal_id,variant_id,factory_id,version,quantity,moq,factory_unit_price_usd,exchange_rate,cost_ratio,total_cost_usd,unit_cost_usd,selling_price_usd,selling_price_jpy,total_billing_jpy,total_billing_tax_jpy,status,source_type,factory_response,pricing_snapshot,plate_fee_usd,pantone_color_fee_usd,domestic_china_freight_usd,china_freight_usd,other_fees_usd,sample_cost_usd,sample_shipping_usd)
 values(q.deal_id,q.variant_id,q.factory_id,version_no,q.quantity,q.moq,q.factory_unit_price_usd,(snapshot->'fx'->>'rate')::numeric,(snapshot->>'cost_ratio')::numeric,(snapshot->>'total_cost_usd')::numeric,(snapshot->>'unit_cost_usd')::numeric,(snapshot->>'selling_price_jpy')::numeric/(snapshot->'fx'->>'rate')::numeric,(snapshot->>'selling_price_jpy')::numeric,(snapshot->>'total_billing_jpy')::numeric,(snapshot->>'total_billing_tax_jpy')::numeric,'drafting','pricing_revision',q.factory_response,snapshot,
  (select (l->>'amount_usd')::numeric from jsonb_array_elements(snapshot->'cost_lines') l where l->>'kind'='plate'),(select (l->>'amount_usd')::numeric from jsonb_array_elements(snapshot->'cost_lines') l where l->>'kind'='color'),(select (l->>'amount_usd')::numeric from jsonb_array_elements(snapshot->'cost_lines') l where l->>'kind'='domestic_freight'),(select (l->>'amount_usd')::numeric from jsonb_array_elements(snapshot->'cost_lines') l where l->>'kind'='international_freight'),(select coalesce(sum((l->>'amount_usd')::numeric),0) from jsonb_array_elements(snapshot->'cost_lines') l where l->>'kind' in ('other','custom')),0,0) returning * into created;
 for line in select value from jsonb_array_elements(snapshot->'cost_lines') loop
  insert into public.quote_cost_lines(quote_id,line_key,kind,name,amount,currency,amount_usd) values(created.id,line->>'key',line->>'kind',line->>'name',(line->>'amount')::numeric,line->>'currency',(line->>'amount_usd')::numeric);
 end loop;
 insert into public.quote_pricing_requests(request_id,created_by,deal_id,payload,quote_id) values(p_request_id,auth.uid(),q.deal_id,payload,created.id);
 return jsonb_build_object('quote_id',created.id,'deal_id',q.deal_id);
end $$;
revoke all on function public.save_quote_pricing_v2(uuid,uuid,jsonb,jsonb) from public,anon;
grant execute on function public.save_quote_pricing_v2(uuid,uuid,jsonb,jsonb) to authenticated;

create function public.keep_quote_pricing_snapshot() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if old.pricing_snapshot is not null and (tg_op='DELETE' or (to_jsonb(new)-array['status','updated_at']) is distinct from (to_jsonb(old)-array['status','updated_at'])) then raise exception 'Saved price revision is immutable; create a new revision'; end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function public.keep_quote_pricing_snapshot() from public,anon,authenticated;
create trigger keep_quote_pricing_snapshot before update or delete on public.deal_quotes for each row execute function public.keep_quote_pricing_snapshot();
-- Retain revisions, cost lines and request ledger during rollback; disable new save UI.

-- Keep existing issuance/retry guards; freeze manual FX for new price versions.
create or replace function public.issue_document_atomic(
  p_request_id uuid,p_deal_id uuid,p_type text,p_metadata jsonb,p_snapshot jsonb
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_payload jsonb; v_saved public.document_issue_requests; v_doc public.documents; v_number text;
  v_approved integer; v_invalid boolean; v_version integer; v_fx numeric;
begin
  if auth.uid() is null or not coalesce(public.is_staff(),false) then raise exception 'Sales or administrator access required'; end if;
  if p_request_id is null then raise exception 'Request ID is required'; end if;
  if p_type not in ('quotation','invoice','delivery_note','rfq','inventory_cert') then raise exception 'Unsupported document type'; end if;
  if jsonb_typeof(p_metadata) is distinct from 'object' or jsonb_typeof(p_snapshot) is distinct from 'object' then raise exception 'Invalid document payload'; end if;
  v_payload:=jsonb_build_object('deal_id',p_deal_id,'type',p_type,'metadata',p_metadata,'snapshot',p_snapshot);
  perform pg_advisory_xact_lock(hashtextextended('document_issue:'||p_request_id::text,0));
  select * into v_saved from public.document_issue_requests where request_id=p_request_id;
  if found then
    if v_saved.created_by<>auth.uid() or v_saved.payload<>v_payload then raise exception 'Request ID was already used with different input or snapshot'; end if;
    select * into v_doc from public.documents where id=v_saved.document_id;
    if not found then raise exception 'Previously issued document is unavailable'; end if;
    return to_jsonb(v_doc);
  end if;
  if p_deal_id is null then
    if p_type<>'inventory_cert' then raise exception 'Only inventory certificates can be standalone'; end if;
  else
    perform 1 from public.deals where id=p_deal_id and archived_at is null for update;
    if not found then raise exception 'Deal not found or archived'; end if;
    if p_snapshot->'deal'->>'id' is distinct from p_deal_id::text then raise exception 'Snapshot does not belong to this deal'; end if;
    if p_type='rfq' then
      if jsonb_typeof(p_snapshot->'variants') is distinct from 'array' or jsonb_array_length(p_snapshot->'variants')=0 then raise exception 'Register specifications before issuing RFQ'; end if;
    else
      if jsonb_typeof(p_snapshot->'quotes') is distinct from 'array' then raise exception 'Approved quotation snapshot is required'; end if;
      select count(*) filter(where q->>'status'='approved'),bool_or(q->>'status'='approved' and
        (coalesce(q->>'quantity','') !~ '^[1-9][0-9]*$' or coalesce(q->>'total_billing_jpy','') !~ '^[0-9]+(\.[0-9]+)?$'
          or coalesce(q->>'selling_price_jpy','') !~ '^[0-9]+(\.[0-9]+)?$'))
        into v_approved,v_invalid from jsonb_array_elements(p_snapshot->'quotes') q;
      if v_approved=0 or coalesce(v_invalid,false) then raise exception 'Valid approved quotations are required'; end if;
      if exists(select 1 from jsonb_array_elements(p_snapshot->'quotes') q
        where q->>'status'='approved' group by q->>'id' having count(*)>1) then
        raise exception 'Approved quotation IDs must be unique';
      end if;
      perform 1 from public.deal_quotes where deal_id=p_deal_id and status='approved' for share;
      if v_approved<>(select count(*) from public.deal_quotes where deal_id=p_deal_id and status='approved')
        or exists(select 1 from public.deal_quotes live where live.deal_id=p_deal_id and live.status='approved'
          and not exists(select 1 from jsonb_array_elements(p_snapshot->'quotes') q
            where q->>'status'='approved' and q->>'id'=live.id::text))
        or exists(select 1 from jsonb_array_elements(p_snapshot->'quotes') q left join public.deal_quotes live
          on live.id::text=q->>'id' and live.deal_id=p_deal_id and live.status='approved'
          where q->>'status'='approved' and (live.id is null or live.quantity::numeric is distinct from (q->>'quantity')::numeric
            or live.selling_price_jpy is distinct from (q->>'selling_price_jpy')::numeric
            or live.total_billing_jpy is distinct from (q->>'total_billing_jpy')::numeric
            or live.total_billing_tax_jpy is distinct from nullif(q->>'total_billing_tax_jpy','')::numeric)) then
        raise exception 'Approved quotations changed; reload before issuing';
      end if;
    end if;
  end if;
  if p_type<>'rfq' and exists(select 1 from public.deal_quotes where deal_id=p_deal_id and status='approved' and pricing_snapshot is not null) and exists(select 1 from public.deal_fees where deal_id=p_deal_id) then raise exception 'Legacy separate fees need allocation before new price issuance'; end if;
  if p_type='quotation' and exists(select 1 from public.deal_quotes where deal_id=p_deal_id and status='approved' and pricing_snapshot is not null) then
    if p_metadata->'manual_fx'->>'confirmed' is distinct from 'true' then raise exception 'Confirm manual FX at quotation issuance'; end if;
    v_fx:=(p_metadata->'manual_fx'->>'rate')::numeric;
    if v_fx is null or v_fx<=0 or v_fx::text in ('NaN','Infinity','-Infinity') then raise exception 'Invalid issuance FX'; end if;
    if exists(select 1 from public.deal_quotes where deal_id=p_deal_id and status='approved' and (pricing_snapshot is null or exchange_rate is distinct from v_fx)) then raise exception 'Revise all selected prices with the confirmed FX before issuing'; end if;
    if exists(select 1 from public.deal_quotes live where live.deal_id=p_deal_id and live.status='approved' and not exists(select 1 from jsonb_array_elements(p_snapshot->'quotes') q where q->>'id'=live.id::text and q->'pricing_snapshot'=live.pricing_snapshot)) then raise exception 'Price version snapshot changed'; end if;
    p_snapshot:=p_snapshot||jsonb_build_object('issuance_fx',jsonb_build_object('kind','manual_confirmed','rate',v_fx::text,'confirmed_at',now(),'automatic_latest',false));
  end if;
  select coalesce(max(version),0)+1 into v_version from public.documents where deal_id is not distinct from p_deal_id and document_type::text=p_type;
  v_number:=public.reserve_document_number(p_type);
  insert into public.documents(deal_id,document_type,document_number,version,metadata,issued_at,issued_by_user_id)
    values(p_deal_id,p_type::public.document_type,v_number,v_version,p_metadata||jsonb_build_object('snapshot_version',1,'snapshot',p_snapshot),now(),auth.uid()) returning * into v_doc;
  insert into public.document_issue_requests(request_id,created_by,payload,document_id) values(p_request_id,auth.uid(),v_payload,v_doc.id);
  return to_jsonb(v_doc);
end $$;

create function public.keep_priced_document_snapshot() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if jsonb_typeof(old.metadata->'snapshot'->'quotes')='array' then
  if exists(select 1 from jsonb_array_elements(old.metadata->'snapshot'->'quotes') q where jsonb_typeof(q->'pricing_snapshot')='object') then raise exception 'Issued price document is immutable; create a new version'; end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function public.keep_priced_document_snapshot() from public,anon,authenticated;
create trigger keep_priced_document_snapshot before update or delete on public.documents for each row execute function public.keep_priced_document_snapshot();
