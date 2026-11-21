import test from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'

const uid = '11111111-1111-4111-8111-111111111111'
const clientA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const clientB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const req = (n: number) => `0000000${n}-0000-4000-8000-000000000000`

async function setup() {
  const db = new PGlite()
  await db.exec(`create role anon;create role authenticated;create schema auth;
  create function auth.uid() returns uuid language sql as $$select '${uid}'::uuid$$;
  create function public.is_staff() returns boolean language sql as $$select current_setting('test.staff',true)='yes'$$;
  set test.staff='yes';
  create type public.simple_status as enum ('quoting','quote_confirmed','paid','data_confirmed','in_production','shipped','delivered');
  create table profiles(id uuid primary key, role text);
  insert into profiles values('${uid}','admin');
  create table clients(id uuid primary key default gen_random_uuid(), company_name text not null, short_name text, brand_name text,
    contact_name text, contact_role text, email text, phone text, contact_phone text);
  create table deals(id uuid primary key default gen_random_uuid(), deal_code text unique not null, deal_name text, client_id uuid,
    client_name_text text, brand_text text, desired_delivery_date date, sales_user_id uuid, master_status text not null default 'M01',
    simple_status public.simple_status not null default 'quoting', visibility text, waiting_on text, last_activity_at timestamptz, archived_at timestamptz);
  create table deal_status_history(id int generated always as identity, deal_id uuid, from_status text, to_status text not null,
    from_simple_status public.simple_status, to_simple_status public.simple_status, changed_by uuid, note text, kind text);
  create table wizard_requests(request_id uuid primary key, user_id uuid not null, operation text not null, payload jsonb not null, result jsonb, created_at timestamptz default now());
  insert into clients(id,company_name,short_name,brand_name,contact_name,email) values
    ('${clientA}','株式会社A','A社','ブランドA1','山田','yamada@example.test'),
    ('${clientB}','株式会社B',null,'株式会社B',null,null);
  insert into deals(deal_code,simple_status) values ('OLD-1','quoting'),('OLD-2','quote_confirmed'),('OLD-3','paid'),
    ('OLD-4','data_confirmed'),('OLD-5','in_production'),('OLD-6','shipped'),('OLD-7','delivered');`)
  await db.exec(await readFile(new URL('../supabase/migrations/20261122000000_process_redesign_stage1.sql', import.meta.url), 'utf8'))
  return db
}

test('D6: 旧7段階が対応表どおり9工程へ移行され、旧ステータスは変わらない', async () => {
  const db = await setup()
  try {
    const rows = (await db.query<{ deal_code: string; simple_status: string; process_stage: number }>(
      'select deal_code,simple_status::text,process_stage from deals order by deal_code')).rows
    assert.deepEqual(rows.map(r => r.process_stage), [2, 5, 6, 7, 7, 8, 9])
    assert.deepEqual(rows.map(r => r.simple_status), ['quoting', 'quote_confirmed', 'paid', 'data_confirmed', 'in_production', 'shipped', 'delivered'])
  } finally { await db.close() }
})

test('既存の担当者・ブランドが新しい表へ写る（会社名と同じブランドは写さない）', async () => {
  const db = await setup()
  try {
    const contacts = (await db.query<{ client_id: string; name: string; is_primary: boolean }>('select client_id,name,is_primary from client_contacts')).rows
    assert.deepEqual(contacts, [{ client_id: clientA, name: '山田', is_primary: true }])
    const brands = (await db.query<{ client_id: string; name: string }>('select client_id,name from brands')).rows
    assert.deepEqual(brands, [{ client_id: clientA, name: 'ブランドA1' }])
    await assert.rejects(db.query("insert into client_contacts(client_id,name,is_primary) values($1,'二人目',true)", [clientA]), /client_contacts_one_primary/)
  } finally { await db.close() }
})

