import test from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'

const uid = '11111111-1111-4111-8111-111111111111'
const deal = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', empty = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const client = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

async function setup() {
  const db = new PGlite()
  await db.exec(`create role anon;create role authenticated;create schema auth;
  create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
  create function public.is_staff() returns boolean language sql as $$select current_setting('test.staff',true)='yes'$$;
  set test.staff='yes'; set test.uid='${uid}';
  create table profiles(id uuid primary key, email text);
  insert into profiles values('${uid}','sales@example.test');
  create table deals(id uuid primary key, deal_code text, deal_name text, client_id uuid, client_name_text text, brand_text text, contact_id uuid, sales_user_id uuid,
    desired_delivery_date date, master_status text default 'M01', simple_status text default 'quoting', process_stage smallint not null default 2, waiting_on text default 'us', archived_at timestamptz, last_activity_at timestamptz);
  insert into deals(id,deal_code,deal_name,client_id,client_name_text,sales_user_id) values('${deal}','PF-1','秋の新商品','${client}','デモ商事','${uid}'),('${empty}','PF-2','空の案件','${client}','デモ商事','${uid}');
  create table client_contacts(id uuid primary key default gen_random_uuid(), client_id uuid, name text, email text, is_primary boolean default false, created_at timestamptz default now());
  insert into client_contacts(client_id,name,email,is_primary) values('${client}','田中','tanaka@example.test',true),('${client}','鈴木','suzuki@example.test',false);
  create table deal_products(id uuid primary key default gen_random_uuid(), deal_id uuid, product_no int, sort_order int, description text, shipping_mode text, sample_required boolean default false,
    food_inspection_required boolean default false, category_note text, product_memo text);
  create table deal_product_variants(id uuid primary key default gen_random_uuid(), product_id uuid, variant_order int default 0, created_at timestamptz default now(), material_note text, print_note text, accessories_note text, size_note text);
  create table deal_quotes(id uuid primary key default gen_random_uuid(), deal_id uuid, variant_id uuid, quantity int, factory_unit_price_usd numeric);
  create table deal_status_history(id int generated always as identity, deal_id uuid, from_status text, to_status text, from_simple_status text, to_simple_status text, changed_by uuid, kind text, note text);
  create table notifications(id uuid primary key default gen_random_uuid(), user_id uuid, deal_id uuid, type text, status text, content text);
  with p as (insert into deal_products(deal_id,product_no,sort_order,description,shipping_mode,sample_required,product_memo) values('${deal}',1,2,'平袋 / サイズ未定','sea',true,'急ぎ'),('${deal}',2,1,'スタンド袋 / W120×H200mm','air',false,null) returning id, product_no),
       v as (insert into deal_product_variants(product_id) select id from p returning id, product_id)
  insert into deal_quotes(deal_id,variant_id,quantity,factory_unit_price_usd) select '${deal}', v.id, q, 0.5 from v cross join (values (1000),(5000)) x(q);`)
  await db.exec(await readFile(new URL('../supabase/migrations/20261122200000_process_redesign_stage3.sql', import.meta.url), 'utf8'))
  return db
}
const create = async (db: PGlite, id = deal) => (await db.query<{ r: { id: string; token: string; contactEmail: string | null; snapshot: { items: Array<Record<string, unknown>> } } }>('select create_customer_confirmation($1) as r', [id])).rows[0].r

test('確認依頼: 商品内容の写しができ、工場の価格などは含まれず、送り先は主担当になる', async () => {
  const db = await setup()
  try {
    const r = await create(db)
    assert.equal(r.token.length, 64)
    assert.equal(r.contactEmail, 'tanaka@example.test')
    assert.deepEqual(r.snapshot.items.map(i => i.name), ['スタンド袋 / W120×H200mm', '平袋 / サイズ未定'], '並び順どおり')
    assert.deepEqual(r.snapshot.items[1].quantities, [1000, 5000])
    assert.ok(!JSON.stringify(r.snapshot).includes('0.5') && !JSON.stringify(r.snapshot).includes('factory'), '原価・工場の情報を含まない')
    // 担当者を案件で指定していれば、その人に送る
    await db.query("update deals set contact_id = (select id from client_contacts where name='鈴木') where id=$1", [deal])
    const again = await create(db)
    assert.equal(again.contactEmail, 'suzuki@example.test')
    const rows = (await db.query<{ status: string }>('select status from customer_confirmations order by created_at')).rows.map(x => x.status)
    assert.deepEqual(rows, ['cancelled', 'pending'], '前の依頼は取り消され、未回答は常に1件')
    await assert.rejects(create(db, empty), /先に商品を登録/)
  } finally { await db.close() }
})

