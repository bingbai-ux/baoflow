import test from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'

// 再設計 工程7（サンプル製造 → 本製造）の DB 関数を検証する。

const uid = '11111111-1111-4111-8111-111111111111'
const deal = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', plain = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', early = 'ffffffff-ffff-4fff-8fff-ffffffffffff'

async function setup() {
  const db = new PGlite()
  await db.exec(`create role anon;create role authenticated;create schema auth;
  create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
  create function public.is_staff() returns boolean language sql as $$select current_setting('test.staff',true)='yes'$$;
  set test.staff='yes'; set test.uid='${uid}';
  create table profiles(id uuid primary key); insert into profiles values('${uid}');
  create table deals(id uuid primary key, master_status text default 'M01', simple_status text default 'quote_confirmed', process_stage smallint not null default 7, waiting_on text default 'factory', archived_at timestamptz, last_activity_at timestamptz);
  insert into deals(id) values('${deal}'),('${plain}'),('${early}');
  create table deal_intakes(deal_id uuid primary key, production_started_at timestamptz);
  insert into deal_intakes values('${deal}',now()),('${plain}',now()),('${early}',null);
  create table deal_products(id uuid primary key default gen_random_uuid(), deal_id uuid, sample_required boolean default false);
  insert into deal_products(deal_id,sample_required) values('${deal}',true),('${deal}',false),('${plain}',false);
  create table deal_design_files(id uuid primary key default gen_random_uuid(), deal_id uuid, category text);
  create table deal_status_history(id int generated always as identity, deal_id uuid, from_status text, to_status text, from_simple_status text, to_simple_status text, changed_by uuid, kind text, note text);`)
  await db.exec(await readFile(new URL('../supabase/migrations/20261122700000_process_redesign_stage7.sql', import.meta.url), 'utf8'))
  return db
}
const act = (db: PGlite, action: string, payload: object = {}, id = deal) => db.query('select save_deal_production($1,$2,$3)', [id, action, JSON.stringify(payload)])
const rounds = async (db: PGlite) => (await db.query<{ round: number; result: string | null; feedback: string | null }>('select round, result, feedback from sample_rounds where deal_id=$1 order by round', [deal])).rows
const start = { started_on: '2026-12-01', due_on: '2026-12-25', transit_days: 30 }

test('サンプルが必要な案件: 写真の受け取り → 顧客へ → 修正なら第2回 → 承認されるまで本製造を開始できない', async () => {
  const db = await setup()
  try {
    await assert.rejects(act(db, 'sample_start', { expected_on: '2026-12-01' }, early), /入稿と前払いを済ませて/)
    await assert.rejects(act(db, 'production_start', start), /顧客がサンプルを承認してから/)
    await assert.rejects(act(db, 'sample_start', {}), /完成予定日を選んで/)
    await act(db, 'sample_start', { expected_on: '2026-12-01' })
    await assert.rejects(act(db, 'sample_start', { expected_on: '2026-12-05' }), /進行中のサンプルがあります/)
    await assert.rejects(act(db, 'sample_shared'), /工場からの受け取りを記録/)
    await assert.rejects(act(db, 'sample_done'), /写真・動画を登録/)
    await db.query("insert into deal_design_files(deal_id,category) values($1,'sample_r1')", [deal])
    await act(db, 'sample_done'); await act(db, 'sample_done') // 二度押しても1回分
    await assert.rejects(act(db, 'sample_result', { result: 'approved' }), /顧客へ渡したことを記録/)
    await act(db, 'sample_shared')
    assert.equal((await db.query<{ w: string }>('select waiting_on w from deals where id=$1', [deal])).rows[0].w, 'client')
    await assert.rejects(act(db, 'sample_result', { result: 'revise', feedback: ' ' }), /修正の内容を入力/)
    await act(db, 'sample_result', { result: 'revise', feedback: 'ロゴをもう少し濃く' })
    await assert.rejects(act(db, 'production_start', start), /顧客がサンプルを承認してから/)
    await act(db, 'sample_start', { expected_on: '2026-12-10' })
    await assert.rejects(act(db, 'sample_done'), /写真・動画を登録/, '第2回には第2回の写真が必要')
    await db.query("insert into deal_design_files(deal_id,category) values($1,'sample_r2')", [deal])
    await act(db, 'sample_done'); await act(db, 'sample_shared')
    await assert.rejects(act(db, 'production_start', start), /進行中のサンプル|承認してから/)
    await act(db, 'sample_result', { result: 'approved' })
    assert.deepEqual(await rounds(db), [{ round: 1, result: 'revise', feedback: 'ロゴをもう少し濃く' }, { round: 2, result: 'approved', feedback: null }])
    await assert.rejects(act(db, 'sample_start', { expected_on: '2026-12-20' }), /承認済み/)
    await act(db, 'production_start', start)
    await assert.rejects(act(db, 'sample_start', { expected_on: '2026-12-20' }), /本製造を開始したあと/)
    const notes = (await db.query<{ note: string }>('select note from deal_status_history where deal_id=$1 order by id', [deal])).rows.map(r => r.note)
    assert.equal(notes.length, 9)
    assert.match(notes[3], /第1回サンプル: 顧客から修正指示: ロゴをもう少し濃く/); assert.match(notes[8], /本製造を開始（完成予定 2026-12-25・到着目安 2027-01-24）/)
  } finally { await db.close() }
})

test('サンプルが不要な案件: そのまま本製造へ。予定の変更は履歴に残り、製造完了で発送へ進む。完了後は変更できない', async () => {
  const db = await setup()
  try {
    await assert.rejects(act(db, 'production_finish', {}, plain), /まだ開始されていません/)
    await assert.rejects(act(db, 'production_start', { ...start, due_on: '2026-11-30' }, plain), /開始日以降/)
    await assert.rejects(act(db, 'production_start', { ...start, transit_days: 'x' }, plain), /到着までの日数/)
    await act(db, 'production_start', start, plain)
    await assert.rejects(act(db, 'production_start', start, plain), /開始済み/)
    await act(db, 'production_update', { due_on: '2026-12-25', transit_days: 30 }, plain) // 同じ内容なら何も残さない
    await act(db, 'production_update', { due_on: '2027-01-05', transit_days: 7 }, plain)
    assert.deepEqual((await db.query<Record<string, unknown>>('select started_on::text s, due_on::text d, transit_days t from deal_productions where deal_id=$1', [plain])).rows[0], { s: '2026-12-01', d: '2027-01-05', t: 7 })
    await act(db, 'production_finish', {}, plain)
    assert.deepEqual((await db.query<Record<string, unknown>>('select process_stage, waiting_on from deals where id=$1', [plain])).rows[0], { process_stage: 8, waiting_on: 'us' })
    await assert.rejects(act(db, 'production_update', { due_on: '2027-01-06', transit_days: 7 }, plain), /製造完了を記録したあと/)
    const notes = (await db.query<{ note: string }>('select note from deal_status_history where deal_id=$1 order by id', [plain])).rows.map(r => r.note)
    assert.deepEqual(notes, ['本製造を開始（完成予定 2026-12-25・到着目安 2027-01-24）', '本製造の予定を変更（完成予定 2026-12-25 → 2027-01-05・到着目安 2027-01-12）', '製造完了。発送へ進んだ'])
    await db.exec("set test.staff='no'")
    await assert.rejects(act(db, 'sample_start', { expected_on: '2026-12-01' }), /営業・管理者/)
  } finally { await db.close() }
})
