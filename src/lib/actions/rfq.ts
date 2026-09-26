'use server'

// Sprint 8-6: 見積依頼 (RFQ) 作成。複数工場へ同条件で依頼。

import crypto from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

interface CreateRfqInput {
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

function generateToken() {
  return crypto.randomBytes(24).toString('base64url')
}

async function nextRfqNumber(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  // RFQ-YYYYMM-NNN
  const now = new Date()
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const prefix = `RFQ-${ym}-`
  const { data } = await supabase
    .from('rfq_requests')
    .select('rfq_number')
    .like('rfq_number', `${prefix}%`)
    .order('rfq_number', { ascending: false })
    .limit(1)
  let next = 1
  if (data && data.length > 0) {
    const m = data[0].rfq_number.match(/(\d+)$/)
    if (m) next = Number(m[1]) + 1
  }
  return `${prefix}${String(next).padStart(3, '0')}`
}


// Sprint 14: RFQ メール送信 (RESEND_API_KEY 設定時のみ)。
// 未設定でも RFQ 自体は成立する (リンクコピー + 工場ポータル表示)。
async function sendRfqEmail(args: {
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
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject: `[${args.rfqNumber}] Quotation Request from (bao) / 询价请求`,
        html: `
          <p>Dear ${args.factoryName},</p>
          <p>We would like to request a quotation. Please open the link below to see the specifications and submit your prices.</p>
          <p>请通过以下链接查看产品规格并提交报价。</p>
          <p><a href="${args.formUrl}">${args.formUrl}</a></p>
          ${args.deadline ? `<p>Deadline / 截止日: ${args.deadline}</p>` : ''}
          ${args.message ? `<p>${args.message}</p>` : ''}
          <p>(bao) — Packaging procurement service</p>`,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function createRfq(
  input: CreateRfqInput
): Promise<{ data: CreatedRfq | null; error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Unauthorized' }

  if (!input.productIds.length) return { data: null, error: '商品を選択してください' }
  const totalFactories =
    input.factoryIds.length + (input.pendingFactories?.length || 0)
  if (totalFactories === 0)
    return { data: null, error: '依頼先工場を 1 つ以上選択してください' }

  // 工場の basic_info_completed チェック (登録済工場のみ)
  if (input.factoryIds.length > 0) {
    const { data: factories } = await supabase
      .from('factories')
      .select('id, factory_name, basic_info_completed')
      .in('id', input.factoryIds)
    const incomplete = (factories || []).filter((f) => !f.basic_info_completed)
    if (incomplete.length > 0) {
      return {
        data: null,
        error: `次の工場は基本情報未登録のため見積依頼できません: ${incomplete
          .map((f) => f.factory_name)
          .join(', ')}`,
      }
    }
  }

  const rfqNumber = await nextRfqNumber(supabase)

  const { data: rfqRow, error: rfqErr } = await supabase
    .from('rfq_requests')
    .insert({
      deal_id: input.dealId,
      product_ids: input.productIds,
      rfq_number: rfqNumber,
      request_message: input.requestMessage?.trim() || null,
      response_deadline: input.responseDeadline || null,
      status: 'open',
      created_by: user.id,
    })
    .select('id')
    .single()

  if (rfqErr || !rfqRow) return { data: null, error: rfqErr?.message || 'RFQ作成失敗' }

  const invitations: CreatedRfq['invitations'] = []
  const origin = process.env.NEXT_PUBLIC_APP_URL || ''

  // 登録済工場
  for (const factoryId of input.factoryIds) {
    const { data: factory } = await supabase
      .from('factories')
      .select('factory_name, contact_email')
      .eq('id', factoryId)
      .single()
    const factoryName = factory?.factory_name || '(unknown)'

    // 1. invitation 作成
    const { data: inv } = await supabase
      .from('rfq_factory_invitations')
      .insert({
        rfq_id: rfqRow.id,
        factory_id: factoryId,
      })
      .select('id')
      .single()
    if (!inv) continue

    // 2. external_form (rfq_response 用) トークン作成
    const token = generateToken()
    const { data: efRow } = await supabase
      .from('external_forms')
      .insert({
        form_type: 'rfq_response',
        token,
        related_id: inv.id,
        status: 'pending',
        created_by: user.id,
      })
      .select('id')
      .single()
    if (!efRow) continue

    // 3. invitation に external_form_id を紐付け
    await supabase
      .from('rfq_factory_invitations')
      .update({ external_form_id: efRow.id, invitation_sent_at: new Date().toISOString() })
      .eq('id', inv.id)

    const formUrl = `${origin}/external/${token}`
    // メール送信 (Resend キー設定時のみ。失敗しても RFQ は成立)
    const emailed = factory?.contact_email
      ? await sendRfqEmail({
          to: factory.contact_email,
          factoryName,
          rfqNumber,
          formUrl,
          deadline: input.responseDeadline,
          message: input.requestMessage,
        })
      : false

    invitations.push({
      invitationId: inv.id,
      factoryId,
      factoryName,
      formToken: token,
      formUrl,
      emailed,
    })
  }

  // Sprint 9 hand-off #2: pending 工場 (未登録) にも external_form トークンを発行する。
  // 工場は同じトークンで RFQ 回答画面にアクセスし、回答後にスタッフが factories マスターへ昇格する。
  for (const pf of input.pendingFactories || []) {
    const { data: inv } = await supabase
      .from('rfq_factory_invitations')
      .insert({
        rfq_id: rfqRow.id,
        factory_id: null,
        factory_name_pending: pf.name,
        factory_email_pending: pf.email || null,
      })
      .select('id')
      .single()
    if (!inv) continue

    const token = generateToken()
    const { data: efRow } = await supabase
      .from('external_forms')
      .insert({
        form_type: 'rfq_response',
        token,
        related_id: inv.id,
        status: 'pending',
        created_by: user.id,
        context: {
          pending_factory_name: pf.name,
          pending_factory_email: pf.email || null,
        },
      })
      .select('id')
      .single()

    if (efRow) {
      await supabase
        .from('rfq_factory_invitations')
        .update({ external_form_id: efRow.id, invitation_sent_at: new Date().toISOString() })
        .eq('id', inv.id)
    }

    invitations.push({
      invitationId: inv.id,
      factoryId: null,
      factoryName: pf.name,
      formToken: token,
      formUrl: efRow ? `${origin}/external/${token}` : '(token生成失敗)',
    })
  }

  revalidatePath('/deals')
  revalidatePath(`/deals/${input.dealId}`)
  return {
    data: {
      rfqId: rfqRow.id,
      rfqNumber,
      invitations,
    },
    error: null,
  }
}

export async function listFactoriesForRfq() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('factories')
    .select('id, factory_name, name_cn, basic_info_completed, contact_email')
    .order('factory_name', { ascending: true })
  return (data || []) as Array<{
    id: string
    factory_name: string
    name_cn: string | null
    basic_info_completed: boolean
    contact_email: string | null
  }>
}
