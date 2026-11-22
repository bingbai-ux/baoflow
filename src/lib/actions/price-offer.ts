'use server'

// 再設計 工程4: 価格の保存 → お見積の提示（メール + PDF + ログイン不要のページ）→ 承認 / 差し戻し。

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSalesAccess } from './deal-access'
import { defaultIssuerName } from './issuer-companies'
import { sendEmail } from '@/lib/utils/email'
import { priceOfferPDF } from '@/lib/pdf/price-offer'
import { offerNumber, type OfferSnapshot } from '@/lib/process/offer-format'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TOKEN = /^[0-9a-f]{64}$/
const esc = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const jstDay = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })

export interface OfferRow {
  id: string; round: number; status: 'sent' | 'approved' | 'returned' | 'cancelled'
  snapshot: OfferSnapshot; contactName: string | null; contactEmail: string | null
  sendStatus: 'accepted' | 'rejected' | 'unknown' | null; sentAt: string | null
  decidedAt: string | null; decidedVia: 'link' | 'staff' | null; choices: string[] | null; returnComment: string | null; createdAt: string
}
export interface PriceLineInput { quote_id: string; factory_unit_price_usd: number; fees_usd: number; freight_usd: number; selling_price_jpy: number }

export async function listPriceOffers(dealId: string): Promise<OfferRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('price_offers')
    .select('id, round, status, snapshot, contact_name, contact_email, send_status, sent_at, decided_at, decided_via, choices, return_comment, created_at')
    .eq('deal_id', dealId).order('round', { ascending: false }).limit(50)
  if (error) throw new Error('Price offers could not be loaded')
  return (data || []).map(r => ({
    id: r.id, round: r.round, status: r.status, snapshot: r.snapshot as OfferSnapshot, contactName: r.contact_name, contactEmail: r.contact_email,
    sendStatus: r.send_status, sentAt: r.sent_at, decidedAt: r.decided_at, decidedVia: r.decided_via, choices: (r.choices as string[] | null) || null, returnComment: r.return_comment, createdAt: r.created_at,
  }))
}

export async function saveOfferPrices(dealId: string, input: { exchangeRate: number; taxRate: number; lines: PriceLineInput[]; productionDays: Record<string, number | null> }): Promise<{ error: string | null }> {
  if (!UUID.test(dealId || '')) return { error: '案件が見つかりません' }
  const supabase = await createClient()
  const accessError = await requireSalesAccess(supabase)
  if (accessError) return { error: accessError }
  const { data, error } = await supabase.rpc('save_offer_prices_v1', { p_deal_id: dealId, p_payload: { exchange_rate: input.exchangeRate, tax_rate: input.taxRate, lines: input.lines, production_days: input.productionDays } })
  if (error || !data?.success) return { error: error?.message || '価格を保存できませんでした' }
  revalidatePath(`/deals/${dealId}`); revalidatePath('/deals')
  return { error: null }
}

