import test from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
const id=(n:number)=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`
const migration=async(n:string)=>readFile(new URL(`../supabase/migrations/${n.startsWith('048') ? '20260930094842' : n.startsWith('049') ? '20260930094843' : '20260930094844'}_${n}.sql`,import.meta.url),'utf8')
const line={product_id:id(2),variant_id:id(3),unit_price_usd:0.1,moq:100,pcs_per_carton:1000,carton_w_cm:10,carton_h_cm:20,carton_d_cm:30,gross_weight_kg:12,production_lead_days:15}
async function setup(){
 const db=new PGlite()
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function is_staff() returns boolean language sql stable as $$select coalesce(current_setting('test.role',true) in ('sales','admin'),false)$$;
 grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
 create table profiles(id uuid primary key);insert into profiles values('${id(9)}'),('${id(10)}');
 create table factories(id uuid primary key,basic_info_completed boolean);insert into factories values('${id(6)}',true),('${id(8)}',false);
 create table deals(id uuid primary key,archived_at timestamptz);insert into deals values('${id(1)}',null),('${id(11)}',now());
 create table external_forms(id uuid primary key,form_type text,related_id uuid,status text,cancelled_at timestamptz,expires_at timestamptz,submitted_at timestamptz,context jsonb,submission_data jsonb);
 create table rfq_requests(id uuid primary key,deal_id uuid,product_ids uuid[],status text);
 create table rfq_factory_invitations(id uuid primary key,rfq_id uuid,factory_id uuid,factory_name_pending text,external_form_id uuid,invitation_sent_at timestamptz);
 create table deal_products(id uuid primary key,deal_id uuid);insert into deal_products values('${id(2)}','${id(1)}');
 create table deal_product_variants(id uuid primary key,product_id uuid);insert into deal_product_variants values('${id(3)}','${id(2)}');
 create table deal_quotes(id uuid primary key default gen_random_uuid(),deal_id uuid,variant_id uuid,factory_id uuid,quantity int,moq int,factory_unit_price_usd numeric,status text,source_type text,version int,factory_response jsonb);
 insert into rfq_requests values('${id(4)}','${id(1)}',array['${id(2)}'::uuid],'open');

 create schema storage;create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
 grant select,insert,update,delete on storage.objects to anon,authenticated;
 create policy "Public read deal-images" on storage.objects for select using(bucket_id='deal-images');
 create policy "Authenticated upload deal-images" on storage.objects for insert to authenticated with check(bucket_id='deal-images');
 create policy "Authenticated delete deal-images" on storage.objects for delete to authenticated using(bucket_id='deal-images');
 grant usage on schema storage to anon,authenticated;grant select on deals to anon,authenticated;
 grant truncate on all tables in schema public to anon,authenticated;
 set test.uid='${id(9)}';set test.role='sales';`)
 for(const name of ['048_pending_rfq_import','049_rfq_email_receipts','050_storage_and_table_privileges'])await db.exec(await migration(name))
 await db.exec(` insert into rfq_factory_invitations values('${id(5)}','${id(4)}',null,'Synthetic pending factory','${id(7)}',null);
 insert into external_forms(id,form_type,related_id,status,expires_at,submitted_at) values('${id(7)}','rfq_response','${id(5)}','submitted',now()-interval '30 days',now()-interval '31 days');`)
 await db.query('update external_forms set context=$1,submission_data=$2',[{requested_lines:[{product_id:id(2),variant_id:id(3),quantities:[1000,2000]}]},{products:[line]}])
 return db
}
const importAnswer=(db:PGlite,deal=id(1),factory=id(6))=>db.query<{result:any}>('select import_pending_rfq_answer($1,$2,$3) result',[deal,id(5),factory])
test('expired submitted pending answer imports only after explicit registration selection, preserving original quantities; replay is stable',async()=>{
 const db=await setup();try{
 assert.equal((await db.query<{n:number}>('select count(*)::int n from deal_quotes')).rows[0].n,0)
 await assert.rejects(importAnswer(db,id(1),id(8)),/complete basic/)
 await assert.rejects(importAnswer(db,id(11)),/belong/)
 await db.exec('set role authenticated');const first=await importAnswer(db);const replay=await importAnswer(db)
 assert.deepEqual(first.rows[0].result.quoteIds,replay.rows[0].result.quoteIds);assert.equal(replay.rows[0].result.replayed,true)
 await db.exec('reset role');assert.deepEqual((await db.query<{quantity:number}>('select quantity from deal_quotes order by quantity')).rows.map(q=>q.quantity),[1000,2000])
 assert.equal((await db.query<{status:string}>('select status from external_forms')).rows[0].status,'submitted')
 await assert.rejects(importAnswer(db,id(1),id(8)),/different input/)
 }finally{await db.close()}
})
test('late import ledger failure rolls back quotes and factory binding; malformed snapshot and partial/forged answers are rejected',async()=>{
 const db=await setup();try{
 await db.exec(`create function fail_import() returns trigger language plpgsql as $$begin raise exception 'late failure';end$$;create trigger fail_import before insert on rfq_answer_imports for each row execute function fail_import();`)
 await assert.rejects(importAnswer(db),/late failure/);assert.equal((await db.query<{n:number}>('select count(*)::int n from deal_quotes')).rows[0].n,0)
 assert.equal((await db.query<{factory_id:null}>('select factory_id from rfq_factory_invitations')).rows[0].factory_id,null)
 await db.exec('drop trigger fail_import on rfq_answer_imports')
 for(const products of [[],[line,line],[{...line,variant_id:id(12)}],[{...line,moq:0.5}]]){
  await db.query('update external_forms set submission_data=$1',[{products}]);await assert.rejects(importAnswer(db))
 }
 await db.query('update external_forms set submission_data=$1,context=$2',[{products:[line]},{requested_lines:[{product_id:id(2),variant_id:id(3),quantities:[0]}]}]);await assert.rejects(importAnswer(db),/quantity/)
 }finally{await db.close()}
})
test('permanent mail reservation blocks retry after 30 days and failed receipt save; accepted record is immutable',async()=>{
 const db=await setup();try{
 await db.exec("update external_forms set status='pending',expires_at=now()+interval '1 day';set role authenticated")
 const claim=(await db.query<{r:any}>('select claim_rfq_email($1) r',[id(5)])).rows[0].r;assert.equal(claim.claimed,true)
 await db.exec('reset role');await db.exec("update rfq_email_receipts set started_at=now()-interval '30 days'")
 await db.exec(`create function fail_receipt() returns trigger language plpgsql as $$begin raise exception 'receipt save failed';end$$;create trigger fail_receipt before update on rfq_email_receipts for each row execute function fail_receipt();set role authenticated;`)
 await assert.rejects(db.query('select finish_rfq_email($1,$2,$3,$4)',[id(5),claim.attemptId,'accepted','provider-test']),/receipt save failed/)
 assert.equal((await db.query<{r:any}>('select claim_rfq_email($1) r',[id(5)])).rows[0].r.claimed,false)
 await db.exec('reset role;drop trigger fail_receipt on rfq_email_receipts;set role authenticated')
 await db.query('select finish_rfq_email($1,$2,$3,$4)',[id(5),claim.attemptId,'accepted','provider-test'])
 await assert.rejects(db.query('select finish_rfq_email($1,$2,$3,$4)',[id(5),claim.attemptId,'unknown',null]),/immutable/)
 await db.exec(`set test.uid='${id(10)}'`);await assert.rejects(db.query('select finish_rfq_email($1,$2,$3,$4)',[id(5),claim.attemptId,'accepted','provider-test']),/mismatch/)
 }finally{await db.close()}
})
test('client/factory/logistics and anonymous cannot import, claim mail, write receipt or truncate; staff cannot write ledgers directly',async()=>{
 const db=await setup();try{
 for(const role of ['client','factory','logistics']){
  await db.exec(`set test.role='${role}';set role authenticated`)
  await assert.rejects(importAnswer(db),/access required/);await assert.rejects(db.query('select claim_rfq_email($1)',[id(5)]),/access required/)
  await assert.rejects(db.exec('truncate deal_quotes'),/permission denied/)
  await assert.rejects(db.exec('delete from rfq_email_receipts'),/permission denied/)
  assert.equal((await db.query('select * from rfq_answer_imports')).rows.length,0);await db.exec('reset role')
 }
 await db.exec("set test.role='sales';set role authenticated");await assert.rejects(db.exec('delete from rfq_answer_imports'),/permission denied/)
 await db.exec('reset role;set role anon');await assert.rejects(importAnswer(db),/permission denied/);await assert.rejects(db.exec('truncate deals'),/permission denied/)
 }finally{await db.close()}
})
test('Storage direct API role attacks denied; staff can upload only live deal paths and clean archived owned paths; no UPDATE',async()=>{
 const db=await setup();try{
 for(const role of ['client','factory','logistics']){
  await db.exec(`set test.role='${role}';set role authenticated`)
  await assert.rejects(db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['deal-images',`${id(1)}/attack.png`]),/row-level security/);await db.exec('reset role')
 }
 await db.exec("set test.role='sales';set role authenticated")
 for(const path of ['bad/path.png',`${id(11)}/archive.png`,`${id(1)}/`])await assert.rejects(db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['deal-images',path]),/row-level security/)
 await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['deal-images',`${id(1)}/allowed.png`])
 assert.equal((await db.query('update storage.objects set name=$1 returning id',['renamed'])).rows.length,0)
 for(const role of ['client','factory','logistics']){await db.exec(`set test.role='${role}'`);assert.equal((await db.query('delete from storage.objects returning id')).rows.length,0)}
 await db.exec("reset role;update deals set archived_at=now();set test.role='sales';set role authenticated")
 assert.equal((await db.query('delete from storage.objects returning id')).rows.length,1)
 }finally{await db.close()}
})
test('unknown Storage writers abort proposal before changes and transaction rollback preserves previous policy',async()=>{
 const db=await setup();try{
 await db.exec('create policy unknown_writer on storage.objects for insert to authenticated with check(true)')
 await db.exec('begin');await assert.rejects(db.exec(await migration('050_storage_and_table_privileges')),/unknown Storage write/);await db.exec('rollback')
 assert.equal((await db.query("select policyname from pg_policies where policyname='Staff upload deal-images'")).rows.length,1)
 }finally{await db.close()}
})

