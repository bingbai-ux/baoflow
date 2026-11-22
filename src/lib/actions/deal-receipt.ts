'use server'

// 再設計 工程9: 検収（到着 → 顧客へ受領の確認を依頼 → 受領で納品書を送って完了）と、同じ内容での次回オーダー（リピート）。

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSalesAccess } from './deal-access'
import { sendEmail } from '@/lib/utils/email'
import { deliveryNotePDF } from '@/lib/pdf/receipt-delivery-note'
import type { ReceiptSnapshot } from '@/lib/process/receipt-format'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TOKEN = /^[0-9a-f]{64}$/
const DAY = /^\d{4}-\d{2}-\d{2}$/
const esc = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const image = (v: unknown) => typeof v === 'string' && /^data:image\/(png|jpeg);base64,/.test(v) ? v : null
type Mail = 'accepted' | 'rejected' | 'unknown'

export interface ReceiptRow {
  id: string; seq: number; deliveryNoteNumber: string; status: 'sent' | 'received' | 'cancelled'; arrivedOn: string; snapshot: ReceiptSnapshot
  contactName: string | null; contactEmail: string | null; sendStatus: Mail | null; sentAt: string | null; receivedAt: string | null; receivedVia: 'link' | 'staff' | null; createdAt: string
}

export async function listDealReceipts(dealId: string): Promise<ReceiptRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('deal_receipts')
    .select('id, seq, delivery_note_number, status, arrived_on, snapshot, contact_name, contact_email, send_status, sent_at, received_at, received_via, created_at')
    .eq('deal_id', dealId).order('seq', { ascending: false }).limit(50)
  if (error) throw new Error('Receipts could not be loaded')
  return (data || []).map(r => ({ id: r.id, seq: r.seq, deliveryNoteNumber: r.delivery_note_number, status: r.status, arrivedOn: r.arrived_on, snapshot: r.snapshot as ReceiptSnapshot,
    contactName: r.contact_name, contactEmail: r.contact_email, sendStatus: r.send_status, sentAt: r.sent_at, receivedAt: r.received_at, receivedVia: r.received_via, createdAt: r.created_at }))
}

async function resend(to: string, subject: string, text: string, key: string, attachment?: { filename: string; bytes: Uint8Array }): Promise<Mail> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify({ from: process.env.RFQ_MAIL_FROM, to: [to], subject, text, ...(attachment ? { attachments: [{ filename: attachment.filename, content: Buffer.from(attachment.bytes).toString('base64') }] } : {}) }),
    })
    if (!res.ok) return 'rejected'
    const body = await res.json()
    return typeof body.id === 'string' && body.id ? 'accepted' : 'unknown'
  } catch { return 'unknown' }
}
const mailReady = () => !!process.env.RESEND_API_KEY && !!process.env.RFQ_MAIL_FROM

/** 納品書PDFを顧客へメールで送る。送れなかった理由があれば文章で返す（null なら送信できた）。 */
async function mailDeliveryNote(to: string | null, name: string | null, s: ReceiptSnapshot, images: { logo: string | null; stamp: string | null }, key: string): Promise<string | null> {
  if (!to) return '担当者のメールアドレスが未登録のため、納品書はメールで送っていません。納品書を開いて直接お渡しください。'
  if (!mailReady()) return 'メール送信の設定が無いため、納品書はメールで送っていません。納品書を開いて直接お渡しください。'
  const pdf = await deliveryNotePDF(s, images)
  const status = await resend(to, `【納品書】${s.deal_name || ''}（${s.delivery_note_number}）`,
    `${s.client_name || ''} ${name || 'ご担当者'} 様\n\nお世話になっております。${s.issuer.name} です。\n受領のご確認ありがとうございました。納品書をお送りします。\n\n${s.issuer.name}`, key, { filename: `納品書_${s.delivery_note_number}.pdf`, bytes: pdf })
  return status === 'accepted' ? null : '納品書のメールを送れたか確認できません。納品書を開いて直接お渡しください。'
}