/** お見積をつくり、PDFを付けたメールを送る。メールの設定や宛先が無いときは送らず、ページのリンクだけ返す。 */
export async function sendPriceOffer(dealId: string): Promise<{ link: string | null; sent: boolean; to: string | null; error: string | null }> {
  if (!UUID.test(dealId || '')) return { link: null, sent: false, to: null, error: '案件が見つかりません' }
  const supabase = await createClient()
  const accessError = await requireSalesAccess(supabase)
  if (accessError) return { link: null, sent: false, to: null, error: accessError }
  const { data, error } = await supabase.rpc('create_price_offer', { p_deal_id: dealId })
  if (error || !data?.success) return { link: null, sent: false, to: null, error: error?.message || 'お見積をつくれませんでした' }
  revalidatePath(`/deals/${dealId}`); revalidatePath('/deals')
  const origin = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
  if (!/^https?:\/\//.test(origin)) return { link: null, sent: false, to: null, error: '公開URL（NEXT_PUBLIC_APP_URL）が未設定のため、お見積ページのリンクをつくれません。管理者に連絡してください。' }
  const link = `${origin}/external/offer/${data.token}`
  const to = data.contactEmail as string | null
  const from = process.env.RFQ_MAIL_FROM
  if (!to) return { link, sent: false, to: null, error: '担当者のメールアドレスが未登録です。下のリンクを担当者へ直接お送りください。' }
  if (!process.env.RESEND_API_KEY || !from) return { link, sent: false, to, error: 'メール送信の設定がありません。下のリンクを担当者へ直接お送りください。' }

  const s = data.snapshot as OfferSnapshot
  const now = new Date()
  const issuerName = await defaultIssuerName()
  const pdf = await priceOfferPDF(s, jstDay(now), jstDay(new Date(now.getTime() + 30 * 86400000)), issuerName)
  const subject = `【お見積書】${s.deal_name || ''}（${offerNumber(s)}）`
  const text = `${s.client_name || ''} ${data.contactName || 'ご担当者'} 様\n\nお世話になっております。(bao) です。\nお見積書（第${s.round}回）をお送りします。添付をご確認のうえ、下のページで「承認」または「変更を依頼」をお選びください（ログインは不要です）。\n\n${link}\n\n(bao) ${issuerName}`
  let status: 'accepted' | 'rejected' | 'unknown' = 'unknown'
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `price-offer/${data.id}` },
      body: JSON.stringify({ from, to: [to], subject, text, attachments: [{ filename: `お見積書_${offerNumber(s)}.pdf`, content: Buffer.from(pdf).toString('base64') }] }),
    })
    if (!res.ok) status = 'rejected'
    else { const body = await res.json(); if (typeof body.id === 'string' && body.id) status = 'accepted' }
  } catch { /* 結果が分からないときは unknown のまま記録する */ }
  const mark = await supabase.rpc('mark_price_offer_sent', { p_id: data.id, p_status: status })
  revalidatePath(`/deals/${dealId}`); revalidatePath('/deals')
  if (mark.error) return { link, sent: status === 'accepted', to, error: '送信結果を記録できませんでした。画面を読み直して状態を確認してください。' }
  if (status !== 'accepted') return { link, sent: false, to, error: status === 'rejected' ? 'メールを送れませんでした。宛先を確認するか、下のリンクを直接お送りください。' : 'メールが届いたか確認できません。下のリンクを直接お送りください。' }
  return { link, sent: true, to, error: null }
}

/** 電話などで返事をもらったとき（承認 / 差し戻し）や、提示を取り消すときに営業が記録する。 */
export async function recordOfferDecision(dealId: string, decision: 'approve' | 'return' | 'cancel', choices: Record<string, string> = {}, comment = ''): Promise<{ error: string | null }> {
  if (!UUID.test(dealId || '')) return { error: '案件が見つかりません' }
  const supabase = await createClient()
  const accessError = await requireSalesAccess(supabase)
  if (accessError) return { error: accessError }
  const { data, error } = await supabase.rpc('staff_decide_price_offer', { p_deal_id: dealId, p_decision: decision, p_choices: choices, p_comment: comment || null })
  if (error || !data?.success) return { error: error?.message || '記録できませんでした' }
  revalidatePath(`/deals/${dealId}`); revalidatePath('/deals')
  return { error: null }
}

// ---- ここから下は、ログインしていない顧客がリンクから使う ----

export async function loadOffer(token: string): Promise<{ status: 'sent' | 'approved' | 'returned' | 'cancelled' | 'expired' | 'missing'; snapshot: OfferSnapshot | null; choices: string[]; createdAt: string | null; expiresAt: string | null }> {
  const missing = { status: 'missing' as const, snapshot: null, choices: [], createdAt: null, expiresAt: null }
  if (!TOKEN.test(token || '')) return missing
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('price_offer_by_token', { p_token: token })
  if (error) throw new Error('Offer could not be loaded')
  if (!data?.found) return missing
  return { status: data.status, snapshot: data.snapshot as OfferSnapshot, choices: (data.choices as string[] | null) || [], createdAt: data.createdAt || null, expiresAt: data.expiresAt || null }
}

