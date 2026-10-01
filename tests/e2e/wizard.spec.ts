import { test, expect } from '@playwright/test'
const fixture='http://127.0.0.1:55440'
const userId='11111111-1111-4111-8111-111111111111'
const jwt=[{alg:'HS256',typ:'JWT'},{sub:userId,exp:4102444800,iat:1700000000,role:'authenticated'},'fixture'].map(x=>typeof x==='string'?x:Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')
test.beforeEach(async({context,request})=>{
 await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort())
 await request.post(fixture+'/__reset')
 const session={access_token:jwt,refresh_token:'local-fixture-refresh',expires_at:4102444800,expires_in:3600,token_type:'bearer',user:{id:userId,role:'authenticated',email:'local@example.test'}}
 await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),domain:'127.0.0.1',path:'/'}])
})
// This verifies browser -> actual Next server action -> synthetic RPC wiring.
// PostgreSQL transaction semantics are verified by verify-wizard-atomic.mjs.
test('wizard retries save once, creates specification and adds a quantity through server actions',async({page,request})=>{
 await page.goto('/deals/new')
 await page.getByLabel('クライアント',{exact:true}).selectOption('22222222-2222-4222-8222-222222222222')
 await page.getByRole('button',{name:'パウチ',exact:true}).click()
 await request.post(fixture+'/__fail',{data:{table:'wizard_atomic'}})
 const failedActionPromise=page.waitForRequest(req=>req.method()==='POST'&&!!req.headers()['next-action'])
 await page.getByRole('button',{name:'案件を保存して商品仕様へ'}).click()
 const failedAction=await failedActionPromise
 await expect(page.getByText('Local simulated database failure',{exact:true})).toBeVisible()
 const actionPromise=page.waitForRequest(req=>req.method()==='POST'&&!!req.headers()['next-action'])
 await page.getByRole('button',{name:'案件を保存して商品仕様へ'}).click()
 const action=await actionPromise
 expect(action.postData()).toBe(failedAction.postData())
 await expect(page).toHaveURL(/\/deals\/[0-9a-f-]{36}(?:\?.*)?$/)
 const state=async()=>await(await request.get(fixture+'/__state')).json()
 expect((await state()).deals).toHaveLength(2)
 // Replay exactly the request whose response could have been lost in transit.
 await page.request.post('/deals/new',{headers:{'next-action':action.headers()['next-action'],'content-type':action.headers()['content-type'],'next-router-state-tree':action.headers()['next-router-state-tree'],origin:'http://127.0.0.1:3100',accept:'text/x-component'},data:action.postData()!})
 expect((await state()).deals).toHaveLength(2)
 expect((await state()).wizard_requests).toHaveLength(1)
 await page.getByRole('button',{name:'仕様・数量を入力',exact:true}).click()
 await page.getByLabel('数量パターン 1',{exact:true}).fill('1000')
 await page.getByLabel('数量パターン 2',{exact:true}).fill('2000')
 await page.getByRole('button',{name:'仕様と数量を保存',exact:true}).click()
 await expect(page.getByText('商品仕様と数量パターンを保存しました',{exact:true})).toBeVisible()
 await expect(page.getByRole('button',{name:'仕様・数量を入力',exact:true})).not.toBeVisible()
 const afterSpec=await state()
 const newDeal=afterSpec.deals.find((d:{id:string})=>d.id!=='33333333-3333-4333-8333-333333333333')
 expect(afterSpec.deal_quotes.filter((q:{deal_id:string})=>q.deal_id===newDeal.id)).toHaveLength(2)
 await page.goto(new URL(page.url()).pathname+'?step=2')
 await page.getByRole('button',{name:'数量を追加',exact:true}).filter({visible:true}).click()
 await page.getByPlaceholder('数量', {exact:true}).fill('3000')
 await page.getByRole('button',{name:'追加',exact:true}).click()
 await expect(page.getByText('数量パターンを追加しました',{exact:true})).toBeVisible()
 expect((await state()).deal_quotes.filter((q:{deal_id:string})=>q.deal_id===newDeal.id)).toHaveLength(3)
})
