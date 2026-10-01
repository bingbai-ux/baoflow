import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
const staff=randomUUID(),worker=randomUUID(),foreign=randomUUID(),factory=randomUUID(),deal=randomUUID(),order=randomUUID()
async function setup(){const db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;
create table profiles(id uuid primary key,role text,factory_id uuid);insert into profiles values('${staff}','sales',null),('${worker}','factory','${factory}'),('${foreign}','factory','${randomUUID()}');
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
create function is_staff() returns boolean language sql as $$select coalesce((select role in('sales','admin') from profiles where id=auth.uid()),false)$$;
create table factories(id uuid primary key,factory_name text,bank_info jsonb,updated_at timestamptz);insert into factories values('${factory}','Synthetic factory','{"raw":"Synthetic bank original"}',now());
create table deals(id uuid primary key,archived_at timestamptz,simple_status text default 'data_confirmed');insert into deals(id) values('${deal}');
create table factory_purchase_orders(id uuid primary key,source_quote_id uuid,deal_id uuid,factory_id uuid,status text,quantity integer,unit_price_usd numeric);insert into factory_purchase_orders values('${order}',null,'${deal}','${factory}','ordered',100,1);
create table client_document_packets(id uuid,deal_id uuid,document_type text,status text,snapshot jsonb);create table client_payment_receipts(packet_id uuid,amount_jpy bigint);
create function finance_packet_matches_live(uuid) returns boolean language sql as $$select true$$;
create function set_deal_simple_status(d uuid,s text,n text,e text) returns void language plpgsql as $$begin if (select simple_status from deals where id=d)<>e then raise exception 'Expected status mismatch';end if;update deals set simple_status=s where id=d;end$$;
set test.actor='${worker}';`);await db.exec(await readFile('supabase/migrations/20261001130755_factory_production_v1.sql','utf8'));return db}
const actor=(db:PGlite,id:string)=>db.query("select set_config('test.actor',$1,false)",[id])
const context=async(db:PGlite)=>(await db.query<any>('select factory_order_context($1) r',[order])).rows[0].r
const cmd=async(db:PGlite,op:string,input:unknown,key=randomUUID())=>(await db.query<any>('select factory_workflow_command($1,$2,$3,$4) r',[key,order,op,JSON.stringify(input)])).rows[0].r
async function agreement(db:PGlite,mode='partial_prepaid'){
 const bank=(await context(db)).registered_bank,proposal=await cmd(db,'propose_terms',{total_usd:'100',upfront_usd:mode==='postpaid'?'0':mode==='full_prepaid'?'100':'50',payment_mode:mode,balance_due:mode==='postpaid'?'after_delivery':'before_shipment',lead_days:'20',note:'Synthetic conditions',expected_bank:bank})
 const terms=(await context(db)).terms[0];await actor(db,staff);await cmd(db,'agree_terms',{terms_id:proposal.terms_id,expected_terms:terms,bank_verified:true,bank_evidence:'Synthetic registration and separate verification',note:'Synthetic agreement'});return proposal
}
test('factory final terms, staff transfer report, factory bank acknowledgment and production are separate',async()=>{const db=await setup();try{
 await agreement(db);await actor(db,worker);await assert.rejects(cmd(db,'start_production',{started_on:'2026-10-01',note:'Synthetic start'}),/upfront receipt/)
 await actor(db,staff);const key=randomUUID(),input={amount_usd:'50',sent_on:'2026-10-01',reference:'SYNTH-TRANSFER',sent_confirmed:true},report=await cmd(db,'report_transfer',input,key);assert.deepEqual(await cmd(db,'report_transfer',input,key),report);assert.equal(report.factory_receipt_confirmed,false)
 await assert.rejects(cmd(db,'ack_receipt',{report_id:report.report_id,amount_usd:'50',received_on:'2026-10-01',bank_reference:'Synthetic bank',bank_confirmed:true}),/Own factory/)
 await actor(db,worker);await assert.rejects(cmd(db,'start_production',{started_on:'2026-10-01',note:'Synthetic start'}),/upfront receipt/)
 await cmd(db,'ack_receipt',{report_id:report.report_id,amount_usd:'50',received_on:'2026-10-01',bank_reference:'SYNTH-BANK',bank_confirmed:true})
 const started=await cmd(db,'start_production',{started_on:'2026-10-01',note:'Synthetic actual start'});assert.equal(started.expected_completion_on,'2026-10-21')
 await actor(db,staff);await cmd(db,'advance_production',{});assert.equal((await db.query<any>('select simple_status from deals')).rows[0].simple_status,'in_production');await actor(db,worker)
 await assert.rejects(cmd(db,'start_production',{started_on:'2026-10-01',note:'Synthetic actual start'}),/unique/)
 assert.equal((await db.query('select * from factory_transfer_reports')).rows.length,1)
 }finally{await db.close()}})

test('bank changes after agreement stop new transfer instructions; direct production status bypass and late-save failure roll back',async()=>{const db=await setup();try{
 await agreement(db);await assert.rejects(db.exec("update deals set simple_status='in_production'"),/All active orders/)
 await db.exec("create function fail_factory_request() returns trigger language plpgsql as $$begin raise exception 'Synthetic late failure';end$$;create trigger fail_factory_request before insert on factory_workflow_requests for each row execute function fail_factory_request();")
 const key=randomUUID(),input={amount_usd:'50',sent_on:'2026-10-01',reference:'Synthetic transfer',sent_confirmed:true};await assert.rejects(cmd(db,'report_transfer',input,key),/late failure/);assert.equal((await db.query('select * from factory_transfer_reports')).rows.length,0)
 await db.exec('drop trigger fail_factory_request on factory_workflow_requests');await cmd(db,'report_transfer',input,key)
 await db.exec("update factories set bank_info='{}'");await assert.rejects(cmd(db,'report_transfer',{...input,reference:'Synthetic second transfer'}),/bank changed/)
 }finally{await db.close()}})

test('new financed case cannot create formal PO before full actual receipt or for an unapproved quote line',async()=>{const db=await setup();try{
 const invoice=randomUUID(),source=randomUUID(),packet={total:'1100',lines:[{quote_id:source}]};await db.query("insert into client_document_packets values($1,$2,'invoice','active',$3)",[invoice,deal,JSON.stringify(packet)])
 const insert=(q:string)=>db.query("insert into factory_purchase_orders values($1,$2,$3,$4,'ordered',100,1)",[randomUUID(),q,deal,factory])
 await assert.rejects(insert(source),/full receipt/);await db.query('insert into client_payment_receipts values($1,1100)',[invoice]);await insert(source)
 await assert.rejects(insert(randomUUID()),/full receipt/)
 }finally{await db.close()}})
test('postpaid is explicit and staff agreed, never inferred from missing payment; full prepay requires full receipt',async()=>{for(const mode of ['postpaid','full_prepaid']){const db=await setup();try{await agreement(db,mode);await actor(db,worker);const input={started_on:'2026-10-01',note:'Synthetic actual start'};if(mode==='postpaid')assert.ok((await cmd(db,'start_production',input)).started_on);else await assert.rejects(cmd(db,'start_production',input),/upfront receipt/)}finally{await db.close()}}})
test('bank changes, missing bank, stale proposal, incorrect PO amount and ambiguous payment terms are refused',async()=>{const db=await setup();try{
 const input={total_usd:'100',upfront_usd:'50',payment_mode:'partial_prepaid',balance_due:'before_shipment',lead_days:'20',expected_bank:(await context(db)).registered_bank,note:''}
 for(const bad of [{total_usd:'101'},{upfront_usd:'0'},{payment_mode:'unknown'},{lead_days:'0'}])await assert.rejects(cmd(db,'propose_terms',{...input,...bad}))
 await cmd(db,'propose_terms',input);const old=(await context(db)).terms[0];await cmd(db,'propose_terms',{...input,lead_days:'21'});await actor(db,staff)
 await assert.rejects(cmd(db,'agree_terms',{terms_id:old.id,expected_terms:old,bank_verified:true,bank_evidence:'Synthetic',note:'Synthetic'}),/Latest/)
 const latest=(await context(db)).terms[0];await db.exec("update factories set bank_info='{"+'"raw":"Changed synthetic bank"'+"}'");await assert.rejects(cmd(db,'agree_terms',{terms_id:latest.id,expected_terms:latest,bank_verified:true,bank_evidence:'Synthetic',note:'Synthetic'}),/bank changed/)
 await actor(db,worker);await assert.rejects(cmd(db,'propose_terms',input),/bank changed/);await db.exec("update factories set bank_info=null");await assert.rejects(cmd(db,'propose_terms',input),/Registered bank original/)
 }finally{await db.close()}})
test('foreign factory/client/logistics/anon isolation, immutable history and no direct write/TRUNCATE',async()=>{const db=await setup();try{
 await agreement(db);await actor(db,foreign);await assert.rejects(context(db),/unavailable/);await assert.rejects(cmd(db,'report_transfer',{}),/unavailable/)
 for(const role of ['client','logistics']){await actor(db,worker);await db.query('update profiles set role=$1 where id=$2',[role,worker]);await assert.rejects(context(db),/unavailable/)}
 for(const table of ['factory_final_terms','factory_terms_agreements','factory_transfer_reports','factory_bank_acknowledgments','factory_production_starts','factory_workflow_requests']){const g=(await db.query<any>("select has_table_privilege('authenticated',$1,'insert') i,has_table_privilege('authenticated',$1,'update') u,has_table_privilege('authenticated',$1,'delete') d,has_table_privilege('authenticated',$1,'truncate') t",[table])).rows[0];assert.deepEqual(g,{i:false,u:false,d:false,t:false})}
 assert.equal((await db.query<any>("select has_function_privilege('anon','factory_order_context(uuid)','execute') a")).rows[0].a,false);await assert.rejects(db.exec('delete from factory_terms_agreements'),/immutable/)
 }finally{await db.close()}})