test('プロジェクト作成: 工程1で作られ、再送しても1件、他社の担当者・ブランドは拒否', async () => {
  const db = await setup()
  try {
    const contact = (await db.query<{ id: string }>('select id from client_contacts')).rows[0].id
    const brand = (await db.query<{ id: string }>('select id from brands')).rows[0].id
    const payload = { client_id: clientA, contact_id: contact, brand_id: brand, desired_delivery_date: '2027-01-31' }
    const first = (await db.query<{ r: { dealId: string; dealCode: string } }>('select create_project_v1($1,$2) as r', [req(1), payload])).rows[0].r
    const again = (await db.query<{ r: { dealId: string } }>('select create_project_v1($1,$2) as r', [req(1), payload])).rows[0].r
    assert.equal(first.dealId, again.dealId)
    const deal = (await db.query<Record<string, unknown>>('select process_stage,client_id,client_name_text,brand_text,brand_id,contact_id,deal_name,simple_status::text,desired_delivery_date::text from deals where id=$1', [first.dealId])).rows[0]
    assert.equal(deal.process_stage, 1)
    assert.equal(deal.client_id, clientA)
    assert.equal(deal.client_name_text, 'A社')
    assert.equal(deal.brand_text, 'ブランドA1')
    assert.equal(deal.contact_id, contact)
    assert.equal(deal.desired_delivery_date, '2027-01-31')
    assert.match(String(deal.deal_name), /^ブランドA1 \d{4}年\d{1,2}月$/)
    assert.match(first.dealCode, /^PF-\d{6}-\d{3}$/)
    assert.equal((await db.query<{ n: number }>("select count(*)::int as n from deals where deal_code like 'PF-%'")).rows[0].n, 1)
    assert.equal((await db.query<{ n: number }>('select count(*)::int as n from deal_status_history where deal_id=$1', [first.dealId])).rows[0].n, 1)

    await assert.rejects(db.query('select create_project_v1($1,$2)', [req(2), { client_id: clientB, contact_id: contact }]), /担当者がこの取引先に/)
    await assert.rejects(db.query('select create_project_v1($1,$2)', [req(3), { client_id: clientB, brand_id: brand }]), /ブランドがこの取引先に/)
    await assert.rejects(db.query('select create_project_v1($1,$2)', [req(4), {}]), /取引先を選んで/)
    const noBrand = (await db.query<{ r: { dealId: string } }>('select create_project_v1($1,$2) as r', [req(5), { client_id: clientB, deal_name: '春の新商品' }])).rows[0].r
    const d2 = (await db.query<{ deal_name: string; brand_id: string | null; desired_delivery_date: string | null }>('select deal_name,brand_id,desired_delivery_date::text from deals where id=$1', [noBrand.dealId])).rows[0]
    assert.deepEqual(d2, { deal_name: '春の新商品', brand_id: null, desired_delivery_date: null })
    await db.exec("set test.staff='no'")
    await assert.rejects(db.query('select create_project_v1($1,$2)', [req(6), { client_id: clientA }]), /営業・管理者/)
  } finally { await db.close() }
})

test('工程変更: 変更と履歴が一緒に残り、範囲外・アーカイブ済み・権限なしは拒否', async () => {
  const db = await setup()
  try {
    const id = (await db.query<{ id: string }>("select id from deals where deal_code='OLD-1'")).rows[0].id
    await db.query('select set_process_stage($1,$2)', [id, 4])
    assert.equal((await db.query<{ process_stage: number }>('select process_stage from deals where id=$1', [id])).rows[0].process_stage, 4)
    const h = (await db.query<{ note: string }>('select note from deal_status_history where deal_id=$1', [id])).rows
    assert.equal(h.length, 1)
    assert.equal(h[0].note, '工程を「商品登録」から「価格提示」に変更')
    await db.query('select set_process_stage($1,$2)', [id, 4])
    assert.equal((await db.query<{ n: number }>('select count(*)::int as n from deal_status_history where deal_id=$1', [id])).rows[0].n, 1)
    await assert.rejects(db.query('select set_process_stage($1,$2)', [id, 10]), /1〜9/)
    await assert.rejects(db.query('update deals set process_stage=0 where id=$1', [id]), /deals_process_stage_range/)
    await db.query('update deals set archived_at=now() where id=$1', [id])
    await assert.rejects(db.query('select set_process_stage($1,$2)', [id, 5]), /アーカイブ/)
    await db.exec("set test.staff='no'")
    await assert.rejects(db.query('select set_process_stage($1,$2)', [id, 5]), /営業・管理者/)
  } finally { await db.close() }
})
