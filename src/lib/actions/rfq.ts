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
      .select('factory_name')
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

    invitations.push({
      invitationId: inv.id,
      factoryId,
      factoryName,
      formToken: token,
      formUrl: `${origin}/external/${token}`,
    })
  }

  // pending 工場 (未登録、メールのみ) は Sprint 8 では invitation だけ作って external_form は作らない。
  // 工場が後から自己登録 → スタッフが手動で紐付けるフローを Sprint 9 で検討。
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
    invitations.push({
      invitationId: inv.id,
      factoryId: null,
      factoryName: pf.name,
      formToken: '',
      formUrl: '(工場が自己登録した後、スタッフが invitation に紐付け)',
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
