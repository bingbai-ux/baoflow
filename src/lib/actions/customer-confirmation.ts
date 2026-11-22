'use server'

// 再設計 工程3: 顧客への商品内容の確認（メール + 明細PDF + ログイン不要の確認ページ）。

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSalesAccess } from './deal-access'
import { sendEmail } from '@/lib/utils/email'
import { customerConfirmationPDF, type ConfirmationSnapshot } from '@/lib/pdf/customer-confirmation'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TOKEN = /^[0-9a-f]{64}$/
const esc = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })

export interface ConfirmationState {
  status: 'none' | 'pending' | 'confirmed' | 'cancelled'
  via: 'link' | 'staff' | null
  contactName: string | null; contactEmail: string | null
  sendStatus: 'accepted' | 'rejected' | 'unknown' | null
  sentAt: string | null; confirmedAt: string | null
  everConfirmed: boolean // 一度でも確認が取れていれば、あとで商品を直しても工場への依頼に進める
}

export async function getConfirmationState(dealId: string): Promise<ConfirmationState> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('customer_confirmations').select('status, confirmed_via, contact_name, contact_email, send_status, sent_at, confirmed_at')
    .eq('deal_id', dealId).order('created_at', { ascending: false }).limit(20)
  if (error) throw new Error('Customer confirmation could not be loaded')
  const rows = (data || []).filter(r => r.status !== 'cancelled') // 取り消した依頼は状態に数えない
  const latest = rows[0]
  return {
    status: (latest?.status as ConfirmationState['status']) || 'none', via: (latest?.confirmed_via as ConfirmationState['via']) || null,
    contactName: latest?.contact_name || null, contactEmail: latest?.contact_email || null, sendStatus: (latest?.send_status as ConfirmationState['sendStatus']) || null,
    sentAt: latest?.sent_at || null, confirmedAt: latest?.confirmed_at || null, everConfirmed: rows.some(r => r.status === 'confirmed'),
  }
}

/** 確認依頼をつくり、明細PDFを付けたメールを送る。メールの設定や宛先が無いときは送らず、確認ページのリンクだけ返す。 */
export async function sendCustomerConfirmation(dealId: string): Promise<{ link: string | null; sent: boolean; to: string | null; error: string | null }> {
  if (!UUID.test(dealId || '')) return { link: null, sent: false, to: null, error: '案件が見つかりません' }
  const supabase = await createClient()
  const accessError = await requireSalesAccess(supabase)
  if (accessError) return { link: null, sent: false, to: null, error: accessError }
  const { data, error } = await supabase.rpc('create_customer_confirmation', { p_deal_id: dealId })
  if (error || !data?.success) return { link: null, sent: false, to: null, error: error?.message || '確認依頼をつくれませんでした' }
  const origin = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
  if (!/^https?:\/\//.test(origin)) { revalidatePath(`/deals/${dealId}`); return { link: null, sent: false, to: null, error: '公開URL（NEXT_PUBLIC_APP_URL）が未設定のため、確認ページのリンクをつくれません。管理者に連絡してください。' } }
  const link = `${origin}/external/confirm/${data.token}`
  const to = data.contactEmail as string | null
  const from = process.env.RFQ_MAIL_FROM
  revalidatePath(`/deals/${dealId}`)
  if (!to) return { link, sent: false, to: null, error: '担当者のメールアドレスが未登録です。下のリンクを担当者へ直接お送りください。' }
  if (!process.env.RESEND_API_KEY || !from) return { link, sent: false, to, error: 'メール送信の設定がありません。下のリンクを担当者へ直接お送りください。' }

  const s = data.snapshot as ConfirmationSnapshot
  const pdf = await customerConfirmationPDF(s, today())
  const subject = `【ご確認のお願い】${s.deal_name || '商品内容'}（${s.deal_code || ''}）`
  const text = `${s.client_name || ''} ${data.contactName || 'ご担当者'} 様\n\nお世話になっております。(bao) です。\nご依頼の商品内容をまとめました。添付の明細をご確認のうえ、問題がなければ下のページで「この内容で進める」を押してください（ログインは不要です）。\n\n${link}\n\n内容に修正がある場合は、このメールにご返信ください。\n\n(bao) / 株式会社FOOD&COMPANY`
  let status: 'accepted' | 'rejected' | 'unknown' = 'unknown'
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `customer-confirmation/${data.id}` },
      body: JSON.stringify({ from, to: [to], subject, text, attachments: [{ filename: `商品内容のご確認_${s.deal_code || 'bao'}.pdf`, content: Buffer.from(pdf).toString('base64') }] }),
    })
    if (!res.ok) status = 'rejected'
    else { const body = await res.json(); if (typeof body.id === 'string' && body.id) status = 'accepted' }
  } catch { /* 結果が分からないときは unknown のまま記録する */ }
  const mark = await supabase.rpc('mark_customer_confirmation_sent', { p_id: data.id, p_status: status })
  revalidatePath(`/deals/${dealId}`); revalidatePath('/deals')
  if (mark.error) return { link, sent: status === 'accepted', to, error: '送信結果を記録できませんでした。画面を読み直して状態を確認してください。' }
  if (status !== 'accepted') return { link, sent: false, to, error: status === 'rejected' ? 'メールを送れませんでした。宛先を確認するか、下のリンクを直接お送りください。' : 'メールが届いたか確認できません。下のリンクを直接お送りください。' }
  return { link, sent: true, to, error: null }
}

