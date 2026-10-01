import {test,expect} from '@playwright/test'
import {createClient} from '@supabase/supabase-js'
import {randomUUID} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
const url=process.env.LOCAL_SUPABASE_URL!
if(url!=='http://127.0.0.1:55321')throw Error('Synthetic localhost only')
const admin=createClient(url,process.env.LOCAL_SUPABASE_SERVICE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}})
test('real customer approval → invoice PDF/Mailpit → declaration → staff bank evidence; role and replay isolation',async({page,context})=>{
 const checked=async(r:PromiseLike<any>)=>{const v=await r;if(v.error)throw Error(v.error.message);return v.data}
 const party=randomUUID(),other=randomUUID(),deal=randomUUID(),product=randomUUID(),variant=randomUUID(),quote=randomUUID(),sessions=new Map<string,any>(),clients=new Map<string,typeof admin>()
 await checked(admin.from('clients').insert([{id:party,company_name:'Synthetic settlement customer',email:'settlement-customer@example.test'},{id:other,company_name:'Synthetic unrelated customer'}]))
 for(const role of ['sales','client','foreign','factory','logistics']){
 const email=`finance-${role}-${randomUUID()}@example.test`,password=randomUUID()+randomUUID(),u=await checked(admin.auth.admin.createUser({email,password,email_confirm:true}));await checked(admin.from('profiles').update({role:role==='foreign'?'client':role,client_id:role==='client'?party:role==='foreign'?other:null}).eq('id',u.user.id))
 const db=createClient(url,process.env.LOCAL_SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false}}),login=await checked(db.auth.signInWithPassword({email,password}));sessions.set(role,login.session);clients.set(role,db)
 }
 await checked(admin.from('deals').insert({id:deal,deal_code:`FIN-${deal.slice(0,8)}`,deal_name:'Synthetic settlement workflow',client_id:party,client_name_text:'Synthetic settlement customer',sales_user_id:sessions.get('sales').user.id,simple_status:'quoting',waiting_on:'us'}))
 await checked(admin.from('deal_products').insert({id:product,deal_id:deal,product_no:1,description:'Synthetic product'}));await checked(admin.from('deal_product_variants').insert({id:variant,product_id:product,variant_label:'Synthetic specification',variant_order:0}))
 const q={id:quote,deal_id:deal,variant_id:variant,status:'approved',quantity:2,selling_price_jpy:500,total_billing_jpy:1000,total_billing_tax_jpy:1100,factory_unit_price_usd:1,exchange_rate:150,cost_ratio:0.5}
 await checked(admin.from('deal_quotes').insert(q))
 const snapshot={deal:{id:deal,client_id:party,deal_name:'Synthetic settlement workflow',deal_code:'FIN-SYNTH',client_name_text:'Synthetic settlement customer'},quotes:[q],products:[{id:product,description:'Synthetic product'}],variants:[{id:variant,product_id:product,variant_label:'Synthetic specification'}],fees:[],company:{name:'Synthetic issuer',registration_number:'T0000000000000'},banks:[{bank_name:'Synthetic bank',account_number:'0000000'}]}
 const issueSyntheticDocument=async(type:string)=>{const id=randomUUID();await checked(admin.from('documents').insert({id,deal_id:deal,document_type:type,document_number:`SYNTH-${id}`,version:1,issued_at:new Date().toISOString(),issued_by_user_id:sessions.get('sales').user.id,metadata:{snapshot,payment_due_date:'2026-10-31'}}));return id}
 const sales=clients.get('sales')!,customer=clients.get('client')!,cmd=(db:typeof admin,operation:string,input:unknown,id=randomUUID())=>checked(db.rpc('client_finance_command',{p_request_id:id,p_operation:operation,p_input:input}))
 const publish=async(id:string,approval:string|null=null)=>{const expected=await checked(sales.rpc('preview_client_document',{p_document_id:id,p_approval_packet_id:approval}));return cmd(sales,'publish_document',{document_id:id,approval_packet_id:approval,expected})}
 const quotedoc=await issueSyntheticDocument('quotation'),quotation=await publish(quotedoc)
 await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort())
 const role=async(name:string)=>{await context.clearCookies();await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(sessions.get(name))).toString('base64url'),domain:'127.0.0.1',path:'/'}])}
 await role('client');await page.goto(`/portal/documents/${quotation.packet_id}?token=${quotation.token}`);await expect(page.getByRole('button',{name:'この版を承認する'})).toBeDisabled();await page.getByLabel('数量・仕様・税込金額を確認しました').check();await expect(page.getByRole('button',{name:'この版を承認する'})).toBeEnabled();await page.getByRole('button',{name:'この版を承認する'}).click();await expect(page.getByText('回答済み：承認・営業確認待ち')).toBeVisible()
 await cmd(sales,'advance_quote',{packet_id:quotation.packet_id});const invoice=await publish(await issueSyntheticDocument('invoice'),quotation.packet_id)
 await page.goto(`/portal/documents/${invoice.packet_id}?token=${invoice.token}`);await page.getByLabel('振込金額（円）').fill('1100');await page.getByLabel('振込日',{exact:true}).fill('2026-10-01');await page.getByLabel('振込名義・確認用情報').fill('Synthetic remittance')
 await expect(page.getByRole('button',{name:'入金を申告する'})).toBeEnabled()
 let resolve!:()=>void;const lost=new Promise<void>(r=>resolve=r)
 await page.route('**/*',async route=>{if(route.request().method()==='POST'&&route.request().headers()['next-action']){await route.fetch();await route.abort('failed');resolve()}else await route.fallback()})
 await page.getByRole('button',{name:'入金を申告する'}).click();await lost;await page.unroute('**/*')
 const pending=await page.evaluate(()=>Object.entries(sessionStorage).filter(([k])=>k.startsWith('baoflow-request:')).map(([,v])=>JSON.parse(v)))
 expect(pending).toHaveLength(1);expect(Object.keys(pending[0]).sort()).toEqual(['id','signature'])
 await page.reload();await expect(page.getByRole('status').filter({hasText:'前回の保存結果が見つかりました'})).toBeVisible();await page.getByRole('button',{name:'履歴を確認して続ける'}).click()
 await mkdir('artifacts/client-settlement-stage4',{recursive:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/client-settlement-stage4/client-report-recovered-390.png'})
 expect(await checked(admin.from('client_payment_reports').select('id').eq('packet_id',invoice.packet_id))).toHaveLength(1)
 expect((await checked(admin.from('deals').select('simple_status').eq('id',deal).single())).simple_status).toBe('quote_confirmed')
 const report=(await checked(admin.from('client_payment_reports').select('*').eq('packet_id',invoice.packet_id)))[0]
 await role('sales');await page.goto(`/deals/${deal}/settlement`);await page.getByLabel('確認する申告').selectOption(report.id);await page.getByLabel('銀行で確認した着金額（円）').fill('1100');await page.getByLabel('実着金日').fill('2026-10-01');await page.getByLabel('銀行明細の一意な照合番号').fill(`SYNTH-${randomUUID()}`);await expect(page.getByRole('button',{name:'実着金を記録する'})).toBeDisabled();await page.getByLabel('実際の銀行明細で着金を確認した').check();await page.getByRole('button',{name:'実着金を記録する'}).click();await expect(page.getByText('入金申告 0件・BAO確認待ち')).toBeVisible()
 expect((await checked(admin.from('deals').select('simple_status').eq('id',deal).single())).simple_status).toBe('quote_confirmed');await cmd(sales,'advance_paid',{packet_id:invoice.packet_id})
 await page.reload();await page.getByText('共有版のPDF・メール送付',{exact:true}).click();const pdf=await context.request.get(`/api/client-documents/${invoice.packet_id}/pdf`);expect(pdf.status()).toBe(200);const bytes=await pdf.body();await mkdir('tmp/pdfs',{recursive:true});await writeFile('tmp/pdfs/client-invoice.pdf',bytes)
 await page.getByRole('button',{name:'メール内容を確認',exact:true}).first().click();const mail=page.getByRole('region',{name:'メール送信前確認'});await expect(mail).toContainText('settlement-customer@example.test');await mail.getByRole('button',{name:'確認した宛先へPDFを送付する'}).click();await expect(mail).toContainText('メールサービス受付済み・到達は未確認')
 const receipt=await checked(admin.from('client_document_mail_receipts').select('*').eq('packet_id',invoice.packet_id).single()),captured=await(await fetch(`http://127.0.0.1:55324/api/v1/message/${receipt.provider_id}`)).json();expect(captured.To[0].Address).toBe('settlement-customer@example.test');expect(captured.Text).toContain('1,100');expect(captured.Text).toContain('2026-10-31');const attachment=captured.Attachments[0],attached=Buffer.from(await(await fetch(`http://127.0.0.1:55324/api/v1/message/${receipt.provider_id}/part/${attachment.PartID}`)).arrayBuffer());expect(attached.equals(bytes)).toBe(true)
 await mkdir('artifacts/client-settlement-stage4',{recursive:true});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('#main-content').screenshot({path:'artifacts/client-settlement-stage4/staff-bank-confirmed-390.png'})
 for(const name of ['foreign','factory','logistics']){await role(name);expect((await context.request.get(`/api/client-documents/${invoice.packet_id}/pdf`)).status()).toBe(404);expect((await clients.get(name)!.rpc('client_finance_context',{p_packet_id:invoice.packet_id,p_token:invoice.token})).error).not.toBeNull()}
 expect((await customer.from('client_payment_receipts').select('*')).data).toEqual([])
})
