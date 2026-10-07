import {test,expect,type Page,type APIRequestContext,type BrowserContext} from '@playwright/test'
const fixture='http://127.0.0.1:55443'
const company='/account-invite/synthetic-company-invitation-only'
const confirmation='/auth/confirm?token_hash='+'a'.repeat(64)+'&type=invite'
const password='synthetic-password-only'
const actor='11111111-1111-4111-8111-111111111111'
const ids={client:'22222222-2222-4222-8222-222222222222',factory:'33333333-3333-4333-8333-333333333333',logistics:'44444444-4444-4444-8444-444444444444',foreignClient:'22222222-2222-4222-8222-222222222223',foreignFactory:'33333333-3333-4333-8333-333333333334'}
const state=async(request:APIRequestContext)=>(await (await request.get(fixture+'/__state')).json())
const profile=async(request:APIRequestContext)=>(await state(request)).profiles.find((p:any)=>p.id===actor)
async function confirm(page:Page){await page.goto(confirmation);await expect(page).toHaveURL(/\/reset-password$/)}
async function setPassword(page:Page){
 await page.getByLabel('新しいパスワード',{exact:true}).fill(password)
 await page.getByLabel('確認用パスワード',{exact:true}).fill(password)
 await page.getByRole('button',{name:'この内容で設定する'}).click()
 await expect(page).toHaveURL(/\/portal$/)
}
async function claim(page:Page){await page.goto(company);await page.getByRole('button',{name:'この招待を受け取る',exact:true}).click()}
async function sessionFor(context:BrowserContext,request:APIRequestContext,kind:string){
 const value=await (await request.post(fixture+'/__session',{data:{actor:kind}})).json()
 await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(value)).toString('base64url'),domain:'localhost',path:'/'}])
 return value.access_token as string
}
async function browserJwt(context:BrowserContext){const cookie=(await context.cookies()).find(c=>c.name==='sb-127-auth-token')!;return JSON.parse(Buffer.from(cookie.value.slice(7),'base64url').toString()).access_token as string}
async function scopedRows(request:APIRequestContext,token:string,table:string,query=''){return (await request.get(fixture+'/rest/v1/'+table+query,{headers:{Authorization:'Bearer '+token}})).json()}
test.beforeEach(async({context,request})=>{
 await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort())
 await request.post(fixture+'/__reset')
})

for(const role of ['client','factory','logistics'] as const){
 test(`${role}: anonymous invitation → Auth confirmation → human password → SQL claim → real role screen and RLS`,async({page,context,request})=>{
  await request.post(fixture+'/__reset',{data:{role}})
  await page.goto(company)
  await expect(page.getByText('招待先:')).toContainText('local+'+role+'@example.test')
  expect((await profile(request)).client_id).toBeNull()
  await confirm(page)
  expect((await state(request)).forms[0].status).toBe('pending')
  await setPassword(page)
  await expect(page.getByRole('heading',{name:'アカウントの紐付けが未完了です'})).toBeVisible()
  await claim(page)
  const home={client:'/portal',factory:'/factory',logistics:'/logistics'}[role]
  await expect(page).toHaveURL('http://localhost:3202'+home)
  const p=await profile(request)
  expect(p.role).toBe(role);expect(p.client_id).toBe(role==='client'?ids.client:null)
  expect(p.factory_id).toBe(role==='factory'?ids.factory:null);expect(p.logistics_partner_id).toBe(role==='logistics'?ids.logistics:null)
  if(role==='client'){
   await expect(page.getByText('Synthetic own stock',{exact:true})).toBeVisible()
   await expect(page.getByText('Synthetic other stock',{exact:true})).toHaveCount(0)
  }else if(role==='factory')await expect(page.getByRole('heading',{name:'Synthetic own factory',exact:true})).toBeVisible()
  else{
   await page.getByRole('button',{name:/在庫一覧/}).click()
   await expect(page.getByText('Synthetic own stock',{exact:true})).toBeVisible()
   await expect(page.getByText('Synthetic other stock',{exact:true})).toBeVisible()
  }
  const token=await browserJwt(context)
  const foreignClients=await scopedRows(request,token,'clients','?id=eq.'+ids.foreignClient)
  expect(foreignClients).toHaveLength(role==='logistics'?1:0) // warehouse scope deliberately covers all clients
  expect(await scopedRows(request,token,'factories','?id=eq.'+ids.foreignFactory)).toHaveLength(0)
  expect(await scopedRows(request,token,'external_forms')).toHaveLength(0)
  const inventory=await scopedRows(request,token,'inventory_items')
  expect(inventory).toHaveLength(role==='logistics'?2:role==='client'?1:0)
  for(const path of ['/master','/deals','/settings',...['/portal','/factory','/logistics'].filter(p=>p!==home)]){
   await page.goto(path);await expect(page).toHaveURL('http://localhost:3202'+home)
  }
  await page.reload();await expect(page).toHaveURL('http://localhost:3202'+home)
  const s=await state(request);expect(s.updates).toBe(1);expect(s.claimed).toBe(1);expect(s.forms[0].status).toBe('submitted');expect(s.mailSent).toBe(0)
 })
}

