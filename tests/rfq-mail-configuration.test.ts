import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { createHash } from 'node:crypto'
import ts from 'typescript'
import { requireSalesAccess } from '../src/lib/actions/deal-access'

const env = {RESEND_API_KEY: 'synthetic-placeholder-no-secret', RFQ_MAIL_FROM: 'bao@verified.example.test', NEXT_PUBLIC_APP_URL: 'https://app.example.test'}
function harness(settings: Record<string, string | undefined> = env, formChanges: Record<string, unknown> = {}) {
  const rpcCalls: string[] = [], sent: Record<string, any>[] = []
  const rows: Record<string, any> = {
    profiles: {role: 'sales'},
    rfq_factory_invitations: {id: 'synthetic-invitation', rfq_id: 'synthetic-rfq', factory_id: 'synthetic-factory', external_form_id: 'synthetic-form', invitation_sent_at: null},
    rfq_requests: {rfq_number: 'SYNTHETIC-RFQ', status: 'open'},
    external_forms: {form_type: 'rfq_response', related_id: 'synthetic-invitation', token: 'synthetic-form-token', status: 'pending', cancelled_at: null, expires_at: '2100-01-01T00:00:00Z', context: {schema_version: 2, recipient: {name: 'Synthetic factory', email: 'frozen+factory@example.test'}}, ...formChanges},
    factories: {factory_name: 'Changed master name', contact_email: 'changed-master@example.test'},
    rfq_email_receipts: null,
  }
  const db = {auth: {getUser: async () => ({data: {user: {id: 'synthetic-staff'}}, error: null})}, from: (table: string) => {
    const builder: any = {select: () => builder, eq: () => builder, single: async () => ({data: rows[table], error: null}), maybeSingle: async () => ({data: rows[table], error: null})}
    return builder
  }, rpc: async (name: string) => {
    rpcCalls.push(name)
    return {data: name === 'claim_rfq_email_v2' ? {claimed: true, attemptId: 'synthetic-attempt'} : null, error: null}
  }}
  const exports: Record<string, any> = {}
  const compiled = ts.transpileModule(readFileSync(new URL('../src/lib/actions/rfq-v2.ts', import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText
  runInNewContext(compiled, {exports, Date, process: {env: settings}, fetch: async (url: string, options: {body: string}) => {
    assert.equal(url, 'https://api.resend.com/emails')
    sent.push(JSON.parse(options.body))
    return {ok: true, json: async () => ({id: 'synthetic-provider-id'})}
  }, require: (name: string) => {
    if (name === 'node:crypto') return {createHash}
    if (name.includes('supabase/server')) return {createClient: async () => db}
    if (name.includes('deal-access')) return {requireSalesAccess}
    if (name.includes('rfq-preview')) return {canonicalRfqInput: () => {throw Error('Unexpected RFQ creation')}}
    throw Error('Unexpected test import')
  }})
  return {actions: exports, rpcCalls, sent}
}

test('missing RFQ mail configuration rejects preview/send before reservation and provider calls', async () => {
  for (const key of ['RESEND_API_KEY', 'RFQ_MAIL_FROM', 'NEXT_PUBLIC_APP_URL']) {
    const h = harness({...env, [key]: undefined})
    const preview = await h.actions.previewRfqEmail('synthetic-invitation')
    assert.match(preview.error, /設定を確認/)
    const send = await h.actions.sendConfirmedRfqEmail('synthetic-invitation', 'synthetic-fingerprint')
    assert.match(send.error, /設定を確認/)
    assert.equal(h.rpcCalls.length, 0)
    assert.equal(h.sent.length, 0)
  }
})

test('RFQ preview and provider payload retain the frozen recipient after master email changes', async () => {
  const h = harness()
  const {preview} = await h.actions.previewRfqEmail('synthetic-invitation')
  assert.equal(preview.to, 'frozen+factory@example.test')
  assert.equal(h.rpcCalls.length, 0)
  const result = await h.actions.sendConfirmedRfqEmail('synthetic-invitation', preview.fingerprint)
  assert.equal(result.status, 'accepted')
  assert.deepEqual(h.sent[0].to, ['frozen+factory@example.test'])
  assert.equal(h.sent[0].from, env.RFQ_MAIL_FROM)
  assert.deepEqual(h.rpcCalls, ['claim_rfq_email_v2', 'finish_rfq_email'])
})

test('cancelled, consumed or expired RFQ links never reserve or send mail', async () => {
  for (const changes of [{cancelled_at: '2026-01-01T00:00:00Z'}, {status: 'submitted'}, {expires_at: '2020-01-01T00:00:00Z'}]) {
    const h = harness(env, changes)
    const result = await h.actions.sendConfirmedRfqEmail('synthetic-invitation', 'synthetic-fingerprint')
    assert.match(result.error, /無効または期限切れ/)
    assert.equal(h.rpcCalls.length, 0)
    assert.equal(h.sent.length, 0)
  }
})

test('a changed review fingerprint cannot reserve or send RFQ mail', async () => {
  const h = harness()
  const result = await h.actions.sendConfirmedRfqEmail('synthetic-invitation', 'outdated-synthetic-fingerprint')
  assert.match(result.error, /送信内容が変更/)
  assert.equal(h.rpcCalls.length, 0)
  assert.equal(h.sent.length, 0)
})
