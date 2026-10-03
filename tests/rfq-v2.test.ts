import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
const staff = '10000000-0000-0000-0000-000000000001'
const deal = '20000000-0000-0000-0000-000000000001'
const otherDeal = '20000000-0000-0000-0000-000000000002'
const product = '30000000-0000-0000-0000-000000000001'
const factory1 = '40000000-0000-0000-0000-000000000001'
const factory2 = '40000000-0000-0000-0000-000000000002'
const request = '50000000-0000-0000-0000-000000000001'

async function setup() {
  const db = new PGlite()
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql as 'select nullif(current_setting(''test.actor'',true),'''')::uuid';
    create table profiles(id uuid primary key, role text);
    create function is_staff() returns boolean language sql as 'select coalesce((select role in (''sales'',''admin'') from profiles where id=auth.uid()),false)';
    create table deals(id uuid primary key);
    create table deal_products(id uuid primary key,deal_id uuid references deals(id),description text,product_no integer);
    create table deal_product_variants(id uuid primary key, product_id uuid references deal_products(id),variant_label text,variant_order integer,width_mm numeric,height_mm numeric,depth_mm numeric,material text,print_color_count text,pcs_per_carton integer);
    create table deal_quotes(id uuid primary key default gen_random_uuid(), deal_id uuid references deals(id), variant_id uuid references deal_product_variants(id), quantity integer);
    create table factories(id uuid primary key,factory_name text,basic_info_completed boolean);
    insert into profiles values('${staff}','sales'); set test.actor='${staff}';
    insert into deals values('${deal}'),('${otherDeal}');
    insert into deal_products(id,deal_id,description,product_no) values('${product}','${deal}','Test pouch',1);
    insert into deal_product_variants(id,product_id,variant_label,variant_order,width_mm) values('60000000-0000-0000-0000-000000000001','${product}','100g',1,100);
    insert into deal_quotes(deal_id,variant_id,quantity) values('${deal}','60000000-0000-0000-0000-000000000001',1000);
    insert into factories values('${factory1}','Factory A',true),('${factory2}','Factory B',true);`)
  const initial = await readFile(new URL('../supabase/migrations/029_sprint8_external_forms_rfq.sql',import.meta.url),'utf8')
  for (const table of ['external_forms','rfq_requests','rfq_factory_invitations']) {
    const statement = initial.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?\\n\\);`))![0]
    await db.exec(statement)
  }
  await db.exec(await readFile(new URL('../supabase/migrations/043_atomic_rfq.sql',import.meta.url),'utf8'))
  await db.exec("alter table deals add column archived_at timestamptz; alter table factories add column contact_email text; update factories set contact_email='synthetic@example.test'; alter table deal_product_variants add column print_method text, add column color_description text, add column pantone_colors text, add column processing text; alter table deal_quotes add column factory_id uuid, add column moq integer, add column factory_unit_price_usd numeric, add column status text, add column source_type text, add column version integer, add column factory_response jsonb;");
  await db.exec(await readFile(new URL('../supabase/migrations/045_rfq_response_integrity.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20260930094842_048_pending_rfq_import.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20260930094843_049_rfq_email_receipts.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261001091055_rfq_selection_preview_v2.sql',import.meta.url),'utf8'));
  return db
}
const variantId='60000000-0000-0000-0000-000000000001'
const selected=[{product_id:product,variant_id:variantId,quantities:[1000]}]
const preview=(db:PGlite,selection=selected)=>db.query<{snapshot:any}>('select preview_rfq_v2($1,$2,$3::uuid[],$4::jsonb,null,$5) snapshot',[deal,JSON.stringify(selection),'{'+factory1+','+factory2+'}','[]','Frozen instructions'])
const create=(db:PGlite,expected:any,selection=selected,key=request)=>db.query<{result:any}>('select create_rfq_v2($1,$2,$3::jsonb,$4::jsonb,$5::uuid[],$6::jsonb,null,$7) result',[key,deal,JSON.stringify(selection),JSON.stringify(expected),'{'+factory1+','+factory2+'}','[]','Frozen instructions'])
const reply=(qty:number,price:number)=>({product_id:product,variant_id:variantId,quantity:qty,unit_price_usd:price,moq:100,pcs_per_carton:100,carton_w_cm:10,carton_h_cm:20,carton_d_cm:30,gross_weight_kg:10,production_lead_days:15})
test('v2 preview is read-only; stale data rolls back; confirmed request freezes selected quantities and replays unchanged',async()=>{
 const db=await setup();try{
  await db.exec(`insert into deal_quotes(deal_id,variant_id,quantity) values('${deal}','${variantId}',2000);`)
  const p=(await preview(db)).rows[0].snapshot
  assert.deepEqual(p.requested_lines[0].quantities,[1000])
  for(const table of ['rfq_requests','external_forms','rfq_creation_requests'])assert.equal((await db.query<{n:number}>(`select count(*)::int n from ${table}`)).rows[0].n,0)
  await db.exec('update deal_product_variants set width_mm=999')
  await assert.rejects(create(db,p),/Preview changed/)
  assert.equal((await db.query<{n:number}>('select count(*)::int n from external_forms')).rows[0].n,0)
  const fresh=(await preview(db)).rows[0].snapshot
  const first=(await create(db,fresh)).rows[0].result
  await db.exec('update deal_product_variants set width_mm=777;update factories set contact_email=\'changed@example.test\'')
  assert.deepEqual((await create(db,fresh)).rows[0].result,first)
  const ctx=(await db.query<{context:any}>('select context from external_forms limit 1')).rows[0].context
  assert.equal(ctx.schema_version,2);assert.equal(ctx.requested_lines[0].width_mm,999);assert.deepEqual(ctx.requested_lines[0].quantities,[1000]);assert.equal(ctx.recipient.email,'synthetic@example.test');assert.equal(ctx.recipients,undefined)
  await assert.rejects(db.exec("update external_forms set context=context||'{\"request_message\":\"rewrite\"}'::jsonb"),/immutable/)
  await assert.rejects(create(db,{...fresh,request_message:'Changed'}),/different input/)
 }finally{await db.close()}
})
test('v2 quantity prices remain independent, exact retry inserts nothing, unknown quantities and partial replies consume no token',async()=>{
 const db=await setup();try{
  await db.exec(`insert into deal_quotes(deal_id,variant_id,quantity) values('${deal}','${variantId}',2000);`)
  const selection=[{...selected[0],quantities:[2000,1000]}]
  const p=(await preview(db,selection)).rows[0].snapshot;const made=(await create(db,p,selection)).rows[0].result;const tok=made.invitations[0].formToken
  assert.deepEqual((await create(db,p,[{...selection[0],quantities:[1000,2000]}])).rows[0].result,made)
  await assert.rejects(db.query('select ext_submit_rfq($1,$2::jsonb)',[tok,JSON.stringify({products:[reply(3000,0.4)]})]),/Unrequested quantity/)
  await assert.rejects(db.query('select ext_submit_rfq($1,$2::jsonb)',[tok,JSON.stringify({products:[reply(1000,0.4)]})]))
  const payload={products:[reply(1000,0.4),reply(2000,0.3)]}
  await db.exec('set role anon');await db.query('select ext_submit_rfq($1,$2::jsonb)',[tok,JSON.stringify(payload)]);await db.query('select ext_submit_rfq($1,$2::jsonb)',[tok,JSON.stringify(payload)]);await db.exec('reset role')
  const qs=(await db.query<{quantity:number,price:number}>("select quantity,factory_unit_price_usd::float price from deal_quotes where source_type='rfq_response' order by quantity")).rows
  assert.deepEqual(qs,[{quantity:1000,price:0.4},{quantity:2000,price:0.3}])
  await db.exec('update rfq_requests set request_message=\'mutated master\'')
  const otherToken=made.invitations[1].formToken;const external=(await db.query<{ctx:any}>('select ext_rfq_context($1) ctx',[otherToken])).rows[0].ctx
  assert.equal(external.rfq.request_message,'Frozen instructions');assert.equal(external.schema_version,2);assert.equal(external.recipients,undefined)
 }finally{await db.close()}
})

test('v2 pending quantity answers import once while v1 replies preserve one-price expansion',async()=>{
 const db=await setup();try{
  await db.exec(`insert into deal_quotes(deal_id,variant_id,quantity) values('${deal}','${variantId}',2000);`)
  const selection=[{...selected[0],quantities:[1000,2000]}],pending=[{name:'Unregistered synthetic',email:'pending@example.test'}]
  const p=(await db.query<{p:any}>('select preview_rfq_v2($1,$2::jsonb,$3::uuid[],$4::jsonb,null,null) p',[deal,JSON.stringify(selection),'{}',JSON.stringify(pending)])).rows[0].p
  const made=(await db.query<{r:any}>('select create_rfq_v2($1,$2,$3::jsonb,$4::jsonb,$5::uuid[],$6::jsonb,null,null) r',[request,deal,JSON.stringify(selection),JSON.stringify(p),'{}',JSON.stringify(pending)])).rows[0].r,inv=made.invitations[0]
  await db.query('select ext_submit_rfq($1,$2::jsonb)',[inv.formToken,JSON.stringify({products:[reply(1000,0.11),reply(2000,0.07)]})])
  assert.equal((await db.query<{n:number}>("select count(*)::int n from deal_quotes where source_type='rfq_response'")).rows[0].n,0)
  const first=(await db.query<{r:any}>('select import_pending_rfq_answer($1,$2,$3) r',[deal,inv.invitationId,factory1])).rows[0].r
  assert.deepEqual((await db.query<{r:any}>('select import_pending_rfq_answer($1,$2,$3) r',[deal,inv.invitationId,factory1])).rows[0].r.quoteIds,first.quoteIds)
  assert.deepEqual((await db.query<{quantity:number,price:number}>("select quantity,factory_unit_price_usd::float price from deal_quotes where source_type='rfq_response' order by quantity")).rows,[{quantity:1000,price:0.11},{quantity:2000,price:0.07}])
  const v1=(await db.query<{r:any}>('select create_rfq_atomic($1,$2,$3::uuid[],$4::uuid[]) r',['50000000-0000-0000-0000-000000000009',deal,'{'+product+'}','{'+factory2+'}'])).rows[0].r
  const oldLine=reply(1000,0.2);delete (oldLine as {quantity?:number}).quantity
  await db.query('select ext_submit_rfq($1,$2::jsonb)',[v1.invitations[0].formToken,JSON.stringify({products:[oldLine]})])
  assert.deepEqual((await db.query<{quantity:number,price:number}>("select quantity,factory_unit_price_usd::float price from deal_quotes where source_type='rfq_response' and factory_id=$1 order by quantity",[factory2])).rows,[{quantity:1000,price:0.2},{quantity:2000,price:0.2}])
 }finally{await db.close()}
})
test('v2 role checks and frozen-recipient reservation do not broaden access or permit a second mail attempt',async()=>{
 const db=await setup();try{
  const p=(await preview(db)).rows[0].snapshot;const made=(await create(db,p)).rows[0].result;const inv=made.invitations[0].invitationId
  for(const role of ['logistics','factory','client']) { await db.exec(`update profiles set role='${role}'`);await assert.rejects(preview(db),/access required/);await assert.rejects(create(db,p),/access required/) }
  await db.exec("update profiles set role='sales';set role anon");await assert.rejects(preview(db),/permission denied/);await db.exec('reset role')
  const mail={from:'bao@example.test',to:'wrong@example.test',subject:'RFQ',html:'<p>synthetic</p>'}
  await assert.rejects(db.query('select claim_rfq_email_v2($1,$2::jsonb)',[inv,JSON.stringify(mail)]),/recipient changed/)
  mail.to='synthetic@example.test'
  const claim=(await db.query<{c:any}>('select claim_rfq_email_v2($1,$2::jsonb) c',[inv,JSON.stringify(mail)])).rows[0].c
  assert.equal(claim.claimed,true)
  await db.exec("update rfq_email_receipts set started_at=now()-interval '3 days'")
  assert.equal((await db.query<{c:any}>('select claim_rfq_email_v2($1,$2::jsonb) c',[inv,JSON.stringify(mail)])).rows[0].c.claimed,false)
  assert.deepEqual((await db.query<{mail_payload:any}>('select mail_payload from rfq_email_receipts')).rows[0].mail_payload,mail)
 }finally{await db.close()}
})
