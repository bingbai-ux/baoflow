import test from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'

// 再設計 工程4（価格 → お見積の提示 → 承認 / 差し戻し）の DB 関数を、本番と同じ型（enum）で検証する。

const uid = '11111111-1111-4111-8111-111111111111'
const deal = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', client = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const pA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', pB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
const q = (n: number) => `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb${n}`

async function setup() {
  const db = new PGlite()
  await db.exec(`create role anon;create role authenticated;create schema auth;
  create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
  create function public.is_staff() returns boolean language sql as $$select current_setting('test.staff',true)='yes'$$;
  set test.staff='yes'; set test.uid='${uid}';
  create type simple_status as enum('quoting','quote_confirmed','paid','data_confirmed','in_production','shipped','delivered');
  create type quote_status as enum('drafting','presented','approved','rejected','revising');
  create table profiles(id uuid primary key, email text);
  insert into profiles values('${uid}','sales@example.test');
  create table system_settings(default_tax_rate numeric); insert into system_settings values(10);
  create table deals(id uuid primary key, deal_code text, deal_name text, client_id uuid, client_name_text text, brand_text text, contact_id uuid, sales_user_id uuid,
    master_status text default 'M01', simple_status simple_status default 'quoting', process_stage smallint not null default 3, waiting_on text default 'us', archived_at timestamptz, last_activity_at timestamptz);
  insert into deals(id,deal_code,deal_name,client_id,client_name_text,sales_user_id) values('${deal}','PF-1','秋の新商品','${client}','デモ商事','${uid}');
  create table client_contacts(id uuid primary key default gen_random_uuid(), client_id uuid, name text, email text, is_primary boolean default false, created_at timestamptz default now());
  insert into client_contacts(client_id,name,email,is_primary) values('${client}','田中','tanaka@example.test',true);
  create table deal_products(id uuid primary key, deal_id uuid, product_no int, sort_order int, description text, shipping_mode text);
  create table deal_product_variants(id uuid primary key default gen_random_uuid(), product_id uuid);
  create table deal_quotes(id uuid primary key, deal_id uuid, variant_id uuid, quantity int, factory_unit_price_usd numeric, plate_fee_usd numeric, other_fees_usd numeric, pantone_color_fee_usd numeric,
    china_freight_usd numeric, domestic_china_freight_usd numeric, factory_calculated_freight_usd numeric, total_cost_usd numeric, unit_cost_usd numeric, exchange_rate numeric, cost_ratio numeric,
    selling_price_jpy numeric, selling_price_usd numeric, total_billing_jpy numeric, total_billing_tax_jpy numeric, status quote_status default 'drafting', pricing_snapshot jsonb);
  create table deal_status_history(id int generated always as identity, deal_id uuid, from_status text, to_status text, from_simple_status simple_status, to_simple_status simple_status, changed_by uuid, kind text, note text);
  create table notifications(id uuid primary key default gen_random_uuid(), user_id uuid, deal_id uuid, type text, status text, content text);
  insert into deal_products values('${pA}','${deal}',1,1,'平袋','sea'),('${pB}','${deal}',2,2,'スタンド袋','air');
  with v as (insert into deal_product_variants(product_id) values('${pA}'),('${pB}') returning id, product_id)
  insert into deal_quotes(id,deal_id,variant_id,quantity)
    select x.id::uuid, '${deal}', v.id, x.qty from v join (values ('${q(1)}','${pA}',1000),('${q(2)}','${pA}',5000),('${q(3)}','${pB}',3000)) x(id,pid,qty) on x.pid::uuid = v.product_id;`)
  await db.exec(await readFile(new URL('../supabase/migrations/20261122300000_process_redesign_stage4.sql', import.meta.url), 'utf8'))
  return db
}
const line = (n: number, unit: number, fees: number, freight: number, sell: number) => ({ quote_id: q(n), factory_unit_price_usd: unit, fees_usd: fees, freight_usd: freight, selling_price_jpy: sell })
const prices = { exchange_rate: 150, tax_rate: 10, lines: [line(1, 0.1, 50, 30, 60), line(2, 0.08, 50, 100, 25.5), line(3, 0.2, 0, 60, 80)], production_days: { [pA]: 25 } }
const save = (db: PGlite, payload: unknown = prices) => db.query('select save_offer_prices_v1($1,$2)', [deal, JSON.stringify(payload)])
type Offer = { id: string; token: string; round: number; contactEmail: string; snapshot: { items: Array<{ name: string; production_days: number | null; options: Array<Record<string, unknown>> }> } }
const create = async (db: PGlite) => (await db.query<{ r: Offer }>('select create_price_offer($1) as r', [deal])).rows[0].r
const statuses = async (db: PGlite) => (await db.query<{ s: string }>("select status::text s from deal_quotes order by id")).rows.map(r => r.s)
const customer = (db: PGlite) => db.exec("set test.staff='no'; set test.uid=''")
const staff = (db: PGlite) => db.exec(`set test.staff='yes'; set test.uid='${uid}'`)

