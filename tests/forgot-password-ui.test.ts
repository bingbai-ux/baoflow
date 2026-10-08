import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

type Node = {type: string; props: Record<string, any>}
type Result = {error: {message: string; status?: number} | null}
function harness(responses: (() => Promise<Result>)[]) {
  const states: any[] = [], calls: {email: string; redirectTo: string}[] = []
  let index = 0
  const useState = (initial: any) => {
    const slot = index++
    if (!(slot in states)) states[slot] = initial
    return [states[slot], (value: any) => {states[slot] = value}]
  }
  const exports: Record<string, any> = {}
  const compiled = ts.transpileModule(readFileSync(new URL('../src/app/forgot-password/page.tsx', import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX},
  }).outputText
  runInNewContext(compiled, {exports, window: {location: {origin: 'https://app.example.test'}}, require: (name: string) => {
    if (name === 'react') return {useState, useRef: (value: any) => useState({current: value})[0]}
    if (name === 'react/jsx-runtime') return {jsx: (type: string, props: any) => ({type, props}), jsxs: (type: string, props: any) => ({type, props}), Fragment: 'fragment'}
    if (name === 'next/link') return {default: 'a'}
    if (name.includes('supabase/client')) return {createClient: () => ({auth: {resetPasswordForEmail: async (email: string, options: {redirectTo: string}) => {
      calls.push({email, redirectTo: options.redirectTo})
      const response = responses.shift()
      assert.ok(response, 'Unexpected additional Auth request')
      return response()
    }}})}
    throw Error('Unexpected test import')
  }})
  const render = () => {index = 0; return exports.default()}
  const input = (view: Node) => find(view, n => n.type === 'input')
  input(render()).props.onChange({target: {value: ' owner+client@example.test '}})
  return {render, calls, input, submit: () => find(render(), n => n.type === 'form').props.onSubmit({preventDefault() {}})}
}
function nodes(node: any): Node[] {
  if (!node || typeof node !== 'object') return []
  if (Array.isArray(node)) return node.flatMap(nodes)
  return [node, ...nodes(node.props?.children)]
}
function find(view: Node, predicate: (n: Node) => boolean): Node {
  const node = nodes(view).find(predicate)
  assert.ok(node)
  return node
}
function text(node: any): string {
  if (!node || typeof node === 'boolean') return ''
  if (Array.isArray(node)) return node.map(text).join('')
  return typeof node === 'object' ? text(node.props?.children) : String(node)
}

test('two simultaneous recovery submits send one request and lock the recipient until completion', async () => {
  let release!: (result: Result) => void
  const pending = new Promise<Result>(resolve => {release = resolve})
  const h = harness([() => pending])
  const first = h.submit(), second = h.submit()
  assert.equal(h.calls.length, 1)
  assert.equal(h.input(h.render()).props.disabled, true)
  assert.deepEqual(h.calls[0], {email: 'owner+client@example.test', redirectTo: 'https://app.example.test/auth/callback?next=/reset-password'})
  release({error: null})
  await Promise.all([first, second])
  assert.match(text(h.render()), /この操作をしたブラウザ/)
  assert.match(text(h.render()), /owner\+client@example.test/)
  assert.equal(nodes(h.render()).filter(n => n.type === 'form').length, 0)
})

test('a rejected recovery request unlocks the form and permits one explicit retry', async () => {
  const h = harness([async () => {throw Error('synthetic network failure')}, async () => ({error: null})])
  await h.submit()
  assert.match(text(h.render()), /通信状態を確認/)
  assert.equal(h.input(h.render()).props.disabled, false)
  assert.equal(find(h.render(), n => n.type === 'button').props.disabled, false)
  assert.doesNotMatch(text(h.render()), /リンクを.*送りました/)
  await h.submit()
  assert.equal(h.calls.length, 2)
  assert.equal(nodes(h.render()).filter(n => n.type === 'form').length, 0)
})

test('transient Auth failures and rate limits never show sent state or retry automatically', async () => {
  for (const error of [{message: '{}', status: 503}, {message: 'email rate limit exceeded', status: 429}]) {
    const h = harness([async () => ({error})])
    await h.submit()
    assert.equal(h.calls.length, 1)
    assert.equal(h.input(h.render()).props.disabled, false)
    assert.match(text(h.render()), error.status === 429 ? /送信回数の上限/ : /通信状態を確認/)
    assert.doesNotMatch(text(h.render()), /リンクを.*送りました/)
  }
})
