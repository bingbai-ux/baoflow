import test from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'

// 再設計 工程6（入稿の受け渡し記録と工場への前払い）の DB 関数を検証する。

const uid = '11111111-1111-4111-8111-111111111111'
const deal = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', other = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

async function setup() {
  const db = new PGlite()
  await db.exec(`create role anon;create role authenticated;create schema auth;
  create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
  create function public.is_staff() returns boolean language sql as $$select current_setting('test.staff',true)='yes'$$;
  set test.staff='yes'; set test.uid='${uid}';
  create table profiles(id uuid primary key); insert into profiles values('${uid}');
  create table deals(id uuid primary key, master_status text default 'M01', simple_status text default 'quote_confirmed', process_stage smallint not null default 6, waiting_on text default 'us', archived_at timestamptz, last_activity_at timestamptz);
  insert into deals(id) values('${deal}'),('${other}');
  create table order_agreements(id uuid primary key default gen_random_uuid(), deal_id uuid, status text);
  insert into order_agreements(deal_id,status) values('${deal}','agreed'),('${other}','sent');
  create table deal_design_files(id uuid primary key default gen_random_uuid(), deal_id uuid, category text);
  create table deal_status_history(id int generated always as identity, deal_id uuid, from_status text, to_status text, from_simple_status text, to_simple_status text, changed_by uuid, kind text, note text);`)
  await db.exec(await readFile(new URL('../supabase/migrations/20261122600000_process_redesign_stage6.sql', import.meta.url), 'utf8'))
  return db
}
const act = (db: PGlite, action: string, payload: object = {}, id = deal) => db.query('select save_deal_intake($1,$2,$3)', [id, action, JSON.stringify(payload)])
const row = async (db: PGlite) => (await db.query<Record<string, unknown>>('select * from deal_intakes where deal_id=$1', [deal])).rows[0]
const file = (db: PGlite, category: string) => db.query('insert into deal_design_files(deal_id,category) values($1,$2)', [deal, category])

test('顧客がデータを用意する進め方: 順番どおりにしか記録できず、ファイルが無いと受領を記録できない。取り消しは後ろから', async () => {
  const db = await setup()
  try {
    await assert.rejects(act(db, 'pattern', { pattern: 'customer' }, other), /契約成立/)
    await assert.rejects(act(db, 'step', { step: 'artwork_received' }), /進め方を選んで/)
    await act(db, 'pattern', { pattern: 'customer' })
    await assert.rejects(act(db, 'step', { step: 'template_received' }), /この進め方には無い手順/)
    await assert.rejects(act(db, 'step', { step: 'artwork_sent' }), /前の手順を先に/)
    await assert.rejects(act(db, 'step', { step: 'artwork_received' }), /入稿データのファイルを登録/)
    await file(db, 'intake_artwork')
    await act(db, 'step', { step: 'artwork_received' }); await act(db, 'step', { step: 'artwork_received' }) // 二度押しても1回分
    await act(db, 'step', { step: 'artwork_sent' })
    assert.equal((await db.query<{ w: string }>('select waiting_on w from deals where id=$1', [deal])).rows[0].w, 'factory')
    await assert.rejects(act(db, 'pattern', { pattern: 'template' }), /進め方を変えられません/)
    await assert.rejects(act(db, 'step', { step: 'artwork_received', done: false }), /後ろの手順の記録を先に取り消して/)
    await act(db, 'step', { step: 'artwork_sent', done: false })
    assert.equal((await row(db)).artwork_sent_at, null)
    await act(db, 'step', { step: 'artwork_sent' }); await act(db, 'step', { step: 'factory_ok' })
    const notes = (await db.query<{ note: string }>('select note from deal_status_history order by id')).rows.map(r => r.note)
    assert.deepEqual(notes, ['入稿: 顧客から入稿データを受け取った', '入稿: 入稿データを工場へ渡した', '入稿: 「入稿データを工場へ渡した」の記録を取り消した', '入稿: 入稿データを工場へ渡した', '入稿: 工場がデータを確認した'])
  } finally { await db.close() }
})

