import {test,expect} from '@playwright/test'
import {createClient} from '@supabase/supabase-js'
import {randomUUID} from 'node:crypto'
const url=process.env.LOCAL_SUPABASE_URL!
if(url!=='http://127.0.0.1:55321')throw Error('This test refuses non-local databases')
const admin=createClient(url,process.env.LOCAL_SUPABASE_SERVICE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}})
const publicClient=createClient(url,process.env.LOCAL_SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false}})
const clientId=randomUUID(),factoryId=randomUUID(),factoryName=`代表検証工場 ${factoryId}`
test('actual local Supabase representative workflow with distinct authenticated business roles',async({page,context})=>{
 const createdUsers:string[]=[];let currentDealId:string|undefined
 const sessions=new Map<string,unknown>()
 try{
  const c=await admin.from('clients').insert({id:clientId,company_name:'Synthetic browser client'});if(c.error)throw Error(c.error.message)
  const f=await admin.from('factories').insert({id:factoryId,factory_name:factoryName,basic_info_completed:true});if(f.error)throw Error(f.error.message)
  const catalog=await admin.from('product_catalog').select('id').eq('level',1).eq('name','パウチ')
  if(catalog.error)throw Error(catalog.error.message)
  if(!catalog.data.length){const seeded=await admin.from('product_catalog').insert({level:1,name:'パウチ',sort:0});if(seeded.error)throw Error(seeded.error.message)}
  for(const role of ['sales','client','factory','logistics']){
   const email=`${role}-${randomUUID()}@example.test`,password=randomUUID()+randomUUID()
   const created=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:`Synthetic ${role}`}})
   if(created.error||!created.data.user)throw Error('Local test user creation failed')
   createdUsers.push(created.data.user.id)
   const profile=await admin.from('profiles').update({role,client_id:role==='client'?clientId:null,factory_id:role==='factory'?factoryId:null}).eq('id',created.data.user.id)
   if(profile.error)throw Error(profile.error.message)
   const logged=await publicClient.auth.signInWithPassword({email,password});if(logged.error||!logged.data.session)throw Error('Local authentication failed')
   sessions.set(role,logged.data.session)
  }
  await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort())
  const role=async(name:string)=>{await context.clearCookies();await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(sessions.get(name))).toString('base64url'),domain:'127.0.0.1',path:'/'}])}
  await role('sales')
  const state=async()=>{
   const dealResult=await admin.from('deals').select('*').eq('client_id',clientId);if(dealResult.error)throw Error(dealResult.error.message)
   const deals=dealResult.data;const ids=deals.map(d=>d.id);currentDealId=ids[0]
   const q=await admin.from('deal_quotes').select('*').in('deal_id',ids), docs=await admin.from('documents').select('*').in('deal_id',ids),orders=await admin.from('factory_purchase_orders').select('*').in('deal_id',ids),items=await admin.from('inventory_items').select('*').eq('client_id',clientId),requests=await admin.from('shipment_requests').select('*').eq('client_id',clientId)
   for(const r of [q,docs,orders,items,requests])if(r.error)throw Error(r.error.message)
   return {deals,deal_quotes:q.data!,documents:docs.data!,factory_purchase_orders:orders.data!,inventory_items:items.data!,shipment_requests:requests.data!}
  }
 await page.goto('/deals/new');await page.getByLabel('クライアント',{exact:true}).selectOption(clientId);await page.getByRole('button',{name:'パウチ',exact:true}).click();await page.getByRole('button',{name:'この内容で案件をつくる'}).click();await expect(page).toHaveURL(/\/deals\/[0-9a-f-]{36}$/)
 const dealPath=new URL(page.url()).pathname, dealId=dealPath.split('/').pop()
 await page.getByRole('button',{name:'仕様を選ぶ →',exact:true}).click();await page.getByRole('button',{name:'中分類をスキップ',exact:false}).click();await page.getByRole('button',{name:'次へ: 数量 →',exact:true}).click();await page.getByPlaceholder('例: 1000',{exact:true}).first().fill('1000');await page.getByRole('button',{name:'この内容で登録する',exact:true}).click();await expect(page.getByText('商品仕様を登録しました',{exact:true})).toBeVisible()
 await page.goto(dealPath+'?step=3');await page.getByRole('button',{name:'見積依頼(RFQ)をつくる',exact:true}).click();const rfq=page.getByRole('dialog',{name:'見積依頼を作成',exact:true});await rfq.getByLabel(factoryName,{exact:false}).check();await rfq.getByRole('button',{name:'RFQ を作成',exact:true}).click();await expect(page.getByRole('dialog',{name:'見積依頼を作成しました',exact:true})).toBeVisible()
 await role('factory');await page.goto('/factory');await page.getByRole('link',{name:'Submit quotation / 提交报价 →',exact:true}).click();await expect(page.getByText('Quantity / 数量: 1,000 pcs',{exact:false})).toBeVisible()
 await expect(page.getByLabel('Unit USD / 单价',{exact:true})).toBeEnabled();
 for(const [label,value] of [['Unit USD / 单价','0.1'],['MOQ','1000'],['PCS/CTN','100'],['Lead days / 交期','15'],['Carton W cm','30'],['Carton H cm','40'],['Carton D cm','30'],['G.W kg','10']])await page.getByLabel(label,{exact:true}).fill(value)
 await page.getByLabel('Unit USD / 单价',{exact:true}).fill('0.1');await expect(page.getByLabel('Unit USD / 单价',{exact:true})).toHaveValue('0.1');
 await page.getByRole('button',{name:'Submit quotation / 提交报价',exact:true}).click();await expect(page.getByText('Thank you for your quotation.',{exact:false})).toBeVisible()
 await role('sales');await page.goto(dealPath+'/quote-builder');await page.getByRole('button',{name:'工場回答から売値を計算',exact:true}).click();await expect(page.getByText('工場回答のカートン条件から原価・売値を計算しました',{exact:true})).toBeVisible();await page.getByRole('button',{name:'この価格で採用',exact:true}).and(page.locator(':enabled')).click();await expect(page.getByRole('button',{name:'採用を解除',exact:true})).toBeVisible()
 const quote=(await state()).deal_quotes.find((q:{deal_id:string,status:string})=>q.deal_id===dealId&&q.status==='approved');expect(quote.quantity).toBe(1000);expect(quote.factory_id).toBe(factoryId)
 await page.goto(dealPath+'/documents');await page.getByRole('button',{name:'この内容で発行する',exact:true}).click();await expect(page.getByText('発行履歴 (1)',{exact:true})).toBeVisible()
 await page.goto(dealPath+'?step=7');await page.getByRole('button',{name:'承認された → 見積確定へ',exact:true}).click();await expect.poll(async()=>(await state()).deals.find((d:{id:string})=>d.id===dealId).simple_status).toBe('quote_confirmed')
 await page.goto(dealPath+'?step=8');await page.getByRole('button',{name:'請求書をつくる',exact:true}).click();await page.getByRole('button',{name:'この内容で発行する',exact:true}).click();await expect(page.getByText('発行履歴 (1)',{exact:true})).toBeVisible();await page.getByRole('button',{name:'閉じる',exact:true}).click();await page.getByRole('button',{name:'入金を確認した → 入金完了へ',exact:true}).click();await expect.poll(async()=>(await state()).deals.find((d:{id:string})=>d.id===dealId).simple_status).toBe('paid')
 await page.goto(dealPath+'?step=9');await page.getByRole('button',{name:'最終確認できた → 入稿データ確認完了へ',exact:true}).click();await expect.poll(async()=>(await state()).deals.find((d:{id:string})=>d.id===dealId).simple_status).toBe('data_confirmed')
 await page.goto(dealPath+'?step=10');await page.getByRole('button',{name:'この内容で工場に発注する',exact:true}).click();await expect(page.getByText('工場発注を保存しました',{exact:true})).toBeVisible();await page.getByRole('button',{name:'発注内容を確認した → 製作中へ',exact:true}).click();await expect.poll(async()=>(await state()).deals.find((d:{id:string})=>d.id===dealId).simple_status).toBe('in_production')
 await role('factory');await page.goto('/factory');await expect(page.getByText('Purchase orders / 工厂订单',{exact:true})).toBeVisible();await expect(page.getByText('1,000 pcs · USD 0.1000 / pc',{exact:false})).toBeVisible()
 await role('sales');await page.goto(dealPath+'?step=11');await page.getByRole('button',{name:'工場が発送した → 工場発送完了へ',exact:true}).click();await expect.poll(async()=>(await state()).deals.find((d:{id:string})=>d.id===dealId).simple_status).toBe('shipped');await page.getByRole('button',{name:/を入庫予定にする$/}).click();await expect(page.getByText('発注の数量・仕様で入庫予定を保存しました',{exact:true})).toBeVisible()
 await role('logistics');await page.goto('/logistics');await page.getByRole('button',{name:'届いた → 検収して入庫',exact:true}).click();await page.getByRole('button',{name:'この数で入庫を確定する',exact:true}).click();await expect.poll(async()=>(await state()).inventory_items[0]?.quantity_on_hand).toBe(1000)
 await role('client');await page.goto('/portal');await page.getByRole('button',{name:'発注する',exact:true}).click();await page.locator('input[type="number"]').fill('1000');await page.getByPlaceholder('例: 渋谷店').fill('代表検証店舗');await page.getByRole('button',{name:'1品目をこの内容で発注する',exact:true}).click();await expect.poll(async()=>(await state()).shipment_requests.length).toBe(1)
 await role('sales');await page.goto('/inventory?tab=requests');await page.getByRole('button',{name:'内容OK → 確認済みにする',exact:true}).click();await expect.poll(async()=>(await state()).shipment_requests[0].status).toBe('confirmed')
 await role('logistics');await page.goto('/logistics');await page.getByRole('button',{name:/出荷依頼 \(/}).click();await page.getByRole('button',{name:'出荷した → 在庫から引き落とす',exact:true}).click();await expect.poll(async()=>(await state()).inventory_items[0].quantity_on_hand).toBe(0);await page.getByRole('button',{name:'届いた → 納品完了',exact:true}).click();await expect.poll(async()=>(await state()).shipment_requests[0].status).toBe('delivered')
 await role('sales');await page.goto(dealPath+'?step=12');await page.getByRole('button',{name:'納品できた → 納品完了へ',exact:true}).click();await expect.poll(async()=>(await state()).deals.find((d:{id:string})=>d.id===dealId).simple_status).toBe('delivered');
 const final=await state();expect(final.documents.filter((d:{deal_id:string})=>d.deal_id===dealId).map((d:{document_type:string})=>d.document_type).sort()).toEqual(['invoice','quotation']);expect(final.factory_purchase_orders[0].quantity).toBe(1000)

 console.log('PASS actual local Auth/PostgREST/Postgres/browser: case, specification, RFQ, factory response, price, adoption, quotation/invoice, purchase order, factory portal, receipt, client request, staff confirmation, warehouse shipment and delivery')
 }finally{
  // Synthetic records stay in the isolated DB for inspection; no local credentials are saved.
  for(const id of createdUsers)await admin.auth.admin.deleteUser(id)
 }
})
