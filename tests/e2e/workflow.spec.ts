import { test, expect } from '@playwright/test'
const deal='/deals/33333333-3333-4333-8333-333333333333'
const jwt=[{alg:'HS256',typ:'JWT'},{sub:'11111111-1111-4111-8111-111111111111',exp:4102444800,iat:1700000000,role:'authenticated'},'fixture'].map(x=>typeof x==='string'?x:Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')
test.beforeEach(async({context,request})=>{
 await context.route('**/*',route=>{const host=new URL(route.request().url()).hostname;return ['127.0.0.1','localhost'].includes(host)?route.continue():route.abort()})
 await request.post('http://127.0.0.1:55440/__reset')
 const session={access_token:jwt,refresh_token:'local-fixture-refresh',expires_at:4102444800,expires_in:3600,token_type:'bearer',user:{id:'11111111-1111-4111-8111-111111111111',role:'authenticated',email:'local@example.test'}}
 await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),domain:'127.0.0.1',path:'/'}])
})
test('staff can reach key workflow pages and recovery routes',async({page})=>{
 for(const path of ['/', '/deals','/deals/new',deal,`${deal}/quote-builder`,'/inventory','/docs','/reset-password']){
  const response=await page.goto(path);expect(response?.status(),path).toBe(200)
  await expect(page.locator('body')).not.toContainText('Application error')
 }
 const callback=await page.goto('/auth/callback?next=//evil.test');expect(['127.0.0.1','localhost']).toContain(new URL(page.url()).hostname);expect(callback?.status()).toBe(200)
})
test('quote approval and status persist through real server actions against local fixture',async({page})=>{
 await page.goto(`${deal}/quote-builder`)
 await page.getByRole('button',{name:'この価格で採用'}).click()
 await expect(page.getByText('この価格を採用しました',{exact:true})).toBeVisible()
 await expect(page.getByRole('button',{name:'採用を解除',exact:true})).toBeVisible()
 const state=await page.request.get('http://127.0.0.1:55440/__state');expect((await state.json()).deal_quotes[0].status).toBe('approved')
})
test('mobile navigation leaves usable width and step links open the requested work',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto(deal+'?step=4')
 await expect(page.getByText('工場の回答を記録(単価$・型代・MOQ・カートン)',{exact:true}).first()).toBeVisible()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
 await page.getByText('メニュー',{exact:false}).first().click();await expect(page.getByRole('link',{name:'在庫管理'})).toBeVisible()
})

test('new deal wizard creates a case and opens its product specification step',async({page})=>{
 await page.goto('/deals/new')
 await page.getByLabel('クライアント',{exact:true}).selectOption('22222222-2222-4222-8222-222222222222')
 await page.getByRole('button',{name:'パウチ',exact:true}).click()
 await page.getByRole('button',{name:'この内容で案件をつくる'}).click()
 await expect(page).toHaveURL(/\/deals\/[0-9a-f-]{36}$/)
 await expect(page.getByText('仕様を固める(サイズ・素材・印刷)',{exact:true})).toBeVisible()
 const state=await (await page.request.get('http://127.0.0.1:55440/__state')).json()
 expect(state.deals).toHaveLength(2);expect(state.deal_products).toHaveLength(2)
})
test('issued quotation is saved with snapshot and can be reprinted after live price changes',async({page})=>{
 await page.goto(deal+'/quote-builder');await page.getByRole('button',{name:'この価格で採用'}).click();await expect(page.getByRole('button',{name:'採用を解除',exact:true})).toBeVisible()
 await page.goto(deal+'/documents')
 await page.getByRole('button',{name:'この内容で発行する',exact:false}).click()
 await expect(page.getByText('発行履歴 (1)',{exact:true})).toBeVisible()
 const state=await (await page.request.get('http://127.0.0.1:55440/__state')).json()
 expect(state.documents[0].metadata.snapshot.quotes[0].total_billing_tax_jpy).toBe(39600)
 await page.request.patch('http://127.0.0.1:55440/rest/v1/deal_quotes?id=eq.66666666-6666-4666-8666-666666666666',{data:{total_billing_tax_jpy:999999}})
 await page.reload();await page.getByRole('button',{name:/QUO-.*を表示/}).click()
 await expect(page.locator('.document-frame')).toContainText('39,600')
 await expect(page.locator('.document-frame')).not.toContainText('999,999')
 await page.emulateMedia({media:'print'})
 await expect(page.locator('.document-frame')).toBeVisible()
 await expect(page.getByRole('button',{name:'JPY',exact:true})).not.toBeVisible()
 await page.screenshot({path:'test-results/quotation-print.png',fullPage:true})
})
test('data failure offers recovery instead of masquerading as empty inventory',async({page,request})=>{
 await request.post('http://127.0.0.1:55440/__fail',{data:{table:'inventory_items'}})
 await page.goto('/inventory')
 await expect(page.getByRole('heading',{name:'画面を読み込めませんでした'})).toBeVisible()
 await page.getByRole('button',{name:'もう一度読み込む'}).click()
 await expect(page.getByRole('heading',{name:'画面を読み込めませんでした'})).not.toBeVisible()
})
test('password recovery page remains public without a session',async({page,context})=>{
 await context.clearCookies();await page.goto('/reset-password')
 await expect(page.getByRole('heading',{name:'新しいパスワードを設定'})).toBeVisible()
 expect(new URL(page.url()).pathname).toBe('/reset-password')
})

test('invoice step opens the invoice issuer and prints its modal',async({page})=>{
 await page.goto(deal+'?step=8')
 await page.getByRole('button',{name:'請求書をつくる',exact:true}).click()
 await expect(page.getByRole('dialog',{name:'帳票発行'})).toBeVisible()
 await expect(page.locator('.document-frame')).toContainText('請求書')
 await page.emulateMedia({media:'print'})
 await expect(page.locator('.document-frame')).toBeVisible()
 await page.screenshot({path:'test-results/invoice-modal-print.png',fullPage:true})
})
