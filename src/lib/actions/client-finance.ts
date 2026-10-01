'use server'
import {canCorrectRejectedWorkflowRequest} from './workflow-recovery'
import {createClient} from '@/lib/supabase/server'
import {requireSalesAccess} from './deal-access'
import {revalidatePath} from 'next/cache'
import {createHash} from 'node:crypto'
import {clientDocumentPDF,type PublicDocumentSnapshot} from '@/lib/pdf/client-document'

export async function clientFinanceCommand(requestId:string,operation:string,input:Record<string,unknown>){
 const db=await createClient(),{data:{user},error:authError}=await db.auth.getUser()
 if(authError||!user)return {error:'ログインしてください'}
 const {data,error}=await db.rpc('client_finance_command',{p_request_id:requestId,p_operation:operation,p_input:input})
 if(error||!data)return {canCorrect:await canCorrectRejectedWorkflowRequest('client_finance',requestId,undefined,error?.code),error:error?.message.includes('Preview changed')?'発行内容が変わりました。もう一度確認してください':(error?.message.includes('full bank receipt')||error?.message.includes('upfront bank receipt'))?'合意した前払額の実着金確認が必要です。顧客の申告だけでは進められません':error?.message.includes('expired')?'リンクが期限切れです。ポータルから有効な帳票を開いてください':'保存を確認できません。入力を変えず再試行してください。重複操作の前に履歴を確認してください'}
 revalidatePath('/portal/documents');revalidatePath('/deals');return {result:data as Record<string,unknown>}
}
export async function previewClientDocument(documentId:string,approvalPacketId:string|null=null,mode:string='full_prepaid',balance:string='before_shipment'){
 const db=await createClient(),denied=await requireSalesAccess(db);if(denied)return {error:denied}
 const {data,error}=await db.rpc('preview_client_document_with_terms',{p_document_id:documentId,p_approval_packet_id:approvalPacketId,p_mode:mode,p_balance:balance})
 return error||!data?{error:'発行版の顧客・採用価格・税込額を確認してください。請求書は顧客承認後に発行し、支払期限が必要です。旧帳票は閲覧を残して新しい版を発行してください'}:{preview:data as Record<string,unknown>}
}
export async function getClientFinanceContext(packetId:string,token:string|null=null){
 const db=await createClient(),{data,error}=await db.rpc('client_finance_context',{p_packet_id:packetId,p_token:token})
 return error||!data?null:data as Record<string,unknown>
}

async function clientDocumentMail(packetId:string){
 const db=await createClient(),denied=await requireSalesAccess(db);if(denied)return {error:denied}
 const {data:p,error}=await db.from('client_document_packets').select('client_id,status,snapshot').eq('id',packetId).maybeSingle()
 if(error||!p||p.status!=='active')return {error:'有効な共有版がありません'}
 const [customer,links,receipt]=await Promise.all([db.from('clients').select('email').eq('id',p.client_id).single(),db.from('client_document_links').select('token,expires_at').eq('packet_id',packetId).is('revoked_at',null).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(1),db.from('client_document_mail_receipts').select('status').eq('packet_id',packetId).maybeSingle()])
 const from=process.env.RFQ_MAIL_FROM,to=customer.data?.email,base=process.env.NEXT_PUBLIC_APP_URL,link=links.data?.[0]
 if(customer.error||links.error||receipt.error||!from||!to||!base||!link||!process.env.RESEND_API_KEY)return {error:'登録顧客メール・送信元・アプリURL・有効リンク・メール設定を確認してください。未送信です'}
 const url=new URL(`/portal/documents/${packetId}`,base);if(url.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(url.hostname))return {error:'安全なアプリURLを確認してください。未送信です'};url.searchParams.set('token',link.token)
 const s=p.snapshot as PublicDocumentSnapshot,pdf=await clientDocumentPDF(s),kind=s.type==='quotation'?'見積書':'請求書'
 const payload={from,to,token:link.token,subject:`${kind} ${s.number}`,body:`${s.customer_name} 御中\n${kind}を添付します。税込金額 ¥${Number(s.total).toLocaleString('ja-JP')}${s.payment_conditions?`\n支払条件 ${s.payment_conditions.mode==='full_prepaid'?'全額前払い':s.payment_conditions.mode==='half_prepaid'?'半金前払い':'後払い'} / 発注前 ¥${Number(s.payment_conditions.upfront_jpy).toLocaleString('ja-JP')} / 発送前累計 ¥${Number(s.payment_conditions.shipment_required_jpy).toLocaleString('ja-JP')} / 残金 ${s.payment_conditions.balance_due==='before_shipment'?'発送前':'納品後・請求書の支払期限まで'}`:''}${s.due_date?`\n支払期限 ${s.due_date}`:''}\n内容の確認・${s.type==='quotation'?'回答':'振込後の入金申告'}は自社アカウントでログインしてください。\n${url}\nリンク有効期限 ${link.expires_at}\n期限切れの場合はポータルの帳票一覧をご利用ください。`,attachment:`${s.number}.pdf`,pdf_sha256:createHash('sha256').update(pdf).digest('hex')}
 return {payload,pdf,status:receipt.data?.status||null,fingerprint:createHash('sha256').update(JSON.stringify(payload)).digest('hex')}
}
export async function previewClientDocumentMail(packetId:string){const r=await clientDocumentMail(packetId);return r.error?{error:r.error}:{preview:{...r.payload!,fingerprint:r.fingerprint!,status:r.status}}}
export async function sendClientDocumentMail(packetId:string,fingerprint:string){
 const r=await clientDocumentMail(packetId);if(r.error)return {error:r.error}
 if(r.fingerprint!==fingerprint)return {error:'宛先・PDF・リンク・内容が変わりました。再確認してください'}
 if(r.status)return {status:r.status,error:r.status==='accepted'?undefined:'送信履歴があるため再送停止。担当者が結果を確認してください'}
 const db=await createClient(),claim=await db.rpc('claim_client_document_email',{p_packet_id:packetId,p_payload:r.payload})
 if(claim.error||!claim.data)return {error:'送信予約を確認できません。履歴を確認するまで再送しないでください'}
 if(!claim.data.claimed)return {status:claim.data.status,error:claim.data.status==='accepted'?undefined:'送信予約済みのため再送停止'}
 let status='unknown',providerId:string|null=null
 try{const p=r.payload!,response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`client-document/${packetId}`},body:JSON.stringify({from:p.from,to:[p.to],subject:p.subject,text:p.body,attachments:[{filename:p.attachment,content:Buffer.from(r.pdf!).toString('base64')}]})});if(!response.ok)status='rejected';else{const body=await response.json();if(typeof body.id==='string'&&body.id){status='accepted';providerId=body.id}}}catch{/* Uncertain response is never evidence that sending is safe again. */}
 const finish=await db.rpc('finish_client_document_email',{p_packet_id:packetId,p_attempt_id:claim.data.attempt_id,p_status:status,p_provider_id:providerId});revalidatePath('/deals')
 return finish.error?{status:'unknown',error:'送信結果を保存できません。重複防止のため再送停止'}:{status,error:status==='accepted'?undefined:'送信結果を確認できません。再送せず履歴を確認してください'}
}
