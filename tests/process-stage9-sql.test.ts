import test from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'

// 再設計 工程9（検収とリピート）の DB 関数を検証する。
// 案件づくり本体（create_project_v1）は工程1のテストで検証済みなので、ここでは同じ約束（同じ要求は同じ結果）を守る代役を使う。

const uid = '11111111-1111-4111-8111-111111111111'
const deal = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', early = 'ffffffff-ffff-4fff-8fff-ffffffffffff', client = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const fc = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', spring = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'

async function setup() {
  const db = new PGlite()
  await db.exec(`create role anon;create role authenticated;create schema auth;
  create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
  create function public.is_staff() returns boolean language sql as $$select current_setting('test.staff',true)='yes'$$;
  set test.staff='yes'; set test.uid='${uid}';
  create type quote_status as enum('drafting','presented','approved','rejected','revising');
  create table profiles(id uuid primary key, email text); insert into profiles values('${uid}','sales@example.test');
  create table deals(id uuid primary key default gen_random_uuid(), deal_code text, deal_name text, client_id uuid, client_name_text text, brand_text text, brand_id uuid, contact_id uuid, sales_user_id uuid,
    master_status text default 'M01', simple_status text default 'quote_confirmed', process_stage smallint not null default 9, waiting_on text default 'client', archived_at timestamptz, last_activity_at timestamptz);
  insert into deals(id,deal_code,deal_name,client_id,client_name_text,sales_user_id) values('${deal}','PF-1','秋の新商品','${client}','デモ商事','${uid}'),('${early}','PF-2','未発送','${client}','デモ商事','${uid}');
  create table client_contacts(id uuid primary key default gen_random_uuid(), client_id uuid, name text, email text, is_primary boolean default false, created_at timestamptz default now());
  insert into client_contacts(client_id,name,email,is_primary) values('${client}','田中','tanaka@example.test',true);
  create table issuer_companies(id uuid primary key, name text, postal_code text, address text, phone text, email text, registration_number text, logo_data text, stamp_data text, is_default boolean default false, archived_at timestamptz);
  insert into issuer_companies(id,name,address,is_default,stamp_data) values('${fc}','株式会社FOOD&COMPANY','東京都世田谷区1-2-3',true,null),('${spring}','株式会社Springroll','神奈川県横浜市4-5-6',false,'data:image/png;base64,AAAA');
  create table order_agreements(id uuid primary key default gen_random_uuid(), deal_id uuid, status text, snapshot jsonb);
  insert into order_agreements(deal_id,status,snapshot) values('${deal}','agreed','{"issuer":{"id":"${spring}"}}');
  create table deal_shipments(deal_id uuid primary key, shipped_on date, ship_to_name text, ship_to_postal_code text, ship_to_address text, carton_count int, carrier text, tracking_number text);
  insert into deal_shipments values('${deal}','2026-11-01','デモ商事 物流センター','150-0001','東京都渋谷区1-2-3',12,'ヤマト運輸','1234-5678'),('${early}',null,null,null,null,null,null,null);
  create table deal_products(id uuid primary key default gen_random_uuid(), deal_id uuid, product_no int, sort_order int, description text, is_selected boolean default false, production_days int, sample_required boolean default false, created_at timestamptz default now(), updated_at timestamptz default now());
  create table deal_product_variants(id uuid primary key default gen_random_uuid(), product_id uuid, variant_label text, variant_order int default 0, width_mm numeric, is_selected boolean default false, created_at timestamptz default now(), updated_at timestamptz default now());
  create table deal_quotes(id uuid primary key default gen_random_uuid(), deal_id uuid, variant_id uuid, quantity int, selling_price_jpy numeric, factory_unit_price_usd numeric, status quote_status default 'drafting', version int default 1);
  create table deal_status_history(id int generated always as identity, deal_id uuid, from_status text, to_status text, from_simple_status text, to_simple_status text, changed_by uuid, kind text, note text);
  create table notifications(id uuid primary key default gen_random_uuid(), user_id uuid, deal_id uuid, type text, status text, content text);
  create table wizard_requests(request_id uuid primary key, result jsonb);
  create function public.create_project_v1(p_request_id uuid, p_payload jsonb) returns jsonb language plpgsql as $$
    declare v uuid; r jsonb; begin
      select result into r from wizard_requests where request_id = p_request_id; if found then return r; end if;
      insert into deals(deal_code, deal_name, client_id, contact_id, sales_user_id, simple_status, process_stage, waiting_on) values('PF-NEW', p_payload->>'deal_name', (p_payload->>'client_id')::uuid, nullif(p_payload->>'contact_id','')::uuid, (p_payload->>'sales_user_id')::uuid, 'quoting', 1, 'us') returning id into v;
      r := jsonb_build_object('success', true, 'dealId', v, 'dealCode', 'PF-NEW'); insert into wizard_requests values(p_request_id, r); return r; end $$;
  with p as (insert into deal_products(deal_id,product_no,sort_order,description,production_days,sample_required,is_selected) values('${deal}',1,2,'平袋',25,true,true),('${deal}',2,1,'スタンド袋',null,false,false) returning id, product_no),
       v as (insert into deal_product_variants(product_id,variant_label,width_mm) select id, '標準', 100 + product_no from p returning id, product_id)
  insert into deal_quotes(deal_id,variant_id,quantity,selling_price_jpy,factory_unit_price_usd,status)
    select '${deal}', v.id, x.qty, 60, 0.1, x.st::quote_status from v join p on p.id=v.product_id join (values (1,1000,'rejected'),(1,5000,'approved'),(2,3000,'approved')) x(no,qty,st) on x.no=p.product_no;`)
  await db.exec(await readFile(new URL('../supabase/migrations/20261122900000_process_redesign_stage9.sql', import.meta.url), 'utf8'))
  return db
}
type Made = { id: string; token: string; contactEmail: string; snapshot: Record<string, unknown> & { lines: Array<Record<string, unknown>>; issuer: Record<string, string> } }
const create = async (db: PGlite, day = '2026-11-20', id = deal) => (await db.query<{ r: Made }>('select create_deal_receipt($1,$2) as r', [id, day])).rows[0].r
const customer = (db: PGlite) => db.exec("set test.staff='no'; set test.uid=''")
const staff = (db: PGlite) => db.exec(`set test.staff='yes'; set test.uid='${uid}'`)