test('価格の保存: 原価・原価率・総額・税込が計算され、原価割れや不正な値は保存しない', async () => {
  const db = await setup()
  try {
    await save(db)
    const r = (await db.query<Record<string, string>>('select total_cost_usd::float8 t, unit_cost_usd::float8 u, cost_ratio::float8 r, selling_price_jpy::float8 s, total_billing_jpy::float8 n, total_billing_tax_jpy::float8 x from deal_quotes where id=$1', [q(1)])).rows[0]
    // 1000個 × $0.1 + 諸費用$50 + 送料$30 = $180 → 1個 $0.18 → ¥27。提示 ¥60 → 原価率 45%
    assert.deepEqual(r, { t: 180, u: 0.18, r: 0.45, s: 60, n: 60000, x: 66000 })
    const half = (await db.query<Record<string, number>>('select total_billing_jpy::float8 n, total_billing_tax_jpy::float8 x from deal_quotes where id=$1', [q(2)])).rows[0]
    assert.deepEqual(half, { n: 127500, x: 140250 }, '小数の単価（¥25.5）でも総額は円単位')
    assert.equal((await db.query<{ d: number }>('select production_days d from deal_products where id=$1', [pA])).rows[0].d, 25)
    assert.equal((await db.query<{ s: number }>('select process_stage s from deals')).rows[0].s, 4)
    await assert.rejects(save(db, { ...prices, lines: [line(1, 0.1, 50, 30, 26)] }), /原価を下回っています/)
    await assert.rejects(save(db, { ...prices, lines: [line(1, 0, 0, 0, 60)] }), /工場単価/)
    await assert.rejects(save(db, { ...prices, exchange_rate: 0 }), /為替/)
    await assert.rejects(save(db, { ...prices, lines: [{ ...line(1, 0.1, 0, 0, 60), quote_id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc9' }] }), /見つかりません/)
    await db.query(`update deal_quotes set pricing_snapshot='{}' where id=$1`, [q(3)])
    await assert.rejects(save(db), /以前の画面で確定/)
    assert.equal((await db.query<{ s: number }>('select selling_price_jpy::float8 s from deal_quotes where id=$1', [q(1)])).rows[0].s, 60, '失敗した保存は何も書き換えない')
  } finally { await db.close() }
})

test('提示 → 顧客が数量を選んで承認: 請求へ進み、選ばれなかった数量は不採用、履歴とお知らせが残る', async () => {
  const db = await setup()
  try {
    await assert.rejects(create(db), /提示単価が未入力/)
    await save(db)
    const o = await create(db)
    assert.deepEqual([o.round, o.contactEmail, o.token.length], [1, 'tanaka@example.test', 64])
    assert.deepEqual(o.snapshot.items.map(i => [i.name, i.production_days, i.options.length]), [['平袋', 25, 2], ['スタンド袋', null, 1]])
    assert.ok(!/factory|cost|0\.18/.test(JSON.stringify(o.snapshot)), '原価・工場の情報を含まない')
    assert.deepEqual(await statuses(db), ['presented', 'presented', 'presented'])
    await assert.rejects(save(db), /返事待ちの間は価格を変更できません/)
    await customer(db)
    const view = (await db.query<{ v: { status: string } }>('select price_offer_by_token($1) as v', [o.token])).rows[0].v
    assert.equal(view.status, 'sent')
    await assert.rejects(db.query("select decide_price_offer($1,'approve')", [o.token]), /「平袋」の数量を選んでください/)
    await assert.rejects(db.query("select decide_price_offer($1,'approve',$2)", [o.token, JSON.stringify({ [pA]: q(3) })]), /数量を選んでください/, '別の商品の数量は選べない')
    const done = (await db.query<{ v: { already: boolean; notifyEmail: string } }>("select decide_price_offer($1,'approve',$2,null,'203.0.113.9','ua') as v", [o.token, JSON.stringify({ [pA]: q(2) })])).rows[0].v
    assert.deepEqual([done.already, done.notifyEmail], [false, 'sales@example.test'])
    assert.deepEqual(await statuses(db), ['rejected', 'approved', 'approved'])
    assert.deepEqual((await db.query<Record<string, unknown>>('select process_stage, waiting_on, simple_status::text simple_status from deals')).rows[0], { process_stage: 5, waiting_on: 'us', simple_status: 'quote_confirmed' })
    const h = (await db.query<Record<string, string>>('select from_simple_status::text f, to_simple_status::text t, note from deal_status_history')).rows
    assert.equal(h.length, 1); assert.deepEqual([h[0].f, h[0].t], ['quoting', 'quote_confirmed']); assert.match(h[0].note, /第1回お見積を顧客が承認/)
    assert.match((await db.query<{ content: string }>('select content from notifications')).rows[0].content, /第1回お見積を承認しました/)
    const twice = (await db.query<{ v: { already: boolean } }>("select decide_price_offer($1,'approve') as v", [o.token])).rows[0].v
    assert.equal(twice.already, true)
    await assert.rejects(db.query("select decide_price_offer($1,'return','{}','やっぱり変更')", [o.token]), /受付を終了/)
    assert.equal((await db.query<{ n: number }>('select count(*)::int n from deal_status_history')).rows[0].n, 1)
    await staff(db)
    await assert.rejects(create(db), /承認済み/)
  } finally { await db.close() }
})

test('差し戻し → 価格を直して第2回を提示: 全ての回が残る。取り消し・期限切れ・価格変更後・権限なしは断る', async () => {
  const db = await setup()
  try {
    await save(db)
    const first = await create(db)
    await customer(db)
    await assert.rejects(db.query("select decide_price_offer($1,'return','{}','  ')", [first.token]), /変更したい内容/)
    await db.query("select decide_price_offer($1,'return','{}','数量を10000に増やしたい')", [first.token])
    await staff(db)
    assert.deepEqual(await statuses(db), ['revising', 'revising', 'revising'])
    assert.deepEqual((await db.query<Record<string, unknown>>('select process_stage, simple_status::text simple_status from deals')).rows[0], { process_stage: 4, simple_status: 'quoting' })
    assert.match((await db.query<{ content: string }>('select content from notifications')).rows[0].content, /差し戻しました: 数量を10000に増やしたい/)
    await save(db, { ...prices, lines: [line(1, 0.1, 50, 30, 55), line(2, 0.08, 50, 100, 24), line(3, 0.2, 0, 60, 80)] })
    const second = await create(db)
    assert.equal(second.round, 2)
    await db.query('select mark_price_offer_sent($1,$2)', [second.id, 'accepted'])
    assert.equal((await db.query<{ w: string }>('select waiting_on w from deals')).rows[0].w, 'client')
    // 営業が取り消す → 価格を直せる状態に戻る
    await db.query("select staff_decide_price_offer($1,'cancel')", [deal])
    assert.deepEqual(await statuses(db), ['drafting', 'drafting', 'drafting'])
    await assert.rejects(db.query("select decide_price_offer($1,'approve',$2)", [second.token, JSON.stringify({ [pA]: q(1) })]), /受付を終了/)
    const third = await create(db)
    assert.equal(third.round, 3, '取り消した回の番号は使い回さない')
    await db.query("update price_offers set expires_at = now() - interval '1 day' where id=$1", [third.id])
    await assert.rejects(db.query("select decide_price_offer($1,'approve',$2)", [third.token, JSON.stringify({ [pA]: q(1) })]), /有効期限/)
    await db.query("update price_offers set expires_at = now() + interval '1 day' where id=$1", [third.id])
    await db.query('update deal_quotes set selling_price_jpy = 70 where id=$1', [q(1)]) // 提示後に価格が変わった
    await assert.rejects(db.query("select staff_decide_price_offer($1,'approve',$2)", [deal, JSON.stringify({ [pA]: q(1) })]), /内容が更新されています/)
    await db.query("select staff_decide_price_offer($1,'approve',$2)", [deal, JSON.stringify({ [pA]: q(2) })])
    assert.deepEqual((await db.query<{ r: number; s: string; v: string | null }>('select round r, status s, decided_via v from price_offers order by round')).rows,
      [{ r: 1, s: 'returned', v: 'link' }, { r: 2, s: 'cancelled', v: null }, { r: 3, s: 'approved', v: 'staff' }])
    assert.equal((await db.query<{ n: number }>('select count(*)::int n from notifications')).rows[0].n, 1, '営業自身の記録ではお知らせを出さない')
    await db.exec("set test.staff='no'")
    await assert.rejects(save(db), /営業・管理者/)
    await assert.rejects(create(db), /営業・管理者/)
    await assert.rejects(db.query("select staff_decide_price_offer($1,'cancel')", [deal]), /営業・管理者/)
    await assert.rejects(db.query('select mark_price_offer_sent($1,$2)', [third.id, 'accepted']), /営業・管理者/)
  } finally { await db.close() }
})
