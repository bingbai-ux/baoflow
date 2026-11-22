'use server'

// 再設計 工程8: 発送（完了報告の確認 → 届け先と段ボールラベル → 発送依頼 → 梱包写真の確認 → 追跡番号つきで発送完了 → 顧客へ知らせる）。

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSalesAccess } from './deal-access'
import { defaultIssuerName } from './issuer-companies'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export interface DealShipment {
  completionAt: string | null; completionNote: string | null
  shipTo: { name: string; postalCode: string; address: string; phone: string }; cartonCount: number | null; inspectionDays: number | null
  requestedAt: string | null; packedAt: string | null
  carrier: string | null; trackingNumber: string | null; trackingUrl: string | null; shippedOn: string | null
  notifyStatus: 'accepted' | 'rejected' | 'unknown' | 'skipped' | null
}

export async function getDealShipment(dealId: string): Promise<DealShipment> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('deal_shipments')
    .select('completion_received_at, completion_note, ship_to_name, ship_to_postal_code, ship_to_address, ship_to_phone, carton_count, inspection_days, requested_at, packed_at, carrier, tracking_number, tracking_url, shipped_on, notify_status')
    .eq('deal_id', dealId).limit(1)
  if (error) throw new Error('Shipment could not be loaded')
  const r = data?.[0]
  return {
    completionAt: r?.completion_received_at || null, completionNote: r?.completion_note || null,
    shipTo: { name: r?.ship_to_name || '', postalCode: r?.ship_to_postal_code || '', address: r?.ship_to_address || '', phone: r?.ship_to_phone || '' },
    cartonCount: r?.carton_count ?? null, inspectionDays: r?.inspection_days ?? null, requestedAt: r?.requested_at || null, packedAt: r?.packed_at || null,
    carrier: r?.carrier || null, trackingNumber: r?.tracking_number || null, trackingUrl: r?.tracking_url || null, shippedOn: r?.shipped_on || null, notifyStatus: r?.notify_status || null,
  }
}

export async function saveShipment(dealId: string, action: 'completion' | 'destination' | 'request' | 'packed', payload: Record<string, unknown> = {}): Promise<{ error: string | null }> {
  if (!UUID.test(dealId || '')) return { error: '案件が見つかりません' }
  const supabase = await createClient()
  const accessError = await requireSalesAccess(supabase)
  if (accessError) return { error: accessError }
  const { data, error } = await supabase.rpc('save_deal_shipment', { p_deal_id: dealId, p_action: action, p_payload: payload })
  if (error || !data?.success) return { error: error?.message || '記録できませんでした' }
  revalidatePath(`/deals/${dealId}`); revalidatePath('/deals')
  return { error: null }
}

/**
 * 発送完了を記録し、顧客へ追跡番号をメールで知らせる。
 * メールの設定や宛先が無いときは送らず、その旨を返す（発送完了の記録は残る）。
 */
export async function recordShipped(dealId: string, input: { carrier: string; trackingNumber: string; trackingUrl: string; shippedOn: string }): Promise<{ error: string | null; notice: string | null }> {
  if (!UUID.test(dealId || '')) return { error: '案件が見つかりません', notice: null }
  const supabase = await createClient()
  const accessError = await requireSalesAccess(supabase)
  if (accessError) return { error: accessError, notice: null }
  const { data, error } = await supabase.rpc('save_deal_shipment', { p_deal_id: dealId, p_action: 'shipped', p_payload: { carrier: input.carrier, tracking_number: input.trackingNumber, tracking_url: input.trackingUrl, shipped_on: input.shippedOn } })
  if (error || !data?.success) return { error: error?.message || '記録できませんでした', notice: null }
  revalidatePath(`/deals/${dealId}`); revalidatePath('/deals')

  const to = data.contactEmail as string | null, from = process.env.RFQ_MAIL_FROM
  let status: 'accepted' | 'rejected' | 'unknown' | 'skipped' = 'skipped', notice: string | null = null
  if (!to) notice = '担当者のメールアドレスが未登録のため、顧客へのお知らせメールは送っていません。追跡番号を直接お伝えください。'
  else if (!process.env.RESEND_API_KEY || !from) notice = 'メール送信の設定が無いため、顧客へのお知らせメールは送っていません。追跡番号を直接お伝えください。'
  else {
    status = 'unknown'
    const issuerName = await defaultIssuerName()
    const text = `${data.clientName || ''} ${data.contactName || 'ご担当者'} 様\n\nお世話になっております。(bao) です。\n「${data.dealName}」を発送しました。\n\n発送日: ${input.shippedOn.replace(/-/g, '/')}\n${input.carrier ? `配送業者: ${input.carrier}\n` : ''}追跡番号: ${input.trackingNumber}\n${input.trackingUrl ? `追跡ページ: ${input.trackingUrl}\n` : ''}\n到着しましたら、内容をご確認ください。\n\n(bao) ${issuerName}`
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `deal-shipped/${dealId}` },
        body: JSON.stringify({ from, to: [to], subject: `【発送のお知らせ】${data.dealName}`, text }),
      })
      if (!res.ok) status = 'rejected'
      else { const body = await res.json(); if (typeof body.id === 'string' && body.id) status = 'accepted' }
    } catch { /* 結果が分からないときは unknown のまま記録する */ }
    if (status !== 'accepted') notice = status === 'rejected' ? '顧客へのお知らせメールを送れませんでした。追跡番号を直接お伝えください。' : '顧客へのお知らせメールが届いたか確認できません。追跡番号を直接お伝えください。'
  }
  const mark = await supabase.rpc('save_deal_shipment', { p_deal_id: dealId, p_action: 'notified', p_payload: { status } })
  if (mark.error) notice = (notice ? notice + ' ' : '') + 'お知らせの送信結果を記録できませんでした。'
  revalidatePath(`/deals/${dealId}`)
  return { error: null, notice }
}
