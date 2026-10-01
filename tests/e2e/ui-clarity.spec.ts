import {test,expect} from '@playwright/test'
import {mkdir} from 'node:fs/promises'
const fixture='http://127.0.0.1:55440', actor='11111111-1111-4111-8111-111111111111'
const deal='/deals/33333333-3333-4333-8333-333333333333'
const token=[{alg:'HS256',typ:'JWT'},{sub:actor,exp:4102444800,iat:1700000000,role:'authenticated'},'fixture'].map(x=>typeof x==='string'?x:Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')
test.beforeEach(async({context,request})=>{
 await context.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort())
 await request.post(fixture+'/__reset')
 const session={access_token:token,refresh_token:'synthetic-refresh',expires_at:4102444800,expires_in:3600,token_type:'bearer',user:{id:actor,role:'authenticated',email:'synthetic@example.test'}}
 await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),domain:'127.0.0.1',path:'/'}])
})
test('record synthetic desktop and mobile screens across sales/client/factory/logistics',async({page,request})=>{
 const phase=process.env.UI_CAPTURE_PHASE==='before'?'before':'after'
 const directory=`tmp/ui-clarity/${phase}`;await mkdir(directory,{recursive:true})
 const cases=[{name:'deal',url:deal,role:'sales'},{name:'new-deal',url:'/deals/new',role:'sales'},{name:'rfq',url:deal+'?step=3',role:'sales'},{name:'pricing',url:deal+'?step=6',role:'sales'},{name:'storage-invoice',url:'/inventory?tab=fees',role:'sales'},{name:'client',url:'/portal',role:'client'},{name:'factory',url:'/factory',role:'factory'},{name:'logistics',url:'/logistics',role:'logistics'}]
 for(const item of cases){
  await request.post(fixture+'/__role',{data:{role:item.role}})
  for(const width of [1280,390]){
   await page.setViewportSize({width,height:900});const response=await page.goto(item.url)
   expect(response?.status()).toBeLessThan(400);await expect(page.locator('body')).not.toContainText('Application error')
   await page.evaluate(()=>document.fonts.ready);if(item.name==='storage-invoice')await expect(page.getByText('請求履歴を読み込んでいます…',{exact:true})).toHaveCount(0);await page.screenshot({path:`${directory}/${item.name}-${width}.png`,fullPage:true})
  }
 }
})

test('mobile work stays visible, sections survive reload and Back, and missing inputs explain how to continue',async({page,request})=>{
 await page.setViewportSize({width:390,height:844});await page.goto(deal+'?step=3')
 const next=page.getByRole('button',{name:'見積依頼(RFQ)をつくる',exact:true})
 await expect(next).toBeVisible();expect((await next.boundingBox())!.y).toBeLessThan(740)
 await page.getByRole('combobox',{name:'表示する工程'}).selectOption('5')
 await expect(page).toHaveURL(/step=6/);await page.reload();await expect(page.getByRole('combobox',{name:'表示する工程'})).toHaveValue('5')
 await page.goBack();await expect(page.getByRole('combobox',{name:'表示する工程'})).toHaveValue('2')
 await page.goto('/inventory');await page.getByRole('button',{name:'保管料',exact:true}).click();await expect(page).toHaveURL(/tab=fees/)
 await page.reload();await expect(page.getByRole('button',{name:'保管請求書を作成',exact:true})).toBeVisible()
 await expect(page.getByText('参考: 現在庫の概算・単価設定・在庫証明書',{exact:true})).toBeVisible()
 await page.getByRole('button',{name:'保管請求書を作成',exact:true}).click()
 await expect(page.getByRole('button',{name:'確認した内容で請求書を発行',exact:true})).toBeDisabled()
 await expect(page.locator('#storage-issue-requirement')).toHaveText('クライアントを選択してください')
 await page.getByLabel('クライアント',{exact:true}).selectOption('22222222-2222-4222-8222-222222222222')
 await expect(page.locator('#storage-issue-requirement')).toContainText('請求対象量・単価・税率')
 await page.goto('/deals/new');await expect(page.locator('#deal-create-requirement')).toContainText('クライアント')
 await request.post(fixture+'/__role',{data:{role:'client'}});await page.goto('/portal')
 await page.getByRole('button',{name:'出荷を依頼',exact:true}).click();await expect(page).toHaveURL(/tab=order/)
 await page.reload();await expect(page.getByRole('button',{name:'出荷を依頼',exact:true})).toHaveAttribute('aria-pressed','true')
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
})

