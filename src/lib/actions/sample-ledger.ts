'use server'
import {createClient} from '@/lib/supabase/server'
import {requireSalesAccess} from './deal-access'
import {revalidatePath} from 'next/cache'
import type {SampleLedger,SampleOperation,SampleInvoice,SampleInvoiceSnapshot} from '@/lib/samples/types'
import {createHash} from 'node:crypto'
import {sampleInvoicePDF} from '@/lib/pdf/sample-invoice'

export async function getSampleLedger(dealId:string):Promise<SampleLedger>{
 const db=await createClient(),denied=await requireSalesAccess(db);if(denied)throw Error(denied)
 const [rounds,products,legacy]=await Promise.all([db.from('sample_rounds').select('*').eq('deal_id',dealId).order('round_number'),db.from('deal_products').select('id,description').eq('deal_id',dealId),db.from('deal_samples').select('id,round_number,sample_production_fee_usd,sample_shipping_fee_usd,plate_fee_usd,subtotal_jpy,sample_status').eq('deal_id',dealId).order('round_number')])
 if(rounds.error||products.error||legacy.error)throw Error('サンプル手配を読み込めません。再試行してください')
 const ids=(rounds.data||[]).map(r=>r.id),pids=(products.data||[]).map(p=>p.id)
 const [costs,payments,invoices,variants,factories,estimates]=await Promise.all([
 ids.length?db.from('sample_costs').select('*').in('round_id',ids):Promise.resolve({data:[],error:null}),
 ids.length?db.from('sample_payments').select('*').in('round_id',ids):Promise.resolve({data:[],error:null}),
 db.from('sample_invoices').select('*').eq('deal_id',dealId).order('created_at',{ascending:false}),
 pids.length?db.from('deal_product_variants').select('id,product_id,variant_label').in('product_id',pids):Promise.resolve({data:[],error:null}),
 db.from('factories').select('id,factory_name').order('factory_name'),
 ids.length?db.from('sample_estimates').select('*').in('round_id',ids):Promise.resolve({data:[],error:null}),
 ])
 if([costs,payments,invoices,variants,factories,estimates].some(r=>r.error))throw Error('費用・請求履歴を読み込めません。再試行してください')
 const bills=(invoices.data||[]).map(i=>i.id),allocations=bills.length?await db.from('sample_invoice_lines').select('cost_id,invoice_id,released_at').in('invoice_id',bills):{data:[],error:null}
 const mailReceipts=bills.length?await db.from('sample_mail_receipts').select('invoice_id,status').in('invoice_id',bills):{data:[],error:null}
 if(allocations.error||mailReceipts.error)throw Error('請求・送信履歴を確認できません')
 return {legacy:legacy.data||[],estimates:estimates.data||[],mailReceipts:mailReceipts.data||[],rounds:rounds.data||[],products:products.data||[],costs:costs.data||[],payments:payments.data||[],invoices:invoices.data||[],variants:variants.data||[],factories:factories.data||[],allocations:allocations.data||[]} as SampleLedger
}
function message(raw:string){return raw.includes('Preview changed')?'費用・請求条件が変わりました。もう一度プレビューしてください':raw.includes('already billed')?'選択費用は請求済みか別案件です。未請求一覧を再確認してください':raw.includes('different input')?'前回の保存結果を確認してください。同じ要求の内容は変更できません':'保存を確認できません。入力を変えず同じ要求で再試行してください'}
export async function sampleCommand(requestId:string,dealId:string,operation:SampleOperation,input:Record<string,unknown>,expected:SampleInvoiceSnapshot|null=null){
 const db=await createClient(),denied=await requireSalesAccess(db);if(denied)return {error:denied}
 const {data,error}=await db.rpc('sample_command',{p_request_id:requestId,p_deal_id:dealId,p_operation:operation,p_input:input,p_expected:expected})
 if(error||!data)return {error:message(error?.message||'')}
 revalidatePath(`/deals/${dealId}/samples`);return {result:data as Record<string,unknown>}
}
export async function previewSampleInvoice(dealId:string,input:Record<string,unknown>){
 const db=await createClient(),denied=await requireSalesAccess(db);if(denied)return {error:denied}
 const {data,error}=await db.rpc('preview_sample_invoice',{p_deal_id:dealId,p_input:input})
 return error||!data?{error:'請求内容を確認できません。未請求費用・顧客名・発行者設定・税率・日付・振込案内を確認してください'}:{preview:data as SampleInvoiceSnapshot}
}
export async function getSampleInvoice(id:string):Promise<SampleInvoice|null>{
 const db=await createClient();if(await requireSalesAccess(db)){const {data,error}=await db.rpc('client_sample_invoices',{p_invoice_id:id});return error?null:(data?.[0]||null) as SampleInvoice|null}
 const {data,error}=await db.from('sample_invoices').select('*').eq('id',id).maybeSingle();return error?null:data as SampleInvoice|null
}
export async function listOwnSampleInvoices():Promise<{data:SampleInvoice[];error:string|null}>{
 const db=await createClient(),{data,error}=await db.rpc('client_sample_invoices',{});return {data:error?[]:data||[],error:error?'自社の請求履歴を確認できません':null}
}
async function sampleMail(id:string){
 const db=await createClient(),denied=await requireSalesAccess(db);if(denied)return {error:denied}
 const bill=await getSampleInvoice(id);if(!bill||bill.status!=='issued')return {error:'有効な請求書がありません'}
 const deal=await db.from('deals').select('client_id').eq('id',bill.deal_id).single()
 const customer=deal.data?.client_id?await db.from('clients').select('email').eq('id',deal.data.client_id).single():{data:null,error:null}
 const receipt=await db.from('sample_mail_receipts').select('status').eq('invoice_id',id).maybeSingle()
 const from=process.env.RFQ_MAIL_FROM,to=customer.data?.email
 if(deal.error||customer.error||receipt.error||!from||!to||!process.env.RESEND_API_KEY)return {error:'顧客の登録メール・送信元・メール設定を確認してください。未送信です'}
 const pdf=await sampleInvoicePDF(bill.document_number,bill.snapshot),payload={from,to,subject:`[${bill.snapshot.deal_code}] サンプル費用請求書 ${bill.document_number}`,body:`${bill.snapshot.customer_name} 御中\nサンプル費用の請求書を添付します。\nご請求金額 ¥${Number(bill.snapshot.total).toLocaleString('ja-JP')}\n支払期限 ${bill.snapshot.due_date}`,attachment:`${bill.document_number}.pdf`,pdf_sha256:createHash('sha256').update(pdf).digest('hex')}
 return {payload,pdf,status:receipt.data?.status||null,fingerprint:createHash('sha256').update(JSON.stringify(payload)).digest('hex')}
}
export async function previewSampleMail(id:string){
 const r=await sampleMail(id);return r.error?{error:r.error}:{preview:{...r.payload!,id,fingerprint:r.fingerprint!,delivery:r.status==='accepted'?'メールサービス受付済み（到達は未確認）':r.status?'送信履歴あり・再送停止':'未送信',status:r.status}}
}
export async function sendSampleMail(id:string,fingerprint:string){
 const r=await sampleMail(id);if(r.error)return {error:r.error}
 if(r.fingerprint!==fingerprint)return {error:'宛先・PDF・送信内容が変わりました。再確認してください'}
 if(r.status)return {status:r.status,error:r.status==='accepted'?undefined:'既存の送信予約があるため再送を停止しています'}
 const db=await createClient(),claim=await db.rpc('claim_sample_email',{p_invoice_id:id,p_payload:r.payload})
 if(claim.error||!claim.data)return {error:'送信予約を確認できません。再送前に履歴を確認してください'}
 if(!claim.data.claimed)return {status:claim.data.status,error:claim.data.status==='accepted'?undefined:'送信予約済みのため再送を停止しています'}
 let status='unknown',providerId:string|null=null
 try{const p=r.payload!,response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`sample-invoice/${id}`},body:JSON.stringify({from:p.from,to:[p.to],subject:p.subject,text:p.body,attachments:[{filename:p.attachment,content:Buffer.from(r.pdf!).toString('base64')}]})});if(!response.ok)status='rejected';else{const body=await response.json();if(typeof body.id==='string'&&body.id){status='accepted';providerId=body.id}}}catch{/* uncertain provider result never permits another POST */}
 const finish=await db.rpc('finish_sample_email',{p_invoice_id:id,p_attempt_id:claim.data.attempt_id,p_status:status,p_provider_id:providerId})
 revalidatePath(`/deals/${(await getSampleInvoice(id))?.deal_id}/samples`)
 return finish.error?{status:'unknown',error:'送信結果の保存を確認できません。重複防止のため再送停止'}:{status,error:status==='accepted'?undefined:'送信結果を確認できません。再送せず履歴を確認してください'}
}
