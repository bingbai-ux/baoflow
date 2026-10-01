import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
const staff=randomUUID(),worker=randomUUID(),foreign=randomUUID(),factory=randomUUID(),deal=randomUUID(),order=randomUUID(),term=randomUUID()
async function setup(){const db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
create table profiles(id uuid primary key,role text,factory_id uuid);insert into profiles values('${staff}','sales',null),('${worker}','factory','${factory}'),('${foreign}','factory','${randomUUID()}');
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
create function is_staff() returns boolean language sql as $$select coalesce((select role in('sales','admin') from profiles where id=auth.uid()),false)$$;
create table deals(id uuid primary key,archived_at timestamptz,simple_status text default 'in_production');insert into deals(id) values('${deal}');
create table factory_purchase_orders(id uuid primary key,deal_id uuid,factory_id uuid,status text,quantity integer);insert into factory_purchase_orders values('${order}','${deal}','${factory}','ordered',100);
create table factory_production_starts(order_id uuid primary key,started_on date,expected_completion_on date);insert into factory_production_starts values('${order}','2026-10-01','2026-10-21');
create table factory_final_terms(id uuid primary key,total_usd numeric,balance_due text);insert into factory_final_terms values('${term}',100,'before_shipment');
create table factory_terms_agreements(order_id uuid primary key,terms_id uuid);insert into factory_terms_agreements values('${order}','${term}');
create table factory_bank_acknowledgments(order_id uuid,amount_usd numeric);insert into factory_bank_acknowledgments values('${order}',50);
create table inbound_shipments(id uuid default gen_random_uuid(),purchase_order_id uuid,deal_id uuid,status text default 'in_transit');
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb,user_metadata jsonb);alter table storage.objects enable row level security;
create function keep_factory_workflow_history() returns trigger language plpgsql as $$begin raise exception 'Factory history immutable';end$$;
create function factory_order_context(oid uuid) returns jsonb language plpgsql as $$begin if not is_staff() and not exists(select 1 from profiles p join factory_purchase_orders o on o.factory_id=p.factory_id where p.id=auth.uid() and p.role='factory' and o.id=oid) then raise exception 'Order unavailable';end if;return jsonb_build_object('actor_role',case when is_staff() then 'staff' else 'factory' end,'production',jsonb_build_object('started_on','2026-10-01','expected_completion_on','2026-10-21'));end$$;
set test.actor='${worker}';`);await db.exec(await readFile('supabase/migrations/20261001134525_factory_qc_v1.sql','utf8'));return db}
const actor=(db:PGlite,id:string)=>db.query("select set_config('test.actor',$1,false)",[id])
const cmd=async(db:PGlite,op:string,input:unknown,key=randomUUID())=>(await db.query<any>('select factory_qc_command($1,$2,$3,$4) r',[key,order,op,JSON.stringify(input)])).rows[0].r
async function asset(db:PGlite,kind:string){const id=randomUUID(),mime=kind==='video'?'video/mp4':'image/png',path=`${order}/${id}.${kind==='video'?'mp4':'png'}`,sha='a'.repeat(64);await db.query('insert into storage.objects(bucket_id,name,owner_id,metadata,user_metadata) values($1,$2,$3,$4,$5)',['factory-qc',path,worker,JSON.stringify({size:100,mimetype:mime}),JSON.stringify({sha256:sha})]);await cmd(db,'register_asset',{kind,object_path:path,sha256:sha},id);return id}
const submission=(ids:string[])=>({asset_ids:ids,completed_on:'2026-10-01',quantity:'100',note:'Synthetic completion evidence',completion_confirmed:true})
const ready=async(db:PGlite)=>(await db.query<any>('select factory_qc_context($1) r',[order])).rows[0].r.ship_ready
test('factory completion does not approve QC; BAO rejection requires new evidence; balance receipt separately gates shipment',async()=>{const db=await setup();try{
 const ids=await Promise.all(['overall_photo','packing_photo','video'].map(kind=>asset(db,kind))),key=randomUUID(),first=await cmd(db,'submit_qc',submission(ids),key);assert.deepEqual(await cmd(db,'submit_qc',submission(ids),key),first);assert.equal(await ready(db),false)
 await assert.rejects(cmd(db,'review_qc',{submission_id:first.submission_id,decision:'approved',note:'Synthetic',evidence_checked:true}),/BAO staff/)
 await actor(db,staff);await cmd(db,'review_qc',{submission_id:first.submission_id,decision:'rejected',note:'Synthetic packing correction',evidence_checked:true});assert.equal(await ready(db),false)
 await actor(db,worker);await assert.rejects(cmd(db,'submit_qc',submission(ids)),/revised evidence/);ids[1]=await asset(db,'packing_photo');const second=await cmd(db,'submit_qc',submission(ids));await actor(db,staff)
 await assert.rejects(cmd(db,'review_qc',{submission_id:first.submission_id,decision:'approved',note:'Synthetic old review',evidence_checked:true}),/Latest evidence/)
 await cmd(db,'review_qc',{submission_id:second.submission_id,decision:'approved',note:'Synthetic QA verified',evidence_checked:true});assert.equal(await ready(db),false)
 await assert.rejects(db.exec("update deals set simple_status='shipped'"),/required factory balance/);await assert.rejects(db.query('insert into inbound_shipments(purchase_order_id,deal_id) values($1,$2)',[order,deal]),/required factory balance/)
 await db.query('insert into factory_bank_acknowledgments values($1,50)',[order]);assert.equal(await ready(db),true);await db.exec("update deals set simple_status='shipped'")
 await db.query('insert into inbound_shipments(purchase_order_id,deal_id) values($1,$2)',[order,deal]);await actor(db,worker);await assert.rejects(cmd(db,'submit_qc',submission(ids)),/Shipment already/)
 }finally{await db.close()}})
test('missing video, cross-order asset, quantity/date mistakes and unconfirmed BAO review cannot submit/approve',async()=>{const db=await setup();try{
 const ids=await Promise.all(['overall_photo','packing_photo','video'].map(kind=>asset(db,kind)))
 for(const bad of [{asset_ids:ids.slice(0,2)},{asset_ids:[...ids.slice(0,2),randomUUID()]},{quantity:'99'},{completed_on:'2026-09-30'}])await assert.rejects(cmd(db,'submit_qc',{...submission(ids),...bad}))
 const submitted=await cmd(db,'submit_qc',submission(ids));await actor(db,staff);await assert.rejects(cmd(db,'review_qc',{submission_id:submitted.submission_id,decision:'approved',note:'Synthetic',evidence_checked:false}),/explicit BAO/)
 await assert.rejects(db.exec('delete from factory_qc_submissions'),/immutable/)
 }finally{await db.close()}})
test('private bucket/foreign role/direct write/TRUNCATE/anon protection; malicious upload paths fail closed',async()=>{const db=await setup();try{
 const bucket=(await db.query<any>("select public,file_size_limit from storage.buckets where id='factory-qc'")).rows[0];assert.equal(bucket.public,false);assert.equal(Number(bucket.file_size_limit),52428800)
 for(const path of ['../escape.png',`${order}/------------------------------------.png`,`${order}/${randomUUID()}/extra.png`])assert.equal((await db.query<any>('select factory_qc_storage_scope($1,true) r',[path])).rows[0].r,false)
 await actor(db,foreign);await assert.rejects(ready(db),/unavailable/)
 for(const table of ['factory_qc_assets','factory_qc_submissions','factory_qc_reviews','factory_qc_requests']){const g=(await db.query<any>("select has_table_privilege('authenticated',$1,'insert') i,has_table_privilege('authenticated',$1,'update') u,has_table_privilege('authenticated',$1,'delete') d,has_table_privilege('authenticated',$1,'truncate') t",[table])).rows[0];assert.deepEqual(g,{i:false,u:false,d:false,t:false})}
 assert.equal((await db.query<any>("select has_function_privilege('anon','factory_qc_context(uuid)','execute') a")).rows[0].a,false)
 }finally{await db.close()}})