/** 到着を記録し、顧客へ受領の確認を依頼する。メールの設定や宛先が無いときは送らず、確認ページのリンクだけ返す。 */
export async function requestReceipt(dealId: string, arrivedOn: string): Promise<{ link: string | null; sent: boolean; to: string | null; error: string | null }> {
  const fail = (error: string) => ({ link: null, sent: false, to: null, error })
  if (!UUID.test(dealId || '')) return fail('案件が見つかりません')
  if (!DAY.test(arrivedOn || '')) return fail('到着日を選んでください')
  const supabase = await createClient()
  const accessError = await requireSalesAccess(supabase)
  if (accessError) return fail(accessError)
  const { data, error } = await supabase.rpc('create_deal_receipt', { p_deal_id: dealId, p_arrived_on: arrivedOn })
  if (error || !data?.success) return fail(error?.message || '記録できませんでした')
  revalidatePath(`/deals/${dealId}`); revalidatePath('/deals')
  const origin = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
  if (!/^https?:\/\//.test(origin)) return fail('公開URL（NEXT_PUBLIC_APP_URL）が未設定のため、確認ページのリンクをつくれません。管理者に連絡してください。')
  const link = `${origin}/external/receipt/${data.token}`
  const to = data.contactEmail as string | null
  if (!to) return { link, sent: false, to: null, error: '担当者のメールアドレスが未登録です。下のリンクを担当者へ直接お送りください。' }
  if (!mailReady()) return { link, sent: false, to, error: 'メール送信の設定がありません。下のリンクを担当者へ直接お送りください。' }
  const s = data.snapshot as ReceiptSnapshot
  const status = await resend(to, `【お届けのご確認】${s.deal_name || ''}`,
    `${s.client_name || ''} ${data.contactName || 'ご担当者'} 様\n\nお世話になっております。${s.issuer.name} です。\n「${s.deal_name || ''}」をお届けしました。内容をご確認のうえ、下のページで「受領しました」を押してください（ログインは不要です）。納品書をお送りします。\n\n${link}\n\n${s.issuer.name}`, `deal-receipt/${data.id}`)
  const mark = await supabase.rpc('mark_deal_receipt_sent', { p_id: data.id, p_status: status })
  revalidatePath(`/deals/${dealId}`)
  if (mark.error) return { link, sent: status === 'accepted', to, error: '送信結果を記録できませんでした。画面を読み直して状態を確認してください。' }
  if (status !== 'accepted') return { link, sent: false, to, error: status === 'rejected' ? 'メールを送れませんでした。宛先を確認するか、下のリンクを直接お送りください。' : 'メールが届いたか確認できません。下のリンクを直接お送りください。' }
  return { link, sent: true, to, error: null }
}

/** 電話などで受領の連絡をもらったときの記録（納品書を送って完了）と、依頼の取り消し。 */
export async function recordReceiptDecision(dealId: string, decision: 'received' | 'cancel'): Promise<{ error: string | null; notice: string | null }> {
  if (!UUID.test(dealId || '')) return { error: '案件が見つかりません', notice: null }
  const supabase = await createClient()
  const accessError = await requireSalesAccess(supabase)
  if (accessError) return { error: accessError, notice: null }
  const { data, error } = await supabase.rpc('staff_decide_deal_receipt', { p_deal_id: dealId, p_decision: decision })
  if (error || !data?.success) return { error: error?.message || '記録できませんでした', notice: null }
  revalidatePath(`/deals/${dealId}`); revalidatePath('/deals')
  if (decision === 'cancel') return { error: null, notice: null }
  const s = data.snapshot as ReceiptSnapshot
  const issuer = s.issuer.id ? await supabase.from('issuer_companies').select('logo_data, stamp_data').eq('id', s.issuer.id).limit(1) : { data: null, error: null }
  if (issuer.error) return { error: null, notice: '受領は記録しましたが、納品書を送れませんでした。納品書を開いて直接お渡しください。' }
  const notice = await mailDeliveryNote(data.contactEmail, data.contactName, s, { logo: image(issuer.data?.[0]?.logo_data), stamp: image(issuer.data?.[0]?.stamp_data) }, `delivery-note/${data.id}`)
  return { error: null, notice }
}

/** 同じ取引先・同じ商品（仕様と数量）で新しい案件をつくる。requestId は同じ操作のやり直しで同じ値を渡す。 */
export async function repeatProject(requestId: string, dealId: string): Promise<{ error: string | null; dealId?: string }> {
  if (!UUID.test(requestId || '') || !UUID.test(dealId || '')) return { error: '案件が見つかりません' }
  const supabase = await createClient()
  const accessError = await requireSalesAccess(supabase)
  if (accessError) return { error: accessError }
  const { data, error } = await supabase.rpc('repeat_project_v1', { p_request_id: requestId, p_deal_id: dealId })
  if (error || !data?.success || !data.dealId) return { error: error?.message || '新しい案件をつくれませんでした' }
  revalidatePath('/deals')
  return { error: null, dealId: data.dealId }
}

// ---- ここから下は、ログインしていない顧客がリンクから使う ----

export async function loadReceipt(token: string): Promise<{ status: 'sent' | 'received' | 'cancelled' | 'expired' | 'missing'; snapshot: ReceiptSnapshot | null; logo: string | null; stamp: string | null }> {
  const none = { status: 'missing' as const, snapshot: null, logo: null, stamp: null }
  if (!TOKEN.test(token || '')) return none
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('deal_receipt_by_token', { p_token: token })
  if (error) throw new Error('Receipt could not be loaded')
  if (!data?.found) return none
  return { status: data.status, snapshot: data.snapshot as ReceiptSnapshot, logo: image(data.logo), stamp: image(data.stamp) }
}

export async function confirmReceiptByCustomer(token: string): Promise<{ success: boolean; error?: string }> {
  if (!TOKEN.test(token || '')) return { success: false, error: 'このページは見つかりません' }
  const supabase = await createClient()
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0].trim() || h.get('x-real-ip') || null
  const { data, error } = await supabase.rpc('confirm_deal_receipt', { p_token: token, p_ip: ip, p_ua: h.get('user-agent') })
  if (error || !data?.success) return { success: false, error: error?.message || '記録できませんでした。時間をおいてもう一度お試しください。' }
  if (!data.already) {
    const s = data.snapshot as ReceiptSnapshot
    // 納品書の送付と営業へのお知らせ。失敗しても受領は記録済み（顧客はこのページから納品書を開ける。営業にはアプリ内のお知らせも出る）
    const view = await supabase.rpc('deal_receipt_by_token', { p_token: token })
    await mailDeliveryNote(data.customerEmail, data.customerName, s, { logo: image(view.data?.logo), stamp: image(view.data?.stamp) }, `delivery-note/${token.slice(0, 32)}`)
    const origin = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
    if (data.notifyEmail) await sendEmail({ to: data.notifyEmail, subject: `[bao] 受領の確認: ${data.notifyClientName || '顧客'}（${data.notifyDealName}）`,
      body: `<p>${esc(data.notifyClientName || '顧客')} が「${esc(data.notifyDealName || '')}」の受領を確認しました。案件完了です。</p>${origin ? `<p><a href="${origin}/deals/${data.notifyDealId}?step=12">案件を開く</a></p>` : ''}` })
  }
  return { success: true }
}
