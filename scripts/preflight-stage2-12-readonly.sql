-- READ ONLY aggregate audit; no customer names, identifiers, payloads, keys or rows.
-- Baseline 052; before apply missing objects are pending, AFTER apply must be zero.
-- Use existing authorized RLS-bypass reader. No privilege escalation or new credential.
begin transaction read only;
set local statement_timeout='30s';set local lock_timeout='2s';
do $audit$
declare tables text[]:=array['case_chat_reads','client_document_links','client_document_mail_receipts','client_document_packets','client_document_responses','client_finance_requests','client_payment_receipts','client_payment_reports','factory_bank_acknowledgments','factory_final_terms','factory_production_starts','factory_qc_assets','factory_qc_requests','factory_qc_reviews','factory_qc_submissions','factory_terms_agreements','factory_transfer_reports','factory_workflow_requests','quote_cost_lines','quote_pricing_requests','sample_costs','sample_estimates','sample_invoice_lines','sample_invoices','sample_mail_receipts','sample_payments','sample_requests','sample_rounds','shipment_customer_receipts','shipment_delivery_documents','shipment_mail_receipts','shipment_milestones','shipment_plans','shipment_workflow_requests']; functions text[]:=array['bind_sample_invoice_client','case_chat_allowed','case_chat_peer_valid','case_chat_targets','claim_client_document_email','claim_rfq_email_v2','claim_sample_email','claim_shipment_email','client_document_send_state','client_finance_command','client_finance_context','client_invoice_threshold','client_payment_family','client_payment_totals','client_sample_invoices','create_rfq_v2','ext_rfq_context','ext_submit_rfq','factory_order_context','factory_order_ship_ready','factory_qc_approved_quantity','factory_qc_command','factory_qc_context','factory_qc_reserved_quantity','factory_qc_storage_scope','factory_workflow_command','finance_packet_matches_live','finish_client_document_email','finish_client_document_resend','finish_sample_email','finish_shipment_email','guard_client_invoice_issue','guard_client_shipment_payment','guard_factory_production_progress','guard_factory_qc_allocation','guard_factory_qc_inbound_reactivation','guard_factory_qc_shipment','guard_finance_progress','guard_financed_factory_order','guard_shipment_customer_completion','import_pending_rfq_answer','issue_document_atomic','list_case_chats','mark_case_chat_read','my_shipment_orders','open_case_chat','preview_client_document','preview_client_document_with_terms','preview_client_price_reissue','preview_client_reissue','preview_quote_pricing_v2','preview_rfq_v2','preview_sample_invoice','read_case_chat','sample_command','save_quote_pricing_v2','send_case_chat','shipment_command','shipment_context','shipment_delivery_context','shipment_order_role','shipment_request_visible','staff_client_finance_summary'];n bigint;ok boolean;
begin
 select coalesce(rolsuper or rolbypassrls,false) into ok from pg_roles where rolname=current_user;
 if not coalesce(ok,false) then raise notice '%',jsonb_build_object('check','visibility','status','blocked_authorized_reader_required');return;end if;
 select count(*) into n from unnest(tables) t where to_regclass('public.'||t) is null;
 raise notice '%',jsonb_build_object('check','missing_candidate_tables','count',n,'expected_after_apply',0);
 select count(*) into n from pg_class c join pg_namespace ns on ns.oid=c.relnamespace where ns.nspname='public' and c.relname=any(tables) and not c.relrowsecurity;
 raise notice '%',jsonb_build_object('check','candidate_rls_disabled','count',n,'expected',0);
 select count(*) into n from pg_class c join pg_namespace ns on ns.oid=c.relnamespace where ns.nspname='public' and c.relname=any(tables) and (has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') or has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'));
 raise notice '%',jsonb_build_object('check','candidate_direct_or_anon_table_access','count',n,'expected',0);
 select count(*) into n from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace where ns.nspname='public' and p.proname=any(functions) and p.prosecdef and p.proname not in('ext_rfq_context','ext_submit_rfq') and has_function_privilege('anon',p.oid,'EXECUTE');
 raise notice '%',jsonb_build_object('check','candidate_definer_anon_execute','count',n,'expected',0);
 select count(*) into n from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace where ns.nspname='public' and p.proname=any(functions) and p.prosecdef and not coalesce(p.proconfig@>array['search_path=public, pg_temp'],false);
 raise notice '%',jsonb_build_object('check','candidate_definer_search_path','count',n,'expected',0);
 select count(*) into n from unnest(functions) f where not exists(select 1 from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace where ns.nspname='public' and p.proname=f and p.prosecdef);
 raise notice '%',jsonb_build_object('check','missing_candidate_definers','count',n,'expected_after_apply',0);
 select count(*) into n from pg_policies where schemaname='public' and tablename in('chat_rooms','chat_messages') and (cmd<>'SELECT' or coalesce(qual,'') in('true','(true)'));
 raise notice '%',jsonb_build_object('check','chat_broad_or_write_policies','count',n,'expected_after_apply',0);
 if to_regclass('storage.buckets') is not null then
  execute 'select count(*) from storage.buckets where id=''factory-qc'' and not public' into n;
  raise notice '%',jsonb_build_object('check','private_qc_bucket_exists','count',n,'expected_after_apply',1);
 end if;
 if to_regclass('public.deal_quotes') is not null then
  execute 'select count(*) from public.deal_quotes where status=''approved'' and variant_id is null' into n;
  raise notice '%',jsonb_build_object('check','legacy_unbound_quotes_preserve_manual_resolution','count',n,'severity','warning_no_guess_backfill');
 end if;
end$audit$;
rollback;
