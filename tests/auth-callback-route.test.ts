import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { NextResponse } from 'next/server'
import { safeAuthDestination } from '../src/lib/utils/auth-routing'

function harness(options: {clientThrows?: boolean; exchangeThrows?: boolean; session?: object | null; authError?: boolean} = {}) {
  const calls: string[] = []
  let clients = 0
  const exports: Record<string, any> = {}
  const compiled = ts.transpileModule(readFileSync(new URL('../src/app/auth/callback/route.ts', import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText
  runInNewContext(compiled, {exports, URL, require: (name: string) => {
    if (name === 'next/server') return {NextResponse}
    if (name.includes('utils/auth-routing')) return {safeAuthDestination}
    if (name.includes('supabase/server')) return {createClient: async () => {
      clients++
      if (options.clientThrows) throw Error('synthetic client unavailable')
      return {auth: {exchangeCodeForSession: async (code: string) => {
        calls.push(code)
        if (options.exchangeThrows) throw Error('synthetic Auth unavailable')
        return {data: {session: options.session === undefined ? {} : options.session}, error: options.authError ? {message: 'synthetic expired code'} : null}
      }}}
    }}
    throw Error('Unexpected test import')
  }})
  return {get: exports.GET as (request: Request) => Promise<Response>, calls, clientCount: () => clients}
}
const request = (query = '') => new Request('https://app.example.test/auth/callback' + query)
function assertPrivate(response: Response) {
  assert.equal(response.status, 307)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer')
}
const failure = 'https://app.example.test/login?error=auth_callback_error'

test('missing recovery code redirects privately without creating an Auth client', async () => {
  const h = harness()
  const response = await h.get(request('?next=/reset-password'))
  assert.equal(response.headers.get('location'), failure)
  assert.equal(h.clientCount(), 0)
  assert.equal(h.calls.length, 0)
  assertPrivate(response)
})

test('client and Auth exceptions return the error route instead of throwing or retrying', async () => {
  for (const options of [{clientThrows: true}, {exchangeThrows: true}]) {
    const h = harness(options)
    const response = await h.get(request('?code=synthetic-code&next=/reset-password'))
    assert.equal(response.headers.get('location'), failure)
    assert.equal(h.clientCount(), 1)
    assert.equal(h.calls.length, options.clientThrows ? 0 : 1)
    assertPrivate(response)
  }
})

test('expired/reused recovery codes cannot enter password setup', async () => {
  const h = harness({authError: true})
  const response = await h.get(request('?code=synthetic-code&next=/reset-password'))
  assert.equal(response.headers.get('location'), failure)
  assert.deepEqual(h.calls, ['synthetic-code'])
  assertPrivate(response)
})

test('an empty session cannot enter password setup even without an Auth error', async () => {
  const h = harness({session: null})
  const response = await h.get(request('?code=synthetic-code&next=/reset-password'))
  assert.equal(response.headers.get('location'), failure)
  assert.deepEqual(h.calls, ['synthetic-code'])
  assertPrivate(response)
})

test('a successful session reaches the local reset form without caching or exposing code in Location', async () => {
  const h = harness()
  const response = await h.get(request('?code=synthetic-code&next=/reset-password'))
  assert.equal(response.headers.get('location'), 'https://app.example.test/reset-password')
  assert.deepEqual(h.calls, ['synthetic-code'])
  assert.equal(h.clientCount(), 1)
  assertPrivate(response)
})

test('successful recovery never redirects to external or backslash destinations', async () => {
  for (const next of ['https://outside.example.test', '//outside.example.test', '/\\outside.example.test']) {
    const h = harness()
    const response = await h.get(request('?code=synthetic-code&next=' + encodeURIComponent(next)))
    assert.equal(response.headers.get('location'), 'https://app.example.test/')
    assert.equal(h.calls.length, 1)
    assertPrivate(response)
  }
})
