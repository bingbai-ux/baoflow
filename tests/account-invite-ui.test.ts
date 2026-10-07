import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import * as helpers from '../src/lib/utils/account-invites'

type Element = {type: string; props: Record<string, any>}
const email = 'owner+client@example.test'
const org = '20000000-0000-4000-8000-000000000001'
function harness(kind: 'creator' | 'receiver', props: Record<string, unknown>, options: {confirm?: boolean; claimError?: string; lookupError?: boolean} = {}) {
  const states: any[] = [], jobs: Promise<unknown>[] = [], calls: any[] = [], routes: string[] = []
  let index = 0
  const useState = (initial: any) => {const slot=index++; if (!(slot in states)) states[slot]=initial; return [states[slot], (value: any) => {states[slot] = typeof value === 'function' ? value(states[slot]) : value}]}
  const react = {useState, useRef: (initial: any) => {const [value] = useState({current:initial}); return value}, useTransition: () => {const [pending,setPending]=useState(false); return [pending,(fn: () => unknown) => {setPending(true); jobs.push(Promise.resolve().then(fn).finally(() => setPending(false)))}]}}
  const exports: Record<string, any> = {}
  const file = kind === 'creator' ? '../src/components/master/account-invite-button.tsx' : '../src/components/external/account-invite-client.tsx'
  const compiled = ts.transpileModule(readFileSync(new URL(file, import.meta.url),'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
  runInNewContext(compiled, {exports, navigator:{clipboard:{writeText:async()=>{calls.push({kind:'copy'})}}}, window:{location:{origin:'http://127.0.0.1:3100'}}, require: (name: string) => {
    if (name === 'react') return react
    if (name === 'react/jsx-runtime') return {jsx: (type: string, props: any) => ({type,props}), jsxs: (type: string, props: any) => ({type,props}), Fragment: 'fragment'}
    if (name === 'lucide-react') return {Copy:'icon',KeyRound:'icon',X:'icon'}
    if (name === 'next/navigation') return {useRouter: () => ({push:(route: string)=>routes.push(route),refresh:()=>{}})}
    if (name.includes('utils/account-invites')) return helpers
    if (name.includes('ui-store')) return {useUi: () => ({toast: () => {}})}
    if (name.includes('actions/account-invites')) return {
      findAccountInvitation:async(input: any)=>{calls.push({kind:'lookup',input}); return options.lookupError ? {token:null,error:'一致する有効な招待がありません'} : {token:'nonsecret-synthetic-fixture',error:null}},
      createAccountInvitation:async(input: any)=>{calls.push({kind:'create', input}); return {token:'nonsecret-synthetic-fixture',error:null}},
      claimAccountInvite:async()=>{calls.push({kind:'claim'}); return options.claimError ? {success:false,error:options.claimError} : {success:true,portalRole:props.portalRole || 'client'}},
    }
    if (name.includes('supabase/client')) return {createClient: () => ({auth:{
      signUp:async(input: any)=>{calls.push({kind:'signup',email:input.email});return {data:{session:options.confirm?null:{}},error:null}},
      signInWithPassword:async(input: any)=>{calls.push({kind:'login',email:input.email});return {error:null}},
      signOut:async()=>{calls.push({kind:'logout'})},
    }})}
    throw Error('Unexpected test import')
  }})
  const Component = exports[kind === 'creator' ? 'AccountInviteButton' : 'AccountInviteClient']
  const render = () => {index=0; return Component(props)}
  return {render,calls,routes,flush:async()=>{while(jobs.length) await jobs.shift()},states}
}
function elements(node: any): Element[] {
  if (!node) return []
  if (Array.isArray(node)) return node.flatMap(elements)
  if (typeof node !== 'object') return []
  return [node, ...elements(node.props?.children)]
}
function text(node: any): string {
  if (!node || typeof node === 'boolean') return ''
  if (Array.isArray(node)) return node.map(text).join('')
  if (typeof node === 'object') return text(node.props?.children)
  return String(node)
}
function find(node: any, predicate: (e: Element) => boolean) {const match=elements(node).find(predicate);assert.ok(match);return match}
const button = (node: any, label: string) => find(node,e=>e.type==='button' && text(e).includes(label))
const form = (node: any) => find(node,e=>e.type==='form')
const event = {preventDefault:()=>{}}

test('creator shows recipient and real logistics scope before generation; opening/invalid input never creates access', async () => {
  const h = harness('creator',{portalRole:'logistics',partnerId:org,orgLabel:'Synthetic warehouse'})
  button(h.render(),'ログイン招待').props.onClick()
  let view=h.render()
  assert.match(text(view),/共有倉庫の全顧客・在庫・入出庫/)
  assert.match(text(view),/本人に割り当てられた便/)
  assert.equal(h.calls.length,0)
  assert.equal(button(view,'この宛先と権限').props.disabled,true)
  form(view).props.onSubmit(event);await h.flush();assert.equal(h.calls.length,0)
  find(view,e=>e.type==='input'&&e.props.id==='account-invite-email').props.onChange({target:{value:' OWNER+CLIENT@EXAMPLE.TEST '}})
  view=h.render();form(view).props.onSubmit(event);await h.flush()
  assert.equal(h.calls.length,1);assert.equal(h.calls[0].input.recipient_email,email)
  assert.match(text(h.render()),/メールは自動送信されません/)
  form(h.render()).props.onSubmit(event);await h.flush();assert.equal(h.calls.length,1)
})

test('wrong logged-in account cannot claim, and has an explicit account-switch action', async () => {
  const h=harness('receiver',{valid:true,recipientEmail:email,loggedInEmail:'owner@example.test',portalRole:'client'})
  const view=h.render()
  assert.match(text(view),/招待先と異なるアカウント/)
  assert.equal(button(view,'この招待を受け取る').props.disabled,true)
  button(view,'この招待を受け取る').props.onClick();await h.flush();assert.equal(h.calls.length,0)
  await button(view,'別のアカウント').props.onClick();assert.equal(h.calls[0].kind,'logout')
})

test('wrong typed account is rejected before signup/login, retaining plus label as identity', async () => {
  const h=harness('receiver',{valid:true,recipientEmail:email,loggedInEmail:null,portalRole:'client'})
  find(h.render(),e=>e.type==='input'&&e.props.type==='email').props.onChange({target:{value:'owner@example.test'}})
  form(h.render()).props.onSubmit(event);await h.flush()
  assert.equal(h.calls.length,0);assert.match(text(h.render()),/招待先のメールアドレスで/)
})

test('confirmation-required signup does not claim; reopening and logging in resumes the same invitation', async () => {
  const props={valid:true,token:'nonsecret-synthetic-fixture',recipientEmail:email,loggedInEmail:null,portalRole:'client'}
  const signup=harness('receiver',props,{confirm:true})
  form(signup.render()).props.onSubmit(event);await signup.flush()
  assert.deepEqual(signup.calls.map(c=>c.kind),['signup']);assert.equal(signup.calls[0].email,email)
  assert.match(text(signup.render()),/もう一度この招待リンクを開いて/)
  assert.ok(signup.states.includes(''))
  const login=harness('receiver',props)
  button(login.render(),'ログイン').props.onClick()
  form(login.render()).props.onSubmit(event);await login.flush()
  assert.deepEqual(login.calls.map(c=>c.kind),['login','claim']);assert.deepEqual(login.routes,['/portal'])
})

test('existing verified recipient claims through each role home; rejected claim does not navigate', async () => {
  for(const [role,path] of [['client','/portal'],['factory','/factory'],['logistics','/logistics']]) {
    const h=harness('receiver',{valid:true,recipientEmail:email,loggedInEmail:email,portalRole:role})
    button(h.render(),'この招待を受け取る').props.onClick();await h.flush();assert.deepEqual(h.routes,[path])
  }
  const h=harness('receiver',{valid:true,recipientEmail:email,loggedInEmail:email},{claimError:'スタッフアカウントではこの招待を使えません'})
  button(h.render(),'この招待を受け取る').props.onClick();await h.flush()
  assert.equal(h.routes.length,0);assert.match(text(h.render()),/スタッフアカウント/)
})


test('existing invitation retrieval and copy revalidate without generating; failed lookup never copies', async () => {
  for (const lookupError of [false,true]) {
    const h=harness('creator',{portalRole:'client',clientId:org,orgLabel:'Synthetic client'},{lookupError})
    button(h.render(),'ログイン招待').props.onClick()
    find(h.render(),e=>e.type==='input'&&e.props.id==='account-invite-email').props.onChange({target:{value:email}})
    const view=h.render(), lookup=button(view,'既存の有効な招待')
    lookup.props.onClick();lookup.props.onClick();await h.flush()
    assert.deepEqual(h.calls.map(c=>c.kind),['lookup'])
    if (!lookupError) {
      button(h.render(),'コピー').props.onClick();await h.flush()
      assert.deepEqual(h.calls.map(c=>c.kind),['lookup','lookup','copy'])
      find(h.render(),e=>e.type==='button'&&e.props['aria-label']==='招待画面を閉じる').props.onClick()
      assert.ok(!elements(h.render()).some(e=>e.props?.role==='dialog'))
    } else assert.ok(!elements(h.render()).some(e=>e.type==='input'&&e.props.readOnly))
  }
})