test('到着の記録 → 顧客が受領: 納品書の内容は承認済みの数量だけ・金額なし。受領で案件完了、履歴とお知らせが残る', async () => {
  const db = await setup()
  try {
    await assert.rejects(create(db, '2026-11-20', early), /発送完了を記録/)
    await assert.rejects(create(db, '2026-10-31'), /発送日以降/)
    await assert.rejects(create(db, '2999-01-01'), /未来の日付/)
    const r = await create(db)
    assert.deepEqual([r.token.length, r.contactEmail, r.snapshot.delivery_note_number, r.snapshot.tracking_number], [64, 'tanaka@example.test', 'PF-1-D1', '1234-5678'])
    assert.deepEqual(r.snapshot.lines, [{ name: 'スタンド袋', quantity: 3000 }, { name: '平袋', quantity: 5000 }], '並び順どおり・不採用の数量は載らない')
    assert.equal(r.snapshot.issuer.name, '株式会社Springroll', '請求書と同じ発行元')
    assert.ok(!/selling|factory|0\.1|"60"/.test(JSON.stringify(r.snapshot)), '金額・原価を含まない')
    const again = await create(db, '2026-11-21')
    assert.deepEqual((await db.query<{ s: string }>('select status s from deal_receipts order by seq')).rows.map(x => x.s), ['cancelled', 'sent'])
    await customer(db)
    const view = (await db.query<{ v: { status: string; stamp: string | null } }>('select deal_receipt_by_token($1) as v', [again.token])).rows[0].v
    assert.deepEqual([view.status, view.stamp], ['sent', 'data:image/png;base64,AAAA'])
    assert.equal((await db.query<{ s: string }>('select status s from deal_receipts where id=$1', [again.id])).rows[0].s, 'sent', '開いただけでは受領にならない')
    await assert.rejects(db.query('select confirm_deal_receipt($1)', [r.token]), /取り消されました/)
    const done = (await db.query<{ v: Record<string, unknown> }>('select confirm_deal_receipt($1,$2,$3) as v', [again.token, '203.0.113.9', 'ua'])).rows[0].v
    assert.deepEqual([done.already, done.notifyEmail, done.customerEmail], [false, 'sales@example.test', 'tanaka@example.test'])
    assert.equal((await db.query<{ v: { already: boolean } }>('select confirm_deal_receipt($1) as v', [again.token])).rows[0].v.already, true)
    assert.deepEqual((await db.query<Record<string, unknown>>('select status, received_via, receive_ip from deal_receipts where id=$1', [again.id])).rows[0], { status: 'received', received_via: 'link', receive_ip: '203.0.113.9' })
    assert.deepEqual((await db.query<Record<string, unknown>>('select process_stage, waiting_on from deals where id=$1', [deal])).rows[0], { process_stage: 9, waiting_on: 'none' })
    const notes = (await db.query<{ note: string }>('select note from deal_status_history where deal_id=$1 order by id', [deal])).rows.map(x => x.note)
    assert.equal(notes.length, 3); assert.match(notes[2], /顧客が受領を確認しました（メールのリンクから）。納品書 PF-1-D2。案件完了/)
    assert.match((await db.query<{ content: string }>('select content from notifications')).rows[0].content, /受領を確認しました。案件完了です/)
    await staff(db)
    await assert.rejects(create(db), /受領済み/)
  } finally { await db.close() }
})

