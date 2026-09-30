-- Explicit anon defaults survive REVOKE FROM PUBLIC on production.
-- Scope: already-approved internal workflows only; no creator default ACL change.
revoke execute on function
 public.create_inbound_shipment_atomic(jsonb,text),
 public.create_inventory_item_atomic(jsonb),
 public.create_shipment_request_atomic(jsonb,text),
 public.receive_inbound_shipment_atomic(uuid,jsonb),
 public.record_inventory_transaction_atomic(jsonb),
 public.select_quote_atomic(uuid),
 public.ship_shipment_request_atomic(uuid),
 public.wizard_atomic(uuid,text,jsonb)
from anon;
-- Keep authenticated grants and in-function actor/RLS guards unchanged.
-- Rollback must retain anon denial; revert application with issuance disabled.
