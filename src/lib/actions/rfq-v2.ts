'use server'

import { createHash } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { requireSalesAccess } from './deal-access'
import type { CreatedRfq } from './rfq'
import { canonicalRfqInput, type RfqV2Input, type RfqPreview } from '@/lib/deals/rfq-preview'

const params = (input: RfqV2Input) => ({ p_deal_id: input.dealId, p_selection: canonicalRfqInput(input).selection, p_factory_ids: [...input.factoryIds].sort(), p_pending_factories: canonicalRfqInput(input).pendingFactories, p_deadline: input.responseDeadline, p_message: input.requestMessage })
const message = (value?: string) => value?.includes('Preview changed') ? '仕様・数量・宛先が変更されました。依頼内容をもう一度確認してください' : value?.includes('different input') ? '保存結果を確認してから新しい依頼を始めてください' : '依頼内容を確認できません。仕様・数量・工場の登録状態を確認して再試行してください'

export async function getRfqSelectionOptions(dealId: string) {
  const db = await createClient()
  const error = await requireSalesAccess(db)
  if (error) throw new Error(error)
  const products = await db.from('deal_products').select('id').eq('deal_id', dealId)
  if (products.error) throw new Error('商品を取得できませんでした')
  if (!products.data?.length) return []
  const [variants, quotes] = await Promise.all([
    db.from('deal_product_variants').select('id,product_id,variant_label,width_mm,height_mm,depth_mm,material').in('product_id', products.data.map(p => p.id)).order('variant_order'),
    db.from('deal_quotes').select('variant_id,quantity').eq('deal_id', dealId),
  ])
  if (variants.error || quotes.error) throw new Error('仕様・数量を取得できませんでした')
  return (variants.data || []).map(v => ({ ...v, quantities: [...new Set((quotes.data || []).filter(q => q.variant_id === v.id && Number.isInteger(q.quantity) && q.quantity > 0).map(q => q.quantity))].sort((a, b) => a - b) }))
}

export async function previewRfq(input: RfqV2Input): Promise<{ preview?: RfqPreview; error?: string }> {
  const db = await createClient()
  const access = await requireSalesAccess(db)
  if (access) return { error: access }
  const { data, error } = await db.rpc('preview_rfq_v2', params(input))
  return error || !data ? { error: message(error?.message) } : { preview: data as RfqPreview }
}

export async function createConfirmedRfq(input: RfqV2Input, expected: RfqPreview, requestId: string): Promise<{ data?: CreatedRfq; error?: string }> {
  const db = await createClient()
  const access = await requireSalesAccess(db)
  if (access) return { error: access }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) return { error: '再試行用の依頼IDが無効です' }
  const { data, error } = await db.rpc('create_rfq_v2', { ...params(input), p_request_id: requestId, p_expected: expected })
  if (error || !data) return { error: message(error?.message) }
  const r = data as CreatedRfq
  return { data: { ...r, invitations: r.invitations.map(i => ({ ...i, formUrl: `/external/${i.formToken}` })) } }
}

