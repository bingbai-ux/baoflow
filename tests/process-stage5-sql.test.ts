import test from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'

// 再設計 工程5（請求書の発行 → 顧客の承認 = 契約成立）の DB 関数を検証する。

const uid = '11111111-1111-4111-8111-111111111111'
const deal = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', client = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

async function setup() {
  const db = new PGlite()
  await db.exec(`create role anon;create role authenticated;create schema auth;
  create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
  create function public.is_staff() returns boolean language sql as $$select current_setting('test.staff',true)='yes'$$;
  set test.staff='yes'; set test.uid='${uid}';
  create type simple_status as enum('quoting','quote_confirmed','paid');
  create type quote_status as enum('drafting','presented','approved','rejected','revising');
  create table profiles(id uuid primary key, email text);
  insert into profiles values('${uid}','sales@example.test');
  create table system_settings(company_info jsonb, bank_accounts jsonb[], invoice_registration_number text, invoice_default_text text, default_tax_rate numeric);
  -- 本番と同じ形: 振込先の要素が文字列として入っている
  insert into system_settings values('{"name":"デモ株式会社","address":"東京都世田谷区1-2-3","phone":"","email":""}',
    array[to_jsonb('{"bank_name":"楽天銀行","branch_name":"第一営業支店","account_type":"普通","account_number":"1234567","account_holder":"デモ（カ","is_default":true}'::text)], 'T1234567890123', '※振込手数料はお客様負担にてお願いいたします。', 10);
  create table deals(id uuid primary key, deal_code text, deal_name text, client_id uuid, client_name_text text, brand_text text, contact_id uuid, sales_user_id uuid,
    master_status text default 'M01', simple_status simple_status default 'quote_confirmed', process_stage smallint not null default 5, waiting_on text default 'us', archived_at timestamptz, last_activity_at timestamptz);
  insert into deals(id,deal_code,deal_name,client_id,client_name_text,sales_user_id) values('${deal}','PF-1','秋の新商品','${client}','デモ商事','${uid}');
  create table client_contacts(id uuid primary key default gen_random_uuid(), client_id uuid, name text, email text, is_primary boolean default false, created_at timestamptz default now());
  insert into client_contacts(client_id,name,email,is_primary) values('${client}','田中','tanaka@example.test',true);
  create table deal_products(id uuid primary key default gen_random_uuid(), deal_id uuid, product_no int, sort_order int, description text);
  create table deal_product_variants(id uuid primary key default gen_random_uuid(), product_id uuid);
  create table deal_quotes(id uuid primary key default gen_random_uuid(), deal_id uuid, variant_id uuid, quantity int, selling_price_jpy numeric, total_billing_jpy numeric, total_billing_tax_jpy numeric, factory_unit_price_usd numeric, status quote_status default 'drafting');
  create table deal_status_history(id int generated always as identity, deal_id uuid, from_status text, to_status text, from_simple_status simple_status, to_simple_status simple_status, changed_by uuid, kind text, note text);
  create table notifications(id uuid primary key default gen_random_uuid(), user_id uuid, deal_id uuid, type text, status text, content text);
  with p as (insert into deal_products(deal_id,product_no,sort_order,description) values('${deal}',1,1,'平袋'),('${deal}',2,2,'スタンド袋') returning id, product_no),
       v as (insert into deal_product_variants(product_id) select id from p returning id, product_id)
  insert into deal_quotes(deal_id,variant_id,quantity,selling_price_jpy,total_billing_jpy,total_billing_tax_jpy,factory_unit_price_usd,status)
    select '${deal}', v.id, x.qty, x.unit, ceil(x.unit*x.qty), ceil(ceil(x.unit*x.qty)*1.1), 0.05, x.st::quote_status
    from v join p on p.id=v.product_id join (values (1,1000,60,'rejected'),(1,5000,25.5,'approved'),(2,3333,12.34,'approved')) x(no,qty,unit,st) on x.no=p.product_no;`)
  await db.exec(await readFile(new URL('../supabase/migrations/20261122400000_process_redesign_stage5.sql', import.meta.url), 'utf8'))
  return db
}
type Made = { id: string; token: string; invoiceNumber: string; contactEmail: string; snapshot: Record<string, unknown> & { lines: Array<Record<string, unknown>>; issuer: Record<string, string>; bank: Record<string, string> } }
const create = async (db: PGlite, issue = '2026-11-22', due = '2026-12-22') => (await db.query<{ r: Made }>('select create_order_agreement($1,$2,$3) as r', [deal, issue, due])).rows[0].r
const customer = (db: PGlite) => db.exec("set test.staff='no'; set test.uid=''")
const staff = (db: PGlite) => db.exec(`set test.staff='yes'; set test.uid='${uid}'`)

