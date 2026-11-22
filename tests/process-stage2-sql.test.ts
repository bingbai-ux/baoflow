import test from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { productName } from '../src/lib/process/product-name'

const uid = '11111111-1111-4111-8111-111111111111'
const deal = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const req = (n: number) => `000000${String(n).padStart(2, '0')}-0000-4000-8000-000000000000`

async function setup() {
  const db = new PGlite()
  await db.exec(`create role anon;create role authenticated;create schema auth;
  create function auth.uid() returns uuid language sql as $$select '${uid}'::uuid$$;
  create function public.is_staff() returns boolean language sql as $$select current_setting('test.staff',true)='yes'$$;
  set test.staff='yes';
  create type public.quote_status as enum ('drafting','presented','approved','rejected','revising');
  create table deals(id uuid primary key, process_stage smallint not null default 1, archived_at timestamptz, last_activity_at timestamptz);
  insert into deals(id) values('${deal}');
  create table deal_products(id uuid primary key default gen_random_uuid(), deal_id uuid not null references deals(id), product_no integer not null, description text not null,
    product_memo text, category_l1 text, category_l2 text, category_l3 text, updated_at timestamptz default now(), unique(deal_id, product_no));
  create table deal_product_variants(id uuid primary key default gen_random_uuid(), product_id uuid not null references deal_products(id) on delete cascade, variant_label text not null,
    variant_order integer not null default 0, width_mm numeric, height_mm numeric, depth_mm numeric, material text, print_color_count text, created_at timestamptz default now(), updated_at timestamptz default now());
  create table deal_quotes(id uuid primary key default gen_random_uuid(), deal_id uuid not null, variant_id uuid references deal_product_variants(id) on delete cascade, quantity integer,
    factory_unit_price_usd numeric, selling_price_jpy numeric, status public.quote_status);
  create table sample_rounds(id uuid primary key default gen_random_uuid(), product_id uuid references deal_products(id));
  create table wizard_requests(request_id uuid primary key, user_id uuid not null, operation text not null, payload jsonb not null, result jsonb, created_at timestamptz default now());`)
  await db.exec(await readFile(new URL('../supabase/migrations/20261122100000_process_redesign_stage2.sql', import.meta.url), 'utf8'))
  return db
}
const base = { deal_id: deal, category_l1: '袋', category_l2: 'スタンド袋', category_l3: 'ジップ付きスタンド', size_mode: 'box', width_mm: '120', height_mm: '200', depth_mm: '40',
  material: 'クラフト紙', print_color_count: '4色（フルカラー）', accessories: ['ジップ', 'バルブ'], quantities: [1000, 3000, 5000], shipping_mode: 'sea', shipping_arranger: 'partner',
  sample_required: true, food_inspection_required: false, memo: 'マット仕上げ希望' }
const save = async (db: PGlite, n: number, payload: object) => (await db.query<{ r: { productId: string; variantId: string; name: string } }>('select save_project_product_v1($1,$2) as r', [req(n), payload])).rows[0].r

test('商品登録: 商品・仕様・数量が1回で保存され、名前が自動で付き、工程が2に進む', async () => {
  const db = await setup()
  try {
    const r = await save(db, 1, base)
    assert.equal(r.name, 'ジップ付きスタンド / W120×H200×D40mm / クラフト紙 / 4色（フルカラー） / ジップ・バルブ')
    assert.equal(r.name, productName(base), '画面の下書き表示とDBの名前が同じ並びであること')
    const p = (await db.query<Record<string, unknown>>('select product_no,sort_order,description,shipping_mode,shipping_arranger,sample_required,food_inspection_required,product_memo from deal_products')).rows
    assert.deepEqual(p, [{ product_no: 1, sort_order: 1, description: r.name, shipping_mode: 'sea', shipping_arranger: 'partner', sample_required: true, food_inspection_required: false, product_memo: 'マット仕上げ希望' }])
    const v = (await db.query<Record<string, unknown>>('select size_mode,width_mm::int w,height_mm::int h,depth_mm::int d,diameter_mm,material,accessories from deal_product_variants')).rows[0]
    assert.deepEqual(v, { size_mode: 'box', w: 120, h: 200, d: 40, diameter_mm: null, material: 'クラフト紙', accessories: ['ジップ', 'バルブ'] })
    assert.deepEqual((await db.query<{ quantity: number }>('select quantity from deal_quotes order by quantity')).rows.map(x => x.quantity), [1000, 3000, 5000])
    assert.equal((await db.query<{ process_stage: number }>('select process_stage from deals')).rows[0].process_stage, 2)
    // 同じ要求の再送は二重に作らない
    assert.equal((await save(db, 1, base)).productId, r.productId)
    assert.equal((await db.query<{ n: number }>('select count(*)::int n from deal_products')).rows[0].n, 1)
  } finally { await db.close() }
})