test('interruption after confirmation: reload and a new tab retain session; login resumes after password without reusing either invitation',async({page,context,request})=>{
 await request.post(fixture+'/__reset',{data:{role:'factory'}})
 await confirm(page);await page.reload();await expect(page.getByText('新しいパスワードを設定',{exact:true})).toBeVisible()
 const resumed=await context.newPage();await resumed.goto('/reset-password');await setPassword(resumed)
 await resumed.getByRole('button',{name:'ログアウト',exact:true}).click()
 await resumed.goto(company)
 await resumed.getByRole('button',{name:'ログイン',exact:true}).click()
 await resumed.getByLabel('パスワード (8文字以上)').fill(password)
 await resumed.getByRole('button',{name:'ログインして招待を受け取る',exact:true}).click()
 await expect(resumed).toHaveURL(/\/factory$/)
 const s=await state(request);expect(s.verified).toBe(1);expect(s.updates).toBe(1);expect(s.logins).toBe(1);expect(s.claimed).toBe(1)
})

test('refresh/back/reopen after claim or Auth verification never consumes again or grants another company',async({page,context,request})=>{
 await confirm(page);await setPassword(page);await claim(page);await expect(page).toHaveURL(/\/portal$/)
 await page.goBack();await page.reload();await page.goto(company)
 await expect(page.getByText('この招待は既に使用されています',{exact:true})).toBeVisible()
 await expect(page.getByRole('button',{name:'この招待を受け取る',exact:true})).toHaveCount(0)
 await page.goto(confirmation)
 await expect(page).not.toHaveURL(/\/reset-password$/)
 await page.goto('/portal');await expect(page.getByText('Synthetic own stock',{exact:true})).toBeVisible()
 const token=await browserJwt(context)
 const repeated=await request.post(fixture+'/rest/v1/rpc/claim_account_invite',{headers:{Authorization:'Bearer '+token},data:{p_token:'synthetic-company-invitation-only'}})
 expect((await repeated.json()).success).toBe(false)
 const s=await state(request);expect(s.claimed).toBe(1);expect((await profile(request)).client_id).toBe(ids.client)
})

for(const condition of ['expired','cancelled'] as const){
 test(`${condition} company invitation during password setup is rejected both by page and stale claim action`,async({page,context,request})=>{
  await confirm(page);await setPassword(page)
  await page.goto(company);await expect(page.getByRole('button',{name:'この招待を受け取る',exact:true})).toBeVisible()
  await request.post(fixture+'/__form',{data:{[condition]:true}})
  await page.getByRole('button',{name:'この招待を受け取る',exact:true}).click()
  await expect(page.getByText(condition==='expired'?'この招待は有効期限が切れています':'この招待は無効化されました',{exact:true})).toBeVisible()
  expect((await state(request)).claimed).toBe(0);expect((await profile(request)).client_id).toBeNull()
  await page.reload();await expect(page.getByText('招待リンクを開けません',{exact:true})).toBeVisible()
  expect(await scopedRows(request,await browserJwt(context),'inventory_items')).toHaveLength(0)
 })
}

test('wrong signed-in recipient switches accounts; direct RPC and unconfirmed matching email cannot bypass canonical Auth checks',async({page,context,request})=>{
 const wrong=await sessionFor(context,request,'other')
 await page.goto(company)
 await expect(page.getByRole('button',{name:'この招待を受け取る',exact:true})).toBeDisabled()
 const wrongClaim=await request.post(fixture+'/rest/v1/rpc/claim_account_invite',{headers:{Authorization:'Bearer '+wrong},data:{p_token:'synthetic-company-invitation-only'}})
 expect((await wrongClaim.json()).success).toBe(false)
 const unconfirmed=await sessionFor(context,request,'unconfirmed')
 const unconfirmedClaim=await request.post(fixture+'/rest/v1/rpc/claim_account_invite',{headers:{Authorization:'Bearer '+unconfirmed},data:{p_token:'synthetic-company-invitation-only'}})
 expect((await unconfirmedClaim.json()).success).toBe(false)
 await context.clearCookies();await sessionFor(context,request,'other');await page.goto(company)
 await page.getByRole('button',{name:'別のアカウントを使う (ログアウト)',exact:true}).click()
 await expect(page.getByLabel('メールアドレス',{exact:true})).toBeVisible()
 await confirm(page);await setPassword(page);await claim(page);await expect(page).toHaveURL(/\/portal$/)
 expect((await state(request)).claimed).toBe(1)
})

test('expired Auth invitation cannot issue a session, set a password or consume the still-pending company invitation',async({page,request})=>{
 await request.post(fixture+'/__configure',{data:{authExpired:true}})
 await page.goto(confirmation);await expect(page).toHaveURL(/\/login\?error=auth_callback_error$/)
 await page.goto('/reset-password')
 await page.getByLabel('新しいパスワード',{exact:true}).fill(password)
 await page.getByLabel('確認用パスワード',{exact:true}).fill(password)
 await page.getByRole('button',{name:'この内容で設定する'}).click()
 await expect(page.getByRole('alert').filter({hasText:'セッションが切れています'})).toBeVisible()
 const s=await state(request);expect(s.updates).toBe(0);expect(s.claimed).toBe(0);expect(s.forms[0].status).toBe('pending')
})

