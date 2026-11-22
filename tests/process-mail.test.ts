import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { createHmac } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { cleanInboundBody, parseReplyAddress, replyAddress, replyToField, verifyWebhook } from '../src/lib/process/reply-address'
import { mergeCandidates } from '../src/lib/process/catalog-import'

// 届いたメールの自動取り込み: 返信用アドレスの組み立てと読み取り、本文の引用落とし、知らせの署名確認、DB 関数、受信口（/api/inbound-mail）の通し。
// 外部には接続しない（メール配信サービスと DB は、このテストの中に立てた代役が返事をする）。

const deal = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', uid = '11111111-1111-4111-8111-111111111111'
const secret = 'whsec_' + Buffer.from('local-test-signing-key-not-secret').toString('base64')
const sign = (id: string, ts: string, body: string) => 'v1,' + createHmac('sha256', Buffer.from(secret.slice(6), 'base64')).update(`${id}.${ts}.${body}`).digest('base64')

test('返信用アドレス: 案件と相手から組み立て、宛先から読み戻せる。ドメイン未設定・他ドメイン・形の違うものは受けない', () => {
  delete process.env.MAIL_REPLY_DOMAIN
  assert.equal(replyAddress(deal, 'client'), null); assert.deepEqual(replyToField(deal, 'client'), {})
  process.env.MAIL_REPLY_DOMAIN = 'Reply.Example.test'
  const c = replyAddress(deal, 'client')!, f = replyAddress(deal, 'factory')!
  assert.equal(c, 'c-dddddddddddd4ddd8ddddddddddddddd@reply.example.test'); assert.equal(f[0], 'f')
  assert.deepEqual(parseReplyAddress(`BAO <${c.toUpperCase()}>`), { dealId: deal, party: 'client' })
  assert.deepEqual(parseReplyAddress(f), { dealId: deal, party: 'factory' })
  for (const bad of ['c-dddddddddddd4ddd8ddddddddddddddd@other.example.test', 'x-dddddddddddd4ddd8ddddddddddddddd@reply.example.test', 'c-123@reply.example.test', 'sales@reply.example.test', '']) assert.equal(parseReplyAddress(bad), null, bad)
  assert.equal(replyAddress('not-a-uuid', 'client'), null)
})

test('本文: 下に付いた前のメールの引用を落とす。HTML しか無いときはタグを外す', () => {
  assert.equal(cleanInboundBody('承知しました。\r\n金曜に送ります。\n\n2026年11月20日(金) 10:00 BAO <a@b.test>:\n> 前のメール\n> つづき', null), '承知しました。\n金曜に送ります。')
  assert.equal(cleanInboundBody('了解です\n\n-----Original Message-----\nFrom: x', null), '了解です')
  assert.equal(cleanInboundBody('好的，明天发货。\n\n在 2026年11月20日，BAO 写道：\n> 请确认', null), '好的，明天发货。')
  assert.equal(cleanInboundBody('', '<div>OK &amp; thanks<br>明日送ります</div><blockquote>前のメール</blockquote>'), 'OK & thanks\n明日送ります')
  assert.equal(cleanInboundBody(null, null), '')
})

test('知らせの署名: 正しい署名だけ通す。本文の改ざん・古い時刻・別の鍵は通さない', () => {
  const now = 1_800_000_000_000, ts = String(now / 1000), body = '{"type":"email.received"}'
  const h = { id: 'msg_1', timestamp: ts, signature: 'v1,AAAA ' + sign('msg_1', ts, body) }
  assert.equal(verifyWebhook(secret, h, body, now), true)
  assert.equal(verifyWebhook(secret, h, body + ' ', now), false)
  assert.equal(verifyWebhook(secret, h, body, now + 301_000), false)
  assert.equal(verifyWebhook('whsec_' + Buffer.from('another').toString('base64'), h, body, now), false)
  assert.equal(verifyWebhook(secret, { ...h, signature: null }, body, now), false)
  assert.equal(verifyWebhook('', h, body, now), false)
})

test('カタログ: 分けて読んだ候補を1つにまとめる（同じものは1つ）', () => {
  const r = mergeCandidates({ categories: [{ l1: '袋', l2: '平袋', l3: null }], materials: ['PET'], print_colors: [], accessories: ['窓'] }, { categories: [{ l1: '袋', l2: '平袋', l3: null }, { l1: '箱', l2: null, l3: null }], materials: ['ｐｅｔ', 'アルミ'], print_colors: ['1色'], accessories: [] })
  assert.equal(r.categories.length, 2); assert.equal(r.materials.length, 2); assert.deepEqual(r.print_colors, ['1色']); assert.deepEqual(r.accessories, ['窓'])
})

