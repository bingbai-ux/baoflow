import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

function harness(env: Record<string, string | undefined>, response: () => Promise<{error: unknown}> = async () => ({error: null})) {
  let constructors = 0
  const calls: Record<string, any>[] = []
  class Resend {
    constructor() {constructors++}
    emails = {send: async (input: Record<string, any>) => {calls.push(input); return response()}}
  }
  const exports: Record<string, any> = {}
  const compiled = ts.transpileModule(readFileSync(new URL('../src/lib/utils/email.ts', import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText
  runInNewContext(compiled, {exports, process: {env}, console: {log() {}, error() {}}, require: (name: string) => {
    assert.equal(name, 'resend')
    return {Resend}
  }})
  return {send: exports.sendEmail, calls, constructorCount: () => constructors}
}
const message = {to: 'owner+client@example.test', subject: 'Synthetic notification', body: '<p>synthetic only</p>'}
const configured = {RESEND_API_KEY: 'synthetic-placeholder-no-secret', RFQ_MAIL_FROM: 'bao@verified.example.test'}

test('missing key or configured sender blocks notification email before a provider request', async () => {
  for (const env of [{}, {RESEND_API_KEY: configured.RESEND_API_KEY}, {RFQ_MAIL_FROM: configured.RFQ_MAIL_FROM}]) {
    const h = harness(env)
    assert.equal(await h.send(message), false)
    assert.equal(h.calls.length, 0)
    assert.equal(h.constructorCount(), 0)
  }
})

test('notification mail uses the configured sender and exact recipient rather than a fixed domain', async () => {
  const h = harness(configured)
  assert.equal(await h.send(message), true)
  assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0].from, configured.RFQ_MAIL_FROM)
  assert.equal(h.calls[0].to, message.to)
  assert.equal(h.calls[0].html, message.body)
})

test('provider rejection or an uncertain network result never reports notification success', async () => {
  for (const response of [async () => ({error: {message: 'synthetic rejection'}}), async () => {throw Error('synthetic timeout')}]) {
    const h = harness(configured, response)
    assert.equal(await h.send(message), false)
    assert.equal(h.calls.length, 1)
  }
})
