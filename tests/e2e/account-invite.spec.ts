import {test,expect} from '@playwright/test'

test.use({trace:'off',screenshot:'off',video:'off'})
const fixture='http://127.0.0.1:55440'
const actor='11111111-1111-4111-8111-111111111111'
const client='22222222-2222-4222-8222-222222222222'
const key='nonsecret-browser-fixture-not-an-invitation'
const recipient='local+client@example.test'
async function seed(request: any, role='client') {
  await request.post(fixture+'/__role',{data:{role}})
  await request.post(fixture+'/rest/v1/external_forms',{data:{id:'a0000000-0000-4000-8000-000000000001',token:key,form_type:'account_invite',status:'pending',expires_at:'2100-01-01T00:00:00Z',context:{portal_role:role,client_id:role==='client'?client:null,label:'Synthetic test company',recipient_email:recipient}}})
}
test.beforeEach(async({context,request})=>{
  await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort())
  await request.post(fixture+'/__reset')
})
async function session(context: any) {
  const token=[{alg:'HS256',typ:'JWT'},{sub:actor,exp:4102444800,iat:1700000000,role:'authenticated'},'fixture'].map(x=>typeof x==='string'?x:Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')
  const value={access_token:token,refresh_token:'nonsecret-fixture',expires_at:4102444800,expires_in:3600,token_type:'bearer',user:{id:actor,role:'authenticated',email:'local@example.test'}}
  await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(value)).toString('base64url'),domain:'127.0.0.1',path:'/'}])
}

test('creator reviews exact recipient before generating; actual server action stores plus identity',async({page,context,request})=>{
  await session(context)
  await page.goto('/master?tab=clients&id='+client)
  await page.getByRole('button',{name:'ログイン招待',exact:true}).click()
  const dialog=page.getByRole('dialog')
  await expect(dialog.getByRole('button',{name:'この宛先と権限で招待リンクを生成'})).toBeDisabled()
  let state=await (await request.get(fixture+'/__state')).json()
  expect(state.external_forms||[]).toHaveLength(0)
  await dialog.getByLabel('招待先メールアドレス').fill('LOCAL+CLIENT@EXAMPLE.TEST')
  await dialog.getByRole('button',{name:'この宛先と権限で招待リンクを生成'}).click()
  await expect(dialog.getByText(/メールは自動送信されません/)).toBeVisible()
  state=await (await request.get(fixture+'/__state')).json()
  expect(state.external_forms).toHaveLength(1)
  expect(state.external_forms[0].context.recipient_email).toBe(recipient)
  expect(state.external_forms[0].context.client_id).toBe(client)
  expect(state.external_forms[0].context.factory_id).toBeNull()
  expect(state.external_forms[0].context.partner_id).toBeNull()
})

test('wrong signed-in identity cannot receive and sees real shared-warehouse scope',async({page,context,request})=>{
  await seed(request,'logistics');await session(context)
  await page.goto('/account-invite/'+key)
  await expect(page.getByRole('alert').filter({hasText:'招待先と異なるアカウント'})).toContainText('招待先と異なるアカウント')
  await expect(page.getByRole('button',{name:'この招待を受け取る',exact:true})).toBeDisabled()
  await expect(page.getByText(/共有倉庫の全顧客・在庫・入出庫/)).toBeVisible()
  await expect(page.getByText(/本人に割り当てられた便/)).toBeVisible()
  const state=await (await request.get(fixture+'/__state')).json()
  expect(state.external_forms[0].status).toBe('pending')
})

test('confirmation-required signup does not claim; same invitation reopens with login and exact plus address',async({page,request})=>{
  await seed(request)
  let attempts=0
  await page.route(fixture+'/auth/v1/signup',async route=>{
    const input=route.request().postDataJSON();expect(input.email).toBe(recipient);attempts++
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({user:{id:actor,email:recipient,aud:'authenticated',role:'authenticated',created_at:'2026-01-01T00:00:00Z'}})})
  })
  await page.goto('/account-invite/'+key)
  await page.getByLabel('パスワード (8文字以上)').fill('synthetic-test-only-value')
  await page.getByRole('button',{name:'アカウントを作成して招待を受け取る',exact:true}).click()
  await expect(page.getByText(/もう一度この招待リンクを開いて/)).toBeVisible()
  expect(attempts).toBe(1)
  let state=await (await request.get(fixture+'/__state')).json()
  expect(state.external_forms[0].status).toBe('pending')
  await page.reload()
  await page.getByRole('button',{name:'ログイン',exact:true}).click()
  await expect(page.getByLabel('メールアドレス',{exact:true})).toHaveValue(recipient)
  await expect(page.getByRole('button',{name:'ログインして招待を受け取る',exact:true})).toBeEnabled()
  state=await (await request.get(fixture+'/__state')).json()
  expect(state.external_forms[0].status).toBe('pending')
})
