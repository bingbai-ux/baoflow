-- READ ONLY / anonymous aggregate counts only. No IDs, names, tokens, payloads or credentials.
-- Run manually using an already-authorized SQL editor/connection; never put its URL/key in this file.
-- Baseline: 037. New objects are optional and reported not_applied_or_missing, never referenced blindly.
-- Release gates: all blocker counts = 0, every check status = checked, except optional new objects
-- before migration. Run again after 038..047: optional new objects/grants/functions must then exist.
-- post_migration_blocker counts are required to be zero AFTER migration only; inventory counts
-- are a preservation inventory, not failures. Historic timestamp-based migration names require
-- manual mapping to the approved 038..047 SQL; candidate_new_migration_history_rows is a hint only.
-- These counts do not replace an approved schema/RLS backup or staging role/concurrency tests.
-- Review warnings explicitly: historic document duplicates are preserved, not auto-renumbered;
-- legacy RFQ pending tokens without requested_lines must be replaced/reissued with staff approval.
-- Preserve current migration ledger, schema/RLS/grants, inventory ledger, issued documents,
-- counters, request ledgers and order snapshots in an approved backup before applying changes.
-- This file does NOT create that backup or authorize migration application.

begin transaction read only;
set local statement_timeout = '30s';
set local lock_timeout = '2s';

do $preflight$
declare
  r record;
  missing bigint;
  amount bigint;
  auditor_ok boolean;