export async function decideOfferByCustomer(token: string, decision: 'approve' | 'return', choices: Record<string, string>, comment: string): Promise<{ success: boolean; error?: string }> {
  if (!TOKEN.test(token || '')) return { success: false, error: 'このお見積のページは見つかりません' }
  const supabase = await createClient()
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0].trim() || h.get('x-real-ip') || null
  const { data, error } = await supabase.rpc('decide_price_offer', { p_token: token, p_decision: decision, p_choices: choices, p_comment: comment || null, p_ip: ip, p_ua: h.get('user-agent') })
  if (error || !data?.success) return { success: false, error: error?.message || '記録できませんでした。時間をおいてもう一度お試しください。' }
  if (!data.already && data.notifyEmail) {
    const origin = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
    const what = decision === 'approve' ? '承認しました' : '差し戻しました'
    // 営業へのお知らせメール。失敗しても顧客の返事は記録済み（アプリ内のお知らせにも出る）
    await sendEmail({
      to: data.notifyEmail, subject: `[bao] ${data.notifyClientName || '顧客'} がお見積を${what}（${data.notifyDealName}）`,
      body: `<p>${esc(data.notifyClientName || '顧客')} が「${esc(data.notifyDealName || '')}」の第${Number(data.round)}回お見積を${what}。</p>${decision === 'return' ? `<p>${esc(comment)}</p>` : ''}${origin ? `<p><a href="${origin}/deals/${data.notifyDealId}?step=6">案件を開く</a></p>` : ''}`,
    })
  }
  return { success: true }
}

// ---- 工場が回答フォームで入力した追加の費用・送料・日数（原価を入れるときの参考） ----

export interface FactoryExtras { factory: string; fees: Array<{ label: string; usd: number }>; shipping: Array<{ label: string; usd: number }>; leadDays: Array<{ label: string; text: string }> }
const SHIP: Record<string, string> = { sea_usd: '船便', air_usd: '航空便', domestic_usd: '中国国内' }
const LEAD: Record<string, string> = { plate: '製版', sample: 'サンプル', production: '本製造', domestic: '中国国内', sea: '船便', air: '航空便' }
const obj = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}
const pos = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null }

export async function getFactoryExtras(dealId: string): Promise<FactoryExtras[]> {
  const supabase = await createClient()
  const rfqs = await supabase.from('rfq_requests').select('id').eq('deal_id', dealId)
  if (rfqs.error) throw new Error('Factory answers could not be loaded')
  const rfqIds = (rfqs.data || []).map(r => r.id)
  if (!rfqIds.length) return []
  const inv = await supabase.from('rfq_factory_invitations').select('external_form_id, factory_id, factory_name_pending, responded_at').in('rfq_id', rfqIds)
  if (inv.error) throw new Error('Factory answers could not be loaded')
  const answered = (inv.data || []).filter(i => i.responded_at && i.external_form_id)
  if (!answered.length) return []
  const [forms, factories] = await Promise.all([
    supabase.from('external_forms').select('id, submission_data').in('id', answered.map(i => i.external_form_id)),
    supabase.from('factories').select('id, factory_name').in('id', answered.map(i => i.factory_id).filter(Boolean)),
  ])
  if (forms.error || factories.error) throw new Error('Factory answers could not be loaded')
  const out: FactoryExtras[] = []
  for (const i of answered) {
    const e = obj(obj(forms.data?.find(f => f.id === i.external_form_id)?.submission_data).extras)
    const fees = (Array.isArray(e.fees) ? e.fees : []).map(f => ({ label: String(obj(f).label || '費用').slice(0, 60), usd: pos(obj(f).usd) })).filter((f): f is { label: string; usd: number } => f.usd != null)
    const shipping = Object.entries(SHIP).map(([k, label]) => ({ label, usd: pos(obj(e.shipping)[k]) })).filter((s): s is { label: string; usd: number } => s.usd != null)
    const leadDays = Object.entries(LEAD).map(([k, label]) => { const d = obj(obj(e.lead_days)[k]), min = pos(d.min), max = pos(d.max); return { label, text: min && max && min !== max ? `${min}〜${max}日` : min || max ? `${min || max}日` : '' } }).filter(l => l.text)
    if (fees.length || shipping.length || leadDays.length) out.push({ factory: factories.data?.find(f => f.id === i.factory_id)?.factory_name || i.factory_name_pending || '工場', fees, shipping, leadDays })
  }
  return out
}
