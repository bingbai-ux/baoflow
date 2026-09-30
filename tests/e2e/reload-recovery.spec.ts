import { test, expect, type Page } from '@playwright/test'
const fixture='http://127.0.0.1:55440'
const actor='11111111-1111-4111-8111-111111111111'
const deal='/deals/33333333-3333-4333-8333-333333333333'
const jwt=[{alg:'HS256',typ:'JWT'},{sub:actor,exp:4102444800,iat:1700000000,role:'authenticated'},'fixture'].map(x=>typeof x==='string'?x:Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')
test.beforeEach(async({context,request})=>{
 await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort())
 await request.post(fixture+'/__reset')
 const session={access_token:jwt,refresh_token:'local-fixture-refresh',expires_at:4102444800,expires_in:3600,token_type:'bearer',user:{id:actor,role:'authenticated',email:'local@example.test'}}
 await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),domain:'127.0.0.1',path:'/'}])
})
// Let the actual Next action commit, then lose only its HTTP response.
async function loseSaveResponse(page:Page, trigger:()=>Promise<unknown>){
 let resolve!:()=>void
 const lost=new Promise<void>(r=>resolve=r)
 await page.route('**/*',async route=>{
  if(route.request().method()==='POST'&&route.request().headers()['next-action']){
   await route.fetch();await route.abort('failed');resolve()
  }else await route.fallback()
 })
 await trigger();await lost;await page.unroute('**/*')
}
async function pending(page:Page,scope:string){
 const entry=await page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)!),`baoflow-request:v1:${actor}:${scope}`)
 expect(Object.keys(entry).sort()).toEqual(['id','signature'])
 return entry
}
test('lost deal response restores the saved case after reload without another creation',async({page,request})=>{
 await page.goto('/deals/new')
 await page.getByLabel('クライアント',{exact:true}).selectOption('22222222-2222-4222-8222-222222222222')
 await page.getByRole('button',{name:'パウチ',exact:true}).click()
 const submit=page.getByRole('button',{name:'この内容で案件をつくる'})
 await expect(submit).toBeEnabled()
 await loseSaveResponse(page,()=>submit.click())
 await pending(page,'deal/new')
 const saved=await(await request.get(fixture+'/__state')).json()
 const id=saved.wizard_requests[0].result.dealId
 await page.reload();await expect(page).toHaveURL(new RegExp(`/deals/${id}$`))
 expect((await(await request.get(fixture+'/__state')).json()).deals).toHaveLength(2)
})
test('lost RFQ response restores the same invitation links after reload',async({page,request})=>{
 await request.post(fixture+'/rest/v1/factories',{data:{id:'77777777-7777-4777-8777-777777777771',factory_name:'復帰検証工場',basic_info_completed:true,contact_email:'test@example.test'}})
 await page.goto(deal+'?step=3')
 await page.getByRole('button',{name:'見積依頼(RFQ)をつくる',exact:true}).click()
 await page.getByLabel('復帰検証工場',{exact:false}).check()
 const submit=page.getByRole('button',{name:'RFQ を作成',exact:true})
 await expect(submit).toBeEnabled();await loseSaveResponse(page,()=>submit.click())
 await pending(page,`rfq/${deal.split('/').pop()}`)
 const saved=await(await request.get(fixture+'/__state')).json()
 await page.reload();await page.getByRole('button',{name:'見積依頼(RFQ)をつくる',exact:true}).click()
 const done=page.getByRole('dialog',{name:'見積依頼を作成しました',exact:true})
 await expect(done).toBeVisible()
 await expect(done.locator('input[readonly]')).toHaveValue(`http://127.0.0.1:3100/external/${saved.rfq_creation_requests[0].result.invitations[0].formToken}`)
 expect((await(await request.get(fixture+'/__state')).json()).rfq_requests).toHaveLength(1)
})
test('lost document response restores its issued snapshot without a second number',async({page,request})=>{
 await page.goto(deal+'/quote-builder');await page.getByRole('button',{name:'この価格で採用'}).click();await expect(page.getByRole('button',{name:'採用を解除',exact:true})).toBeVisible()
 await page.goto(deal+'/documents')
 const submit=page.getByRole('button',{name:'この内容で発行する',exact:false})
 await expect(submit).toBeEnabled();await loseSaveResponse(page,()=>submit.click())
 await pending(page,`document/${deal.split('/').pop()}/quotation`)
 await page.reload();await expect(page.getByText('発行履歴 (1)',{exact:true})).toBeVisible()
 await expect(page.locator('.document-frame')).toContainText('39,600')
 expect((await(await request.get(fixture+'/__state')).json()).documents).toHaveLength(1)
 await expect.poll(()=>page.evaluate(key=>sessionStorage.getItem(key),`baoflow-request:v1:${actor}:document/${deal.split('/').pop()}/quotation`)).toBeNull()
})