test('営業の代理記録と取り消し。期限切れ・権限なしは断る', async () => {
  const db = await setup()
  try {
    await assert.rejects(db.query("select staff_decide_deal_receipt($1,'received')", [deal]), /返事待ちの確認依頼がありません/)
    const first = await create(db)
    await db.query("select staff_decide_deal_receipt($1,'cancel')", [deal])
    assert.equal((await db.query<{ w: string }>('select waiting_on w from deals where id=$1', [deal])).rows[0].w, 'us')
    const second = await create(db)
    await db.query("update deal_receipts set expires_at = now() - interval '1 day' where id=$1", [second.id])
    await assert.rejects(db.query('select confirm_deal_receipt($1)', [second.token]), /期限が切れました/)
    await db.query('select mark_deal_receipt_sent($1,$2)', [second.id, 'accepted'])
    const done = (await db.query<{ v: Record<string, unknown> }>("select staff_decide_deal_receipt($1,'received') as v", [deal])).rows[0].v
    assert.equal(done.contactEmail, 'tanaka@example.test')
    assert.deepEqual((await db.query<Record<string, unknown>>('select seq, status, received_via, received_by from deal_receipts order by seq')).rows,
      [{ seq: 1, status: 'cancelled', received_via: null, received_by: null }, { seq: 2, status: 'received', received_via: 'staff', received_by: uid }])
    assert.equal((await db.query<{ n: number }>('select count(*)::int n from notifications')).rows[0].n, 0, '営業自身の記録ではお知らせを出さない')
    assert.ok(first.token !== second.token)
    await db.exec("set test.staff='no'")
    await assert.rejects(create(db), /営業・管理者/)
    await assert.rejects(db.query("select staff_decide_deal_receipt($1,'cancel')", [deal]), /営業・管理者/)
    await assert.rejects(db.query('select mark_deal_receipt_sent($1,$2)', [second.id, 'accepted']), /営業・管理者/)
    await assert.rejects(db.query('select repeat_project_v1(gen_random_uuid(),$1)', [deal]), /営業・管理者/)
  } finally { await db.close() }
})

test('リピート: 商品の仕様と数量だけを新しい案件に写す。価格・状態は引き継がず、同じ要求を2回送っても1件だけ', async () => {
  const db = await setup()
  try {
    const request = '99999999-9999-4999-8999-999999999999'
    const r = (await db.query<{ v: { dealId: string } }>('select repeat_project_v1($1,$2) as v', [request, deal])).rows[0].v
    const twice = (await db.query<{ v: { dealId: string } }>('select repeat_project_v1($1,$2) as v', [request, deal])).rows[0].v
    assert.equal(twice.dealId, r.dealId)
    assert.deepEqual((await db.query<Record<string, unknown>>('select deal_name, client_id, process_stage, simple_status, waiting_on from deals where id=$1', [r.dealId])).rows[0],
      { deal_name: '秋の新商品（リピート）', client_id: client, process_stage: 2, simple_status: 'quoting', waiting_on: 'us' })
    const products = (await db.query<Record<string, unknown>>('select description, product_no, sort_order, sample_required, is_selected, production_days from deal_products where deal_id=$1 order by sort_order', [r.dealId])).rows
    assert.deepEqual(products, [{ description: 'スタンド袋', product_no: 2, sort_order: 1, sample_required: false, is_selected: false, production_days: null }, { description: '平袋', product_no: 1, sort_order: 2, sample_required: true, is_selected: false, production_days: null }])
    const quotes = (await db.query<Record<string, unknown>>(`select p.description d, v.width_mm::int w, q.quantity n, q.status::text s, q.selling_price_jpy price, q.factory_unit_price_usd cost
      from deal_quotes q join deal_product_variants v on v.id=q.variant_id join deal_products p on p.id=v.product_id where q.deal_id=$1 order by p.sort_order, q.quantity`, [r.dealId])).rows
    assert.deepEqual(quotes, [{ d: 'スタンド袋', w: 102, n: 3000, s: 'drafting', price: null, cost: null }, { d: '平袋', w: 101, n: 1000, s: 'drafting', price: null, cost: null }, { d: '平袋', w: 101, n: 5000, s: 'drafting', price: null, cost: null }])
    assert.equal((await db.query<{ n: number }>('select count(*)::int n from deal_products where deal_id=$1', [deal])).rows[0].n, 2, '元の案件はそのまま')
    assert.match((await db.query<{ note: string }>('select note from deal_status_history where deal_id=$1', [r.dealId])).rows[0].note, /「秋の新商品」（PF-1）の内容を引き継いで作成/)
  } finally { await db.close() }
})
