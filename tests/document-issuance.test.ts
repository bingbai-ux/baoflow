import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
const actor='10000000-0000-0000-0000-000000000001'
const deal='20000000-0000-0000-0000-000000000001'
const requestId='30000000-0000-0000-0000-000000000001'
const snapshot={deal:{id:deal,deal_code:'TEST'},quotes:[{id:'40000000-0000-0000-0000-000000000001',status:'approved',quantity:1000,selling_price_jpy:10,total_billing_jpy:10000,total_billing_tax_jpy:11000}],variants:[]}
async function setup(){
 const db=new PGlite()
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql as 'select nullif(current_setting(''test.actor'',true),'''')::uuid';
 create table profiles(id uuid primary key,role text);insert into profiles values('${actor}','sales');set test.actor='${actor}';
 create function is_staff() returns boolean language sql as 'select coalesce((select role in (''sales'',''admin'') from profiles where id=auth.uid()),false)';
 create table deals(id uuid primary key,archived_at timestamptz);insert into deals values('${deal}',null);
 create table deal_quotes(id uuid primary key,deal_id uuid,status text,quantity integer,selling_price_jpy numeric,total_billing_jpy numeric,total_billing_tax_jpy numeric);
 insert into deal_quotes values('${snapshot.quotes[0].id}','${deal}','approved',1000,10,10000,11000);
 create type document_type as enum('quotation','invoice','delivery_note','rfq','inventory_cert');
 create table documents(id uuid primary key default gen_random_uuid(),deal_id uuid references deals(id),document_type document_type not null,document_number text,version integer,metadata jsonb,issued_at timestamptz,issued_by_user_id uuid,created_at timestamptz default now());`)
 for(const migration of ['041_document_number_counter.sql','046_document_number_guard.sql','047_atomic_document_issuance.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+migration,import.meta.url),'utf8'))
 return db
}
const issue=(db:PGlite,opts:{id?:string;meta?:unknown;snapshot?:unknown;deal?:string|null;type?:string}={})=>db.query<{document:Record<string,unknown>}>('select issue_document_atomic($1::uuid,$2::uuid,$3,$4::jsonb,$5::jsonb) document',[opts.id||requestId,opts.deal===undefined?deal:opts.deal,opts.type||'invoice',JSON.stringify(opts.meta||{notes:'Test'}),JSON.stringify(opts.snapshot||snapshot)])
test('late failure rolls back snapshot, document, counter and ledger; retry issues once with same ID and original issued date',async()=>{
 const db=await setup();try{
  await db.exec(`create function fail_issue_ledger() returns trigger language plpgsql as $$begin raise exception 'forced ledger failure';end$$;create trigger fail_issue before insert on document_issue_requests for each row execute function fail_issue_ledger();`)
  await assert.rejects(issue(db),/forced ledger failure/)
  for(const table of ['documents','document_issue_requests','document_number_counters'])assert.equal((await db.query<{n:number}>(`select count(*)::int n from ${table}`)).rows[0].n,0)
  await db.exec('drop trigger fail_issue on document_issue_requests')
  const first=(await issue(db)).rows[0].document
  const retried=(await issue(db)).rows[0].document
  assert.deepEqual(retried,first);assert.match(String(first.document_number),/-001$/)
  assert.deepEqual((first.metadata as {snapshot:unknown}).snapshot,snapshot)
  assert.equal((await db.query<{n:number}>('select count(*)::int n from documents')).rows[0].n,1)
  const next=(await issue(db,{id:'30000000-0000-0000-0000-000000000002'})).rows[0].document
  assert.match(String(next.document_number),/-002$/)
  await assert.rejects(issue(db,{meta:{notes:'Changed'}}),/different input/)
  await assert.rejects(issue(db,{snapshot:{...snapshot,quotes:[{...snapshot.quotes[0],total_billing_jpy:20000}]}}),/different input/)
  await db.exec("insert into profiles values('10000000-0000-0000-0000-000000000002','admin');set test.actor='10000000-0000-0000-0000-000000000002'")
  await assert.rejects(issue(db),/different input/)
 }finally{await db.close()}
})
test('external roles, invalid adopted snapshot and standalone invoice cannot issue documents',async()=>{
 const db=await setup();try{
  await assert.rejects(issue(db,{snapshot:{...snapshot,quotes:[{...snapshot.quotes[0],status:'drafting'}]}}),/approved quotations/)
  await assert.rejects(issue(db,{snapshot:{...snapshot,quotes:[{...snapshot.quotes[0],quantity:0}]}}),/approved quotations/)
  await assert.rejects(issue(db,{deal:null}),/Only inventory/)
  await assert.rejects(issue(db,{snapshot:{...snapshot,quotes:[{...snapshot.quotes[0],total_billing_jpy:99999}]}}),/quotations changed/)
  await assert.rejects(issue(db,{snapshot:{...snapshot,quotes:[{...snapshot.quotes[0],id:'99999999-0000-0000-0000-000000000001'}]}}),/quotations changed/)
  const standalone=(await issue(db,{deal:null,type:'inventory_cert',snapshot:{}})).rows[0].document
  assert.equal(standalone.deal_id,null);assert.match(String(standalone.document_number),/^CRT-/)
  await db.exec("update profiles set role='client'")
  await assert.rejects(issue(db,{id:'30000000-0000-0000-0000-000000000003'}),/access required/)
  await db.exec('set role anon');await assert.rejects(issue(db),/permission denied for function/)
 }finally{await db.close()}
})

test('approved snapshot IDs match the full live set exactly and unit prices cannot be changed',async()=>{
 const db=await setup();try{
  const second={...snapshot.quotes[0],id:'40000000-0000-0000-0000-000000000002',quantity:500,selling_price_jpy:20}
  await db.exec(`insert into deal_quotes values('${second.id}','${deal}','approved',500,20,10000,11000)`)
  await assert.rejects(issue(db,{snapshot:{...snapshot,quotes:[snapshot.quotes[0],snapshot.quotes[0]]}}),/IDs must be unique/)
  await assert.rejects(issue(db,{snapshot:{...snapshot,quotes:[snapshot.quotes[0]]}}),/quotations changed/)
  await assert.rejects(issue(db,{snapshot:{...snapshot,quotes:[snapshot.quotes[0],{...second,id:'40000000-0000-0000-0000-000000000099'}]}}),/quotations changed/)
  await assert.rejects(issue(db,{snapshot:{...snapshot,quotes:[{...snapshot.quotes[0],selling_price_jpy:999},second]}}),/quotations changed/)
  for(const table of ['documents','document_issue_requests','document_number_counters'])assert.equal((await db.query<{n:number}>(`select count(*)::int n from ${table}`)).rows[0].n,0)
  const issued=(await issue(db,{snapshot:{...snapshot,quotes:[second,snapshot.quotes[0]]}})).rows[0].document
  assert.match(String(issued.document_number),/-001$/)
  assert.deepEqual((issued.metadata as {snapshot:{quotes:unknown}}).snapshot.quotes,[second,snapshot.quotes[0]])
 }finally{await db.close()}
})