test('発行: 承認済みの見積だけが明細になり、消費税は全体で1回だけ計算。発行者・振込先が入り、原価は含まない', async () => {
  const db = await setup()
  try {
    const r = await create(db)
    assert.deepEqual([r.invoiceNumber, r.contactEmail, r.token.length], ['PF-1-I1', 'tanaka@example.test', 64])
    assert.deepEqual(r.snapshot.lines.map(l => [l.name, l.quantity, Number(l.unit_jpy), Number(l.net_jpy)]), [['平袋', 5000, 25.5, 127500], ['スタンド袋', 3333, 12.34, 41130]])
    // 小計 168,630 → 税込 ceil(185,493.0) = 185,493（行ごとの税込 140,250 + 45,243 と一致）
    assert.deepEqual([Number(r.snapshot.subtotal_jpy), Number(r.snapshot.tax_jpy), Number(r.snapshot.total_jpy)], [168630, 16863, 185493])
    assert.deepEqual(r.snapshot.issuer, { name: 'デモ株式会社', address: '東京都世田谷区1-2-3', phone: null, email: null, registration_number: 'T1234567890123' })
    assert.equal(r.snapshot.bank.account_number, '1234567')
    assert.ok(!/factory|0\.05/.test(JSON.stringify(r.snapshot)), '原価・工場の情報を含まない')
    await assert.rejects(create(db, '2026-11-22', '2026-11-21'), /発行日以降/)
    const again = await create(db)
    assert.equal(again.invoiceNumber, 'PF-1-I2')
    assert.deepEqual((await db.query<{ s: string }>('select status s from order_agreements order by seq')).rows.map(x => x.s), ['cancelled', 'sent'], '承認待ちは常に1通')
    // 設定に足りない項目があれば発行しない
    await db.exec(`update system_settings set company_info = company_info || '{"address":""}', bank_accounts = array['{"bank_name":"楽天銀行"}'::jsonb]`)
    await assert.rejects(create(db), /発行者情報が足りません: 住所・支店名・口座種別・口座番号・口座名義/)
    await db.exec("update deal_quotes set status='drafting'")
    await assert.rejects(create(db), /発行者情報|承認済みのお見積がありません/)
  } finally { await db.close() }
})

test('顧客の承認: 開いただけでは成立せず、ボタンで契約成立 → 工程6・履歴・お知らせ・操作記録。二度押しても1回分', async () => {
  const db = await setup()
  try {
    const r = await create(db)
    await customer(db)
    const view = (await db.query<{ v: { status: string } }>('select order_agreement_by_token($1) as v', [r.token])).rows[0].v
    assert.equal(view.status, 'sent')
    assert.equal((await db.query<{ s: string }>('select status s from order_agreements')).rows[0].s, 'sent', '開いただけでは成立しない')
    const done = (await db.query<{ v: Record<string, unknown> }>('select agree_order_agreement($1,$2,$3) as v', [r.token, '203.0.113.7', 'ua'])).rows[0].v
    assert.deepEqual([done.already, done.notifyEmail, done.customerEmail, done.invoiceNumber, Number(done.totalJpy)], [false, 'sales@example.test', 'tanaka@example.test', 'PF-1-I1', 185493])
    assert.deepEqual((await db.query<Record<string, unknown>>('select status, agreed_via, agree_ip, agreed_at is not null as at from order_agreements')).rows[0], { status: 'agreed', agreed_via: 'link', agree_ip: '203.0.113.7', at: true })
    assert.deepEqual((await db.query<Record<string, unknown>>('select process_stage, waiting_on from deals')).rows[0], { process_stage: 6, waiting_on: 'us' })
    assert.equal((await db.query<{ v: { already: boolean } }>('select agree_order_agreement($1) as v', [r.token])).rows[0].v.already, true)
    const h = (await db.query<{ note: string }>('select note from deal_status_history')).rows
    assert.equal(h.length, 1); assert.match(h[0].note, /請求書 PF-1-I1 を顧客が承認しました（契約成立/)
    assert.match((await db.query<{ content: string }>('select content from notifications')).rows[0].content, /請求書を承認しました（契約成立）/)
    await staff(db)
    await assert.rejects(create(db), /契約成立済み/)
  } finally { await db.close() }
})

test('取り消し・期限切れ・金額変更後は成立しない。営業の代理記録は別扱い。権限なしは断る', async () => {
  const db = await setup()
  try {
    const first = await create(db)
    await db.query("select staff_decide_order_agreement($1,'cancel')", [deal])
    await assert.rejects(db.query('select agree_order_agreement($1)', [first.token]), /取り消されました/)
    const second = await create(db)
    await db.query("update order_agreements set expires_at = now() - interval '1 day' where id=$1", [second.id])
    await assert.rejects(db.query('select agree_order_agreement($1)', [second.token]), /期限が切れました/)
    await db.query("update order_agreements set expires_at = now() + interval '1 day' where id=$1", [second.id])
    await db.query('select mark_order_agreement_sent($1,$2)', [second.id, 'accepted'])
    assert.equal((await db.query<{ w: string }>('select waiting_on w from deals')).rows[0].w, 'client')
    await db.exec("update deal_quotes set total_billing_jpy = total_billing_jpy + 100 where status='approved' and quantity=5000") // 発行後に金額が変わった
    await assert.rejects(db.query("select staff_decide_order_agreement($1,'agree')", [deal]), /内容が更新されています/)
    await db.exec("update deal_quotes set total_billing_jpy = total_billing_jpy - 100 where status='approved' and quantity=5000")
    await db.query("select staff_decide_order_agreement($1,'agree')", [deal])
    assert.deepEqual((await db.query<Record<string, unknown>>('select seq, status, agreed_via, agreed_by from order_agreements order by seq')).rows,
      [{ seq: 1, status: 'cancelled', agreed_via: null, agreed_by: null }, { seq: 2, status: 'agreed', agreed_via: 'staff', agreed_by: uid }])
    assert.equal((await db.query<{ n: number }>('select count(*)::int n from notifications')).rows[0].n, 0, '営業自身の記録ではお知らせを出さない')
    await db.exec("set test.staff='no'")
    await assert.rejects(create(db), /営業・管理者/)
    await assert.rejects(db.query("select staff_decide_order_agreement($1,'cancel')", [deal]), /営業・管理者/)
    await assert.rejects(db.query('select mark_order_agreement_sent($1,$2)', [second.id, 'accepted']), /営業・管理者/)
    await assert.rejects(db.query('select order_agreement_issuer()'), /営業・管理者/)
  } finally { await db.close() }
})
