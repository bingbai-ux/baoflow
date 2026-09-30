import { test, expect } from '@playwright/test'
const fixture='http://127.0.0.1:55440'
const deal='/deals/33333333-3333-4333-8333-333333333333'
const userId='11111111-1111-4111-8111-111111111111'
const factories=['77777777-7777-4777-8777-777777777771','77777777-7777-4777-8777-777777777772']
const jwt=[{alg:'HS256',typ:'JWT'},{sub:userId,exp:4102444800,iat:1700000000,role:'authenticated'},'fixture'].map(x=>typeof x==='string'?x:Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')
test.beforeEach(async({context,request})=>{
 await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort())
 await request.post(fixture+'/__reset')
 await request.post(fixture+'/rest/v1/factories',{data:factories.map((id,i)=>({id,factory_name:`検証工場${i+1}`,basic_info_completed:true,contact_email:`factory${i+1}@example.test`}))})
 const session={access_token:jwt,refresh_token:'local-fixture-refresh',expires_at:4102444800,expires_in:3600,token_type:'bearer',user:{id:userId,role:'authenticated',email:'local@example.test'}}
 await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),domain:'127.0.0.1',path:'/'}])
})
test('RFQ retry creates one complete request and copyable links without automatically sending email',async({page,request})=>{
 await page.goto(deal+'?step=3')
 await page.getByRole('button',{name:'見積依頼(RFQ)をつくる',exact:true}).click()
 const dialog=page.getByRole('dialog',{name:'見積依頼を作成',exact:true})
 await dialog.getByLabel('検証工場1',{exact:false}).check()
 await dialog.getByLabel('検証工場2',{exact:false}).check()
 await request.post(fixture+'/__fail',{data:{table:'rfq_form'}})
 await dialog.getByRole('button',{name:'RFQ を作成',exact:true}).click()
 await expect(dialog.getByRole('alert')).toContainText('同じ内容で再試行')
 let state=await (await request.get(fixture+'/__state')).json()
 expect(state.rfq_requests).toHaveLength(0)
 await dialog.getByRole('button',{name:'RFQ を作成',exact:true}).click()
 await expect(page.getByRole('dialog',{name:'見積依頼を作成しました',exact:true})).toBeVisible()
 const done=page.getByRole('dialog',{name:'見積依頼を作成しました',exact:true})
 await expect(done).toContainText('メールはまだ送信していません')
 await expect(done.getByRole('button',{name:'工場にメールを送信する',exact:true})).toHaveCount(2)
 const urls=await done.locator('input[readonly]').evaluateAll(inputs=>inputs.map(input=>(input as HTMLInputElement).value))
 expect(urls).toHaveLength(2)
 for(const url of urls)expect(url).toMatch(/^http:\/\/127\.0\.0\.1:3100\/external\/[0-9a-f]{64}$/)
 state=await (await request.get(fixture+'/__state')).json()
 expect(state.rfq_requests).toHaveLength(1);expect(state.rfq_factory_invitations).toHaveLength(2);expect(state.external_forms).toHaveLength(2)
 expect(state.rfq_creation_requests).toHaveLength(1)
 expect(state.rfq_factory_invitations.every((i:{invitation_sent_at:unknown})=>i.invitation_sent_at===null)).toBe(true)
 await page.goto(urls[0])
 await expect(page.getByRole('button',{name:'Submit quotation / 提交报价',exact:true})).toBeVisible()
 await expect(page.getByText('Your contact',{exact:false})).toBeVisible()
 // Email buttons are deliberately not clicked: no real provider calls are authorized.
})
