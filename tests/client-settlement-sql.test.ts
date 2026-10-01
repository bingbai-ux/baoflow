import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'

const staff=randomUUID(),client=randomUUID(),foreign=randomUUID(),party=randomUUID(),other=randomUUID(),deal=randomUUID(),quote=randomUUID(),variant=randomUUID(),product=randomUUID()
async function setup(){
 const db=new PGlite()
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create table clients(id uuid primary key);insert into clients values('${party}'),('${other}');
 create table profiles(id uuid primary key,role text,client_id uuid);insert into profiles values('${staff}','sales',null),('${client}','client','${party}'),('${foreign}','client','${other}');
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
 create function is_staff() returns boolean language sql as $$select coalesce((select role in('sales','admin') from profiles where id=auth.uid()),false)$$;
 create table deals(id uuid primary key,client_id uuid,archived_at timestamptz,simple_status text default 'quoting');insert into deals(id,client_id) values('${deal}','${party}');
 create table documents(id uuid primary key,deal_id uuid,document_type text,document_number text,version integer,issued_at timestamptz,metadata jsonb);
 create table deal_quotes(id uuid primary key,deal_id uuid,variant_id uuid,status text,quantity integer,selling_price_jpy numeric,total_billing_jpy numeric,total_billing_tax_jpy numeric);
 insert into deal_quotes values('${quote}','${deal}','${variant}','approved',2,500,1000,1100);
 create function set_deal_simple_status(d uuid,s text,n text,e text) returns void language plpgsql as $$begin if (select simple_status from deals where id=d)<>e then raise exception 'Expected status mismatch';end if;update deals set simple_status=s where id=d;end$$;
 set test.actor='${staff}';`)
 await db.exec(await readFile('supabase/migrations/20261001121648_client_settlement_v1.sql','utf8'))
 return db
}
async function actor(db:PGlite,id:string){await db.query("select set_config('test.actor',$1,false)",[id])}
const cmd=async(db:PGlite,op:string,input:unknown,key=randomUUID())=>(await db.query<any>('select client_finance_command($1,$2,$3) r',[key,op,JSON.stringify(input)])).rows[0].r
async function document(db:PGlite,type='quotation'){
 const id=randomUUID(),snapshot={deal:{client_id:party,deal_name:'Synthetic order',deal_code:'SYNTH-1',client_name_text:'Synthetic customer'},quotes:[{id:quote,variant_id:variant,status:'approved',quantity:2,selling_price_jpy:500,total_billing_jpy:1000,total_billing_tax_jpy:1100,supplier_price_usd:123}],products:[{id:product,description:'Synthetic product'}],variants:[{id:variant,product_id:product,variant_label:'Synthetic variant'}],fees:[],company:{name:'Synthetic issuer'},banks:[{bank_name:'Synthetic bank',account_number:'0000000'}]}
 await db.query('insert into documents values($1,$2,$3,$4,1,clock_timestamp(),$5)',[id,deal,type,`SYNTH-${id}`,JSON.stringify({snapshot,payment_due_date:'2026-10-31'})]);return id
}
async function publish(db:PGlite,id:string,approval:string|null=null){const expected=(await db.query<any>('select preview_client_document($1,$2) r',[id,approval])).rows[0].r;return cmd(db,'publish_document',{document_id:id,approval_packet_id:approval,expected})}
async function invoice(db:PGlite){const q=await publish(db,await document(db));await actor(db,client);await cmd(db,'respond_quote',{packet_id:q.packet_id,token:q.token,decision:'approved',note:''});await actor(db,staff);await cmd(db,'advance_quote',{packet_id:q.packet_id});return publish(db,await document(db,'invoice'),q.packet_id)}

test('approval, declaration, bank evidence and explicit progression are distinct; no factory cost projection',async()=>{const db=await setup();try{
 const bill=await invoice(db);await actor(db,client)
 const ctx=(await db.query<any>('select client_finance_context($1,$2) r',[bill.packet_id,bill.token])).rows[0].r
 assert.equal(JSON.stringify(ctx).includes('supplier_price'),false)
 const input={packet_id:bill.packet_id,token:bill.token,amount_jpy:'1100',paid_on:'2026-10-01',reference:'Synthetic remittance'},key=randomUUID(),report=await cmd(db,'report_payment',input,key)
 assert.deepEqual(await cmd(db,'report_payment',input,key),report);assert.equal(report.payment_confirmed,false)
 assert.deepEqual(await cmd(db,'report_payment',input),report);assert.equal((await db.query('select * from client_payment_reports')).rows.length,1)
 assert.equal((await db.query<any>('select simple_status from deals')).rows[0].simple_status,'quote_confirmed')
 await actor(db,staff);await assert.rejects(cmd(db,'advance_paid',{packet_id:bill.packet_id}),/full bank receipt/)
 await assert.rejects(db.exec("update deals set simple_status='paid'"),/full bank receipt/)
 await cmd(db,'confirm_receipt',{packet_id:bill.packet_id,report_id:report.report_id,amount_jpy:'400',received_on:'2026-10-01',bank_reference:'SYNTH-BANK-1',bank_confirmed:true})
 await assert.rejects(cmd(db,'confirm_receipt',{packet_id:bill.packet_id,report_id:report.report_id,amount_jpy:'400',received_on:'2026-10-01',bank_reference:' synth-bank-1 ',bank_confirmed:true}),/unique/)
 await assert.rejects(cmd(db,'advance_paid',{packet_id:bill.packet_id}),/full bank receipt/)
 await cmd(db,'confirm_receipt',{packet_id:bill.packet_id,report_id:report.report_id,amount_jpy:'700',received_on:'2026-10-01',bank_reference:'SYNTH-BANK-2',bank_confirmed:true})
 assert.equal((await db.query<any>('select simple_status from deals')).rows[0].simple_status,'quote_confirmed')
 await cmd(db,'advance_paid',{packet_id:bill.packet_id});assert.equal((await db.query<any>('select simple_status from deals')).rows[0].simple_status,'paid')
 await assert.rejects(cmd(db,'cancel_packet',{packet_id:bill.packet_id,reason:'Correction'}),/accounting correction/)
 }finally{await db.close()}})

test('other company, expired or wrong packet link, role escalation and replay deny; portal identity is still required',async()=>{const db=await setup();try{
 const bill=await invoice(db);await actor(db,foreign);await assert.rejects(db.query('select client_finance_context($1,$2)',[bill.packet_id,bill.token]),/unavailable/)
 await actor(db,client);await assert.rejects(cmd(db,'confirm_receipt',{packet_id:bill.packet_id}),/Client response operation/)
 await assert.rejects(db.query('select client_finance_context($1,$2)',[bill.packet_id,'a'.repeat(64)]),/expired/)
 // Advance logical time by creating an expired link, without mutating an immutable published link.
 await db.query("insert into client_document_links(packet_id,token,expires_at,created_by) values($1,$2,now()-interval '1 day',$3)",[bill.packet_id,'b'.repeat(64),staff])
 await assert.rejects(cmd(db,'report_payment',{packet_id:bill.packet_id,token:'b'.repeat(64),amount_jpy:'100',paid_on:'2026-10-01',reference:'Synthetic'}),/expired/)
 assert.ok((await db.query<any>('select client_finance_context($1,null) r',[bill.packet_id])).rows[0].r)
 const key=randomUUID(),input={packet_id:bill.packet_id,amount_jpy:'100',paid_on:'2026-10-01',reference:'Synthetic'};await cmd(db,'report_payment',input,key)
 await assert.rejects(cmd(db,'report_payment',{...input,amount_jpy:'200'},key),/different input/)
 await actor(db,foreign);await assert.rejects(cmd(db,'report_payment',input,key),/different input/)
 }finally{await db.close()}})

test('current price drift, legacy missing identity, premature invoice and immutable history are protected',async()=>{const db=await setup();try{
 const id=await document(db),q=await publish(db,id)
 await assert.rejects(document(db,'invoice'),/customer approval/)
 await actor(db,client);await cmd(db,'respond_quote',{packet_id:q.packet_id,decision:'approved',note:''});await actor(db,staff)
 await db.exec('update deal_quotes set selling_price_jpy=600')
 await assert.rejects(cmd(db,'advance_quote',{packet_id:q.packet_id}),/current price/)
 await assert.rejects(document(db,'invoice'),/customer approval/)
 await assert.rejects(db.query("update documents set metadata='{}' where id=$1",[id]),/immutable/)
 await assert.rejects(db.exec('delete from client_document_responses'),/immutable/)
 const legacy=await document(db);await db.query("update documents set metadata=jsonb_set(metadata,'{snapshot,deal,client_id}','null') where id=$1",[legacy]);await assert.rejects(publish(db,legacy),/Frozen customer identity/)
 }finally{await db.close()}})

test('table writes/TRUNCATE and anonymous RPC are denied; private bank details and other-company packets remain hidden',async()=>{const db=await setup();try{
 await invoice(db)
 for(const table of ['client_document_packets','client_document_links','client_document_responses','client_payment_reports','client_payment_receipts','client_finance_requests','client_document_mail_receipts']){
 const g=(await db.query<any>("select has_table_privilege('authenticated',$1,'insert') i,has_table_privilege('authenticated',$1,'update') u,has_table_privilege('authenticated',$1,'delete') d,has_table_privilege('authenticated',$1,'truncate') t",[table])).rows[0];assert.deepEqual(g,{i:false,u:false,d:false,t:false})}
 assert.equal((await db.query<any>("select has_function_privilege('anon','client_finance_context(uuid,text)','execute') a")).rows[0].a,false)
 await db.exec('grant usage on schema auth to authenticated;grant select on profiles to authenticated');await actor(db,client);await db.exec('set role authenticated')
 assert.equal((await db.query('select * from client_document_packets')).rows.length,2);assert.equal((await db.query('select * from client_document_links')).rows.length,0);assert.equal((await db.query('select * from client_payment_receipts')).rows.length,0)
 await db.exec('reset role');await actor(db,foreign);await db.exec('set role authenticated');assert.equal((await db.query('select * from client_document_packets')).rows.length,0)
 }finally{await db.close()}})

test('cancelled packet cannot bypass approval; email uncertain results never allow a long-retry resend',async()=>{const db=await setup();try{
 const bill=await invoice(db),payload={from:'sender@example.test',to:'customer@example.test',token:bill.token,pdf_sha256:'a'.repeat(64)},claim=async()=>(await db.query<any>('select claim_client_document_email($1,$2) r',[bill.packet_id,JSON.stringify(payload)])).rows[0].r
 const first=await claim();assert.equal(first.claimed,true)
 await assert.rejects(db.query("select finish_client_document_email($1,$2,'accepted','synthetic-provider')",[bill.packet_id,randomUUID()]),/mismatch/)
 await db.exec("update client_document_mail_receipts set created_at=now()-interval '2 months'");assert.deepEqual(await claim(),{claimed:false,status:'attempting'})
 await db.query("select finish_client_document_email($1,$2,'unknown',null)",[bill.packet_id,first.attempt_id]);assert.deepEqual(await claim(),{claimed:false,status:'unknown'})
 await cmd(db,'cancel_packet',{packet_id:bill.packet_id,reason:'Synthetic correction'})
 await assert.rejects(db.exec("update deals set simple_status='paid'"),/full bank receipt/)
 await actor(db,client);await assert.rejects(db.query('select client_finance_context($1,$2)',[bill.packet_id,bill.token]),/unavailable/)
 }finally{await db.close()}})

test('late request-save failure rolls back payment declaration; staff privilege downgrade cannot read old privileged requests',async()=>{const db=await setup();try{
 const bill=await invoice(db);await actor(db,client)
 await db.exec("create function fail_finance_request() returns trigger language plpgsql as $$begin raise exception 'Synthetic request failure';end$$;create trigger fail_finance_request before insert on client_finance_requests for each row execute function fail_finance_request();")
 const input={packet_id:bill.packet_id,amount_jpy:'100',paid_on:'2026-10-01',reference:'Synthetic'},key=randomUUID()
 await assert.rejects(cmd(db,'report_payment',input,key),/request failure/);assert.equal((await db.query('select * from client_payment_reports')).rows.length,0)
 await db.exec('drop trigger fail_finance_request on client_finance_requests');await cmd(db,'report_payment',input,key);assert.equal((await db.query('select * from client_payment_reports')).rows.length,1)
 await db.exec('grant usage on schema auth to authenticated;grant select on profiles to authenticated');await actor(db,staff);await db.exec("update profiles set role='factory' where id=auth.uid();set role authenticated")
 assert.equal((await db.query('select * from client_finance_requests')).rows.length,0)
 }finally{await db.close()}})

async function paymentSetup(){const db=await setup();await db.exec(`
create table factory_purchase_orders(id uuid default gen_random_uuid(),deal_id uuid,source_quote_id uuid);
create table shipment_plans(id uuid default gen_random_uuid(),deal_id uuid);
create table shipment_milestones(plan_id uuid);
`);await db.exec(await readFile('supabase/migrations/20261001162000_client_payment_conditions_v1.sql','utf8'));await db.exec('create trigger guard_financed_factory_order before insert on factory_purchase_orders for each row execute function guard_financed_factory_order()');return db}
async function termsPublish(db:PGlite,id:string,approval:string|null,mode:string,balance:string){const expected=(await db.query<any>('select preview_client_document_with_terms($1,$2,$3,$4) r',[id,approval,mode,balance])).rows[0].r;return {published:await cmd(db,'publish_document',{document_id:id,approval_packet_id:approval,expected}),expected}}
async function termsInvoice(db:PGlite,mode:string,balance:string){const q=await termsPublish(db,await document(db),null,mode,balance);await actor(db,client);await cmd(db,'respond_quote',{packet_id:q.published.packet_id,decision:'approved',note:''});await actor(db,staff);await cmd(db,'advance_quote',{packet_id:q.published.packet_id});return termsPublish(db,await document(db,'invoice'),q.published.packet_id,'postpaid','after_delivery')}
async function termsReceipt(db:PGlite,packet:string,amount:string,ref:string){await actor(db,client);const r=await cmd(db,'report_payment',{packet_id:packet,amount_jpy:amount,paid_on:'2026-10-01',reference:ref});await actor(db,staff);return cmd(db,'confirm_receipt',{packet_id:packet,report_id:r.report_id,amount_jpy:amount,received_on:'2026-10-01',bank_reference:ref,bank_confirmed:true})}
test('half prepaid is an approved immutable rule: upfront PO gate and distinct shipment balance, never full receipt',async()=>{const db=await paymentSetup();try{
 const b=await termsInvoice(db,'half_prepaid','before_shipment'),id=b.published.packet_id
 assert.equal(b.expected.payment_conditions.upfront_jpy,'550');assert.equal(b.expected.payment_conditions.shipment_required_jpy,'1100')
 await assert.rejects(cmd(db,'advance_paid',{packet_id:id}),/upfront/)
 await assert.rejects(db.query('insert into factory_purchase_orders(deal_id,source_quote_id) values($1,$2)',[deal,quote]),/Formal PO/)
 await termsReceipt(db,id,'549','SYNTH-HALF-1');await assert.rejects(cmd(db,'advance_paid',{packet_id:id}),/upfront/)
 await termsReceipt(db,id,'1','SYNTH-HALF-2');await cmd(db,'advance_paid',{packet_id:id});await db.query('insert into factory_purchase_orders(deal_id,source_quote_id) values($1,$2)',[deal,quote])
 await actor(db,client);assert.equal((await db.query<any>('select client_finance_context($1,null) r',[id])).rows[0].r.paid_in_full,false);await actor(db,staff)
 await assert.rejects(db.query('insert into shipment_plans(deal_id) values($1)',[deal]),/shipment balance/)
 await termsReceipt(db,id,'550','SYNTH-HALF-3');await db.query('insert into shipment_plans(deal_id) values($1)',[deal])
 await assert.rejects(db.query("update client_document_packets set snapshot=jsonb_set(snapshot,'{payment_conditions,upfront_jpy}','\"0\"') where id=$1",[id]),/immutable/)
 }finally{await db.close()}})
test('postpaid and half balance after delivery preserve actual unpaid invoice; approvals/price match still gate PO and shipment',async()=>{for(const mode of ['postpaid','half_prepaid']){const db=await paymentSetup();try{
 const b=await termsInvoice(db,mode,'after_delivery'),id=b.published.packet_id
 if(mode==='half_prepaid')await termsReceipt(db,id,'550','SYNTH-UPFRONT')
 await cmd(db,'advance_paid',{packet_id:id});await db.query('insert into factory_purchase_orders(deal_id,source_quote_id) values($1,$2)',[deal,quote]);await db.query('insert into shipment_plans(deal_id) values($1)',[deal])
 await actor(db,client);const context=(await db.query<any>('select client_finance_context($1,null) r',[id])).rows[0].r;assert.equal(context.paid_in_full,false);assert.equal(context.confirmed_jpy,mode==='postpaid'?'0':'550');await actor(db,staff)
 await db.exec('update deal_quotes set selling_price_jpy=501');await assert.rejects(db.query('insert into factory_purchase_orders(deal_id,source_quote_id) values($1,$2)',[deal,quote]),/Formal PO/);await assert.rejects(db.query('insert into shipment_plans(deal_id) values($1)',[deal]),/shipment balance/)
 }finally{await db.close()}}})
test('legacy snapshots default full payment; terms preview is staff-only and half odd-yen rounding is deterministic',async()=>{const db=await paymentSetup();try{
 const b=await invoice(db);await assert.rejects(cmd(db,'advance_paid',{packet_id:b.packet_id}),/upfront/)
 const id=await document(db);await actor(db,foreign);await assert.rejects(db.query("select preview_client_document_with_terms($1,null,'postpaid','after_delivery')",[id]),/Sales/);await actor(db,staff)
 const rules=(await db.query<any>("select client_payment_conditions(1101,'half_prepaid','after_delivery') r")).rows[0].r;assert.equal(rules.upfront_jpy,'551');assert.equal(rules.shipment_required_jpy,'551')
 await assert.rejects(db.query("select client_payment_conditions(1101,'postpaid','before_shipment')"),/timing/)
 await assert.rejects(db.query("select client_payment_conditions(1101,null,'before_shipment')"),/Explicit/)
 }finally{await db.close()}})

test('customer revision loop creates a new payment-condition version without altering the rejected quote or approving its invoice',async()=>{const db=await paymentSetup();try{
 const first=await termsPublish(db,await document(db),null,'full_prepaid','before_shipment');await actor(db,client);await cmd(db,'respond_quote',{packet_id:first.published.packet_id,decision:'revision_requested',note:'Synthetic request for half payment'});await actor(db,staff)
 await assert.rejects(cmd(db,'advance_quote',{packet_id:first.published.packet_id}),/approval/)
 const second=await termsPublish(db,await document(db),null,'half_prepaid','after_delivery');await actor(db,client);await cmd(db,'respond_quote',{packet_id:second.published.packet_id,decision:'approved',note:'Synthetic agreement to revised conditions'});await actor(db,staff);await cmd(db,'advance_quote',{packet_id:second.published.packet_id})
 const bill=await termsPublish(db,await document(db,'invoice'),second.published.packet_id,'full_prepaid','before_shipment');assert.equal(bill.expected.payment_conditions.mode,'half_prepaid');assert.equal(bill.expected.payment_conditions.balance_due,'after_delivery')
 const original=(await db.query<any>('select status,snapshot from client_document_packets where id=$1',[first.published.packet_id])).rows[0];assert.equal(original.status,'superseded');assert.equal(original.snapshot.payment_conditions.mode,'full_prepaid')
 assert.equal((await db.query<any>('select decision from client_document_responses where packet_id=$1',[first.published.packet_id])).rows[0].decision,'revision_requested')
 }finally{await db.close()}})
