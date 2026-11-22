'use server'

// 再設計 工程5: 請求書の発行（メール + PDF + ログイン不要のページ）→ 顧客の承認 = 契約成立。

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSalesAccess } from './deal-access'
import { logSentMail } from '@/lib/process/talk-log'
import { sendEmail } from '@/lib/utils/email'
import { orderInvoicePDF } from '@/lib/pdf/order-invoice'
import { yen } from '@/lib/process/offer-format'
import { replyToField } from '@/lib/process/reply-address'
import { jpDate, type InvoiceSnapshot } from '@/lib/process/invoice-format'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TOKEN = /^[0-9a-f]{64}$/
const DAY = /^\d{4}-\d{2}-\d{2}$/
const esc = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

export interface AgreementRow {
  id: string; seq: number; invoiceNumber: string; status: 'sent' | 'agreed' | 'cancelled'; issueDate: string; dueDate: string; snapshot: InvoiceSnapshot
  contactName: string | null; contactEmail: string | null; sendStatus: 'accepted' | 'rejected' | 'unknown' | null; sentAt: string | null
  agreedAt: string | null; agreedVia: 'link' | 'staff' | null; createdAt: string
}

export async function listOrderAgreements(dealId: string): Promise<AgreementRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('order_agreements')
    .select('id, seq, invoice_number, status, issue_date, due_date, snapshot, contact_name, contact_email, send_status, sent_at, agreed_at, agreed_via, created_at')
    .eq('deal_id', dealId).order('seq', { ascending: false }).limit(50)
  if (error) throw new Error('Invoices could not be loaded')
  return (data || []).map(r => ({
    id: r.id, seq: r.seq, invoiceNumber: r.invoice_number, status: r.status, issueDate: r.issue_date, dueDate: r.due_date, snapshot: r.snapshot as InvoiceSnapshot,
    contactName: r.contact_name, contactEmail: r.contact_email, sendStatus: r.send_status, sentAt: r.sent_at, agreedAt: r.agreed_at, agreedVia: r.agreed_via, createdAt: r.created_at,
  }))
}

/** 請求書をつくり、PDFを付けたメールを送る。メールの設定や宛先が無いときは送らず、ページのリンクだけ返す。 */
export async function issueOrderInvoice(dealId: string, issueDate: string, dueDate: string, issuerId: string): Promise<{ link: string | null; sent: boolean; to: string | null; error: string | null }> {
  const fail = (error: string) => ({ link: null, sent: false, to: null, error })
  if (!UUID.test(dealId || '')) return fail('案件が見つかりません')
  if (!DAY.test(issueDate || '') || !DAY.test(dueDate || '')) return fail('発行日と振込期限を選んでください')
  if (!UUID.test(issuerId || '')) return fail('発行元の会社を選んでください')
  const supabase = await createClient()
  const accessError = await requireSalesAccess(supabase)
  if (accessError) return fail(accessError)
  const { data, error } = await supabase.rpc('create_order_agreement', { p_deal_id: dealId, p_issue_date: issueDate, p_due_date: dueDate, p_issuer_id: issuerId })
  if (error || !data?.success) return fail(error?.message || '請求書をつくれませんでした')
  revalidatePath(`/deals/${dealId}`); revalidatePath('/deals')
  const origin = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
  if (!/^https?:\/\//.test(origin)) return fail('公開URL（NEXT_PUBLIC_APP_URL）が未設定のため、請求書ページのリンクをつくれません。管理者に連絡してください。')
  const link = `${origin}/external/invoice/${data.token}`
  const to = data.contactEmail as string | null
  const from = process.env.RFQ_MAIL_FROM
  if (!to) return { link, sent: false, to: null, error: '担当者のメールアドレスが未登録です。下のリンクを担当者へ直接お送りください。' }
  if (!process.env.RESEND_API_KEY || !from) return { link, sent: false, to, error: 'メール送信の設定がありません。下のリンクを担当者へ直接お送りください。' }

  const s = data.snapshot as InvoiceSnapshot
  const pdf = await orderInvoicePDF(s, { logo: data.logo as string | null, stamp: data.stamp as string | null })
  const subject = `【ご請求書】${s.deal_name || ''}（${s.invoice_number}）`
  const text = `${s.client_name || ''} ${data.contactName || 'ご担当者'} 様\n\nお世話になっております。${s.issuer.name} です。\nご請求書をお送りします（ご請求金額 ${yen(s.total_jpy)}・お振込期限 ${jpDate(s.due_date)}）。\n添付をご確認のうえ、下のページで「この内容で発注する」を押してください（ログインは不要です）。ボタンを押した時点でご契約成立となります。\n\n${link}\n\n${s.issuer.name}`
  let status: 'accepted' | 'rejected' | 'unknown' = 'unknown'
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `order-agreement/${data.id}` },
      body: JSON.stringify({ from, to: [to], subject, text, ...replyToField(dealId, 'client'), attachments: [{ filename: `請求書_${s.invoice_number}.pdf`, content: Buffer.from(pdf).toString('base64') }] }),
    })
    if (!res.ok) status = 'rejected'
    else { const body = await res.json(); if (typeof body.id === 'string' && body.id) status = 'accepted' }
  } catch { /* 結果が分からないときは unknown のまま記録する */ }
  const mark = await supabase.rpc('mark_order_agreement_sent', { p_id: data.id, p_status: status })
  if (status === 'accepted') await logSentMail(supabase, dealId, subject, `請求書 ${s.invoice_number} を送りました（ご請求金額 ${yen(s.total_jpy)}・お振込期限 ${jpDate(s.due_date)}）。\n請求書ページ: ${link}`)
  revalidatePath(`/deals/${dealId}`); revalidatePath('/deals')
  if (mark.error) return { link, sent: status === 'accepted', to, error: '送信結果を記録できませんでした。画面を読み直して状態を確認してください。' }
  if (status !== 'accepted') return { link, sent: false, to, error: status === 'rejected' ? 'メールを送れませんでした。宛先を確認するか、下のリンクを直接お送りください。' : 'メールが届いたか確認できません。下のリンクを直接お送りください。' }
  return { link, sent: true, to, error: null }
}

