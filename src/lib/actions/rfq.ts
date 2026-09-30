'use server'

// Sprint 8-6: 見積依頼 (RFQ) 作成。複数工場へ同条件で依頼。

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSalesAccess } from './deal-access'

interface CreateRfqInput {
  requestId: string
  dealId: string
  productIds: string[]
  factoryIds: string[] // factories マスターから選択
  pendingFactories?: Array<{ name: string; email?: string }> // 未登録工場 (Sprint 8 では先送り、UI 簡略化)
  responseDeadline?: string | null
  requestMessage?: string | null
}

export interface CreatedRfq {
  rfqId: string
  rfqNumber: string
  invitations: Array<{
    invitationId: string
    factoryId: string | null
    factoryName: string
    formToken: string
    formUrl: string
    emailed?: boolean
  }>
}

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

// Sprint 14: RFQ メール送信 (RESEND_API_KEY 設定時のみ)。
// 未設定でも RFQ 自体は成立する (リンクコピー + 工場ポータル表示)。
async function sendRfqEmail(args: {
  invitationId: string
  to: string
  factoryName: string
  rfqNumber: string
  formUrl: string
  deadline?: string | null
  message?: string | null
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.RFQ_MAIL_FROM || 'BAO Flow <onboarding@resend.dev>'
  if (!key || !args.to) return false
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': `rfq-invitation/${args.invitationId}` },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject: `[${args.rfqNumber}] Quotation Request from (bao) / 询价请求`,
        html: `
          <p>Dear ${escapeHtml(args.factoryName)},</p>
          <p>We would like to request a quotation. Please open the link below to see the specifications and submit your prices.</p>
          <p>请通过以下链接查看产品规格并提交报价。</p>
          <p><a href="${escapeHtml(args.formUrl)}">${escapeHtml(args.formUrl)}</a></p>
          ${args.deadline ? `<p>Deadline / 截止日: ${args.deadline}</p>` : ''}
          ${args.message ? `<p>${escapeHtml(args.message)}</p>` : ''}
          <p>(bao) — Packaging procurement service</p>`,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function createRfq(input: CreateRfqInput): Promise<{ data: CreatedRfq | null; error: string | null }> {
  const supabase = await createClient()
  const accessError = await requireSalesAccess(supabase)
  if (accessError) return { data: null, error: accessError }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.requestId)) return { data: null, error: '再試行用の依頼IDが無効です' }
  const { data, error } = await supabase.rpc('create_rfq_atomic', {
    p_request_id: input.requestId, p_deal_id: input.dealId,
    p_product_ids: input.productIds, p_factory_ids: input.factoryIds,
    p_pending_factories: input.pendingFactories || [], p_deadline: input.responseDeadline || null,
    p_message: input.requestMessage || null,
  })
  if (error || !data) {
    const messages: Record<string, string> = {
      'Register product variants before requesting quotes': '対象商品の仕様を登録してから依頼してください',
      'Enter a positive quote quantity for every requested variant': '対象の各仕様に、見積画面で依頼数量を入力してください',
      'Products do not belong to this deal': '選択した商品がこの案件に属していません',
      'Factories missing or basic information incomplete': '依頼先工場の基本情報を登録してください',
      'Request ID was already used with different input': '同じ依頼IDで内容を変更できません。保存済みの依頼を確認してください',
      'Select products and factories': '対象商品と依頼先工場を選択してください',
    }
    return { data: null, error: messages[error?.message || ''] || '見積依頼を保存できませんでした。同じ内容で再試行してください' }
  }
  const result = data as CreatedRfq
  const origin = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
  revalidatePath('/deals')
  revalidatePath(`/deals/${input.dealId}`)
  return { data: { ...result, invitations: result.invitations.map(i => ({ ...i, formUrl: `${origin}/external/${i.formToken}`, emailed: false })) }, error: null }
}

/** Explicit user action, separate from RFQ creation. Stable provider key prevents network retry duplicates. */
export async function emailRfqInvitation(invitationId: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const accessError = await requireSalesAccess(supabase)
  if (accessError) return { error: accessError }
  const { data: invitation, error } = await supabase.from('rfq_factory_invitations').select('id, rfq_id, factory_id, factory_name_pending, factory_email_pending, external_form_id, invitation_sent_at').eq('id', invitationId).single()
  if (error || !invitation) return { error: '依頼先が見つかりません' }
  if (invitation.invitation_sent_at) return { error: null }
  const [{ data: request }, { data: form }, { data: factory }] = await Promise.all([
    supabase.from('rfq_requests').select('rfq_number, response_deadline, request_message, status').eq('id', invitation.rfq_id).single(),
    supabase.from('external_forms').select('token, status, expires_at, cancelled_at, related_id, form_type').eq('id', invitation.external_form_id).single(),
    invitation.factory_id ? supabase.from('factories').select('factory_name, contact_email').eq('id', invitation.factory_id).single() : Promise.resolve({ data: null }),
  ])
  if (!request || !['open','partially_responded'].includes(request.status) || !form || form.form_type !== 'rfq_response' || form.related_id !== invitation.id || form.cancelled_at || form.status !== 'pending' || !Number.isFinite(new Date(form.expires_at).getTime()) || new Date(form.expires_at).getTime() <= Date.now()) return { error: '回答リンクが無効または期限切れです' }
  const origin = process.env.NEXT_PUBLIC_APP_URL
  if (!origin || !/^https?:\/\//.test(origin)) return { error: '送信には公開アプリURLの設定が必要です' }
  const sent = await sendRfqEmail({ to: factory?.contact_email || invitation.factory_email_pending || '', factoryName: factory?.factory_name || invitation.factory_name_pending || '', rfqNumber: request.rfq_number, formUrl: `${origin.replace(/\/$/, '')}/external/${form.token}`, deadline: request.response_deadline, message: request.request_message, invitationId })
  if (!sent) return { error: 'メールを送信できませんでした。メールアドレス・送信設定を確認してください' }
  const { error: saveError } = await supabase.from('rfq_factory_invitations').update({ invitation_sent_at: new Date().toISOString() }).eq('id', invitationId).select('id').single()
  return { error: saveError ? '送信済みですが履歴の保存に失敗しました。再送する前に送信履歴を確認してください' : null }
}

export async function listFactoriesForRfq() {
  const supabase = await createClient()
  const accessError = await requireSalesAccess(supabase)
  if (accessError) throw new Error(accessError)
  const { data, error } = await supabase
    .from('factories')
    .select('id, factory_name, name_cn, basic_info_completed, contact_email')
    .order('factory_name', { ascending: true })
  if (error) throw new Error('工場一覧を取得できませんでした')
  return (data || []) as Array<{
    id: string
    factory_name: string
    name_cn: string | null
    basic_info_completed: boolean
    contact_email: string | null
  }>
}
