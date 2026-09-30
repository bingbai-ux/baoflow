'use server'
import { createClient } from '@/lib/supabase/server'
import { requireSalesAccess } from './deal-access'
import { revalidatePath } from 'next/cache'
import { validateStorageInvoice, type StorageInvoiceInput, type StorageInvoiceSnapshot } from '@/lib/utils/storage-invoice'
import { storageInvoicePDF } from '@/lib/pdf/storage-invoice'

export interface StorageBill {
 id: string; client_id: string; billing_month: string; total_amount: number; invoice_document_id: string
 snapshot: StorageInvoiceSnapshot & { document_number: string }; status: string
 email_status?: 'attempting'|'accepted'|'unknown'|'rejected'
}
export async function listStorageBills() {
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser()
 if(!user)return {data:[] as StorageBill[],error:'ログインしてください'}
 const {data,error}=await supabase.from('storage_billing').select('id,client_id,billing_month,total_amount,invoice_document_id,snapshot,status').order('billing_month',{ascending:false}).limit(100)
 if(error)return {data:[] as StorageBill[],error:'保管請求履歴を取得できません'}
 const bills=(data||[]) as StorageBill[], ids=bills.map(b=>b.invoice_document_id).filter(Boolean)
 if(!ids.length)return {data:bills,error:null}
 const receipts=await supabase.from('document_email_receipts').select('document_id,status').in('document_id',ids)
 if(receipts.error)return {data:bills,error:'送信履歴を確認できません'}
 const statuses=new Map((receipts.data||[]).map(r=>[r.document_id,r.status]))
 return {data:bills.map(b=>({...b,email_status:statuses.get(b.invoice_document_id) as StorageBill['email_status']})),error:null}
}
export async function getStorageBill(id:string) {
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser()
 if(!user)return null
 const {data,error}=await supabase.from('storage_billing').select('id,client_id,billing_month,total_amount,invoice_document_id,snapshot,status').eq('id',id).maybeSingle()
 return error?null:data as StorageBill|null
}
export async function issueStorageInvoice(requestId:string,clientId:string,input:StorageInvoiceInput) {
 const supabase=await createClient(),denied=await requireSalesAccess(supabase)
 if(denied)return {data:null,error:denied}
 const invalid=validateStorageInvoice(input);if(invalid)return {data:null,error:invalid}
 const {data,error}=await supabase.rpc('issue_storage_invoice',{p_request_id:requestId,p_client_id:clientId,p_input:input})
 if(error)return {data:null,error:error.message.includes('already exists')?'このクライアント・月の請求書は発行済みです。履歴を確認してください':error.message.includes('different input')?'前回の発行内容が異なります。履歴を確認してください':error.message.includes('Configure invoice issuer')?'会社設定で請求書の発行元を登録してください':'請求書を発行できません。入力・履歴を確認してください'}
 revalidatePath('/inventory');revalidatePath('/docs');revalidatePath('/portal')
 return {data:data as StorageBill,error:null}
}
export async function emailStorageInvoice(billId:string) {
 const supabase=await createClient(),denied=await requireSalesAccess(supabase)
 if(denied)return {error:denied}
 const bill=await getStorageBill(billId)
 if(!bill?.snapshot||!bill.invoice_document_id)return {error:'発行済み請求書を確認してください'}
 const key=process.env.RESEND_API_KEY,from=process.env.RFQ_MAIL_FROM
 if(!key||!from)return {error:'メール設定が未登録です。PDFを確認し、送付方法を担当者へ確認してください'}
 const s=bill.snapshot
 // Complete all fallible PDF work before permanently reserving the only provider POST.
 let pdf:Uint8Array
 try{pdf=await storageInvoicePDF(s.document_number,s)}catch{return {error:'PDFを作成できません。送信予約は行っていません'}}
 const {data:claim,error:claimError}=await supabase.rpc('claim_storage_invoice_email',{p_document_id:bill.invoice_document_id})
 if(claimError||!claim)return {error:'送信状態を確認できません。送信していません'}
 if(!claim.claimed)return {error:claim.status==='accepted'?null:'送信結果が不明のため再送を停止しています。履歴を確認してください'}
 let state:'accepted'|'unknown'|'rejected'='unknown',providerId:string|undefined
 try{
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`storage-invoice/${bill.invoice_document_id}`},body:JSON.stringify({from,to:[s.input.recipient],subject:`保管料請求書 ${s.document_number}（${s.input.month}）`,text:`保管料請求書を添付いたします。\n対象月: ${s.input.month}\n合計（税込）: ${s.total} 円\n支払期限: ${s.input.due_date}`,attachments:[{filename:`${s.document_number}.pdf`,content:Buffer.from(pdf).toString('base64')}]})})
  if(!response.ok)state='rejected'
  else{const body=await response.json();if(typeof body.id==='string'&&body.id){state='accepted';providerId=body.id}}
 }catch{state='unknown'}
 const {error}=await supabase.rpc('finish_storage_invoice_email',{p_document_id:bill.invoice_document_id,p_attempt_id:claim.attemptId,p_status:state,p_provider_id:providerId||null})
 if(error||state!=='accepted')return {error:'送信結果が不明または拒否されたため再送を停止しました。メール履歴を確認してください'}
 revalidatePath('/inventory');return {error:null}
}
