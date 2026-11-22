import test from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'

// 再設計 工程8（発送）の DB 関数を検証する。

const uid = '11111111-1111-4111-8111-111111111111'
const deal = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', food = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', early = 'ffffffff-ffff-4fff-8fff-ffffffffffff', client = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

async function setup() {
  const db = new PGlite()
  await db.exec(`create role anon;create role authenticated;create schema auth;
  create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
  create function public.is_staff() returns boolean language sql as $$select current_setting('test.staff',true)='yes'$$;
  set test.staff='yes'; set test.uid='${uid}';
  create table deals(id uuid primary key, deal_code text, deal_name text, client_id uuid, client_name_text text, contact_id uuid, master_status text default 'M01', simple_status text default 'quote_confirmed', process_stage smallint not null default 8, waiting_on text default 'us', archived_at timestamptz, last_activity_at timestamptz);
  insert into deals(id,deal_code,deal_name,client_id,client_name_text) values('${deal}','PF-1','秋の新商品','${client}','デモ商事'),('${food}','PF-2','食品の袋','${client}','デモ商事'),('${early}','PF-3','まだ製造中','${client}','デモ商事');
  create table client_contacts(id uuid primary key default gen_random_uuid(), client_id uuid, name text, email text, is_primary boolean default false, created_at timestamptz default now());
  insert into client_contacts(client_id,name,email,is_primary) values('${client}','田中','tanaka@example.test',true);
  create table deal_productions(deal_id uuid primary key, finished_at timestamptz);
  insert into deal_productions values('${deal}',now()),('${food}',now()),('${early}',null);
  create table deal_products(id uuid primary key default gen_random_uuid(), deal_id uuid, food_inspection_required boolean default false);
  insert into deal_products(deal_id,food_inspection_required) values('${deal}',false),('${food}',true);
  create table deal_design_files(id uuid primary key default gen_random_uuid(), deal_id uuid, category text);
  create table deal_status_history(id int generated always as identity, deal_id uuid, from_status text, to_status text, from_simple_status text, to_simple_status text, changed_by uuid, kind text, note text);`)
  await db.exec(await readFile(new URL('../supabase/migrations/20261122800000_process_redesign_stage8.sql', import.meta.url), 'utf8'))
  return db
}
const act = async (db: PGlite, action: string, payload: object = {}, id = deal) => (await db.query<{ r: Record<string, unknown> }>('select save_deal_shipment($1,$2,$3) as r', [id, action, JSON.stringify(payload)])).rows[0].r
const file = (db: PGlite, category: string, id = deal) => db.query('insert into deal_design_files(deal_id,category) values($1,$2)', [id, category])
const dest = { name: 'デモ商事 物流センター', postal_code: '150-0001', address: '東京都渋谷区1-2-3', phone: '03-0000-0000', carton_count: 12 }
const ship = { carrier: 'ヤマト運輸', tracking_number: '1234-5678-9012', tracking_url: 'https://example.test/track/123', shipped_on: '2026-11-20' }

test('発送の流れ: 完了報告 → 届け先 → 依頼 → 梱包・ラベル写真 → 追跡番号つきで発送完了。順番と必須の写真を守らせる', async () => {
  const db = await setup()
  try {
    await assert.rejects(act(db, 'completion', {}, early), /製造完了を記録/)
    await assert.rejects(act(db, 'completion'), /完成品の写真・動画を登録/)
    await assert.rejects(act(db, 'request'), /完了報告を確認/)
    await file(db, 'ship_done')
    await act(db, 'completion', { note: '検品OK' }); await act(db, 'completion', { note: '二度目' }) // 二度押しても1回分
    await assert.rejects(act(db, 'request'), /届け先と箱数を保存/)
    await assert.rejects(act(db, 'destination', { ...dest, address: ' ' }), /名前と住所/)
    await assert.rejects(act(db, 'destination', { ...dest, carton_count: 0 }), /箱数/)
    await act(db, 'destination', dest)
    await assert.rejects(act(db, 'packed'), /発送を依頼/)
    await act(db, 'request')
    assert.equal((await db.query<{ w: string }>('select waiting_on w from deals where id=$1', [deal])).rows[0].w, 'factory')
    await act(db, 'destination', { ...dest, carton_count: 14 }) // 発送完了までは届け先・箱数を直せる
    await assert.rejects(act(db, 'packed'), /梱包の写真/)
    await file(db, 'ship_pack')
    await assert.rejects(act(db, 'packed'), /ラベルを貼った写真/)
    await file(db, 'ship_label')
    await assert.rejects(act(db, 'shipped', ship), /梱包とラベル貼付の写真を確認/)
    await act(db, 'packed')
    await assert.rejects(act(db, 'shipped', { ...ship, tracking_number: ' ' }), /追跡番号/)
    await assert.rejects(act(db, 'shipped', { ...ship, tracking_url: 'javascript:alert(1)' }), /http/)
    await assert.rejects(act(db, 'shipped', { ...ship, shipped_on: '2999-01-01' }), /未来の日付/)
    await assert.rejects(act(db, 'notified', { status: 'accepted' }), /発送完了がまだ/)
    const done = await act(db, 'shipped', ship)
    assert.deepEqual([done.contactEmail, done.contactName, done.dealName], ['tanaka@example.test', '田中', '秋の新商品'])
    assert.deepEqual((await db.query<Record<string, unknown>>('select process_stage, waiting_on from deals where id=$1', [deal])).rows[0], { process_stage: 9, waiting_on: 'client' })
    assert.deepEqual((await db.query<Record<string, unknown>>('select completion_note n, carton_count c, tracking_number t, shipped_on::text d from deal_shipments where deal_id=$1', [deal])).rows[0], { n: '検品OK', c: 14, t: '1234-5678-9012', d: '2026-11-20' })
    await act(db, 'notified', { status: 'accepted' })
    await assert.rejects(act(db, 'destination', dest), /発送完了を記録したあと/)
    await assert.rejects(act(db, 'shipped', ship), /発送完了を記録したあと/)
    const notes = (await db.query<{ note: string }>('select note from deal_status_history where deal_id=$1 order by id', [deal])).rows.map(r => r.note)
    assert.equal(notes.length, 4); assert.match(notes[1], /工場へ発送を依頼した（12箱・届け先 デモ商事 物流センター）/); assert.match(notes[3], /発送完了（追跡番号 1234-5678-9012・発送日 2026-11-20）/)
  } finally { await db.close() }
})

test('食品検査がある案件は検査日数が必須。権限なしは断る', async () => {
  const db = await setup()
  try {
    await assert.rejects(act(db, 'destination', dest, food), /食品検査の日数/)
    await act(db, 'destination', { ...dest, inspection_days: 10 }, food)
    assert.equal((await db.query<{ n: number }>('select inspection_days n from deal_shipments where deal_id=$1', [food])).rows[0].n, 10)
    await act(db, 'destination', { ...dest, inspection_days: 10 }) // 検査のない案件では日数を保存しない
    assert.equal((await db.query<{ n: number | null }>('select inspection_days n from deal_shipments where deal_id=$1', [deal])).rows[0].n, null)
    await db.exec("set test.staff='no'")
    await assert.rejects(act(db, 'destination', dest), /営業・管理者/)
  } finally { await db.close() }
})