test('mail migration refuses historical invitations with uncertain unrecorded sends',async()=>{
 const db=await setup();try{
  await db.exec('begin');await assert.rejects(db.exec(await migration('049_rfq_email_receipts')),/preexisting unsent/);await db.exec('rollback')
  assert.equal((await db.query('select * from rfq_email_receipts')).rows.length,0)
 }finally{await db.close()}
})

test('uncommitted privilege proposal rolls back all policy and grant changes together',async()=>{
 const db=await setup();try{
  await db.exec(`drop policy "Staff upload deal-images" on storage.objects;drop policy "Staff delete deal-images" on storage.objects;
  create policy "Authenticated upload deal-images" on storage.objects for insert to authenticated with check(bucket_id='deal-images');
  create policy "Authenticated delete deal-images" on storage.objects for delete to authenticated using(bucket_id='deal-images');grant truncate on deals to authenticated;`)
  await db.exec('begin')
  await db.exec(await migration('050_storage_and_table_privileges'))
  assert.equal((await db.query<{allowed:boolean}>("select has_table_privilege('authenticated','deals','TRUNCATE') allowed")).rows[0].allowed,false)
  await db.exec('rollback')
  assert.equal((await db.query<{allowed:boolean}>("select has_table_privilege('authenticated','deals','TRUNCATE') allowed")).rows[0].allowed,true)
  assert.equal((await db.query("select policyname from pg_policies where policyname='Authenticated upload deal-images'")).rows.length,1)
  assert.equal((await db.query("select policyname from pg_policies where policyname='Staff upload deal-images'")).rows.length,0)
 }finally{await db.close()}
})
