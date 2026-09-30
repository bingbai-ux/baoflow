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
  return db
}
function call(db: PGlite, overrides: { id?:string; deal?:string; products?:string[]; factories?:string[]; pending?:unknown[]; message?:string } = {}) {
  return db.query<{ result: { rfqId:string; invitations: { invitationId:string; formToken:string }[] } }>(
    'select create_rfq_atomic($1::uuid,$2::uuid,$3::uuid[],$4::uuid[],$5::jsonb,null,$6::text) as result',
    [overrides.id || request, overrides.deal || deal, `{${(overrides.products || [product]).join(',')}}`, `{${(overrides.factories || [factory1,factory2]).join(',')}}`, JSON.stringify(overrides.pending || []), overrides.message || 'Please quote'])
}

test('failure in second form rolls back every RFQ row, then same key retries once with complete linked invitations',async () => {
  const db = await setup()
  try {
    await db.exec(`create function fail_second_form() returns trigger language plpgsql as $$ begin
      if (select count(*) from external_forms) > 0 then raise exception 'forced second form failure'; end if;
      return new; end $$;
      create trigger fail_form before insert on external_forms for each row execute function fail_second_form();`)
    await assert.rejects(call(db), /forced second form failure/)
    for (const table of ['rfq_requests','rfq_factory_invitations','external_forms','rfq_creation_requests']) {
      assert.equal((await db.query<{n:number}>(`select count(*)::int n from ${table}`)).rows[0].n,0)
    }
    await db.exec('drop trigger fail_form on external_forms')
    const first = (await call(db)).rows[0].result
    const retry = (await call(db,{factories:[factory2,factory1]})).rows[0].result
    assert.deepEqual(first,retry)
    assert.equal(first.invitations.length,2)
    const snapshot=(await db.query<{context:{requested_lines:{quantities:number[];width_mm:number;product_description:string}[]}}>('select context from external_forms limit 1')).rows[0].context
    assert.deepEqual(snapshot.requested_lines[0].quantities,[1000]);assert.equal(snapshot.requested_lines[0].width_mm,100);assert.equal(snapshot.requested_lines[0].product_description,'Test pouch')
    await db.exec('update deal_quotes set quantity=5000;update deal_product_variants set width_mm=999')
    assert.deepEqual((await call(db)).rows[0].result,first)
    assert.deepEqual((await db.query<{context:typeof snapshot}>('select context from external_forms limit 1')).rows[0].context,snapshot)
    assert.equal((await db.query<{n:number}>('select count(*)::int n from rfq_factory_invitations i join external_forms e on e.id=i.external_form_id and e.related_id=i.id')).rows[0].n,2)
    assert.equal((await db.query<{n:number}>('select count(*)::int n from rfq_requests')).rows[0].n,1)
    assert.equal((await db.query<{n:number}>('select count(*)::int n from rfq_factory_invitations where invitation_sent_at is not null')).rows[0].n,0)
    await assert.rejects(call(db,{message:'Changed input'}), /different input/)
    await db.exec("insert into profiles values('10000000-0000-0000-0000-000000000002','admin'); set test.actor='10000000-0000-0000-0000-000000000002'")
    await assert.rejects(call(db), /different input/)
  } finally { await db.close() }
})

test('DB rejects wrong deal, incomplete factory, duplicate inputs, malformed pending factory and external role',async () => {
  const db = await setup()
  try {
    await assert.rejects(call(db,{deal:otherDeal}), /do not belong/)
    await assert.rejects(call(db,{products:[product,product]}), /Duplicate/)
    await assert.rejects(call(db,{factories:[factory1,factory1]}), /Duplicate/)
    await assert.rejects(call(db,{pending:[{name:' '}]}), /Invalid pending/)
    await assert.rejects(call(db,{pending:[{name:'New',email:'wrong'}]}), /Invalid pending/)
    await assert.rejects(call(db,{pending:[{name:'New'},{name:'new'}]}), /Duplicate pending/)
    await assert.rejects(call(db,{pending:[{name:'New',email:'same@example.test'},{name:'Other',email:'SAME@example.test'}]}), /Duplicate pending/)
    await assert.rejects(call(db,{pending:[{name:'Factory A'}]}), /Duplicate pending/)
    await db.exec('update deal_quotes set quantity=0')
    await assert.rejects(call(db), /positive quote quantity/)
    await db.exec('update deal_quotes set quantity=1000')
    await db.exec(`update factories set basic_info_completed=false where id='${factory2}'`)
    await assert.rejects(call(db), /incomplete/)
    await db.exec(`update profiles set role='factory'`)
    await assert.rejects(call(db), /access required/)
    assert.equal((await db.query<{n:number}>('select count(*)::int n from rfq_requests')).rows[0].n,0)
    await db.exec('set role anon')
    await assert.rejects(call(db), /permission denied for function/)
    await db.exec('reset role')
  } finally { await db.close() }
})

test('pending factory receives transactional linked form and network retries reuse token',async () => {
  const db = await setup()
  try {
    const payload = {factories:[],pending:[{name:'New supplier',email:'new@example.test'}]}
    const first = (await call(db,payload)).rows[0].result
    assert.deepEqual((await call(db,payload)).rows[0].result,first)
    assert.equal(first.invitations.length,1)
    assert.equal((await db.query<{name:string}>('select context->>\'pending_factory_name\' name from external_forms')).rows[0].name,'New supplier')
  } finally { await db.close() }
})

test('reload recovery ledger is readable by its original staff actor only',async()=>{
 const db=await setup()
 try{
  await call(db)
  await db.exec(`grant usage on schema auth to authenticated; grant select on profiles to authenticated; insert into profiles values('10000000-0000-0000-0000-000000000002','sales'),('10000000-0000-0000-0000-000000000003','client'); set role authenticated;`)
  assert.equal((await db.query('select request_id from rfq_creation_requests')).rows.length,1)
  await db.exec(`set test.actor='10000000-0000-0000-0000-000000000002'`)
  assert.equal((await db.query('select request_id from rfq_creation_requests')).rows.length,0)
  await db.exec(`set test.actor='10000000-0000-0000-0000-000000000003'`)
  assert.equal((await db.query('select request_id from rfq_creation_requests')).rows.length,0)
 }finally{await db.close()}
})