begin
  select coalesce(rolsuper or rolbypassrls,false) into auditor_ok from pg_roles where rolname=current_user;
  if not coalesce(auditor_ok,false) then
    raise notice '%',jsonb_build_object('check','audit_visibility','severity','blocker','status','blocked_require_authorized_rls_bypass_reader','count',1);
    return; -- RLS-filtered counts must never be presented as complete audit results.
  end if;
  for r in
    select * from (values
      ('baseline_037_required_schema','blocker',$q$
        select count(*) from (values
          ('deals','client_id'),('deals','simple_status'),('deals','master_status'),('deals','archived_at'),
          ('deal_quotes','variant_id'),('deal_quotes','quantity'),('deal_quotes','factory_unit_price_usd'),
          ('inventory_items','quantity_on_hand'),('inventory_transactions','quantity_delta'),
          ('inbound_shipments','status'),('inbound_shipment_items','expected_quantity'),
          ('shipment_requests','status'),('shipment_request_items','quantity'),
          ('external_forms','context'),('external_forms','related_id'),('documents','metadata'),
          ('profiles','role'),('profiles','factory_id')
        ) expected(table_name,column_name)
        where not exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name=expected.table_name and c.column_name=expected.column_name)
      $q$,array[]::text[]),
      ('migration_history_rows','inventory',$q$select count(*) from supabase_migrations.schema_migrations$q$,array['supabase_migrations.schema_migrations.version']),
      ('candidate_new_migration_history_rows','inventory',$q$
        select count(*) from supabase_migrations.schema_migrations where version in ('038','039','040','041','042','043','044','045','046','047')
          or name ~ '^(038|039|040|041|042|043|044|045|046|047)(_|$)'
      $q$,array['supabase_migrations.schema_migrations.version','supabase_migrations.schema_migrations.name']),
      ('base_tables_without_rls','blocker',$q$
        select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relname in ('profiles','clients','factories','deals','deal_quotes','inventory_items','inventory_transactions','inbound_shipments','inbound_shipment_items','shipment_requests','shipment_request_items','external_forms','documents') and not c.relrowsecurity
      $q$,array[]::text[]),
      ('broad_authenticated_policies','blocker',$q$
        select count(*) from pg_policies where schemaname='public' and tablename in ('profiles','clients','factories','deals','deal_quotes','inventory_items','inventory_transactions','inbound_shipments','shipment_requests','documents')
          and (policyname='authenticated_full_access' or ('authenticated'=any(roles) and coalesce(qual,'') in ('true','(true)')))
      $q$,array[]::text[]),
      ('current_policy_rows','inventory',$q$
        select count(*) from pg_policies where schemaname='public' and tablename in ('profiles','deals','deal_quotes','inventory_items','inventory_transactions','inbound_shipments','inbound_shipment_items','shipment_requests','shipment_request_items','external_forms','documents')
      $q$,array[]::text[]),
      ('negative_stock','blocker',$q$select count(*) from public.inventory_items where quantity_on_hand<0$q$,array['public.inventory_items.quantity_on_hand']),
      ('negative_cartons','blocker',$q$select count(*) from public.inventory_items where cartons_on_hand<0$q$,array['public.inventory_items.cartons_on_hand']),
      ('stock_ledger_balance_mismatch','blocker',$q$
        select count(*) from public.inventory_items i left join (select item_id,sum(quantity_delta) total from public.inventory_transactions group by item_id) t on t.item_id=i.id
        where i.quantity_on_hand::bigint<>coalesce(t.total,0)
      $q$,array['public.inventory_items.id','public.inventory_items.quantity_on_hand','public.inventory_transactions.item_id','public.inventory_transactions.quantity_delta']),
      ('history_to_status_null','blocker',$q$select count(*) from public.deal_status_history where to_status is null$q$,array['public.deal_status_history.to_status']),
      ('historical_document_duplicate_groups','warning',$q$
        select count(*) from (select document_number from public.documents where document_number is not null group by document_number having count(*)>1) d
      $q$,array['public.documents.document_number']),
      ('legacy_documents_without_snapshot','warning',$q$
        select count(*) from public.documents where metadata->'snapshot' is null or jsonb_typeof(metadata->'snapshot') is distinct from 'object'
      $q$,array['public.documents.metadata']),
      ('pending_rfq_without_request_snapshot','blocker',$q$
        select count(*) from public.external_forms where form_type='rfq_response' and status='pending'
          and cancelled_at is null and (expires_at is null or expires_at>=now())
          and (jsonb_typeof(context->'requested_lines') is distinct from 'array' or context->'requested_lines'='[]'::jsonb)
      $q$,array['public.external_forms.form_type','public.external_forms.status','public.external_forms.context','public.external_forms.cancelled_at','public.external_forms.expires_at']),
      ('rfq_invitation_form_link_mismatch','blocker',$q$
        select count(*) from public.rfq_factory_invitations i join public.rfq_requests r on r.id=i.rfq_id left join public.external_forms f on f.id=i.external_form_id
        where r.status in ('open','partially_responded') and i.responded_at is null
          and (i.external_form_id is null or f.id is null or f.form_type<>'rfq_response' or f.related_id is distinct from i.id)
      $q$,array['public.rfq_factory_invitations.id','public.rfq_factory_invitations.rfq_id','public.rfq_factory_invitations.responded_at','public.rfq_factory_invitations.external_form_id','public.rfq_requests.id','public.rfq_requests.status','public.external_forms.id','public.external_forms.related_id','public.external_forms.form_type']),
      ('approved_quotes_without_variant','blocker',$q$
        select count(*) from public.deal_quotes q join public.deals d on d.id=q.deal_id where q.status='approved' and q.variant_id is null and d.archived_at is null
      $q$,array['public.deal_quotes.status','public.deal_quotes.variant_id','public.deal_quotes.deal_id','public.deals.id','public.deals.archived_at']),
      ('approved_quotes_wrong_deal_variant','blocker',$q$
        select count(*) from public.deal_quotes q left join public.deal_product_variants v on v.id=q.variant_id left join public.deal_products p on p.id=v.product_id
        where q.status='approved' and q.variant_id is not null and (v.id is null or p.deal_id is distinct from q.deal_id)
      $q$,array['public.deal_quotes.status','public.deal_quotes.variant_id','public.deal_quotes.deal_id','public.deal_product_variants.id','public.deal_product_variants.product_id','public.deal_products.id','public.deal_products.deal_id']),
      ('approved_quotes_invalid_quantity_price_rate','blocker',$q$
        select count(*) from public.deal_quotes where status='approved' and
          (quantity is null or quantity<=0 or factory_unit_price_usd is null or factory_unit_price_usd<=0 or selling_price_jpy is null or selling_price_jpy<=0
          or total_billing_jpy is null or total_billing_jpy<=0 or total_billing_tax_jpy is null or total_billing_tax_jpy<=0
          or exchange_rate is null or exchange_rate<=0 or cost_ratio is null or cost_ratio<=0 or cost_ratio>1
          or (moq is not null and (moq<=0 or quantity<moq))
          or factory_unit_price_usd::text in ('NaN','Infinity','-Infinity') or selling_price_jpy::text in ('NaN','Infinity','-Infinity')
          or total_billing_jpy::text in ('NaN','Infinity','-Infinity') or total_billing_tax_jpy::text in ('NaN','Infinity','-Infinity')
          or exchange_rate::text in ('NaN','Infinity','-Infinity') or cost_ratio::text in ('NaN','Infinity','-Infinity'))
      $q$,array['public.deal_quotes.status','public.deal_quotes.quantity','public.deal_quotes.factory_unit_price_usd','public.deal_quotes.selling_price_jpy','public.deal_quotes.total_billing_jpy','public.deal_quotes.total_billing_tax_jpy','public.deal_quotes.exchange_rate','public.deal_quotes.cost_ratio','public.deal_quotes.moq']),
      ('multiple_approved_quotes_same_scope','blocker',$q$
        select count(*) from (select deal_id,variant_id,case when variant_id is null then spec_id else null end legacy_scope from public.deal_quotes where status='approved' group by deal_id,variant_id,case when variant_id is null then spec_id else null end having count(*)>1) groups
      $q$,array['public.deal_quotes.deal_id','public.deal_quotes.variant_id','public.deal_quotes.spec_id','public.deal_quotes.status']),
      ('inbound_deal_client_mismatch','blocker',$q$
        select count(*) from public.inbound_shipments s join public.deals d on d.id=s.deal_id where s.status<>'cancelled' and s.client_id is distinct from d.client_id
      $q$,array['public.inbound_shipments.deal_id','public.inbound_shipments.client_id','public.inbound_shipments.status','public.deals.id','public.deals.client_id']),
      ('inbound_existing_item_client_mismatch','blocker',$q$
        select count(*) from public.inbound_shipment_items l join public.inbound_shipments s on s.id=l.shipment_id join public.inventory_items i on i.id=l.item_id
        where s.status<>'cancelled' and s.client_id is distinct from i.client_id
      $q$,array['public.inbound_shipment_items.shipment_id','public.inbound_shipment_items.item_id','public.inbound_shipments.id','public.inbound_shipments.client_id','public.inbound_shipments.status','public.inventory_items.id','public.inventory_items.client_id']),
      ('received_shipments_with_unprocessed_lines','blocker',$q$
        select count(*) from public.inbound_shipments s where s.status='received' and (not exists(select 1 from public.inbound_shipment_items l where l.shipment_id=s.id) or exists(select 1 from public.inbound_shipment_items l where l.shipment_id=s.id and l.received_quantity is null))
      $q$,array['public.inbound_shipments.id','public.inbound_shipments.status','public.inbound_shipment_items.shipment_id','public.inbound_shipment_items.received_quantity']),
      ('requests_with_wrong_client_item','blocker',$q$
        select count(*) from public.shipment_request_items l join public.shipment_requests r on r.id=l.request_id join public.inventory_items i on i.id=l.item_id where r.client_id is distinct from i.client_id
      $q$,array['public.shipment_request_items.request_id','public.shipment_request_items.item_id','public.shipment_requests.id','public.shipment_requests.client_id','public.inventory_items.id','public.inventory_items.client_id']),
      ('pending_request_over_available_stock','warning',$q$
        select count(*) from (select l.request_id,l.item_id,sum(l.quantity) quantity from public.shipment_request_items l join public.shipment_requests r on r.id=l.request_id where r.status in ('requested','confirmed') group by l.request_id,l.item_id) requested join public.inventory_items i on i.id=requested.item_id where requested.quantity>i.quantity_on_hand
      $q$,array['public.shipment_request_items.request_id','public.shipment_request_items.item_id','public.shipment_request_items.quantity','public.shipment_requests.id','public.shipment_requests.status','public.inventory_items.id','public.inventory_items.quantity_on_hand']),
      ('new_tables_without_rls','blocker',$q$
        select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('document_number_counters','wizard_requests','rfq_creation_requests','factory_purchase_orders','document_issue_requests') and not c.relrowsecurity
      $q$,array[]::text[]),
      ('new_044_factory_orders_mutation_grants','blocker',$q$
        select count(*) from (values ('authenticated'),('anon')) roles(name) where has_table_privilege(roles.name,'public.factory_purchase_orders','UPDATE') or has_table_privilege(roles.name,'public.factory_purchase_orders','DELETE')
      $q$,array['public.factory_purchase_orders.id']),
      ('post_038_ledger_mutation_grants','post_migration_blocker',$q$
        select count(*) from (values ('UPDATE'),('DELETE')) actions(name) where has_table_privilege('authenticated','public.inventory_transactions',actions.name)
      $q$,array['public.inventory_transactions.id']),
      ('ordered_factory_snapshot_invalid','blocker',$q$
        select count(*) from public.factory_purchase_orders where status='ordered' and (quantity<=0 or unit_price_usd<=0 or jsonb_typeof(snapshot) is distinct from 'object' or snapshot->>'variant_id' is null or snapshot->>'quantity' is distinct from quantity::text or (snapshot->>'unit_price_usd')::numeric is distinct from unit_price_usd)
      $q$,array['public.factory_purchase_orders.status','public.factory_purchase_orders.quantity','public.factory_purchase_orders.unit_price_usd','public.factory_purchase_orders.snapshot']),
      ('factory_order_planned_quantity_overflow','blocker',$q$
        select count(*) from public.factory_purchase_orders o join (select s.purchase_order_id,sum(l.expected_quantity) planned from public.inbound_shipments s join public.inbound_shipment_items l on l.shipment_id=s.id where s.status<>'cancelled' group by s.purchase_order_id) totals on totals.purchase_order_id=o.id where totals.planned>o.quantity
      $q$,array['public.factory_purchase_orders.id','public.factory_purchase_orders.quantity','public.inbound_shipments.id','public.inbound_shipments.purchase_order_id','public.inbound_shipments.status','public.inbound_shipment_items.shipment_id','public.inbound_shipment_items.expected_quantity']),
      ('factory_order_received_over_plan','blocker',$q$
        select count(*) from public.inbound_shipment_items l join public.inbound_shipments s on s.id=l.shipment_id where s.purchase_order_id is not null and l.received_quantity>l.expected_quantity
      $q$,array['public.inbound_shipment_items.shipment_id','public.inbound_shipment_items.received_quantity','public.inbound_shipment_items.expected_quantity','public.inbound_shipments.id','public.inbound_shipments.purchase_order_id']),
      ('reload_recovery_owner_policies','post_migration_blocker',$q$
        select 2-count(*) from pg_policies where schemaname='public' and
          ((tablename='rfq_creation_requests' and policyname='rfq_creation_request_owner_read') or
           (tablename='document_issue_requests' and policyname='document_issue_request_owner_read'))
      $q$,array[]::text[]),
      ('new_rpc_missing_after_release','post_migration_blocker',$q$
        select count(*) from (values
          ('ship_shipment_request_atomic(uuid)'),('receive_inbound_shipment_atomic(uuid,jsonb)'),('create_shipment_request_atomic(jsonb,text)'),('create_inbound_shipment_atomic(jsonb,text)'),
          ('record_inventory_transaction_atomic(jsonb)'),('create_inventory_item_atomic(jsonb)'),('set_deal_simple_status(uuid,public.simple_status,text,public.simple_status)'),('archive_deal_safely(uuid,boolean,text,text)'),
          ('select_quote_atomic(uuid)'),('reserve_document_number(text)'),('wizard_atomic(uuid,text,jsonb)'),('create_rfq_atomic(uuid,uuid,uuid[],uuid[],jsonb,date,text)'),
          ('create_factory_order_atomic(uuid,uuid,text)'),('issue_document_atomic(uuid,uuid,text,jsonb,jsonb)')
        ) expected(signature) where to_regprocedure('public.'||signature) is null
      $q$,array[]::text[]),
      ('new_internal_rpc_anon_execute_grants','blocker',$q$
        select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('ship_shipment_request_atomic','receive_inbound_shipment_atomic','create_shipment_request_atomic','create_inbound_shipment_atomic','record_inventory_transaction_atomic','create_inventory_item_atomic','set_deal_simple_status','archive_deal_safely','select_quote_atomic','reserve_document_number','wizard_atomic','create_rfq_atomic','create_factory_order_atomic','issue_document_atomic') and has_function_privilege('anon',p.oid,'EXECUTE')
      $q$,array[]::text[]),
      ('immutable_order_rpc_uses_update_lock','blocker',$q$
        select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('validate_inbound_source','create_inbound_shipment_atomic') and pg_get_functiondef(p.oid) ~* 'factory_purchase_orders[^;]*for update'
      $q$,array[]::text[]),
      ('saved_new_request_ledger_rows','inventory',$q$
        select (select count(*) from public.wizard_requests)+(select count(*) from public.rfq_creation_requests)+(select count(*) from public.document_issue_requests)
      $q$,array['public.wizard_requests.request_id','public.rfq_creation_requests.request_id','public.document_issue_requests.request_id'])
    ) checks(check_name,severity,query_text,required_columns)
  loop
    select count(*) into missing from unnest(r.required_columns) ref
      where not exists(select 1 from information_schema.columns c where c.table_schema=split_part(ref,'.',1) and c.table_name=split_part(ref,'.',2) and c.column_name=split_part(ref,'.',3));
    if missing>0 then
      raise notice '%',jsonb_build_object('check',r.check_name,'severity',r.severity,'status','not_applied_or_missing','count',null,'missing_column_count',missing);
      continue;
    end if;
    begin
      execute r.query_text into amount;
      raise notice '%',jsonb_build_object('check',r.check_name,'severity',r.severity,'status','checked','count',amount);
    exception when others then
      -- Never print SQLERRM: it may contain offending personal values.
      raise notice '%',jsonb_build_object('check',r.check_name,'severity',r.severity,'status','unverified','count',null,'sqlstate',sqlstate);
    end;
  end loop;
end
$preflight$;
rollback;
