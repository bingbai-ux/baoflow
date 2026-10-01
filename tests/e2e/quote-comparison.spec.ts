import { test, expect } from '@playwright/test'
const deal='/deals/33333333-3333-4333-8333-333333333333'
const jwt=[{alg:'HS256',typ:'JWT'},{sub:'11111111-1111-4111-8111-111111111111',exp:4102444800,iat:1700000000,role:'authenticated'},'fixture'].map(x=>typeof x==='string'?x:Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')
test.beforeEach(async({context,request})=>{
 await context.route('**/*',route=>{const host=new URL(route.request().url()).hostname;return ['127.0.0.1','localhost'].includes(host)?route.continue():route.abort()})
 await request.post('http://127.0.0.1:55440/__reset')
 const session={access_token:jwt,refresh_token:'local-fixture-refresh',expires_at:4102444800,expires_in:3600,token_type:'bearer',user:{id:'11111111-1111-4111-8111-111111111111',role:'authenticated',email:'local@example.test'}}
 await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),domain:'127.0.0.1',path:'/'}])
})

const fixture='http://127.0.0.1:55440'
const product2='44444444-4444-4444-8444-444444444445',variant2='55555555-5555-4555-8555-555555555556'
const factoryA='77777777-7777-4777-8777-777777777777',factoryB='88888888-8888-4888-8888-888888888888'
test('comparison filters preserve product, quantity and factory boundaries without writes',async({page,request})=>{
 await request.post(fixture+'/rest/v1/factories',{data:[{id:factoryA,factory_name:'Factory A'},{id:factoryB,factory_name:'Factory B'}]})
 await request.patch(fixture+'/rest/v1/deal_quotes?id=eq.66666666-6666-4666-8666-666666666666',{data:{factory_id:factoryA,factory_response:{line:{pcs_per_carton:100,carton_w_cm:30,carton_h_cm:40,carton_d_cm:30,gross_weight_kg:10,production_lead_days:15}}}})
 await request.post(fixture+'/rest/v1/deal_products',{data:{id:product2,deal_id:deal.split('/').pop(),product_no:2,description:'Second pouch'}})
 await request.post(fixture+'/rest/v1/deal_product_variants',{data:{id:variant2,product_id:product2,variant_label:'200g',material:'PET',deal_products:{deal_id:deal.split('/').pop()}}})
 const baseline=await(await request.get(fixture+'/__state')).json()
 await request.post(fixture+'/rest/v1/deal_quotes',{data:[{...baseline.deal_quotes[0],id:'99999999-9999-4999-8999-999999999991',factory_id:factoryB,quantity:2000},{...baseline.deal_quotes[0],id:'99999999-9999-4999-8999-999999999992',variant_id:variant2,factory_id:factoryB,quantity:1000}]})
 const before=await(await request.get(fixture+'/__state')).json()
 await page.goto(deal+'/quote-builder');await page.getByText('商品・数量・工場で絞込',{exact:false}).click();await expect(page.getByRole('status')).toContainText('3件 / 全3件')
 await page.getByRole('combobox',{name:'商品',exact:true}).selectOption(product2);await expect(page.getByRole('status')).toContainText('1件 / 全3件')
 await page.getByRole('combobox',{name:'比較数量',exact:true}).selectOption('2000');await expect(page.getByText('条件に合う見積がありません。',{exact:false})).toBeVisible()
 await page.getByRole('button',{name:'絞込を解除',exact:true}).click();await page.getByRole('combobox',{name:'回答工場',exact:true}).selectOption(factoryA);await expect(page.getByRole('status')).toContainText('1件 / 全3件')
 await page.getByText('回答条件・費用内訳',{exact:true}).click();await expect(page.getByText('工場製造納期:',{exact:false})).toContainText('15 日');await expect(page.getByText('送料の適用料金表',{exact:false})).toContainText('要確認')
 await expect(page.getByText('取得元・取得時刻は',{exact:false})).toBeVisible()
 await page.getByText('商品・数量・工場で絞込',{exact:false}).click()
 for(const width of [1366,390]){await page.setViewportSize({width,height:900});await page.getByRole('button',{name:'この価格で採用',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:`tmp/quote-stage3/comparison-${width}.png`,fullPage:false});expect(await page.locator('main').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);await expect(page.getByRole('button',{name:'この価格で採用',exact:true})).toBeInViewport()}
 expect((await(await request.get(fixture+'/__state')).json()).deal_quotes).toEqual(before.deal_quotes)
})