test('search returns a clear empty result and reset; warehouse waiting work has no approval control',async({page,request})=>{
 const item='88888888-8888-4888-8888-888888888888',client='22222222-2222-4222-8222-222222222222'
 await request.post(fixture+'/rest/v1/inventory_items',{data:{id:item,client_id:client,item_name:'合成パウチ',quantity_on_hand:1000,cartons_on_hand:10,unit:'pcs'}})
 await page.goto('/inventory');await page.getByRole('searchbox',{name:'商品・クライアントで検索'}).fill('該当しない商品')
 await expect(page.getByText('一致する商品がありません。検索を解除してください。',{exact:true})).toBeVisible()
 await page.getByRole('button',{name:'検索を解除',exact:true}).click();await expect(page.getByText('合成パウチ',{exact:true})).toBeVisible()
 const req='99999999-9999-4999-8999-999999999999'
 await request.post(fixture+'/rest/v1/shipment_requests',{data:{id:req,client_id:client,request_no:'SO-SYNTHETIC',status:'requested',destination_name:'検証用届け先'}})
 await request.post(fixture+'/rest/v1/shipment_request_items',{data:{request_id:req,item_id:item,quantity:100}})
 await request.post(fixture+'/__role',{data:{role:'logistics'}});await page.goto('/logistics?tab=requests')
 await expect(page.getByText('営業の承認待ち 1件',{exact:true})).toBeVisible()
 await expect(page.getByText('営業の承認待ちです。承認後に出荷を記録できます。',{exact:true})).toBeVisible()
 await expect(page.getByRole('button',{name:'内容OK → 確認済みにする',exact:true})).toHaveCount(0)
 await expect(page.getByRole('button',{name:'出荷した → 在庫から引き落とす',exact:true})).toHaveCount(0)
})

