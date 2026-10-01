import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
const actor=randomUUID(),deal=randomUUID(),product=randomUUID(),variant=randomUUID(),factory=randomUUID()
async function setup(){const db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;
create table profiles(id uuid primary key,role text);insert into profiles values('${actor}','sales');
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
create function is_staff() returns boolean language sql as $$select coalesce((select role in('sales','admin') from profiles where id=auth.uid()),false)$$;
set test.actor='${actor}';create table deals(id uuid primary key,deal_code text,deal_name text,client_name_text text,archived_at timestamptz);
insert into deals values('${deal}','SYNTH-1','Synthetic samples','Synthetic customer',null);
create table deal_products(id uuid primary key,deal_id uuid,description text default 'Synthetic product');insert into deal_products(id,deal_id) values('${product}','${deal}');
create table deal_product_variants(id uuid primary key,product_id uuid,variant_label text default 'Synthetic variant');insert into deal_product_variants(id,product_id) values('${variant}','${product}');
create table deal_samples(deal_id uuid,round_number integer);create table factories(id uuid primary key);insert into factories values('${factory}');create table system_settings(company_info_phase1 jsonb);insert into system_settings values('{"name":"Synthetic issuer"}');`);
await db.exec(await readFile('supabase/migrations/20261001111822_sample_ledger_v1.sql','utf8'));return db}
const roundInput=()=>({product_id:product,variant_id:variant,factory_id:factory,quantity:2,due_date:'2026-10-20',note:'Synthetic order'})
const cmd=async(db:PGlite,op:string,input:unknown,key=randomUUID(),expected:unknown=null)=>(await db.query<{r:any}>('select sample_command($1,$2,$3,$4,$5) r',[key,deal,op,JSON.stringify(input),JSON.stringify(expected)])).rows[0].r
const costInput=(id:string,kind='manufacturing')=>({round_id:id,kind,carrier:kind==='shipping'?'FedEx':null,estimate:'25',amount:'20',currency:'USD',fx:{rate:'150',reference:'Synthetic FX',as_of:'2026-10-01T00:00:00Z',confirmed:true},customer_charge_jpy:'1500',basis:'Confirmed synthetic expense',confirmed:true})
const invoiceInput=(ids:string[])=>({cost_ids:ids,tax_rate:'10',issue_date:'2026-10-01',due_date:'2026-10-31',payment_details:'Synthetic bank details'})
const preview=async(db:PGlite,i:unknown)=>(await db.query<{p:any}>('select preview_sample_invoice($1,$2) p',[deal,JSON.stringify(i)])).rows[0].p
test('independent rounds, actual manufacturing/carrier expenses, separate factory payment, batch billing and stable retry',async()=>{const db=await setup();try{
 const key=randomUUID(),r1=await cmd(db,'create_round',roundInput(),key);assert.deepEqual(await cmd(db,'create_round',roundInput(),key),r1);const r2=await cmd(db,'create_round',roundInput());assert.equal(r2.round_number,2)
 await assert.rejects(cmd(db,'create_round',{...roundInput(),quantity:3},key),/different input/)
 await cmd(db,'record_estimate',{round_id:r1.id,kind:'manufacturing',carrier:null,amount:'25',currency:'USD',basis:'Synthetic estimate'});assert.equal((await db.query('select * from sample_costs')).rows.length,0)
 const c1=await cmd(db,'add_cost',costInput(r1.id)),c2=await cmd(db,'add_cost',costInput(r2.id,'shipping'));
 await cmd(db,'record_payment',{round_id:r1.id,amount:20,currency:'USD',paid_on:'2026-10-01',reference:'Synthetic transfer receipt'})
 assert.equal((await db.query('select * from sample_invoice_lines')).rows.length,0)
 const i=invoiceInput([c1.id,c2.id]),p=await preview(db,i);assert.equal(p.subtotal,'3000');assert.equal(p.tax,'300');assert.equal(p.total,'3300');assert.equal(p.lines[1].carrier,'FedEx');assert.equal(p.manufacturing_price_included,false)
 assert.equal((await db.query('select * from sample_invoices')).rows.length,0)
 const issueKey=randomUUID(),bill=await cmd(db,'issue_invoice',i,issueKey,p);assert.deepEqual(await cmd(db,'issue_invoice',i,issueKey,p),bill)
 await assert.rejects(preview(db,i),/already billed/);await assert.rejects(cmd(db,'issue_invoice',i,randomUUID(),p),/already billed/)
 const cancelKey=randomUUID(),cancel=await cmd(db,'cancel_invoice',{invoice_id:bill.id,reason:'Correction'},cancelKey);assert.deepEqual(await cmd(db,'cancel_invoice',{invoice_id:bill.id,reason:'Correction'},cancelKey),cancel)
 assert.deepEqual(await cmd(db,'issue_invoice',i,issueKey,p),bill)
 const reinput={...i,previous_invoice_id:bill.id},rep=await preview(db,reinput),reissued=await cmd(db,'issue_invoice',reinput,randomUUID(),rep);assert.notEqual(reissued.id,bill.id)
 const old=(await db.query<any>('select * from sample_invoices where id=$1',[bill.id])).rows[0];assert.equal(old.status,'cancelled');assert.equal(old.snapshot.total,'3300');assert.equal((await db.query('select * from sample_invoice_lines where released_at is null')).rows.length,2)
 }finally{await db.close()}})
test('missing amount/FX, nonpositive quantity, unrelated variant, unsupported carrier and premature status cannot save',async()=>{const db=await setup();try{
 await assert.rejects(cmd(db,'create_round',{...roundInput(),quantity:0}));await assert.rejects(cmd(db,'create_round',{...roundInput(),variant_id:randomUUID()}),/Product variant/)
 const r=await cmd(db,'create_round',roundInput());for(const bad of [{amount:null},{confirmed:false},{fx:{}},{currency:'RMB'},{kind:'shipping',carrier:'Unknown'}])await assert.rejects(cmd(db,'add_cost',{...costInput(r.id),...bad}));
 assert.equal((await db.query('select * from sample_costs')).rows.length,0);await assert.rejects(cmd(db,'set_status',{round_id:r.id,status:'approved'}),/Invalid sample transition/)
 for(const status of ['manufacturing','shipping','arrived','revision_requested'])await cmd(db,'set_status',{round_id:r.id,status})
 await assert.rejects(cmd(db,'set_status',{round_id:r.id,status:'requested'}));
 }finally{await db.close()}})
test('stale invoice preview and late allocation failure roll back invoice and request; snapshots immutable',async()=>{const db=await setup();try{
 const r=await cmd(db,'create_round',roundInput()),c=await cmd(db,'add_cost',costInput(r.id)),i=invoiceInput([c.id]),p=await preview(db,i);
 await assert.rejects(cmd(db,'issue_invoice',{...i,tax_rate:'8'},randomUUID(),p),/Preview changed/)
 await db.exec(`create function fail_sample_line() returns trigger language plpgsql as $$begin raise exception 'Forced allocation failure';end$$;create trigger fail_sample_line before insert on sample_invoice_lines for each row execute function fail_sample_line();`)
 const key=randomUUID();await assert.rejects(cmd(db,'issue_invoice',i,key,p),/Forced allocation/);assert.equal((await db.query('select * from sample_invoices')).rows.length,0);assert.equal((await db.query('select * from sample_requests where id=$1',[key])).rows.length,0)
 await db.exec('drop trigger fail_sample_line on sample_invoice_lines');const bill=await cmd(db,'issue_invoice',i,key,p)
 await assert.rejects(db.query('update sample_costs set amount=0 where id=$1',[c.id]),/immutable/);await assert.rejects(db.query('delete from sample_invoices where id=$1',[bill.id]),/immutable/);await assert.rejects(db.query("update sample_invoices set snapshot='{}' where id=$1",[bill.id]),/immutable/)
 }finally{await db.close()}})
test('role RPC denial, table write/TRUNCATE denial, private request RLS and anonymous execute denial',async()=>{const db=await setup();try{
 for(const role of ['client','factory','logistics']){await db.query('update profiles set role=$1',[role]);await assert.rejects(cmd(db,'create_round',roundInput()),/Sales or administrator/);await assert.rejects(preview(db,invoiceInput([])),/Sales or administrator/)}
 for(const table of ['sample_rounds','sample_estimates','sample_costs','sample_payments','sample_invoices','sample_invoice_lines','sample_requests','sample_mail_receipts']){const g=(await db.query<any>(`select has_table_privilege('authenticated',$1,'insert') i,has_table_privilege('authenticated',$1,'update') u,has_table_privilege('authenticated',$1,'delete') d,has_table_privilege('authenticated',$1,'truncate') t`,[table])).rows[0];assert.deepEqual(g,{i:false,u:false,d:false,t:false})}
 assert.equal((await db.query<any>("select has_function_privilege('anon','sample_command(uuid,uuid,text,jsonb,jsonb)','execute') a")).rows[0].a,false)
 await db.exec("update profiles set role='sales'");await cmd(db,'create_round',roundInput());await db.exec("grant usage on schema auth to authenticated;grant select on profiles to authenticated;set role authenticated;");assert.equal((await db.query('select * from sample_rounds')).rows.length,1);await db.exec("reset role;update profiles set role='client';set role authenticated;");assert.equal((await db.query('select * from sample_rounds')).rows.length,0)
 }finally{await db.close()}})
test('unbilled cost correction keeps original expense; active allocation blocks correction',async()=>{const db=await setup();try{
 const r=await cmd(db,'create_round',roundInput()),c=await cmd(db,'add_cost',costInput(r.id)),i=invoiceInput([c.id]),p=await preview(db,i),bill=await cmd(db,'issue_invoice',i,randomUUID(),p)
 await assert.rejects(cmd(db,'void_cost',{cost_id:c.id,reason:'Correction'}),/Unbilled/);await cmd(db,'cancel_invoice',{invoice_id:bill.id,reason:'Correction'});await cmd(db,'void_cost',{cost_id:c.id,reason:'Wrong expense'})
 await assert.rejects(preview(db,i),/already billed/);const original=(await db.query<any>('select * from sample_costs where id=$1',[c.id])).rows[0];assert.equal(Number(original.amount),20);assert.ok(original.voided_at)
 }finally{await db.close()}})
test('mail receipt survives long retry and finish failure; unknown/accepted never claim another send',async()=>{const db=await setup();try{
 const r=await cmd(db,'create_round',roundInput()),c=await cmd(db,'add_cost',costInput(r.id)),i=invoiceInput([c.id]),p=await preview(db,i),bill=await cmd(db,'issue_invoice',i,randomUUID(),p)
 const payload={from:'sender@example.test',to:'client@example.test',pdf_sha256:'a'.repeat(64)}
 const claim=async()=>(await db.query<any>('select claim_sample_email($1,$2) r',[bill.id,JSON.stringify(payload)])).rows[0].r
 const first=await claim();assert.equal(first.claimed,true);await assert.rejects(db.query("select finish_sample_email($1,$2,'accepted','mailpit-id')",[bill.id,randomUUID()]),/mismatch/)
 await db.exec("update sample_mail_receipts set created_at=now()-interval '2 months'");assert.deepEqual(await claim(),{claimed:false,status:'attempting'})
 await db.query("select finish_sample_email($1,$2,'unknown',null)",[bill.id,first.attempt_id]);assert.deepEqual(await claim(),{claimed:false,status:'unknown'})
 await assert.rejects(db.query("select finish_sample_email($1,$2,'accepted','mailpit-id')",[bill.id,first.attempt_id]),/mismatch/)
 }finally{await db.close()}})

test('stored legacy round numbers are preserved and never reused for new orders',async()=>{const db=await setup();try{await db.query('insert into deal_samples values($1,7)',[deal]);const r=await cmd(db,'create_round',roundInput());assert.equal(r.round_number,8);assert.equal((await db.query<any>('select round_number from deal_samples')).rows[0].round_number,7);assert.equal((await db.query('select * from sample_costs')).rows.length,0)}finally{await db.close()}})

test('moving an underlying product after sample ordering blocks cross-deal billing',async()=>{const db=await setup();try{const r=await cmd(db,'create_round',roundInput()),c=await cmd(db,'add_cost',costInput(r.id));await db.query('update deal_products set deal_id=$1',[randomUUID()]);await assert.rejects(preview(db,invoiceInput([c.id])),/already billed or not in deal/);assert.equal((await db.query('select * from sample_invoices')).rows.length,0)}finally{await db.close()}})