/** 電話などで承認をもらったときの記録（契約成立）と、発行の取り消し。 */
export async function recordAgreementDecision(dealId: string, decision: 'agree' | 'cancel'): Promise<{ error: string | null }> {
  if (!UUID.test(dealId || '')) return { error: '案件が見つかりません' }
  const supabase = await createClient()
  const accessError = await requireSalesAccess(supabase)
  if (accessError) return { error: accessError }
  const { data, error } = await supabase.rpc('staff_decide_order_agreement', { p_deal_id: dealId, p_decision: decision })
  if (error || !data?.success) return { error: error?.message || '記録できませんでした' }
  revalidatePath(`/deals/${dealId}`); revalidatePath('/deals')
  return { error: null }
}

// ---- ここから下は、ログインしていない顧客がリンクから使う ----

export async function loadAgreement(token: string): Promise<{ status: 'sent' | 'agreed' | 'cancelled' | 'expired' | 'missing'; snapshot: InvoiceSnapshot | null; agreedAt: string | null; logo: string | null; stamp: string | null }> {
  const none = { status: 'missing' as const, snapshot: null, agreedAt: null, logo: null, stamp: null }
  if (!TOKEN.test(token || '')) return none
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('order_agreement_by_token', { p_token: token })
  if (error) throw new Error('Invoice could not be loaded')
  if (!data?.found) return none
  const image = (v: unknown) => typeof v === 'string' && /^data:image\/(png|jpeg);base64,/.test(v) ? v : null
  return { status: data.status, snapshot: data.snapshot as InvoiceSnapshot, agreedAt: data.agreedAt || null, logo: image(data.logo), stamp: image(data.stamp) }
}

export async function agreeByCustomer(token: string): Promise<{ success: boolean; error?: string }> {
  if (!TOKEN.test(token || '')) return { success: false, error: 'この請求書のページは見つかりません' }
  const supabase = await createClient()
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0].trim() || h.get('x-real-ip') || null
  const { data, error } = await supabase.rpc('agree_order_agreement', { p_token: token, p_ip: ip, p_ua: h.get('user-agent') })
  if (error || !data?.success) return { success: false, error: error?.message || '記録できませんでした。時間をおいてもう一度お試しください。' }
  if (!data.already) {
    const origin = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
    const summary = `<p>請求書番号: ${esc(String(data.invoiceNumber))}<br>ご請求金額（税込）: ${esc(yen(Number(data.totalJpy)))}</p>`
    // 双方への成立メール。失敗しても成立は記録済み（営業にはアプリ内のお知らせも出る）
    if (data.notifyEmail) await sendEmail({ to: data.notifyEmail, subject: `[bao] 契約成立: ${data.notifyClientName || '顧客'}（${data.notifyDealName}）`,
      body: `<p>${esc(data.notifyClientName || '顧客')} が「${esc(data.notifyDealName || '')}」の請求書を承認し、契約が成立しました。入稿に進めます。</p>${summary}${origin ? `<p><a href="${origin}/deals/${data.notifyDealId}?step=9">案件を開く</a></p>` : ''}` })
    if (data.customerEmail) await sendEmail({ to: data.customerEmail, subject: `【ご契約成立のお知らせ】${data.notifyDealName}`,
      body: `<p>${esc(data.notifyClientName || '')} ${esc(data.customerName || 'ご担当者')} 様</p><p>「${esc(data.notifyDealName || '')}」のご発注を承りました。ご契約成立となります。ありがとうございます。</p>${summary}` })
  }
  return { success: true }
}