async function setupDb() {
  const db = new PGlite()
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
  create function public.is_staff() returns boolean language sql as $$select current_setting('test.staff',true)='yes'$$;
  create table profiles(id uuid primary key); insert into profiles values('${uid}');
  create table deals(id uuid primary key, deal_code text, deal_name text, client_name_text text, sales_user_id uuid, waiting_on text default 'client', last_activity_at timestamptz);
  insert into deals values('${deal}','PF-1','秋の新商品','デモ商事','${uid}','client',null);
  create table deal_communications(id uuid primary key default gen_random_uuid(), deal_id uuid not null references deals(id) on delete cascade, author_user_id uuid, author_role text, channel text not null, subject text, body text not null,
    is_read boolean not null default false, needs_followup boolean not null default false, followup_date date, occurred_at timestamptz not null default now(), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
  create table deal_design_files(id uuid primary key default gen_random_uuid(), deal_id uuid not null, file_url text not null, storage_path text, file_name text, file_type text, file_size_bytes bigint, version_number integer not null default 1, category text, comment text);
  insert into deal_design_files(deal_id,file_url,version_number) values('${deal}','https://x.test/a',4);
  create table notifications(id uuid primary key default gen_random_uuid(), user_id uuid, deal_id uuid, type text, status text, content text);`)
  await db.exec(await readFile(new URL('../supabase/migrations/20261123000000_inbound_mail.sql', import.meta.url), 'utf8'))
  return db
}

test('DB: 届いたメールはトーク欄に1件だけ入り、案件は「自社の番」になり、担当へお知らせが出る。添付は案件のファイルに入る', async () => {
  const db = await setupDb()
  const call = (id: string, d = deal) => db.query<{ r: { success: boolean; already?: boolean; reason?: string } }>(`select record_inbound_mail($1,$2,'client','田中 <tanaka@example.test>','c-x@reply.example.test','Re: お見積書','承知しました',$3::jsonb) r`, [id, d, JSON.stringify([{ name: '修正.pdf', type: 'application/pdf' }])])
  assert.deepEqual((await call('mail-0001')).rows[0].r.already, false)
  assert.deepEqual((await call('mail-0001')).rows[0].r.already, true, '同じメールが2回届いても1件')
  assert.equal((await call('mail-0002', '99999999-9999-4999-8999-999999999999')).rows[0].r.reason, 'deal_not_found')
  const talk = (await db.query<{ author_role: string; channel: string; subject: string; body: string; is_read: boolean }>('select * from deal_communications')).rows
  assert.equal(talk.length, 1); assert.deepEqual([talk[0].author_role, talk[0].channel, talk[0].subject, talk[0].is_read], ['client', 'email', 'Re: お見積書', false])
  assert.match(talk[0].body, /^承知しました\n\n添付: 修正\.pdf\n\n差出人: 田中 <tanaka@example\.test>$/)
  assert.equal((await db.query<{ waiting_on: string }>('select waiting_on from deals')).rows[0].waiting_on, 'us')
  assert.match((await db.query<{ content: string }>('select content from notifications')).rows[0].content, /デモ商事 から「秋の新商品」にメールの返信が届きました/)

  const files = JSON.stringify([{ name: '修正.pdf', type: 'application/pdf', size: 1200, storage_path: `${deal}/a_x.pdf`, url: 'https://s.test/a_x.pdf', saved: true }, { name: '大きい.zip', type: 'application/zip', size: null, storage_path: null, url: null, saved: false }])
  assert.equal((await db.query<{ r: { saved: number } }>(`select add_inbound_mail_files('mail-0001',$1::jsonb) r`, [files])).rows[0].r.saved, 1)
  assert.equal((await db.query<{ r: { already: boolean } }>(`select add_inbound_mail_files('mail-0001',$1::jsonb) r`, [files])).rows[0].r.already, true, '2回呼んでも二重に登録しない')
  const saved = (await db.query<{ file_name: string; category: string; version_number: number; comment: string }>(`select * from deal_design_files where category = 'mail_in'`)).rows
  assert.equal(saved.length, 1); assert.deepEqual([saved[0].file_name, saved[0].version_number, saved[0].comment], ['修正.pdf', 5, '顧客からのメールに添付'])
  assert.match((await db.query<{ body: string }>('select body from deal_communications')).rows[0].body, /添付を保存できませんでした: 大きい\.zip/)
  await assert.rejects(db.query(`select add_inbound_mail_files('nope','[]'::jsonb)`), /届いたメールが見つかりません/)
})

test('DB: 取り込みの関数は管理用の鍵だけが呼べる。ログイン中の人・未ログインは呼べず、表も書けない', async () => {
  const db = await setupDb()
  const can = async (role: string, fn: string) => (await db.query<{ ok: boolean }>(`select has_function_privilege($1, $2, 'execute') ok`, [role, fn])).rows[0].ok
  for (const fn of ['record_inbound_mail(text,uuid,text,text,text,text,text,jsonb)', 'add_inbound_mail_files(text,jsonb)']) {
    assert.equal(await can('service_role', fn), true); assert.equal(await can('authenticated', fn), false); assert.equal(await can('anon', fn), false)
  }
  const priv = async (role: string, p: string) => (await db.query<{ ok: boolean }>(`select has_table_privilege($1, 'inbound_mails', $2) ok`, [role, p])).rows[0].ok
  assert.equal(await priv('authenticated', 'select'), true); assert.equal(await priv('authenticated', 'insert'), false); assert.equal(await priv('anon', 'select'), false)
})

test('受信口: 署名が正しい知らせだけ受け、本文を取りに行ってトーク欄に入れ、添付を保存する。設定が無ければ 503', async () => {
  const calls: Array<{ path: string; body: unknown }> = []
  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = []; for await (const c of req) chunks.push(c as Buffer)
    const raw = Buffer.concat(chunks), path = req.url || ''
    let body: unknown = null; try { body = JSON.parse(raw.toString()) } catch { body = `bytes:${raw.length}` }
    calls.push({ path, body }); res.setHeader('content-type', 'application/json')
    if (path === '/emails/receiving/mail-0001') return res.end(JSON.stringify({ text: '了解しました。\n\n> 引用', html: null }))
    if (path === '/emails/receiving/mail-0001/attachments') return res.end(JSON.stringify({ data: [{ filename: '写真 1.jpg', content_type: 'image/jpeg', size: 3, download_url: `http://127.0.0.1:${port}/dl/1` }, { filename: 'logo.png', content_disposition: 'inline', download_url: `http://127.0.0.1:${port}/dl/2` }] }))
    if (path === '/dl/1') return res.end(Buffer.from([1, 2, 3]))
    if (path === '/rest/v1/rpc/record_inbound_mail') return res.end(JSON.stringify({ success: true, already: false }))
    if (path === '/rest/v1/rpc/add_inbound_mail_files') return res.end(JSON.stringify({ success: true, saved: 1 }))
    if (path.startsWith('/storage/v1/object/deal-images/')) return res.end(JSON.stringify({ Key: path }))
    res.statusCode = 404; res.end('{}')
  })
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r))
  const port = (server.address() as { port: number }).port
  try {
    const { POST } = await import('../src/app/api/inbound-mail/route')
    const event = JSON.stringify({ type: 'email.received', data: { email_id: 'mail-0001', from: '田中 <tanaka@example.test>', to: [`c-${deal.replace(/-/g, '')}@reply.example.test`], subject: 'Re: お見積書', attachments: [{ filename: '写真 1.jpg', content_type: 'image/jpeg' }] } })
    const send = (body: string, good = true) => { const ts = String(Math.floor(Date.now() / 1000)); return POST(new Request('http://local.test/api/inbound-mail', { method: 'POST', body, headers: { 'svix-id': 'msg_1', 'svix-timestamp': ts, 'svix-signature': good ? sign('msg_1', ts, body) : 'v1,AAAA' } })) }
    for (const k of ['RESEND_WEBHOOK_SECRET', 'RESEND_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) delete process.env[k]
    assert.equal((await send(event)).status, 503, '設定が無いときは受けない')
    Object.assign(process.env, { MAIL_REPLY_DOMAIN: 'reply.example.test', RESEND_WEBHOOK_SECRET: secret, RESEND_API_KEY: 'local-test-placeholder', RESEND_API_BASE: `http://127.0.0.1:${port}`, SUPABASE_SERVICE_ROLE_KEY: 'local-test-placeholder', NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${port}` })
    assert.equal((await send(event, false)).status, 401, '署名が違う知らせは受けない')
    assert.equal(calls.length, 0, '署名が違うときは、どこにも問い合わせない')
    assert.deepEqual(await (await send(JSON.stringify({ type: 'email.sent', data: {} }))).json(), { ignored: 'not_email_received' })
    assert.deepEqual(await (await send(JSON.stringify({ type: 'email.received', data: { email_id: 'mail-0009', to: ['someone@reply.example.test'] } }))).json(), { ignored: 'not_reply_address' })
    const res = await send(event)
    assert.deepEqual(await res.json(), { ok: true, files: 1, failed: 0 })
    const rec = calls.find(c => c.path === '/rest/v1/rpc/record_inbound_mail')!.body as Record<string, unknown>
    assert.deepEqual([rec.p_deal_id, rec.p_party, rec.p_body, rec.p_subject], [deal, 'client', '了解しました。', 'Re: お見積書'])
    const reg = calls.find(c => c.path === '/rest/v1/rpc/add_inbound_mail_files')!.body as { p_files: Array<{ name: string; saved: boolean; storage_path: string }> }
    assert.equal(reg.p_files.length, 1, '本文に埋め込まれた画像（署名のロゴなど）は添付として扱わない')
    assert.equal(reg.p_files[0].saved, true); assert.match(reg.p_files[0].storage_path, new RegExp(`^${deal}/[0-9a-f-]{36}_[_]+1\\.jpg$`))
    assert.ok(calls.some(c => c.path.startsWith(`/storage/v1/object/deal-images/${deal}/`)))
  } finally { server.close() }
})

test('DB: 工場の返信ページ — リンクは見積をもらった工場にだけ作れて使い回す。書き込みはトーク欄・ファイル・お知らせに入り、取り消すと使えない。AIの使い分けは決まった種類だけ保存できる', async () => {
  const db = new PGlite()
  const factory = 'ffffffff-ffff-4fff-8fff-ffffffffffff', other = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
  create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
  create function public.is_staff() returns boolean language sql as $$select current_setting('test.staff',true)='yes'$$;
  set test.staff='yes'; set test.uid='${uid}';
  create table profiles(id uuid primary key); insert into profiles values('${uid}');
  create table deals(id uuid primary key, deal_code text, deal_name text, client_name_text text, sales_user_id uuid, master_status text default 'M01', simple_status text default 'quoting', waiting_on text default 'factory', archived_at timestamptz, last_activity_at timestamptz);
  insert into deals(id,deal_code,deal_name,client_name_text,sales_user_id) values('${deal}','PF-1','秋の新商品','デモ商事','${uid}');
  create table factories(id uuid primary key, factory_name text); insert into factories values('${factory}','東莞パック'),('${other}','義烏プリント');
  create table deal_quotes(id uuid primary key default gen_random_uuid(), deal_id uuid, factory_id uuid); insert into deal_quotes(deal_id,factory_id) values('${deal}','${factory}');
  create table deal_communications(id uuid primary key default gen_random_uuid(), deal_id uuid not null, author_user_id uuid, author_role text, channel text not null, subject text, body text not null, is_read boolean not null default false, occurred_at timestamptz not null default now(), updated_at timestamptz not null default now());
  create table deal_design_files(id uuid primary key default gen_random_uuid(), deal_id uuid not null, file_url text not null, storage_path text, file_name text, file_type text, file_size_bytes bigint, version_number integer not null default 1, category text, comment text);
  create table deal_status_history(id int generated always as identity, deal_id uuid, from_status text, to_status text, from_simple_status text, to_simple_status text, changed_by uuid, kind text, note text);
  create table notifications(id uuid primary key default gen_random_uuid(), user_id uuid, deal_id uuid, type text, status text, content text);`)
  await db.exec(await readFile(new URL('../supabase/migrations/20261123200000_talk_links_ai_settings.sql', import.meta.url), 'utf8'))
  const one = async <T>(sql: string, params: unknown[] = []) => (await db.query<{ r: T }>(sql, params)).rows[0].r
  await assert.rejects(db.query(`select create_talk_link('${deal}','${other}')`), /見積をもらっている工場/)
  const first = await one<{ token: string; reused: boolean }>(`select create_talk_link('${deal}','${factory}') r`)
  const again = await one<{ token: string; reused: boolean }>(`select create_talk_link('${deal}','${factory}') r`)
  assert.match(first.token, /^[0-9a-f]{64}$/); assert.deepEqual([again.token, again.reused], [first.token, true])
  const view = await one<Record<string, unknown>>(`select talk_link_by_token($1) r`, [first.token])
  assert.deepEqual([view.status, view.dealCode, view.factoryName], ['active', 'PF-1', '東莞パック']); assert.equal(JSON.stringify(view).includes('デモ商事'), false, '顧客名は返さない')
  assert.equal((await one<{ found: boolean }>(`select talk_link_by_token('short') r`)).found, false)

  const files = JSON.stringify([{ name: '样品.jpg', type: 'image/jpeg', size: 10, storage_path: `${deal}/x_a.jpg`, url: 'https://s.test/x_a.jpg' }])
  await db.query(`select post_talk_link($1,'样品已完成',$2::jsonb,'203.0.113.9','UA')`, [first.token, files])
  await assert.rejects(db.query(`select post_talk_link($1,'x',$2::jsonb)`, [first.token, JSON.stringify([{ name: 'a', storage_path: 'other-deal/a', url: 'https://s.test/a' }])]), /保存先が正しくありません/)
  await assert.rejects(db.query(`select post_talk_link($1,'  ')`, [first.token]), /本文がありません/)
  const talk = (await db.query<{ author_role: string; channel: string; subject: string; body: string }>('select * from deal_communications')).rows
  assert.deepEqual(talk.map(t => [t.author_role, t.channel, t.subject, t.body]), [['factory', 'link', '東莞パック（返信ページ）', '样品已完成\n\n添付: 样品.jpg']])
  assert.deepEqual((await db.query<{ category: string; file_name: string }>('select category, file_name from deal_design_files')).rows, [{ category: 'talk_link', file_name: '样品.jpg' }])
  assert.equal((await db.query<{ waiting_on: string }>('select waiting_on from deals')).rows[0].waiting_on, 'us')
  assert.match((await db.query<{ content: string }>('select content from notifications')).rows[0].content, /東莞パック から「秋の新商品」に連絡が届きました/)
  assert.equal((await db.query<{ n: number }>('select count(*)::int n from deal_status_history')).rows[0].n, 1)

  await db.query(`select cancel_talk_link((select id from talk_links))`)
  await assert.rejects(db.query(`select post_talk_link($1,'x')`, [first.token]), /使えなくなりました/)
  assert.notEqual((await one<{ token: string }>(`select create_talk_link('${deal}','${factory}') r`)).token, first.token, '取り消したあとは新しいリンクになる')
  await db.exec(`set test.staff='no'`)
  await assert.rejects(db.query(`select create_talk_link('${deal}','${factory}')`), /営業・管理者のみ/)
  await assert.rejects(db.query(`select save_ai_settings('claude-opus-5-5','claude-opus-5-5')`), /営業・管理者のみ/)
  await db.exec(`set test.staff='yes'`)

  assert.deepEqual((await db.query('select draft_model, catalog_model from ai_settings')).rows, [{ draft_model: 'claude-sonnet-5-5', catalog_model: 'claude-opus-5-5' }])
  await db.query(`select save_ai_settings('claude-haiku-5-5','claude-sonnet-5-5')`)
  assert.deepEqual((await db.query('select draft_model, catalog_model from ai_settings')).rows, [{ draft_model: 'claude-haiku-5-5', catalog_model: 'claude-sonnet-5-5' }])
  await assert.rejects(db.query(`select save_ai_settings('gpt','claude-opus-5-5')`), /AIの種類が正しくありません/)
  const can = async (role: string, fn: string) => (await db.query<{ ok: boolean }>(`select has_function_privilege($1, $2, 'execute') ok`, [role, fn])).rows[0].ok
  assert.deepEqual([await can('anon', 'post_talk_link(text,text,jsonb,text,text)'), await can('authenticated', 'post_talk_link(text,text,jsonb,text,text)'), await can('service_role', 'post_talk_link(text,text,jsonb,text,text)')], [false, false, true])
  assert.deepEqual([await can('anon', 'talk_link_by_token(text)'), await can('anon', 'create_talk_link(uuid,uuid)'), await can('anon', 'save_ai_settings(text,text)')], [true, false, false])
})
