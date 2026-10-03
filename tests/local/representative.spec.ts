import {test,expect} from '@playwright/test'
import {createClient} from '@supabase/supabase-js'
import {randomUUID} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
const url=process.env.LOCAL_SUPABASE_URL!
if(url!=='http://127.0.0.1:55321')throw Error('This test refuses non-local databases')
const admin=createClient(url,process.env.LOCAL_SUPABASE_SERVICE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}})
const publicClient=createClient(url,process.env.LOCAL_SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false}})
const clientId=randomUUID(),clientName=`Synthetic browser client ${clientId}`,factoryId=randomUUID(),factoryName=`代表検証工場 ${factoryId}`
test('actual local Supabase representative workflow with distinct authenticated business roles',async({page,context})=>{
 const createdUsers:string[]=[];let currentDealId:string|undefined
 const sessions=new Map<string,unknown>()
 try{
  const c=await admin.from('clients').insert({id:clientId,company_name:clientName,email:'client@example.test'});if(c.error)throw Error(c.error.message)
  const config=await admin.from('system_settings').select('id').limit(1).maybeSingle();if(config.error)throw Error(config.error.message)
  const issuer={name:'Synthetic invoice issuer',address:'Synthetic local address',registration_number:'T0000000000000'}
  const configured=config.data?await admin.from('system_settings').update({company_info_phase1:issuer}).eq('id',config.data.id):await admin.from('system_settings').insert({company_info_phase1:issuer})
  if(configured.error)throw Error(configured.error.message)
  const f=await admin.from('factories').insert({id:factoryId,factory_name:factoryName,basic_info_completed:true,contact_email:'factory@example.test'});if(f.error)throw Error(f.error.message)
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
 await page.goto('/deals/new');await page.getByLabel('クライアント',{exact:true}).selectOption(clientId);await page.getByRole('button',{name:'パウチ',exact:true}).click();await page.getByRole('button',{name:'案件を保存して商品仕様へ',exact:true}).click();await expect(page).toHaveURL(/\/deals\/[0-9a-f-]{36}\?step=2/)
 const dealPath=new URL(page.url()).pathname, dealId=dealPath.split('/').pop()
 await page.getByRole('button',{name:'仕様・数量を入力',exact:true}).click();await page.getByRole('combobox',{name:'中分類',exact:true}).selectOption('__other__');await page.getByLabel('中分類（自由入力）',{exact:true}).fill('Synthetic pouch');await page.getByRole('combobox',{name:'小分類',exact:true}).selectOption('__other__');await page.getByLabel('小分類（自由入力）',{exact:true}).fill('Synthetic size');await page.getByLabel('幅（mm）',{exact:true}).fill('100');await page.getByLabel('高さ（mm）',{exact:true}).fill('150');await page.getByLabel('数量パターン 1',{exact:true}).fill('1000');await page.getByRole('button',{name:'仕様と数量を保存',exact:true}).click();await expect(page.getByRole('region',{name:'商品仕様の入力',exact:true})).toHaveCount(0)
 await page.goto(dealPath+'?step=3');await page.getByRole('button',{name:'見積依頼(RFQ)をつくる',exact:true}).click();const rfq=page.getByRole('dialog',{name:'見積依頼を作成',exact:true});await rfq.getByLabel(factoryName,{exact:false}).check();await rfq.getByRole('button',{name:'依頼内容を確認',exact:true}).click();await page.getByRole('button',{name:'この内容で回答リンクを作成',exact:true}).click();await expect(page.getByRole('dialog',{name:'見積依頼を作成しました',exact:true})).toBeVisible()
 const resultDialog=page.getByRole('dialog',{name:'見積依頼を作成しました',exact:true}),savedLink=await resultDialog.locator('input[readonly]').inputValue()
 await page.reload();await page.getByRole('button',{name:'見積依頼(RFQ)をつくる',exact:true}).click();await expect(resultDialog).toBeVisible();await expect(resultDialog.locator('input[readonly]')).toHaveValue(savedLink)
 expect((await admin.from('rfq_requests').select('id').eq('deal_id',dealId)).data).toHaveLength(1)
 await resultDialog.getByRole('button',{name:'工場へのメール内容を確認',exact:true}).click();await expect(resultDialog.getByRole('region',{name:'メール送信内容の確認',exact:true})).toContainText('factory@example.test');await resultDialog.getByRole('button',{name:'この宛先・内容で送信を確定',exact:true}).click();await expect(resultDialog).toContainText('メール受付済み')
 const requestsForMail=await admin.from('rfq_requests').select('id').eq('deal_id',dealId);const invitationForMail=await admin.from('rfq_factory_invitations').select('id').eq('rfq_id',requestsForMail.data![0].id).single();const emailReceipt=await admin.from('rfq_email_receipts').select('status,provider_message_id,mail_payload').eq('invitation_id',invitationForMail.data!.id).single();if(emailReceipt.error)throw Error(emailReceipt.error.message);expect(emailReceipt.data.status).toBe('accepted');expect(emailReceipt.data.mail_payload.to).toBe('factory@example.test')
 const capturedRfqMail=await(await fetch(`http://127.0.0.1:55324/api/v1/message/${emailReceipt.data.provider_message_id}`)).json();expect(capturedRfqMail.To[0].Address).toBe('factory@example.test');expect(capturedRfqMail.HTML).toContain(savedLink);expect(capturedRfqMail.Subject).toContain('Quotation Request')
 await resultDialog.getByRole('button',{name:'見積依頼を閉じる',exact:true}).click();await expect(resultDialog).not.toBeVisible()
 await role('factory');await page.goto('/factory');await page.getByRole('link',{name:'Submit quotation / 提交报价 →',exact:true}).click();await expect(page.getByText('Quantity / 数量: 1,000 pcs',{exact:false})).toBeVisible()
 await expect(page.getByLabel('Unit USD / 单价',{exact:true})).toBeEnabled();
 for(const [label,value] of [['Unit USD / 单价','0.1'],['MOQ','1000'],['PCS/CTN','100'],['Lead days / 交期','15'],['Carton W cm','30'],['Carton H cm','40'],['Carton D cm','30'],['G.W kg','10']])await page.getByLabel(label,{exact:true}).fill(value)
 await page.getByLabel('Unit USD / 单价',{exact:true}).fill('0.1');await expect(page.getByLabel('Unit USD / 单价',{exact:true})).toHaveValue('0.1');
 await page.getByRole('button',{name:'Submit quotation / 提交报价',exact:true}).click();await expect(page.getByText('Thank you for your quotation.',{exact:false})).toBeVisible()
 await role('sales');await page.goto(dealPath+'/quote-builder');await page.getByRole('button',{name:'工場回答から売値を計算',exact:true}).click();await expect(page.getByText('工場回答のカートン条件から原価・売値を計算しました',{exact:true})).toBeVisible();await page.getByRole('row').filter({hasText:factoryName}).getByRole('button',{name:'価格を改訂して確認',exact:true}).click()
 const pricingDialog=page.getByRole('dialog',{name:'価格改訂の確認',exact:true})
 await pricingDialog.getByRole('combobox',{name:'入力する価格',exact:true}).selectOption('selling_price');await pricingDialog.getByLabel('税抜売単価（円・整数）',{exact:true}).fill('37');await pricingDialog.getByLabel('消費税率（%・0も明示）',{exact:true}).fill('10');await pricingDialog.getByLabel('レート（JPY/USD）',{exact:true}).fill('150');await pricingDialog.getByLabel('確認した取得元・根拠',{exact:true}).fill('Synthetic confirmed manual FX');await pricingDialog.getByLabel('基準日時（タイムゾーン付ISO）',{exact:true}).fill('2026-09-30T00:00:00Z');await pricingDialog.getByLabel('レート・根拠・基準日時を確認しました',{exact:true}).check()
 for(const name of ['版代','色指定費','中国国内送料','国際送料','その他費用']){await pricingDialog.getByLabel(name+'の総額',{exact:true}).fill('0');await pricingDialog.getByLabel(name+'を確認',{exact:true}).check()}
 await pricingDialog.getByRole('button',{name:'価格・費目を確認',exact:true}).click();await expect(pricingDialog).toContainText('DB確認済み');await pricingDialog.getByRole('button',{name:'この内容で新しい価格版を保存',exact:true}).click();await expect(pricingDialog).not.toBeVisible()
 const revision=await admin.from('deal_quotes').select('id,pricing_snapshot').eq('deal_id',dealId).eq('source_type','pricing_revision').single();if(revision.error)throw Error(revision.error.message);expect(revision.data.pricing_snapshot.fx.kind).toBe('manual_confirmed');expect(revision.data.pricing_snapshot.sample_costs_included).toBe(false)
 await page.locator(`[data-quote-id="${revision.data.id}"]`).getByRole('button',{name:'この価格で採用',exact:true}).click();await expect(page.getByRole('button',{name:'採用を解除',exact:true})).toBeVisible()
 const quote=(await state()).deal_quotes.find((q:{deal_id:string,status:string})=>q.deal_id===dealId&&q.status==='approved');expect(quote.quantity).toBe(1000);expect(quote.factory_id).toBe(factoryId)
 await page.goto(dealPath+'/documents');await expect(page.getByRole('button',{name:'この内容で発行する',exact:true})).toBeDisabled();await page.getByLabel('発行時に確認したJPY/USD',{exact:true}).fill('150');await page.getByLabel('発行時レートと全採用版の金額・PDFを確認しました',{exact:true}).check();await page.getByRole('button',{name:'この内容で発行する',exact:true}).click();await expect(page.getByText('発行履歴 (1)',{exact:true})).toBeVisible()
 await page.goto(dealPath+'?step=7');await page.getByRole('button',{name:'承認された → 見積確定へ',exact:true}).click();await expect.poll(async()=>(await state()).deals.find((d:{id:string})=>d.id===dealId).simple_status).toBe('quote_confirmed')
 await page.goto(dealPath+'?step=8');await page.getByRole('button',{name:'請求書をつくる',exact:true}).click();await page.getByRole('button',{name:'この内容で発行する',exact:true}).click();await expect(page.getByText('発行履歴 (1)',{exact:true})).toBeVisible();await page.getByRole('button',{name:'閉じる',exact:true}).click();await page.getByRole('button',{name:'支払条件を確認した → 発注準備へ',exact:true}).click();await expect.poll(async()=>(await state()).deals.find((d:{id:string})=>d.id===dealId).simple_status).toBe('paid')
 await page.goto(dealPath+'?step=9');await page.getByRole('button',{name:'最終確認できた → 入稿データ確認完了へ',exact:true}).click();await expect.poll(async()=>(await state()).deals.find((d:{id:string})=>d.id===dealId).simple_status).toBe('data_confirmed')
 await page.goto(dealPath+'?step=10');await page.getByRole('button',{name:'この内容で工場に発注する',exact:true}).click();await expect(page.getByText('工場発注を保存しました',{exact:true})).toBeVisible();await page.getByRole('button',{name:'発注内容を確認した → 製作中へ',exact:true}).click();await expect.poll(async()=>(await state()).deals.find((d:{id:string})=>d.id===dealId).simple_status).toBe('in_production')
 await role('factory');await page.goto('/factory');await expect(page.getByText('Purchase orders / 工厂订单',{exact:true})).toBeVisible();await expect(page.getByText('1,000 pcs · USD 0.1000 / pc',{exact:false})).toBeVisible()
 await role('sales');await page.goto(dealPath+'?step=11');await page.getByRole('button',{name:'工場が発送した → 工場発送完了へ',exact:true}).click();await expect.poll(async()=>(await state()).deals.find((d:{id:string})=>d.id===dealId).simple_status).toBe('shipped');await page.getByRole('button',{name:/を入庫予定にする$/}).click();await expect(page.getByText('発注の数量・仕様で入庫予定を保存しました',{exact:true})).toBeVisible()
 await role('logistics');await page.goto('/logistics');await page.getByRole('button',{name:'届いた → 検収して入庫',exact:true}).click();await page.getByRole('button',{name:'この数で入庫を確定する',exact:true}).click();await expect.poll(async()=>(await state()).inventory_items[0]?.quantity_on_hand).toBe(1000)
 // Extend the actual journey through storage billing and a captured PDF email before shipment.
 await role('sales');await page.goto('/inventory');await page.getByText(clientName,{exact:true}).click()
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhJkAAAAASUVORK5CYII=','base64')
 await page.locator('input[type=file]').setInputFiles({name:'synthetic-photo.png',mimeType:'image/png',buffer:png});await expect(page.getByText('商品写真を設定しました',{exact:true})).toBeVisible()
 const photo=(await state()).inventory_items[0];expect(new URL(photo.thumbnail_url).pathname).toContain(`/${dealId}/inventory/${photo.id}/`)
 const storedImage=await fetch(photo.thumbnail_url);expect(storedImage.status).toBe(200);expect(Buffer.from(await storedImage.arrayBuffer()).equals(png)).toBe(true)
 await page.goto('/inventory?tab=fees');await expect(page.getByRole('heading',{name:'保管料請求書',exact:true})).toBeVisible()
 const cartons=(await state()).inventory_items[0].cartons_on_hand;expect(cartons).toBe(10)
 await page.getByRole('button',{name:'保管請求書を作成',exact:true}).click()
 await page.getByRole('combobox',{name:'クライアント',exact:true}).selectOption(clientId)
 for(const [label,value]of [['請求対象月','2026-09'],['発行日','2026-09-30'],['支払期限','2026-10-31'],['請求対象カートン数','10'],['保管単価（円/CTN・月）','250'],['入庫回数','2'],['入庫単価（円/回）','300'],['出庫回数','1'],['出庫単価（円/回）','500'],['消費税率（%）','10'],['算定根拠（倉庫台帳・契約の確認内容）','Synthetic warehouse statement confirmed 10 cartons and contracted handling charges'],['振込先','Synthetic bank account 1234567']])await page.getByLabel(label,{exact:true}).fill(value)
 await expect(page.getByLabel('送付先メール',{exact:true})).toHaveValue('client@example.test')
 await page.getByLabel('対象量・料金・期間・宛先・振込先を確認しました',{exact:true}).check()
 await page.getByRole('button',{name:'確認した内容で請求書を発行',exact:true}).click();await expect(page.getByText('保管請求書を発行しました',{exact:true})).toBeVisible()
 const billing=await admin.from('storage_billing').select('*').eq('client_id',clientId).single();if(billing.error)throw Error(billing.error.message)
 expect(Number(billing.data.total_amount)).toBe(3960);expect(billing.data.snapshot.input.cartons).toBe(10);expect(billing.data.snapshot.input.due_date).toBe('2026-10-31')
 await page.reload();const invoiceRow=page.getByRole('listitem',{name:billing.data.snapshot.document_number,exact:true});await expect(invoiceRow.getByRole('link',{name:'PDFを確認',exact:true})).toHaveCount(1)
 const pdf=await context.request.get(`/api/storage-invoices/${billing.data.id}/pdf`);expect(pdf.status()).toBe(200);expect(pdf.headers()['content-type']).toBe('application/pdf')
 const pdfBytes=await pdf.body();expect(pdfBytes.subarray(0,5).toString()).toBe('%PDF-')
 await invoiceRow.getByRole('button',{name:'送付先を確認',exact:true}).click();await page.getByRole('button',{name:'この宛先へPDFを送信',exact:true}).click();await expect(page.getByText('メールサービスで受理されました。到達は履歴で確認してください',{exact:true})).toBeVisible()
 const receipt=await admin.from('document_email_receipts').select('status,provider_message_id').eq('document_id',billing.data.invoice_document_id).single();if(receipt.error)throw Error(receipt.error.message);expect(receipt.data.status).toBe('accepted')
 const captured=await(await fetch(`http://127.0.0.1:55324/api/v1/message/${receipt.data.provider_message_id}`)).json();expect(captured.To[0].Address).toBe('client@example.test');expect(captured.Text).toContain('3960');expect(captured.Text).toContain('2026-10-31');expect(captured.Attachments).toHaveLength(1)
 const attachment=await fetch(`http://127.0.0.1:55324/api/v1/message/${receipt.data.provider_message_id}/part/${captured.Attachments[0].PartID}`);expect(attachment.status).toBe(200)
 const receivedPDF=Buffer.from(await attachment.arrayBuffer());expect(receivedPDF.subarray(0,5).toString()).toBe('%PDF-');expect(receivedPDF.equals(pdfBytes)).toBe(true)
 await mkdir('tmp/pdfs',{recursive:true});await writeFile('tmp/pdfs/storage-invoice-mailpit.pdf',receivedPDF)
 await page.reload();await expect(invoiceRow).toContainText('メールサービス受理済み');await expect(invoiceRow.getByRole('button',{name:'送付先を確認',exact:true})).toHaveCount(0)
 const receiptAgain=await admin.from('document_email_receipts').select('provider_message_id').eq('document_id',billing.data.invoice_document_id).single();expect(receiptAgain.data?.provider_message_id).toBe(receipt.data.provider_message_id)
 const mailbox=await(await fetch('http://127.0.0.1:55324/api/v1/messages')).json();expect(mailbox.messages.filter((m:{Subject:string})=>m.Subject===captured.Subject)).toHaveLength(1)
 await role('client');await page.goto('/portal/invoices');const clientInvoice=page.locator('article').filter({hasText:billing.data.snapshot.document_number});await expect(clientInvoice).toContainText('2026-09の保管料');await expect(clientInvoice).toContainText('¥3,960');expect((await context.request.get(`/api/storage-invoices/${billing.data.id}/pdf`)).status()).toBe(200)
 await role('factory');expect((await context.request.get(`/api/storage-invoices/${billing.data.id}/pdf`)).status()).toBe(404)
 await role('logistics');expect((await context.request.get(`/api/storage-invoices/${billing.data.id}/pdf`)).status()).toBe(404)
 await role('client');await page.goto('/portal');await page.getByRole('button',{name:'出荷を依頼',exact:true}).click();await page.locator('input[type="number"]').fill('1000');await page.getByPlaceholder('例: 渋谷店').fill('代表検証店舗');await page.getByRole('button',{name:'1品目をこの内容で出荷を依頼',exact:true}).click();await expect.poll(async()=>(await state()).shipment_requests.length).toBe(1)
 await role('sales');await page.goto('/inventory?tab=requests');await page.getByRole('button',{name:'内容OK → 確認済みにする',exact:true}).click();await expect.poll(async()=>(await state()).shipment_requests[0].status).toBe('confirmed')
 await role('logistics');await page.goto('/logistics');await page.getByRole('button',{name:/出荷依頼 \(/}).click();await page.getByRole('button',{name:'出荷した → 在庫から引き落とす',exact:true}).click();await expect.poll(async()=>(await state()).inventory_items[0].quantity_on_hand).toBe(0);await page.getByRole('button',{name:'届いた → 納品完了',exact:true}).click();await expect.poll(async()=>(await state()).shipment_requests[0].status).toBe('delivered')
 await role('sales');await page.goto(dealPath+'?step=12');await page.getByRole('button',{name:'納品できた → 納品完了へ',exact:true}).click();await expect.poll(async()=>(await state()).deals.find((d:{id:string})=>d.id===dealId).simple_status).toBe('delivered');
 const final=await state();expect(final.documents.filter((d:{deal_id:string})=>d.deal_id===dealId).map((d:{document_type:string})=>d.document_type).sort()).toEqual(['invoice','quotation']);expect(final.factory_purchase_orders[0].quantity).toBe(1000)

 console.log('PASS actual local Auth/PostgREST/Postgres/browser: case/spec/RFQ/response/adoption/quotation/invoice/order/receipt, confirmed storage charges and immutable invoice, Mailpit PDF attachment/content/retry, real Storage photo, client invoice access and role isolation, client request/staff confirmation/warehouse shipment/delivery')
 }finally{
  // Synthetic records stay in the isolated DB for inspection; no local credentials are saved.
  for(const id of createdUsers)await admin.auth.admin.deleteUser(id)
 }
})
