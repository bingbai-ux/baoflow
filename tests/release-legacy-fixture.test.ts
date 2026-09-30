import test from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { readFile, readdir } from 'node:fs/promises'
const root=new URL('../supabase/migrations/',import.meta.url)
const id=(n:number)=>`${String(n).padStart(8,'0')}-2222-4222-8222-222222222222`
test('real source migrations 038–051 preserve six unbound adopted quotes and their single specification candidates; legacy invoice can be reissued without guessing',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;`)
 const files=(await readdir(root)).sort().filter(f=>f.endsWith('.sql')&&!['011','015'].some(n=>f.startsWith(n)))
 for(const file of files.filter(f=>f<'038'))await db.exec(await readFile(new URL(file,root),'utf8'))
 await db.exec(`insert into auth.users(id,email) values('${id(99)}','synthetic@example.test');update profiles set role='sales' where id='${id(99)}';set test.actor='${id(99)}';
 insert into clients(id,company_name) values('${id(97)}','Synthetic customer');
 insert into factories(id,factory_name,basic_info_completed) values('${id(98)}','Synthetic legacy factory',true);`)
 for(let n=1;n<=6;n++)await db.query(`insert into deals(id,deal_code,deal_name,simple_status) values($1,$2,$3,'quote_confirmed')`,[id(n),`SYNTHETIC-${n}`,`Legacy case ${n}`])
 for(let n=1;n<=6;n++)await db.query(`insert into deal_quotes(id,deal_id,factory_id,status,quantity,factory_unit_price_usd,selling_price_jpy,total_billing_jpy,total_billing_tax_jpy) values($1,$2,$3,'approved',1000,0.1,10,10000,11000)`,[id(n+10),id(n),id(98)])
 // Read-only production audit found one filled candidate per deal, but no quote binding or source file.
 for(let n=1;n<=6;n++)await db.query('insert into deal_specifications(id,deal_id,product_category,product_name) values($1,$2,$3,$4)',[id(n+50),id(n),'pouch',`Synthetic candidate ${n}`])
 const month=(await db.query<{ym:string}>("select to_char(now(),'YYYYMM') as ym")).rows[0].ym
 await db.exec(`insert into documents(id,deal_id,document_type,document_number,metadata) values('${id(30)}','${id(1)}','invoice','INV-${month}-001','{"notes":"Synthetic original document without snapshot"}');
 insert into inbound_shipments(id,shipment_no,deal_id) values('${id(31)}','SYNTHETIC-IN','${id(1)}');
 insert into shipment_requests(id,client_id,request_no,destination_name,status) values('${id(32)}','${id(97)}','SYNTHETIC-OUT','Synthetic location','requested');
 grant truncate on all tables in schema public to anon,authenticated;`)
 const tables=['deal_quotes','deal_specifications','documents','inbound_shipments','shipment_requests','deals']
 const before=new Map<string,unknown>()
 for(const table of tables)before.set(table,(await db.query(`select to_jsonb(t) row from ${table} t order by id`)).rows)
 for(const file of files.filter(f=>f>='038'))await db.exec(await readFile(new URL(file,root),'utf8'))
 for(const table of tables){
  const after=(await db.query<{row:Record<string,unknown>}>(`select to_jsonb(t) row from ${table} t order by id`)).rows
  const original=before.get(table) as {row:Record<string,unknown>}[]
  for(let i=0;i<original.length;i++)for(const [key,value] of Object.entries(original[i].row))assert.deepEqual(after[i].row[key],value,`${table}.${key}`)
 }
 assert.equal((await db.query<{n:number}>('select count(*)::int n from deal_products')).rows[0].n,0)
 assert.equal((await db.query<{n:number}>('select count(*)::int n from deal_quotes where variant_id is null and spec_id is null and status=\'approved\'')).rows[0].n,6)
 const quotes=(await db.query('select * from deal_quotes where deal_id=$1',[id(1)])).rows
 const snapshot={deal:{id:id(1)},quotes,variants:[],products:[],fees:[]}
 const issued=(await db.query<{doc:{document_number:string;metadata:{snapshot:unknown}}}>('select issue_document_atomic($1,$2,$3,$4,$5) doc',[id(33),id(1),'invoice',{notes:'Synthetic reissue'},snapshot])).rows[0].doc
 assert.equal(issued.document_number,`INV-${month}-002`);assert.deepEqual(issued.metadata.snapshot,JSON.parse(JSON.stringify(snapshot)))
 assert.equal((await db.query<{n:number}>('select count(*)::int n from deal_quotes')).rows[0].n,6)
 assert.equal((await db.query<{metadata:{snapshot?:unknown}}>('select metadata from documents where id=$1',[id(30)])).rows[0].metadata.snapshot,undefined)
 await assert.rejects(db.query('select create_factory_order_atomic($1,$2,$3)',[id(11),id(98),'SYNTHETIC-PO']),/商品仕様/)
 assert.equal((await db.query<{n:number}>('select count(*)::int n from factory_purchase_orders')).rows[0].n,0)
 const checklist=await db.exec(await readFile(new URL('../scripts/preflight-legacy-manual.sql',import.meta.url),'utf8'))
 const checklistRows=checklist.find(result=>result.rows.some(row=>'case_no' in row))!.rows
 assert.equal(checklistRows.length,6)
 for(const row of checklistRows){assert.equal(row.automatically_bind_old_quote,false);assert.equal(row.existing_factory_retained,true);assert.equal(Object.keys(row).some(key=>key.endsWith('_id')),false)}
 // Exercise pending replies through real 043 → 045 → 048 against the full source schema.
 await db.exec(`insert into deal_products(id,deal_id,product_no,description) values('${id(40)}','${id(6)}',1,'Synthetic new specification');
 insert into deal_product_variants(id,product_id,variant_label) values('${id(41)}','${id(40)}','New A');
 insert into deal_quotes(deal_id,variant_id,quantity,status) values('${id(6)}','${id(41)}',1234,'drafting');`)
 const rfq=(await db.query<{r:{invitations:{invitationId:string;formToken:string}[]}}>('select create_rfq_atomic($1,$2,$3,$4,$5) r',[id(42),id(6),[id(40)],[],[{name:'Synthetic pending respondent'}]])).rows[0].r
 const invitation=rfq.invitations[0]
 const answer={products:[{product_id:id(40),variant_id:id(41),unit_price_usd:0.2,moq:100,pcs_per_carton:200,carton_w_cm:10,carton_h_cm:20,carton_d_cm:30,gross_weight_kg:12,production_lead_days:15}]}
 await db.exec('set role anon');await db.query('select ext_submit_rfq($1,$2)',[invitation.formToken,answer]);await db.exec('reset role')
 assert.equal((await db.query<{n:number}>("select count(*)::int n from deal_quotes where source_type='rfq_response'")).rows[0].n,0)
 await db.query('select import_pending_rfq_answer($1,$2,$3)',[id(6),invitation.invitationId,id(98)])
 await db.query('select import_pending_rfq_answer($1,$2,$3)',[id(6),invitation.invitationId,id(98)])
 const imported=(await db.query<{quantity:number;factory_id:string}>("select quantity,factory_id from deal_quotes where source_type='rfq_response'")).rows
 assert.deepEqual(imported,[{quantity:1234,factory_id:id(98)}])
 // Default privileges for future tables created by the same migration owner also reject TRUNCATE.
 await db.exec('create table future_local_probe(id integer);set role authenticated')
 await assert.rejects(db.exec('truncate future_local_probe'),/permission denied/)
 }finally{await db.close()}
})
