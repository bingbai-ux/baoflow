-- Optional operator checklist; read-only, no names/IDs/prices/tokens/row payloads.
-- Case numbers are transient ordering labels, not customer identifiers.
begin transaction read only;
set local statement_timeout='10s';
set local lock_timeout='2s';
with affected as (
 select d.id,d.created_at,d.simple_status,count(*) as adopted_quotes,
 bool_and(q.factory_id is not null) as existing_factory_retained
 from public.deals d join public.deal_quotes q on q.deal_id=d.id
 where d.archived_at is null and q.status='approved' and q.variant_id is null and q.spec_id is null
 and not exists(select 1 from public.deal_products p where p.deal_id=d.id)
 group by d.id,d.created_at,d.simple_status
)
select row_number() over(order by created_at,id) as case_no,simple_status,
 adopted_quotes,existing_factory_retained,
 true as confirm_original_specification,true as create_new_spec_and_quote_for_future_order,
 false as automatically_bind_old_quote
from affected order by created_at,id limit 100;
rollback;
-- Requires an authorized staff/DB actor with visibility of all target rows.
-- Do not treat an RLS-filtered partial result as a complete list.