test('工場の雛形を使う進め方: 雛形の受領 → 顧客へ → 入稿データ受領 → 工場へ → 工場確認 の5手順', async () => {
  const db = await setup()
  try {
    await act(db, 'pattern', { pattern: 'template' })
    await assert.rejects(act(db, 'step', { step: 'template_received' }), /雛形のファイルを登録/)
    await file(db, 'intake_template')
    await act(db, 'step', { step: 'template_received' }); await act(db, 'step', { step: 'template_sent' })
    assert.equal((await db.query<{ w: string }>('select waiting_on w from deals where id=$1', [deal])).rows[0].w, 'client')
    await assert.rejects(act(db, 'step', { step: 'artwork_received' }), /入稿データのファイルを登録/)
    await file(db, 'intake_artwork')
    for (const step of ['artwork_received', 'artwork_sent', 'factory_ok']) await act(db, 'step', { step })
    const r = await row(db)
    assert.ok(['template_received_at', 'template_sent_at', 'artwork_received_at', 'artwork_sent_at', 'factory_ok_at'].every(k => r[k] != null))
  } finally { await db.close() }
})

test('前払い: 割合と振込を記録するまで製作開始へ進めない。進んだあとは変更できない。権限なしは断る', async () => {
  const db = await setup()
  try {
    await act(db, 'pattern', { pattern: 'customer' }); await file(db, 'intake_artwork')
    for (const step of ['artwork_received', 'artwork_sent', 'factory_ok']) await act(db, 'step', { step })
    await assert.rejects(act(db, 'start'), /前払いがまだ記録されていません/)
    await assert.rejects(act(db, 'prepay_paid', { paid_on: '2026-11-20', amount_usd: 500 }), /割合を選んで/)
    await assert.rejects(act(db, 'prepay_rate', { rate: 40 }), /割合を選んで/)
    await act(db, 'prepay_rate', { rate: 50 })
    await assert.rejects(act(db, 'prepay_paid', { paid_on: '2026-11-20', amount_usd: 0 }), /金額/)
    await assert.rejects(act(db, 'prepay_paid', { paid_on: '2999-01-01', amount_usd: 500 }), /未来の日付/)
    await act(db, 'prepay_paid', { paid_on: '2026-11-20', amount_usd: 512.5, note: 'Wise' })
    assert.deepEqual((await db.query<Record<string, unknown>>("select prepay_rate r, prepay_amount_usd::float8 a, prepay_paid_on::text d, prepay_note n, prepay_recorded_by b from deal_intakes")).rows[0], { r: 50, a: 512.5, d: '2026-11-20', n: 'Wise', b: uid })
    await assert.rejects(act(db, 'prepay_rate', { rate: 30 }), /振込の記録を取り消してから/)
    await act(db, 'prepay_unpaid')
    await assert.rejects(act(db, 'start'), /前払いがまだ記録されていません/)
    await act(db, 'prepay_rate', { rate: 30 }); await act(db, 'prepay_paid', { paid_on: '2026-11-21', amount_usd: 300 })
    await act(db, 'step', { step: 'factory_ok', done: false })
    await assert.rejects(act(db, 'start'), /工場のデータ確認がまだ/)
    await act(db, 'step', { step: 'factory_ok' })
    await act(db, 'start')
    assert.deepEqual((await db.query<Record<string, unknown>>('select process_stage, waiting_on from deals where id=$1', [deal])).rows[0], { process_stage: 7, waiting_on: 'factory' })
    await assert.rejects(act(db, 'prepay_unpaid'), /製作開始へ進んだあとは変更できません/)
    await assert.rejects(act(db, 'step', { step: 'factory_ok', done: false }), /製作開始へ進んだあと/)
    assert.match((await db.query<{ note: string }>('select note from deal_status_history order by id desc limit 1')).rows[0].note, /製作開始へ進んだ/)
    await db.exec("set test.staff='no'")
    await assert.rejects(act(db, 'pattern', { pattern: 'customer' }), /営業・管理者/)
  } finally { await db.close() }
})
