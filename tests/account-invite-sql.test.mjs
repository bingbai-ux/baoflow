import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'

const repo = fileURLToPath(new URL('..', import.meta.url))
const uid = '10000000-0000-4000-8000-000000000001'
const missing = '10000000-0000-4000-8000-000000000002'
const client = '20000000-0000-4000-8000-000000000001'
const factory = '20000000-0000-4000-8000-000000000002'
const partner = '20000000-0000-4000-8000-000000000003'
const recipient = 'owner+client@example.test'
// Deliberately nonsecret fixture constant: never an actual invitation/link/token.
const fixtureKey = 'synthetic-test-fixture-not-a-real-invitation'

const source = await readFile(repo + '/supabase/migrations/036_portal_extensions.sql', 'utf8')
const start = source.indexOf('create or replace function public.claim_account_invite(')
const baseline = source.slice(start, source.indexOf('\n$$;', start) + '\n$$;'.length)
const candidate = await readFile(new URL('../supabase/migrations/20261003070321_account_invite_recipient_binding.sql', import.meta.url), 'utf8')

async function setup() {
  const db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql as
      $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
    create type public.user_role as enum ('admin','sales','client','factory','logistics');
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create table public.profiles(id uuid primary key,role user_role,email text,
      client_id uuid, factory_id uuid, logistics_partner_id uuid);
    create table public.external_forms(id uuid primary key,token text unique,form_type text,
      status text,cancelled_at timestamptz,expires_at timestamptz,context jsonb,
      submitted_at timestamptz,submitted_by_email text,related_id uuid,submission_data jsonb);
    alter table profiles enable row level security;
    create policy own_read on profiles for select to authenticated using(id=auth.uid());
    alter table external_forms enable row level security;
    grant usage on schema auth to authenticated;
    grant select on profiles to authenticated;
  `)
  return db
}

async function seed(db, opts = {}) {
  await db.exec('reset role; delete from external_forms; delete from profiles; delete from auth.users;')
  const email = opts.email ?? recipient
  await db.query('insert into auth.users values($1,$2,$3)', [uid, email, opts.unverified ? null : '2026-01-01T00:00:00Z'])
  if (!opts.missingProfile) await db.query('insert into profiles values($1,$2,$3,$4,$5,$6)', [uid, opts.role ?? 'client', opts.profileEmail ?? email, client, factory, partner])
  const context = { portal_role: opts.targetRole ?? 'client', client_id: null, factory_id: null, partner_id: null }
  if (opts.bound !== false) context.recipient_email = opts.recipient ?? recipient
  context[context.portal_role === 'client' ? 'client_id' : context.portal_role === 'factory' ? 'factory_id' : 'partner_id'] = context.portal_role === 'client' ? client : context.portal_role === 'factory' ? factory : partner
  await db.query('insert into external_forms(id,token,form_type,status,cancelled_at,expires_at,context) values($1,$2,$3,$4,$5,$6,$7)', [missing, fixtureKey, opts.formType ?? 'account_invite', opts.status ?? 'pending', opts.cancelled ? '2026-01-01T00:00:00Z' : null, opts.expired ? '2026-01-01T00:00:00Z' : '2100-01-01T00:00:00Z', context])
  await db.query("select set_config('test.user_id',$1,false)", [opts.anonymous ? '' : uid])
}

async function snapshot(db) {
  await db.exec('reset role')
  return { profiles: (await db.query('select * from profiles order by id')).rows,
    invitations: (await db.query('select id,status,submitted_at,submitted_by_email,related_id,submission_data from external_forms order by id')).rows }
}
async function claim(db) {
  await db.exec('set role authenticated')
  try { return (await db.query('select claim_account_invite($1) result', [fixtureKey])).rows[0].result }
  finally { await db.exec('reset role') }
}

test('existing bearer RPC accepts a different verified account and unverified account (isolated reproduction)', async () => {
  const db = await setup()
  try {
    await db.exec(baseline)
    await db.exec('revoke all on function claim_account_invite(text) from public; grant execute on function claim_account_invite(text) to authenticated;')
    await seed(db, { email: 'different@example.test', targetRole: 'logistics' })
    assert.equal((await claim(db)).success, true)
    await seed(db, { unverified: true, targetRole: 'factory' })
    assert.equal((await claim(db)).success, true)
  } finally { await db.close() }
})

test('recipient-bound review candidate regression matrix', async t => {
  const db = await setup()
  t.after(() => db.close())
  await db.exec(candidate)
  await t.test('RPC executable only by authenticated; Auth table remains private', async () => {
    const row = (await db.query("select has_function_privilege('authenticated','claim_account_invite(text)','EXECUTE') auth_call, has_function_privilege('anon','claim_account_invite(text)','EXECUTE') anon_call, has_table_privilege('authenticated','auth.users','SELECT') auth_read")).rows[0]
    assert.deepEqual(row, {auth_call: true, anon_call: false, auth_read: false})
  })
  await t.test('overlapping legitimate requests consume one invitation only (PGlite serializes one connection)', async () => {
    await seed(db, {targetRole: 'logistics'})
    const results = await Promise.all([claim(db), claim(db)])
    assert.equal(results.filter(r => r.success).length, 1)
    assert.equal(results.filter(r => !r.success).length, 1)
    const after = await snapshot(db)
    assert.equal(after.invitations[0].status, 'submitted')
    assert.equal(after.profiles[0].role, 'logistics')
  })
  for (const role of ['client', 'factory', 'logistics']) {
    await t.test(`verified exact recipient can claim ${role}; other organization links cleared`, async () => {
      await seed(db, { targetRole: role })
      assert.deepEqual(await claim(db), {success: true, portal_role: role})
      const { profiles, invitations } = await snapshot(db)
      assert.equal(profiles[0].role, role)
      assert.equal(profiles[0].client_id, role === 'client' ? client : null)
      assert.equal(profiles[0].factory_id, role === 'factory' ? factory : null)
      assert.equal(profiles[0].logistics_partner_id, role === 'logistics' ? partner : null)
      assert.equal(invitations[0].status, 'submitted')
      assert.equal(invitations[0].submitted_by_email, recipient)
      const after = await snapshot(db)
      assert.equal((await claim(db)).success, false)
      assert.deepEqual(await snapshot(db), after)
    })
  }
  await t.test('case/whitespace normalized without removing plus label', async () => {
    await seed(db, { recipient: ' OWNER+CLIENT@EXAMPLE.TEST ' })
    assert.equal((await claim(db)).success, true)
  })
  const deny = [
    ['different verified account', {email: 'different@example.test'}],
    ['base inbox identity is distinct from plus identity', {email: 'owner@example.test'}],
    ['different plus label', {email: 'owner+factory@example.test'}],
    ['unverified matching Auth email', {unverified: true}],
    ['legacy unbound invitation', {bound: false}],
    ['profile email spoof cannot override canonical Auth email', {email: 'different@example.test', profileEmail: recipient}],
    ['admin guard retained', {role: 'admin'}],
    ['sales guard retained', {role: 'sales'}],
    ['unauthenticated claim', {anonymous: true}],
    ['missing profile cannot consume invitation', {missingProfile: true}],
    ['expired invitation', {expired: true}],
    ['cancelled invitation', {cancelled: true}],
    ['used invitation', {status: 'submitted'}],
    ['different external form type', {formType: 'factory_self_registration'}],
  ]
  for (const [name, opts] of deny) await t.test(`${name}: no profile/invitation mutation`, async () => {
    await seed(db, opts)
    const before = await snapshot(db)
    assert.equal((await claim(db)).success, false)
    assert.deepEqual(await snapshot(db), before)
  })
  await t.test('late invitation-write failure rolls back role grant', async () => {
    await seed(db, {targetRole: 'logistics'})
    const before = await snapshot(db)
    await db.exec(`create function fail_invite_write() returns trigger language plpgsql as
      $$ begin raise exception 'synthetic late failure'; end $$;
      create trigger fail_invite_write before update on external_forms for each row execute function fail_invite_write();`)
    await assert.rejects(claim(db), /synthetic late failure/)
    assert.deepEqual(await snapshot(db), before)
    await db.exec('drop trigger fail_invite_write on external_forms; drop function fail_invite_write();')
  })
})
