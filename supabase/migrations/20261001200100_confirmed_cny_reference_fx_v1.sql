-- CLI-generated; reordered after Stage12 chat/sample migration.
-- Explicit CNY reference conversion; frozen human-confirmed snapshot, not bank FX.
alter table public.quote_cost_lines drop constraint quote_cost_lines_currency_check;
alter table public.quote_cost_lines add constraint quote_cost_lines_currency_check check(currency in ('USD','JPY','CNY'));
create or replace function public.preview_quote_pricing_v2(p_quote_id uuid,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp stable as $$
declare q public.deal_quotes; line jsonb; kind text; rate numeric; tax numeric; val numeric; total numeric; unit numeric; sell numeric; ratio numeric;
 lines jsonb:='[]'; keys text[]:='{}'; names text[]:='{}'; n text; amount numeric; converted numeric; cny_rate numeric;
begin
 if auth.uid() is null or not coalesce(public.is_staff(),false) then raise exception 'Sales or administrator access required'; end if;
 select * into q from public.deal_quotes where id=p_quote_id;
 if not found or not exists(select 1 from public.deals where id=q.deal_id and archived_at is null) then raise exception 'Quote unavailable or archived'; end if;
 if q.variant_id is null or not exists(select 1 from public.deal_product_variants v join public.deal_products p on p.id=v.product_id where v.id=q.variant_id and p.deal_id=q.deal_id) then raise exception 'Specification binding required'; end if;
 if q.quantity is null or q.quantity<=0 or q.factory_unit_price_usd is null or q.factory_unit_price_usd<=0 or q.factory_unit_price_usd::text in ('NaN','Infinity','-Infinity') then raise exception 'Quantity and factory price required'; end if;
 if jsonb_typeof(p_input) is distinct from 'object' or coalesce(p_input->>'mode','') not in ('ratio','selling_price') then raise exception 'Invalid pricing input'; end if;
 rate:=(p_input->'fx'->>'rate')::numeric;cny_rate:=nullif(p_input->'fx'->>'cny_jpy_rate','')::numeric;tax:=(p_input->>'tax_rate')::numeric;val:=(p_input->>'value')::numeric;
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
   or coalesce(line->>'kind','') not in ('plate','color','domestic_freight','international_freight','other','custom') or coalesce(line->>'currency','') not in ('USD','JPY','CNY') or line->>'confirmed' is distinct from 'true'
   or amount is null or amount<0 or amount::text in ('NaN','Infinity','-Infinity') then raise exception 'Missing, duplicate or unconfirmed cost'; end if;
  if line->>'kind'='custom' and n~*'(版代|プレート|plate|sample|サンプル)' then raise exception 'Plate belongs to its own line; sample belongs to separate billing'; end if;
  keys:=array_append(keys,line->>'key');names:=array_append(names,lower(n));
  if line->>'currency'='CNY' and (cny_rate is null or cny_rate<=0 or cny_rate::text in ('NaN','Infinity','-Infinity')) then raise exception 'Confirmed JPY/CNY rate required';end if;
  converted:=case when line->>'currency'='USD' then amount when line->>'currency'='CNY' then amount*cny_rate/rate else amount/rate end;total:=total+converted;
  lines:=lines||jsonb_build_array(jsonb_build_object('key',line->>'key','kind',line->>'kind','name',n,'amount',amount::text,'currency',line->>'currency','confirmed',true,'amount_usd',converted::text));
 end loop;
 unit:=total/q.quantity;sell:=case when p_input->>'mode'='ratio' then ceil(unit*rate/val) else val end;
 if sell<unit*rate then raise exception 'Selling price below cost'; end if;
 ratio:=case when p_input->>'mode'='ratio' then val else unit*rate/sell end;
 if sell*q.quantity>9007199254740991 or ceil(sell*q.quantity*(1+tax/100))>9007199254740991 then raise exception 'Amount exceeds safe range'; end if;
 return jsonb_build_object('schema_version',1,'source_quote_id',q.id,'deal_id',q.deal_id,'variant_id',q.variant_id,'factory_id',q.factory_id,'quantity',q.quantity,'factory_unit_price_usd',q.factory_unit_price_usd::text,'factory_response',q.factory_response,
  'mode',p_input->>'mode','input_value',val::text,'fx',jsonb_build_object('kind','manual_confirmed','cny_jpy_rate',cny_rate::text,'rate',rate::text,'reference',trim(p_input->'fx'->>'reference'),'as_of',to_char((p_input->'fx'->>'as_of')::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),
  'tax_rate',tax::text,'cost_lines',lines,'total_cost_usd',(total)::text,'unit_cost_usd',(unit)::text,'cost_ratio',(ratio)::text,'selling_price_jpy',(sell)::text,'total_billing_jpy',(sell*q.quantity)::text,'total_billing_tax_jpy',(ceil(sell*q.quantity*(1+tax/100)))::text,'rounding','JPY_UNIT_CEIL_TAX_TOTAL_CEIL','sample_costs_included',false);
end $$;