test('active staff/external routes and role lists render at desktop and mobile widths using synthetic records only',async({page,context,request})=>{
 test.setTimeout(180000)
 const client='22222222-2222-4222-8222-222222222222',req='99999999-9999-4999-8999-999999999999'
 await request.post(fixture+'/rest/v1/shipment_requests',{data:{id:req,client_id:client,request_no:'SO-SYNTHETIC',status:'confirmed',destination_name:'検証用届け先'}})
 const types=['client_self_registration','factory_self_registration','logistics_self_registration','shipping_self_registration','rfq_response','account_invite']
 const tokens=types.map((_,i)=>String(i+1).repeat(64))
 for(const [i,type] of types.entries())await request.post(fixture+'/rest/v1/external_forms',{data:{id:`a0000000-0000-4000-8000-00000000000${i}`,token:tokens[i],form_type:type,status:'pending',expires_at:new Date(Date.now()+604800000).toISOString(),related_id:req,context:type==='account_invite'?{portal_role:'client',client_id:client,label:'合成検証用カフェ'}:{requested_lines:[{variant_id:'55555555-5555-4555-8555-555555555555',quantities:[1000]}]}}})
 await request.post(fixture+'/rest/v1/rfq_requests',{data:{id:req,deal_id:deal.split('/').pop(),rfq_number:'RFQ-SYNTHETIC',product_ids:['44444444-4444-4444-8444-444444444444'],response_deadline:'2026-10-15'}})
 await request.post(fixture+'/rest/v1/rfq_factory_invitations',{data:{id:req,rfq_id:req,external_form_id:'a0000000-0000-4000-8000-000000000004'}})
 const routes=['/','/deals','/deals?q=synthetic', '/deals/new',deal,deal+'/edit',deal+'/quote-builder',deal+'/documents',deal+'/samples',deal+'/settlement',deal+'/production',deal+'/shipping','/inventory','/inventory?tab=inbound','/inventory?tab=requests','/inventory?tab=shipping','/inventory?tab=fees','/master','/master?tab=factories','/master?tab=staff','/master?tab=logistics','/master?tab=clients&id='+client,'/docs','/analytics','/archive','/settings','/print/request/'+req,'/print/stock/'+client,'/account-invite/'+tokens[5],'/external/'+tokens[0],...['client-registration','factory-registration','logistics-registration','shipping-registration','rfq-response'].map((type,i)=>'/external/'+type+'/'+tokens[i]),'/external/'+'f'.repeat(64)]
 await mkdir('tmp/ui-clarity/routes',{recursive:true});await mkdir('artifacts/ui-final-stage11',{recursive:true})
 for(const [index,url] of routes.entries())for(const width of [1280,390]){
  await page.setViewportSize({width,height:900});expect((await page.goto(url))?.status(),url).toBe(200)
  await expect(page.locator('body')).not.toContainText('Application error')
  await expect(page.locator('body')).not.toContainText('画面を読み込めませんでした')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),url+' mobile overflow').toBe(true)
  await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:`tmp/ui-clarity/routes/${index}-${width}.png`,fullPage:true});if(width===390&&[deal,deal+'/settlement','/inventory'].includes(url))await page.screenshot({path:`artifacts/ui-final-stage11/staff-${url===deal?'case':url.endsWith('settlement')?'settlement':'inventory'}-390.png`,fullPage:true})
 }
 for(const [role,urls] of [['client',['/portal','/portal?tab=order','/portal?tab=history','/portal?tab=shipping','/portal?tab=deals','/portal/invoices','/portal/documents','/portal/shipments']],['factory',['/factory']],['logistics',['/logistics','/logistics?tab=manual','/logistics?tab=requests','/logistics?tab=shipping','/logistics?tab=stock','/logistics/shipments']]] as const){
  await request.post(fixture+'/__role',{data:{role}})
  for(const [index,url] of urls.entries()){
   await page.setViewportSize({width:390,height:900});expect((await page.goto(url))?.status(),url).toBe(200)
   await expect(page.locator('body')).not.toContainText('Application error');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),url+' overflow').toBe(true)
   await page.screenshot({path:`tmp/ui-clarity/routes/${role}-${index}-390.png`,fullPage:true});if(index===0)await page.screenshot({path:`artifacts/ui-final-stage11/${role}-390.png`,fullPage:true})
  }
 }
 await context.clearCookies()
 for(const url of ['/login','/portal/login','/factory/login','/logistics/login','/forgot-password','/reset-password']){
  expect((await page.goto(url))?.status(),url).toBe(200);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 }
})

test('failed overview, analytics, archive and account lists offer recovery instead of false zero results',async({page,request})=>{
 for(const [url,table] of [['/','deals'],['/analytics','deal_quotes'],['/archive','deals'],['/master','clients']]){
  await request.post(fixture+'/__fail',{data:{table}});await page.goto(url)
  await expect(page.getByRole('heading',{name:'画面を読み込めませんでした',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'もう一度読み込む',exact:true}).click()
  await expect(page.getByRole('heading',{name:'画面を読み込めませんでした',exact:true})).toHaveCount(0)
 }
})

test('factory order search and status filter explain empty results and restore the next action',async({page,request})=>{
 const factory='77777777-7777-4777-8777-777777777777'
 for(const [i,status] of ['ordered','cancelled'].entries())await request.post(fixture+'/rest/v1/factory_purchase_orders',{data:{id:`b0000000-0000-4000-8000-00000000000${i}`,factory_id:factory,deal_id:deal.split('/').pop(),order_no:`PO-SYNTH-${i}`,quantity:100,unit_price_usd:1,status,snapshot:{item_name:`Synthetic order ${i}`}}})
 await request.post(fixture+'/__role',{data:{role:'factory'}});await page.goto('/factory');const list=page.getByRole('region',{name:'発注番号・商品で検索 / 搜索订单'})
 await expect(list.getByRole('link',{name:'最終条件・着金・製造開始を確認 / 确认条件及生产'})).toHaveCount(1)
 await expect(list).toContainText('取消済みです。');await list.getByRole('searchbox').fill('no matching order');await expect(list).toContainText('一致する項目がありません。');await list.getByRole('button',{name:'絞り込みを解除'}).click()
 await list.getByRole('combobox').selectOption('ordered');await expect(list.getByRole('link')).toHaveCount(1);await expect(list).toContainText('PO-SYNTH-0');await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
})
