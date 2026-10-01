import test from 'node:test'
import assert from 'node:assert/strict'
import {PGlite} from '@electric-sql/pglite'
import {readFile} from 'node:fs/promises'
import {requiredCostKinds,type PricingRevisionInput} from '../src/lib/calc/pricing-revision'
const user='11111111-1111-4111-8111-111111111111',deal='22222222-2222-4222-8222-222222222222',quote='33333333-3333-4333-8333-333333333333',variant='44444444-4444-4444-8444-444444444444',product='55555555-5555-4555-8555-555555555555',request='66666666-6666-4666-8666-666666666666'
const input=():PricingRevisionInput=>({mode:'ratio',value:.5,tax_rate:10,fx:{rate:150,reference:'Synthetic rate reference',as_of:'2026-09-30T00:00:00Z',confirmed:true},cost_lines:requiredCostKinds.map(kind=>({key:kind,kind,name:kind,amount:0,currency:'USD',confirmed:true}))})
async function setup(){
 const db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;create table profiles(id uuid primary key,role text);create function auth.uid() returns uuid language sql as 'select nullif(current_setting(''test.actor'',true),'''')::uuid';create function is_staff() returns boolean language sql as 'select coalesce((select role in (''sales'',''admin'') from profiles where id=auth.uid()),false)';insert into profiles values('${user}','sales');set test.actor='${user}';
 create table deals(id uuid primary key,archived_at timestamptz);insert into deals values('${deal}',null);
 create table deal_products(id uuid primary key,deal_id uuid);insert into deal_products values('${product}','${deal}');create table deal_product_variants(id uuid primary key,product_id uuid);insert into deal_product_variants values('${variant}','${product}');
 create type quote_status as enum ('drafting','presented','approved','rejected','revising');create table deal_quotes(id uuid primary key default gen_random_uuid(),deal_id uuid,variant_id uuid,factory_id uuid,version int,quantity int,moq int,factory_unit_price_usd numeric,exchange_rate numeric,cost_ratio numeric,total_cost_usd numeric,unit_cost_usd numeric,selling_price_usd numeric,selling_price_jpy numeric,total_billing_jpy numeric,total_billing_tax_jpy numeric,status quote_status,source_type text,factory_response jsonb,plate_fee_usd numeric,pantone_color_fee_usd numeric,domestic_china_freight_usd numeric,china_freight_usd numeric,other_fees_usd numeric,sample_cost_usd numeric,sample_shipping_usd numeric,updated_at timestamptz);
 insert into deal_quotes(id,deal_id,variant_id,version,quantity,factory_unit_price_usd,status,sample_cost_usd) values('${quote}','${deal}','${variant}',1,1000,.1,'approved',25);`)
 await db.exec(`create table deal_fees(id uuid primary key default gen_random_uuid(),deal_id uuid);create type document_type as enum ('quotation','invoice','delivery_note','rfq','inventory_cert');create table documents(id uuid primary key default gen_random_uuid(),deal_id uuid,document_type document_type,document_number text,version int,metadata jsonb,issued_at timestamptz,issued_by_user_id uuid);create function reserve_document_number(text) returns text language sql as $$select 'QUO-'||(select count(*)+1 from documents)::text$$;`)
 await db.exec(await readFile('supabase/migrations/047_atomic_document_issuance.sql','utf8'))
 await db.exec(await readFile('supabase/migrations/20261001102446_quote_pricing_revision_v2.sql','utf8'));return db
}
const preview=async(db:PGlite,i=input())=>(await db.query<{p:any}>('select preview_quote_pricing_v2($1,$2) p',[quote,JSON.stringify(i)])).rows[0].p
const save=async(db:PGlite,i:PricingRevisionInput,p:any,key=request)=>(await db.query<{r:any}>('select save_quote_pricing_v2($1,$2,$3,$4) r',[key,quote,JSON.stringify(i),JSON.stringify(p)])).rows[0].r
test('numeric ratio and selling unit preview, immutable revised price/custom ledger and stable retry preserve old approved quote and samples',async()=>{
 const db=await setup();try{const i=input();i.mode='selling_price';i.value=37;i.cost_lines.push({key:'inspection',kind:'custom',name:'Inspection',amount:1500,currency:'JPY',confirmed:true});const p=await preview(db,i);assert.equal(Number(p.total_cost_usd),110);assert.equal(Number(p.selling_price_jpy),37);assert.equal(Number(p.total_billing_tax_jpy),40700);assert.equal(p.fx.kind,'manual_confirmed');assert.equal(p.sample_costs_included,false)
 assert.equal((await db.query('select * from quote_pricing_requests')).rows.length,0)
 const first=await save(db,i,p);assert.deepEqual(await save(db,i,p),first);assert.equal((await db.query('select * from quote_cost_lines')).rows.length,6)
 const old=(await db.query<any>('select * from deal_quotes where id=$1',[quote])).rows[0];assert.equal(old.status,'approved');assert.equal(Number(old.sample_cost_usd),25)
 const next=(await db.query<any>('select * from deal_quotes where id=$1',[first.quote_id])).rows[0];assert.equal(next.version,2);assert.equal(Number(next.sample_cost_usd),0);assert.equal(next.status,'drafting')
 await assert.rejects(db.query('update deal_quotes set selling_price_jpy=99 where id=$1',[first.quote_id]),/immutable/);await assert.rejects(db.query('delete from deal_quotes where id=$1',[first.quote_id]),/immutable/);await db.query("update deal_quotes set status='approved' where id=$1",[first.quote_id])
 await assert.rejects(save(db,{...i,value:38},p),/different input/)
 }finally{await db.close()}
})
test('missing costs, repeated plate/sample costs, invalid ratio/FX/tax, archive and unbound quote cannot create a revision',async()=>{
 const db=await setup();try{for(const n of [null,0,-1,2]){const i=input();i.value=n;await assert.rejects(preview(db,i))}const missing=input();missing.cost_lines[0].amount=null;await assert.rejects(preview(db,missing));for(const name of ['Extra plate','Sample round 1']){const i=input();i.cost_lines.push({key:'extra',kind:'custom',name,amount:1,currency:'USD',confirmed:true});await assert.rejects(preview(db,i))}
 const noFx=input();noFx.fx.confirmed=false;await assert.rejects(preview(db,noFx));const tax=input();tax.tax_rate=null;await assert.rejects(preview(db,tax));await db.exec('update deal_quotes set variant_id=null');await assert.rejects(preview(db));assert.equal((await db.query('select * from quote_cost_lines')).rows.length,0)
 }finally{await db.close()}
})
test('stale confirmation and late DB failure rollback quote, cost lines and request ledger together',async()=>{
 const db=await setup();try{const i=input(),p=await preview(db,i);await db.exec('update deal_quotes set factory_unit_price_usd=.2');await assert.rejects(save(db,i,p),/Preview changed/);assert.equal((await db.query('select * from deal_quotes')).rows.length,1)
 const fresh=await preview(db,i);await db.exec("create function fail_cost() returns trigger language plpgsql as $$begin raise exception 'Forced late failure';end$$;create trigger fail_cost before insert on quote_cost_lines for each row execute function fail_cost();");await assert.rejects(save(db,i,fresh),/Forced late/);assert.equal((await db.query('select * from deal_quotes')).rows.length,1);assert.equal((await db.query('select * from quote_pricing_requests')).rows.length,0)
 }finally{await db.close()}
})
test('customer/factory/logistics cannot use pricing RPC; anon has no execute and authenticated has no table write or truncate',async()=>{
 const db=await setup();try{for(const role of ['client','factory','logistics']){await db.query('update profiles set role=$1',[role]);await assert.rejects(preview(db),/Sales or administrator/)}const grants=(await db.query<any>("select has_function_privilege('anon','preview_quote_pricing_v2(uuid,jsonb)','execute') a,has_table_privilege('authenticated','quote_cost_lines','insert') i,has_table_privilege('authenticated','quote_cost_lines','truncate') t")).rows[0];assert.deepEqual(grants,{a:false,i:false,t:false})
 }finally{await db.close()}
})
test('quotation issuance freezes confirmed manual FX and increments version; changed FX or legacy unallocated fees cannot issue',async()=>{
 const db=await setup();try{const i=input(),p=await preview(db,i),r=await save(db,i,p);await db.query("update deal_quotes set status=case when id=$1 then 'approved'::quote_status else 'drafting'::quote_status end",[r.quote_id]);
 const quotes=(await db.query('select * from deal_quotes')).rows,snapshot={deal:{id:deal},quotes,fees:[]}
 const issue=async(key:string,meta:any)=>(await db.query<any>("select issue_document_atomic($1,$2,'quotation',$3,$4) d",[key,deal,JSON.stringify(meta),JSON.stringify(snapshot)])).rows[0].d
 const key='77777777-7777-4777-8777-777777777777'
 await assert.rejects(issue(key,{}),/Confirm manual FX/);await assert.rejects(issue(key,{manual_fx:{rate:151,confirmed:true}}),/Revise all/)
 const first=await issue(key,{manual_fx:{rate:150,confirmed:true}});assert.equal(first.version,1);assert.equal(first.metadata.snapshot.issuance_fx.rate,'150');assert.equal(first.metadata.snapshot.issuance_fx.automatic_latest,false)
 assert.deepEqual(await issue(key,{manual_fx:{rate:150,confirmed:true}}),first)
 const second=await issue('88888888-8888-4888-8888-888888888888',{manual_fx:{rate:150,confirmed:true}});assert.equal(second.version,2);assert.notEqual(second.id,first.id)
 assert.deepEqual((await db.query<any>('select metadata from documents where id=$1',[first.id])).rows[0].metadata,first.metadata)
 await assert.rejects(db.query("update documents set metadata='{}' where id=$1",[first.id]),/immutable/);await assert.rejects(db.query('delete from documents where id=$1',[first.id]),/immutable/)
 const legacy=(await db.query<any>(`insert into documents(metadata) values('{"snapshot":{"quotes":null}}') returning id`)).rows[0];await db.query("update documents set metadata='{}' where id=$1",[legacy.id]);await db.query('delete from documents where id=$1',[legacy.id])
 await db.query('insert into deal_fees(deal_id) values($1)',[deal]);await assert.rejects(issue('99999999-9999-4999-8999-999999999999',{manual_fx:{rate:150,confirmed:true}}),/Legacy separate fees/);assert.equal((await db.query('select * from documents')).rows.length,2)
 }finally{await db.close()}
})