test('顧客の確認: 見るだけでは確認にならず、ボタンで確認すると工程3・履歴・お知らせが残る。二度押しても1回分', async () => {
  const db = await setup()
  try {
    const r = await create(db)
    await db.exec("set test.staff='no'; set test.uid=''") // ここからは未ログインの顧客
    const view = (await db.query<{ v: { found: boolean; status: string; snapshot: unknown } }>('select customer_confirmation_by_token($1) as v', [r.token])).rows[0].v
    assert.equal(view.status, 'pending')
    assert.equal((await db.query<{ status: string }>('select status from customer_confirmations where id=$1', [r.id])).rows[0].status, 'pending', '開いただけでは確認済みにならない')
    assert.equal((await db.query<{ v: { found: boolean } }>("select customer_confirmation_by_token('x') as v")).rows[0].v.found, false)
    const done = (await db.query<{ v: { success: boolean; already: boolean; notifyEmail: string } }>('select confirm_customer_confirmation($1,$2,$3) as v', [r.token, '203.0.113.5', 'test-agent'])).rows[0].v
    assert.deepEqual([done.success, done.already, done.notifyEmail], [true, false, 'sales@example.test'])
    const c = (await db.query<Record<string, unknown>>('select status, confirmed_via, confirm_ip, confirmed_at is not null as at from customer_confirmations where id=$1', [r.id])).rows[0]
    assert.deepEqual(c, { status: 'confirmed', confirmed_via: 'link', confirm_ip: '203.0.113.5', at: true })
    assert.deepEqual((await db.query<Record<string, unknown>>('select process_stage, waiting_on from deals where id=$1', [deal])).rows[0], { process_stage: 3, waiting_on: 'us' })
    const twice = (await db.query<{ v: { already: boolean } }>('select confirm_customer_confirmation($1) as v', [r.token])).rows[0].v
    assert.equal(twice.already, true)
    assert.equal((await db.query<{ n: number }>('select count(*)::int n from deal_status_history')).rows[0].n, 1)
    const n = (await db.query<{ user_id: string; content: string }>('select user_id, content from notifications')).rows
    assert.equal(n.length, 1); assert.equal(n[0].user_id, uid); assert.match(n[0].content, /デモ商事 が「秋の新商品」の商品内容を確認しました/)
  } finally { await db.close() }
})

test('取り消し済み・期限切れのリンクは確認できない。営業の代理記録は別扱いで残る。権限なしは断る', async () => {
  const db = await setup()
  try {
    const first = await create(db), second = await create(db)
    await assert.rejects(db.query('select confirm_customer_confirmation($1)', [first.token]), /取り消されました/)
    await db.query("update customer_confirmations set expires_at = now() - interval '1 day' where id=$1", [second.id])
    await assert.rejects(db.query('select confirm_customer_confirmation($1)', [second.token]), /期限が切れました/)
    assert.equal((await db.query<{ v: { status: string } }>('select customer_confirmation_by_token($1) as v', [second.token])).rows[0].v.status, 'expired')
    await db.query('select mark_customer_confirmation_sent($1,$2)', [second.id, 'accepted'])
    assert.equal((await db.query<{ waiting_on: string }>('select waiting_on from deals where id=$1', [deal])).rows[0].waiting_on, 'client')
    await db.query('select staff_confirm_customer_confirmation($1)', [deal])
    const c = (await db.query<Record<string, unknown>>("select confirmed_via, confirmed_by from customer_confirmations where status='confirmed'")).rows
    assert.deepEqual(c, [{ confirmed_via: 'staff', confirmed_by: uid }])
    assert.equal((await db.query<{ n: number }>('select count(*)::int n from notifications')).rows[0].n, 0, '営業自身の記録ではお知らせを出さない')
    assert.match((await db.query<{ note: string }>('select note from deal_status_history')).rows[0].note, /営業が記録/)
    await db.exec("set test.staff='no'")
    await assert.rejects(create(db), /営業・管理者/)
    await assert.rejects(db.query('select staff_confirm_customer_confirmation($1)', [deal]), /営業・管理者/)
    await assert.rejects(db.query('select mark_customer_confirmation_sent($1,$2)', [second.id, 'accepted']), /営業・管理者/)
  } finally { await db.close() }
})
