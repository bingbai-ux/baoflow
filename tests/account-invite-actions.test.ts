import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { normalizeAccountInviteEmail, prepareAccountInvite } from '../src/lib/utils/account-invites'

const org = '20000000-0000-4000-8000-000000000001'
const email = 'owner+client@example.test'
function harness(role: string | null = 'sales', invitation?: Record<string, unknown>) {
  const writes: Array<Record<string, any>> = []
  let tokens = 0
  const user = role ? {id: 'synthetic-user'} : null
  const db = {auth: {getUser: async () => ({data: {user}, error: null})},
    from: (table: string) => ({insert: async (data: Record<string, unknown>) => {assert.equal(table, 'external_forms'); writes.push(data); return {error: null}}}),
    rpc: () => ({maybeSingle: async () => ({data: invitation, error: null})})}
  const exports: Record<string, any> = {}
  const compiled = ts.transpileModule(readFileSync(new URL('../src/lib/actions/account-invites.ts', import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true}}).outputText
  runInNewContext(compiled, {exports, Date, require: (name: string) => {
    if (name === 'crypto') return {randomBytes: () => {tokens++; return {toString: () => 'nonsecret-synthetic-fixture'}}}
    if (name === 'next/cache') return {revalidatePath: () => {}}
    if (name.includes('supabase/server')) return {createClient: async () => db}
    if (name.includes('deal-access')) return {requireSalesAccess: async () => ['sales','admin'].includes(role || '') ? null : '営業・管理者のみ'}
    if (name.includes('utils/account-invites')) return {normalizeAccountInviteEmail, prepareAccountInvite}
    throw Error('Unexpected test import')
  }})
  return {create: exports.createAccountInvitation, info: () => exports.getAccountInviteInfo('nonsecret-synthetic-fixture'), writes, tokens: () => tokens}
}

test('invitation server action preserves plus identity and only binds the selected organization', async () => {
  for (const role of ['client','factory','logistics'] as const) {
    const h = harness(), result = await h.create({portal_role: role, recipient_email: ' OWNER+CLIENT@EXAMPLE.TEST ', client_id: org, factory_id: org, partner_id: org})
    assert.equal(result.error, null)
    assert.equal(h.writes.length, 1)
    const context = h.writes[0].context
    assert.equal(context.recipient_email, email)
    assert.equal(context.client_id, role === 'client' ? org : null)
    assert.equal(context.factory_id, role === 'factory' ? org : null)
    assert.equal(context.partner_id, role === 'logistics' ? org : null)
  }
})

test('invalid/missing recipient, unsupported role or missing organization never generate or insert an invitation', async () => {
  const valid = {portal_role: 'client', recipient_email: email, client_id: org}
  for (const input of [null, {...valid, recipient_email: ''}, {...valid, recipient_email: 'bad'}, {...valid, recipient_email: 'a\nb@example.test'}, {...valid, recipient_email: 'a'.repeat(250)+'@example.test'}, {...valid, portal_role: 'admin'}, {...valid, client_id: null}, {...valid, client_id: 'bad'}]) {
    const h = harness(), r = await h.create(input)
    assert.ok(r.error)
    assert.equal(h.tokens(), 0)
    assert.equal(h.writes.length, 0)
  }
})

test('external and unauthenticated accounts cannot generate invitations', async () => {
  for (const role of ['client','factory','logistics', null]) {
    const h = harness(role), r = await h.create({portal_role: 'client', recipient_email: email, client_id: org})
    assert.ok(r.error); assert.equal(h.tokens(), 0); assert.equal(h.writes.length, 0)
  }
})

test('invitation GET rejects unbound/invalid invitations and returns the exact normalized recipient without changing data', async () => {
  const base = {form_type: 'account_invite', status: 'pending', cancelled_at: null, expires_at: '2100-01-01T00:00:00Z'}
  for (const context of [{portal_role:'client'}, {portal_role:'admin',recipient_email:email}, {portal_role:'client',recipient_email:'bad'}]) {
    const h = harness('sales', {...base, context})
    assert.equal((await h.info()).valid, false); assert.equal(h.writes.length, 0); assert.equal(h.tokens(), 0)
  }
  const h = harness('sales', {...base, context:{portal_role:'client',label:'Synthetic org',recipient_email:' OWNER+CLIENT@EXAMPLE.TEST '}})
  const r = await h.info()
  assert.equal(r.valid, true); assert.equal(r.recipientEmail, email)
  assert.equal(h.writes.length, 0); assert.equal(h.tokens(), 0)
})
