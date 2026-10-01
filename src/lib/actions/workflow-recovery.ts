'use server'

import { createClient } from '@/lib/supabase/server'
import { requireSalesAccess } from './deal-access'

export type RecoverableOperation = 'deal' | 'spec' | 'quantity' | 'rfq' | 'document' | 'storage_invoice' | 'pricing_revision' | 'sample_ledger' | 'client_finance' | 'factory_workflow' | 'factory_qc' | 'shipment_workflow'
/** Read only the current staff user's saved transaction result, never another actor's request. */
export async function recoverWorkflowRequest(operation: RecoverableOperation, requestId?: string, dealId?: string) {
  const supabase = await createClient()
  if(operation==='factory_workflow'||operation==='factory_qc'||operation==='shipment_workflow'){
    const {data:{user},error:authError}=await supabase.auth.getUser();if(authError||!user)return {actorId:null,result:null,error:'ログインしてください'}
    const {data:profile,error:profileError}=await supabase.from('profiles').select('role').eq('id',user.id).single()
    if(profileError||!profile||!(operation==='shipment_workflow'?['admin','sales','factory','logistics','client']:['admin','sales','factory']).includes(profile.role))return {actorId:null,result:null,error:'この操作を利用できません'}
    if(!requestId)return {actorId:user.id,result:null,error:null}
    if(!/^[0-9a-f-]{36}$/i.test(requestId))return {actorId:user.id,result:null,error:'保存要求IDが無効です'}
    const {data,error}=await supabase.from(operation==='shipment_workflow'?'shipment_workflow_requests':operation==='factory_qc'?'factory_qc_requests':'factory_workflow_requests').select('order_id,result').eq('id',requestId).eq('created_by',user.id).maybeSingle()
    if(data&&data.order_id!==dealId)return {actorId:user.id,result:null,error:'保存要求の発注が一致しません'}
    return {actorId:user.id,result:data?.result as Record<string,unknown>|null,error:error?'前回の保存結果を確認できません':null}
  }
  if(operation==='client_finance'){
    const {data:{user},error:authError}=await supabase.auth.getUser()
    if(authError||!user)return {actorId:null,result:null,error:'ログインしてください'}
    const {data:profile,error:profileError}=await supabase.from('profiles').select('role').eq('id',user.id).single()
    if(profileError||!profile||!['admin','sales','client'].includes(profile.role))return {actorId:null,result:null,error:'この操作を利用できません'}
    if(!requestId)return {actorId:user.id,result:null,error:null}
    if(!/^[0-9a-f-]{36}$/i.test(requestId))return {actorId:user.id,result:null,error:'保存要求IDが無効です'}
    const {data,error}=await supabase.from('client_finance_requests').select('result').eq('id',requestId).eq('created_by',user.id).maybeSingle()
    return {actorId:user.id,result:data?.result as Record<string,unknown>|null,error:error?'前回の保存結果を確認できません':null}
  }
  const denied = await requireSalesAccess(supabase)
  if (denied) return { actorId: null, result: null, error: denied }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { actorId: null, result: null, error: 'ログインしてください' }
  if (!requestId) return { actorId: user.id, result: null, error: null }
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) return { actorId: user.id, result: null, error: '保存要求IDが無効です' }
  if(operation==='sample_ledger'){
    const {data,error}=await supabase.from('sample_requests').select('deal_id,result').eq('id',requestId).eq('created_by',user.id).maybeSingle()
    if(data&&data.deal_id!==dealId)return {actorId:user.id,result:null,error:'サンプルの案件が一致しません'}
    return {actorId:user.id,result:data?.result as Record<string,unknown>|null,error:error?'前回のサンプル保存を確認できません':null}
  }
  if (operation === 'pricing_revision') {
    const {data,error}=await supabase.from('quote_pricing_requests').select('quote_id,deal_id').eq('request_id',requestId).eq('created_by',user.id).maybeSingle()
    if(data && data.deal_id!==dealId)return {actorId:user.id,result:null,error:'見積の案件が一致しません'}
    return {actorId:user.id,result:data as Record<string,unknown>|null,error:error?'前回の価格保存を確認できません':null}
  }
  if (operation === 'storage_invoice') {
    const {data,error}=await supabase.from('storage_billing').select('id,invoice_document_id,snapshot').eq('request_id',requestId).eq('created_by',user.id).maybeSingle()
    return {actorId:user.id,result:data as Record<string,unknown>|null,error:error?'前回の保管請求発行を確認できません':null}
  }
  if (operation === 'document') {
    const { data, error } = await supabase.from('document_issue_requests').select('document_id,payload').eq('request_id', requestId).eq('created_by', user.id).maybeSingle()
    if (error) return { actorId: user.id, result: null, error: '前回の帳票発行を確認できません。履歴を確認してください' }
    if (!data) return { actorId: user.id, result: null, error: null }
    if (data.payload?.deal_id !== (dealId || null)) return { actorId: user.id, result: null, error: '帳票の案件が一致しません' }
    const doc = await supabase.from('documents').select('*').eq('id', data.document_id).maybeSingle()
    return { actorId: user.id, result: doc.data as Record<string, unknown> | null, error: doc.error || !doc.data ? '前回の帳票を取得できません' : null }
  }
  const rfq = operation === 'rfq'
  let query = supabase.from(rfq ? 'rfq_creation_requests' : 'wizard_requests')
    .select('result,payload').eq('request_id', requestId).eq(rfq ? 'created_by' : 'user_id', user.id)
  if (!rfq) query = query.eq('operation', operation)
  const { data, error } = await query.maybeSingle()
  if (error) return { actorId: user.id, result: null, error: '前回の保存結果を確認できません。入力を変えず再読込してください' }
  if (data && dealId && (rfq ? data.payload?.deal : data.payload?.deal_id) !== dealId) return { actorId: user.id, result: null, error: '保存要求の案件が一致しません' }
  return { actorId: user.id, result: (data?.result || null) as Record<string, unknown> | null, error: null }
}