test('temporary password and claim failures can retry without premature binding or duplicate consumption',async({page,request})=>{
 await confirm(page)
 await request.post(fixture+'/__configure',{data:{failPasswordOnce:true}})
 await page.getByLabel('新しいパスワード',{exact:true}).fill(password);await page.getByLabel('確認用パスワード',{exact:true}).fill(password)
 await page.getByRole('button',{name:'この内容で設定する'}).click()
 await expect(page.getByRole('alert').filter({hasText:'パスワードを設定できませんでした。通信状態を確認して、もう一度お試しください。'})).toBeVisible()
 expect((await state(request)).updates).toBe(0)
 await page.getByRole('button',{name:'この内容で設定する'}).click();await expect(page).toHaveURL(/\/portal$/)
 await request.post(fixture+'/__configure',{data:{failClaimOnce:true}})
 await claim(page);await expect(page.getByText('Synthetic temporary claim failure',{exact:true})).toBeVisible()
 expect((await profile(request)).client_id).toBeNull()
 await page.getByRole('button',{name:'この招待を受け取る',exact:true}).click();await expect(page).toHaveURL(/\/portal$/)
 const s=await state(request);expect(s.updates).toBe(1);expect(s.claimed).toBe(1)
})

test('password and company-claim double submission causes one update and one successful claim',async({page,request})=>{
 await confirm(page)
 await request.post(fixture+'/__configure',{data:{holdPassword:true}})
 await page.getByLabel('新しいパスワード',{exact:true}).fill(password);await page.getByLabel('確認用パスワード',{exact:true}).fill(password)
 await page.locator('form').evaluate(form=>{(form as HTMLFormElement).requestSubmit();(form as HTMLFormElement).requestSubmit()})
 await expect.poll(async()=>(await state(request)).passwordAttempts).toBe(1)
 await request.post(fixture+'/__release')
 await expect(page).toHaveURL(/\/portal$/)
 await page.goto(company)
 await page.getByRole('button',{name:'この招待を受け取る',exact:true}).evaluate(button=>{(button as HTMLButtonElement).click();(button as HTMLButtonElement).click()})
 await expect(page).toHaveURL(/\/portal$/)
 const s=await state(request);expect(s.passwordAttempts).toBe(1);expect(s.claims).toBe(1);expect(s.claimed).toBe(1)
})


test('losing the confirmation session before password setup blocks safe self-resume and leaves the company invitation pending',async({page,context,request})=>{
 await confirm(page);await context.clearCookies()
 await page.goto('/reset-password')
 await page.getByLabel('新しいパスワード',{exact:true}).fill(password);await page.getByLabel('確認用パスワード',{exact:true}).fill(password)
 await page.getByRole('button',{name:'この内容で設定する'}).click()
 await expect(page.getByRole('alert').filter({hasText:'セッションが切れています'})).toBeVisible()
 await page.goto(confirmation);await expect(page).toHaveURL(/\/login\?error=auth_callback_error$/)
 await page.goto(company);await expect(page.getByLabel('メールアドレス',{exact:true})).toBeVisible()
 const direct=await request.post(fixture+'/rest/v1/rpc/claim_account_invite',{data:{p_token:'synthetic-company-invitation-only'}})
 expect(direct.status()).toBe(403)
 const s=await state(request);expect(s.updates).toBe(0);expect(s.claimed).toBe(0);expect(s.forms[0].status).toBe('pending')
 expect((await profile(request)).client_id).toBeNull()
})

test('an external user cannot alter the invitation target/company or their profile role through direct REST before receipt',async({page,context,request})=>{
 await confirm(page);await setPassword(page)
 const token=await browserJwt(context),headers={Authorization:'Bearer '+token}
 const before=await state(request)
 const changedContext={...before.forms[0].context,client_id:ids.foreignClient,portal_role:'admin'}
 const invitePatch=await request.patch(fixture+'/rest/v1/external_forms',{headers,data:{context:changedContext}})
 const profilePatch=await request.patch(fixture+'/rest/v1/profiles',{headers,data:{role:'admin',client_id:ids.foreignClient}})
 expect(await invitePatch.json()).toEqual([]);expect(await profilePatch.json()).toEqual([])
 expect((await state(request)).forms[0].context).toEqual(before.forms[0].context)
 expect((await profile(request)).role).toBe('client');expect((await profile(request)).client_id).toBeNull()
 await claim(page);await expect(page).toHaveURL(/\/portal$/)
 expect((await profile(request)).client_id).toBe(ids.client)
 expect(await scopedRows(request,token,'clients','?id=eq.'+ids.foreignClient)).toHaveLength(0)
})
