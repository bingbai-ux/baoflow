import {test,expect} from '@playwright/test'
import {mkdir} from 'node:fs/promises'
// Headless compositor capture only; transaction/authorization use the real local test.
test.use({launchOptions:{args:['--disable-gpu']}})
test('sample workbench mobile shell, scroll and filtered empty state',async({page,context,request})=>{
 await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort())
 await request.post('http://127.0.0.1:55440/__reset')
 const user='11111111-1111-4111-8111-111111111111',deal='33333333-3333-4333-8333-333333333333'
 const jwt=[{alg:'HS256',typ:'JWT'},{sub:user,exp:4102444800,iat:1700000000,role:'authenticated'},'fixture'].map(x=>typeof x==='string'?x:Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')
 const session={access_token:jwt,refresh_token:'local-fixture-refresh',expires_at:4102444800,expires_in:3600,token_type:'bearer',user:{id:user,role:'authenticated',email:'local@example.test'}}
 await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),domain:'127.0.0.1',path:'/'}])
 const factory='77777777-7777-4777-8777-777777777777';await request.post('http://127.0.0.1:55440/rest/v1/factories',{data:{id:factory,factory_name:'合成工場'}})
 for(const round of [1,2])await request.post('http://127.0.0.1:55440/rest/v1/sample_rounds',{data:{deal_id:deal,product_id:'44444444-4444-4444-8444-444444444444',variant_id:'55555555-5555-4555-8555-555555555555',factory_id:factory,round_number:round,quantity:2,due_date:'2026-10-20',note:'合成サンプル・未送信',status:'requested'}})
 await page.setViewportSize({width:390,height:844});await page.goto(`/deals/${deal}/samples`);await expect(page.getByRole('button',{name:'次のサンプルを手配記録',exact:true})).toBeEnabled()
 await expect(page.locator('summary').filter({hasText:'メニューを開く / 閉じる'})).toHaveCount(1)
 await page.evaluate(async()=>{await document.fonts.ready})
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await mkdir('artifacts/sample-stage3',{recursive:true});await page.locator('#main-content').screenshot({path:'artifacts/sample-stage3/workbench-main-390.png'})
 const main=page.locator('#main-content');await main.evaluate(e=>{e.scrollTop=e.scrollHeight});await expect(page.getByText('2回目',{exact:false})).toBeVisible();await main.evaluate(e=>{e.scrollTop=0})
 await page.getByLabel('サンプル・工場・費目を検索',{exact:true}).fill('一致しない条件');await expect(page.getByRole('status').filter({hasText:'検索条件に合う記録はありません'})).toBeVisible();await page.getByLabel('サンプル・工場・費目を検索',{exact:true}).fill('')
})