export interface RfqMailPreview { invitationId: string; from: string; to: string; subject: string; html: string; fingerprint: string; status: string | null }
export async function listRfqHistory(dealId: string) {
  const db = await createClient()
  const access = await requireSalesAccess(db)
  if (access) throw new Error(access)
  const requests = await db.from('rfq_requests').select('id,rfq_number,status,response_deadline,created_at').eq('deal_id', dealId).order('created_at', { ascending: false })
  if (requests.error) throw new Error('依頼履歴を取得できませんでした')
  if (!requests.data?.length) return []
  const invites = await db.from('rfq_factory_invitations').select('id,rfq_id,factory_id,factory_name_pending,external_form_id,invitation_sent_at,responded_at').in('rfq_id', requests.data.map(r => r.id))
  if (invites.error) throw new Error('依頼先履歴を取得できませんでした')
  const [forms, receipts, factories] = await Promise.all([
    invites.data?.length ? db.from('external_forms').select('id,context,status').in('id', invites.data.map(i => i.external_form_id).filter(Boolean)) : Promise.resolve({ data: [], error: null }),
    invites.data?.length ? db.from('rfq_email_receipts').select('invitation_id,status').in('invitation_id', invites.data.map(i => i.id)) : Promise.resolve({ data: [], error: null }),
    db.from('factories').select('id,factory_name'),
  ])
  if (forms.error || receipts.error || factories.error) throw new Error('依頼内容・送信履歴を取得できませんでした')
  return requests.data.map(r => ({ ...r, invitations: (invites.data || []).filter(i => i.rfq_id === r.id).map(i => {
    const form = forms.data?.find(f => f.id === i.external_form_id), ctx = form?.context as (Partial<RfqPreview> & { recipient?: { name: string } }) | null
    return { id: i.id, name: ctx?.recipient?.name || factories.data?.find(f => f.id === i.factory_id)?.factory_name || i.factory_name_pending || '工場名未設定', version: ctx?.schema_version || 1, lines: ctx?.requested_lines || [], response: i.responded_at ? '回答記録あり' : form?.status === 'cancelled' ? '回答リンク停止' : '回答待ち', email: receipts.data?.find(e => e.invitation_id === i.id)?.status || (i.invitation_sent_at ? 'accepted' : null) }
  }) }))
}
const escape = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
async function loadMail(invitationId: string): Promise<RfqMailPreview> {
  const db = await createClient()
  const access = await requireSalesAccess(db)
  if (access) throw new Error(access)
  const inv = await db.from('rfq_factory_invitations').select('id,rfq_id,factory_id,external_form_id,factory_name_pending,factory_email_pending,invitation_sent_at').eq('id', invitationId).single()
  if (inv.error || !inv.data) throw new Error('依頼先が見つかりません')
  const [rfq, form, receipt, factory] = await Promise.all([
    db.from('rfq_requests').select('rfq_number,status,response_deadline,request_message').eq('id', inv.data.rfq_id).single(),
    db.from('external_forms').select('token,context,status,expires_at,cancelled_at,related_id,form_type').eq('id', inv.data.external_form_id).single(),
    db.from('rfq_email_receipts').select('status').eq('invitation_id', invitationId).maybeSingle(),
    inv.data.factory_id ? db.from('factories').select('factory_name,contact_email').eq('id', inv.data.factory_id).single() : Promise.resolve({ data: null, error: null }),
  ])
  if (rfq.error || form.error || receipt.error || factory.error || !rfq.data || !form.data) throw new Error('送信内容を取得できませんでした')
  const f = form.data
  if (f.form_type !== 'rfq_response' || f.related_id !== invitationId || f.cancelled_at || f.status !== 'pending' || !Number.isFinite(Date.parse(f.expires_at)) || Date.parse(f.expires_at) <= Date.now() || !['open', 'partially_responded'].includes(rfq.data.status)) throw new Error('回答リンクが無効または期限切れです')
  const ctx = f.context as (RfqPreview & { recipient?: { name: string; email: string } }) | null
  const frozen = ctx?.schema_version === 2
  const name = frozen ? ctx.recipient?.name : factory.data?.factory_name || inv.data.factory_name_pending
  const to = frozen ? ctx.recipient?.email : factory.data?.contact_email || inv.data.factory_email_pending
  const from = process.env.RFQ_MAIL_FROM, origin = process.env.NEXT_PUBLIC_APP_URL
  if (!from || !to || !origin || !/^https?:\/\//.test(origin) || !process.env.RESEND_API_KEY) throw new Error('メールアドレス・送信元・公開URLの設定を確認してください')
  const deadline = frozen ? ctx.response_deadline : rfq.data.response_deadline
  const note = frozen ? ctx.request_message : rfq.data.request_message
  const link = `${origin.replace(/\/$/, '')}/external/${f.token}`
  const subject = `[${rfq.data.rfq_number}] Quotation Request from (bao) / 询价请求`
  const html = `<p>Dear ${escape(name || '')},</p><p>We would like to request a quotation. / 询价请求</p><p><a href="${escape(link)}">Open specifications and reply / 查看规格并报价</a></p>${deadline ? `<p>Deadline / 截止日: ${escape(deadline)}</p>` : ''}${note ? `<p>${escape(note)}</p>` : ''}<p>(bao) — Packaging procurement service</p>`
  const fingerprint = createHash('sha256').update(JSON.stringify({ from, to, subject, html })).digest('hex')
  return { invitationId, from, to, subject, html, fingerprint, status: receipt.data?.status || (inv.data.invitation_sent_at ? 'accepted' : null) }
}
export async function previewRfqEmail(invitationId: string): Promise<{ preview?: RfqMailPreview; error?: string }> {
  try { return { preview: await loadMail(invitationId) } } catch (e) { return { error: e instanceof Error ? e.message : '送信内容を確認できませんでした' } }
}
export async function sendConfirmedRfqEmail(invitationId: string, expectedFingerprint: string): Promise<{ status?: string; error?: string }> {
  let mail: RfqMailPreview
  try { mail = await loadMail(invitationId) } catch (e) { return { error: e instanceof Error ? e.message : '送信内容を確認できませんでした' } }
  if (mail.fingerprint !== expectedFingerprint) return { error: '送信内容が変更されました。もう一度確認してください' }
  if (mail.status) return { status: mail.status, error: mail.status === 'accepted' ? undefined : '送信予約があるため再送を停止しています。履歴を確認してください' }
  const db = await createClient()
  const { data: claim, error } = await db.rpc('claim_rfq_email_v2', { p_invitation_id: invitationId, p_mail_payload: { from: mail.from, to: mail.to, subject: mail.subject, html: mail.html } })
  if (error || !claim) return { error: '送信予約を確認できません。再送前に履歴を確認してください' }
  if (!claim.claimed) return { status: claim.status, error: claim.status === 'accepted' ? undefined : '送信予約済みのため再送を停止しています' }
  let status = 'unknown', providerId: string | null = null
  try {
    const res = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `rfq-invitation/${invitationId}` }, body: JSON.stringify({ from: mail.from, to: [mail.to], subject: mail.subject, html: mail.html }) })
    if (!res.ok) status = 'rejected'
    else { const body = await res.json(); if (typeof body.id === 'string' && body.id) { status = 'accepted'; providerId = body.id } }
  } catch { /* An uncertain provider call never permits another attempt. */ }
  const result = await db.rpc('finish_rfq_email', { p_invitation_id: invitationId, p_attempt_id: claim.attemptId, p_status: status, p_provider_id: providerId })
  if (result.error) return { status: 'unknown', error: '送信結果の保存を確認できません。重複防止のため再送を停止しています' }
  return { status, error: status === 'accepted' ? undefined : '送信を確認できません。再送せず履歴を確認してください' }
}