test('大きさは空欄・直径×高さ・容量指定でも登録でき、名前に反映される', async () => {
  const db = await setup()
  try {
    const undecided = await save(db, 1, { deal_id: deal, category_l1: '袋', size_mode: 'undecided', quantities: [500] })
    assert.equal(undecided.name, '袋 / サイズ未定')
    const none = await save(db, 2, { deal_id: deal, category_note: '特注トレー', quantities: [500] })
    assert.equal(none.name, '特注トレー / サイズ未定')
    const round = await save(db, 3, { deal_id: deal, category_l1: '缶', size_mode: 'round', diameter_mm: '65', height_mm: '80', width_mm: '999', material_note: 'スチール', quantities: [2000] })
    assert.equal(round.name, '缶 / φ65×H80mm / スチール')
    const cap = await save(db, 4, { deal_id: deal, category_l2: 'コーヒーバッグ', size_mode: 'capacity', capacity_text: '1kg', quantities: [1000] })
    assert.equal(cap.name, 'コーヒーバッグ / 1kg入り')
    for (const p of [{ category_l1: '袋', size_mode: 'undecided' }, { category_note: '特注トレー' }, { category_l1: '缶', size_mode: 'round', diameter_mm: '65', height_mm: '80', material_note: 'スチール' }, { category_l2: 'コーヒーバッグ', size_mode: 'capacity', capacity_text: '1kg' }]) {
      assert.equal(productName(p), (await db.query<{ n: string }>('select project_product_name($1) n', [p])).rows[0].n)
    }
    const v = (await db.query<{ width_mm: number | null; d: number }>('select width_mm, diameter_mm::int d from deal_product_variants where id=$1', [round.variantId])).rows[0]
    assert.deepEqual(v, { width_mm: null, d: 65 }, '直径×高さのときは幅を保存しない')
    assert.deepEqual((await db.query<{ product_no: number; sort_order: number }>('select product_no, sort_order from deal_products order by product_no')).rows.map(x => [x.product_no, x.sort_order]), [[1, 1], [2, 2], [3, 3], [4, 4]])
  } finally { await db.close() }
})

test('編集: 数量の追加・削除ができ、工場の価格がある数量は外せない（黙って消さない）', async () => {
  const db = await setup()
  try {
    const r = await save(db, 1, base)
    await save(db, 2, { ...base, product_id: r.productId, quantities: [1000, 10000], material: 'PET' })
    assert.deepEqual((await db.query<{ quantity: number }>('select quantity from deal_quotes order by quantity')).rows.map(x => x.quantity), [1000, 10000])
    assert.equal((await db.query<{ description: string }>('select description from deal_products')).rows[0].description, 'ジップ付きスタンド / W120×H200×D40mm / PET / 4色（フルカラー） / ジップ・バルブ')
    assert.equal((await db.query<{ n: number }>('select count(*)::int n from deal_product_variants')).rows[0].n, 1)
    await db.query('update deal_quotes set factory_unit_price_usd = 0.12 where quantity = 10000')
    await assert.rejects(save(db, 3, { ...base, product_id: r.productId, quantities: [1000] }), /数量 10000 には工場の価格や見積の記録があるため外せません/)
    assert.equal((await db.query<{ n: number }>('select count(*)::int n from deal_quotes')).rows[0].n, 2, '断られたときは何も変わらない')
  } finally { await db.close() }
})

test('入力の検査: 数量なし・不正な数量・不正な大きさ・他案件の商品・アーカイブ済み・権限なしは断る', async () => {
  const db = await setup()
  try {
    await assert.rejects(save(db, 1, { ...base, quantities: [] }), /数量を1つ以上/)
    await assert.rejects(save(db, 2, { ...base, quantities: [0] }), /1 以上の整数/)
    await assert.rejects(save(db, 3, { ...base, quantities: [1.5] }), /1 以上の整数/)
    await assert.rejects(save(db, 4, { ...base, width_mm: '-5' }), /0 より大きい数字/)
    await assert.rejects(save(db, 5, { ...base, shipping_mode: 'rocket' }), /配送方法/)
    await assert.rejects(save(db, 6, { ...base, product_id: '99999999-9999-4999-8999-999999999999' }), /この案件に見つかりません/)
    assert.equal((await db.query<{ n: number }>('select count(*)::int n from deal_products')).rows[0].n, 0)
    assert.equal((await db.query<{ n: number }>('select count(*)::int n from wizard_requests')).rows[0].n, 0, '断られた要求は記録に残さない')
    await db.query('update deals set archived_at = now()')
    await assert.rejects(save(db, 7, base), /アーカイブ済み/)
    await db.query('update deals set archived_at = null')
    await db.exec("set test.staff='no'")
    await assert.rejects(save(db, 8, base), /営業・管理者/)
  } finally { await db.close() }
})

test('並べ替えと削除: 渡した順に並び、記録のある商品は削除できない', async () => {
  const db = await setup()
  try {
    const a = await save(db, 1, { ...base, category_l3: 'A' }), b = await save(db, 2, { ...base, category_l3: 'B' }), c = await save(db, 3, { ...base, category_l3: 'C' })
    await db.query('select reorder_project_products($1,$2)', [deal, [c.productId, a.productId, b.productId]])
    assert.deepEqual((await db.query<{ c: string }>('select category_l3 c from deal_products order by sort_order')).rows.map(x => x.c), ['C', 'A', 'B'])
    await assert.rejects(db.query('select reorder_project_products($1,$2)', [deal, [c.productId, a.productId]]), /一覧が変わっています/)
    await assert.rejects(db.query('select reorder_project_products($1,$2)', [deal, [c.productId, a.productId, a.productId]]), /一覧が変わっています/)
    await db.query('update deal_quotes set factory_unit_price_usd = 0.2 where variant_id = $1 and quantity = 1000', [a.variantId])
    await assert.rejects(db.query('select delete_project_product($1)', [a.productId]), /工場の価格や見積の記録があるため削除できません/)
    await db.query('insert into sample_rounds(product_id) values($1)', [b.productId])
    await assert.rejects(db.query('select delete_project_product($1)', [b.productId]), /サンプルの記録/)
    await db.query('select delete_project_product($1)', [c.productId])
    assert.deepEqual((await db.query<{ c: string }>('select category_l3 c from deal_products order by sort_order')).rows.map(x => x.c), ['A', 'B'])
    assert.equal((await db.query<{ n: number }>('select count(*)::int n from deal_quotes where variant_id = $1', [c.variantId])).rows[0].n, 0)
  } finally { await db.close() }
})