/** 電話などで確認が取れたとき、営業が確認済みとして記録する。 */
export async function recordCustomerConfirmed(dealId: string): Promise<{ error: string | null }> {
  if (!UUID.test(dealId || '')) return { error: '案件が見つかりません' }
  const supabase = await createClient()
  const accessError = await requireSalesAccess(supabase)
  if (accessError) return { error: accessError }
  const { data, error } = await supabase.rpc('staff_confirm_customer_confirmation', { p_deal_id: dealId })
  if (error || !data?.success) return { error: error?.message || '記録できませんでした' }
  revalidatePath(`/deals/${dealId}`); revalidatePath('/deals')
  return { error: null }
}

// ---- ここから下は、ログインしていない顧客がリンクから使う ----

export async function loadConfirmation(token: string): Promise<{ status: 'pending' | 'confirmed' | 'cancelled' | 'expired' | 'missing'; snapshot: ConfirmationSnapshot | null; confirmedAt: string | null }> {
  if (!TOKEN.test(token || '')) return { status: 'missing', snapshot: null, confirmedAt: null }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('customer_confirmation_by_token', { p_token: token })
  if (error) throw new Error('Confirmation could not be loaded')
  if (!data?.found) return { status: 'missing', snapshot: null, confirmedAt: null }
  return { status: data.status, snapshot: data.snapshot as ConfirmationSnapshot, confirmedAt: data.confirmedAt || null }
}

export async function confirmByCustomer(token: string): Promise<{ success: boolean; error?: string }> {
  if (!TOKEN.test(token || '')) return { success: false, error: 'この確認ページは見つかりません' }
  const supabase = await createClient()
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0].trim() || h.get('x-real-ip') || null
  const { data, error } = await supabase.rpc('confirm_customer_confirmation', { p_token: token, p_ip: ip, p_ua: h.get('user-agent') })
  if (error || !data?.success) return { success: false, error: error?.message || '確認を記録できませんでした。時間をおいてもう一度お試しください。' }
  if (!data.already && data.notifyEmail) {
    const origin = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
    // 営業へのお知らせメール。失敗しても顧客の確認は記録済み（アプリ内のお知らせにも出る）
    await sendEmail({
      to: data.notifyEmail, subject: `[bao] ${data.notifyClientName || '顧客'} が商品内容を確認しました（${data.notifyDealName}）`,
      body: `<p>${esc(data.notifyClientName || '顧客')} が「${esc(data.notifyDealName || '')}」の商品内容を確認しました。</p><p>工場へ見積を依頼できます。</p>${origin ? `<p><a href="${origin}/deals/${data.notifyDealId}?step=3">案件を開く</a></p>` : ''}`,
    })
  }
  return { success: true }
}
