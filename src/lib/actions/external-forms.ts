'use server'

// Sprint 8-2: 外部フォーム (anonymous) のトークン生成・検証・送信処理。
//
// セキュリティ実装方針 (§0.5-5):
//   - トークン: crypto.randomBytes(24).toString('base64url') = 32 chars URL-safe
//   - 有効期限: 7 日デフォルト (DB 側 default、明示的に上書きも可)
//   - 送信時に IP / User-Agent を submission_ip / submission_user_agent に記録
//   - 1 度 'submitted' になったトークンは再使用不可 (status check)
//   - スタッフが管理画面から手動で 'cancelled' にできる (cancelExternalForm)
//   - RFQ フォームには案件名 (deal_name) は含めない、商品仕様のみ

import crypto from 'crypto'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type {
  ExternalFormRow,
  ExternalFormType,
  ClientSelfRegistrationPayload,
  FactorySelfRegistrationPayload,
  RfqResponsePayload,
} from './external-forms-types'

function generateToken(): string {
  return crypto.randomBytes(24).toString('base64url')
}

async function getRequestMeta(): Promise<{ ip: string | null; ua: string | null }> {
  const h = await headers()
  const xff = h.get('x-forwarded-for')
  const ip = xff ? xff.split(',')[0].trim() : h.get('x-real-ip') || null
  const ua = h.get('user-agent') || null
  return { ip, ua }
}

/**
 * トークンから external_form を取得。anonymous でアクセス可。
 * status / expires_at / cancelled_at をチェックし、無効ならエラーメッセージを返す。
 */
export async function getFormByToken(
  token: string
): Promise<{ form: ExternalFormRow | null; error: string | null }> {
  if (!token || token.length < 16) {
    return { form: null, error: '無効なトークンです' }
  }
  const supabase = await createClient()
  const { data } = await supabase
    .from('external_forms')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (!data) return { form: null, error: 'フォームが見つかりません' }

  const row = data as ExternalFormRow
  if (row.status === 'submitted') {
    return { form: row, error: 'このフォームは既に送信されています' }
  }
  if (row.status === 'cancelled' || row.cancelled_at) {
    return { form: row, error: 'このフォームは無効化されました' }
  }
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return { form: row, error: 'このフォームは有効期限が切れています' }
  }
  return { form: row, error: null }
}

// ============================================================================
// スタッフ側: フォームトークン生成 (招待リンク作成)
// ============================================================================

export async function createClientInvitation(): Promise<{
  token: string | null
  error: string | null
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { token: null, error: 'Unauthorized' }

  const token = generateToken()
  const { error } = await supabase.from('external_forms').insert({
    form_type: 'client_self_registration',
    token,
    status: 'pending',
    created_by: user.id,
  })
  if (error) return { token: null, error: error.message }
  revalidatePath('/master')
  return { token, error: null }
}

export async function createFactoryInvitation(): Promise<{
  token: string | null
  error: string | null
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { token: null, error: 'Unauthorized' }

  const token = generateToken()
  const { error } = await supabase.from('external_forms').insert({
    form_type: 'factory_self_registration',
    token,
    status: 'pending',
    created_by: user.id,
  })
  if (error) return { token: null, error: error.message }
  revalidatePath('/master')
  return { token, error: null }
}

export async function cancelExternalForm(
  formId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { error } = await supabase
    .from('external_forms')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: user.id,
    })
    .eq('id', formId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/master')
  return { success: true }
}

// ============================================================================
// 外部側: 提出処理 (anonymous)
// ============================================================================

export async function submitClientRegistration(
  token: string,
  payload: ClientSelfRegistrationPayload
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { form, error: getErr } = await getFormByToken(token)
  if (getErr || !form) return { success: false, error: getErr || 'invalid token' }
  if (form.form_type !== 'client_self_registration') {
    return { success: false, error: 'フォーム種別が一致しません' }
  }
  if (!payload.company_name?.trim()) {
    return { success: false, error: '会社名は必須です' }
  }
  if (!payload.addresses || payload.addresses.length === 0) {
    return { success: false, error: '配送先を最低 1 件登録してください' }
  }

  const { ip, ua } = await getRequestMeta()

  // 1. clients に INSERT
  const { data: client, error: insertErr } = await supabase
    .from('clients')
    .insert({
      company_name: payload.company_name.trim(),
      short_name: payload.short_name?.trim() || null,
      industry: payload.industry?.trim() || null,
      contact_name: payload.contact_name?.trim() || null,
      contact_role: payload.contact_role?.trim() || null,
      phone: payload.phone?.trim() || null,
      email: payload.email?.trim() || null,
      tax_id: payload.tax_id?.trim() || null,
      payment_terms: payload.payment_terms?.trim() || null,
      tax_rate: payload.tax_rate ?? null,
      self_registered_at: new Date().toISOString(),
      self_registration_form_id: form.id,
    })
    .select('id')
    .single()
  if (insertErr || !client) return { success: false, error: insertErr?.message || 'INSERT失敗' }

  // 2. client_addresses を一括 INSERT
  const addressRows = payload.addresses
    .filter((a) => a.label?.trim() && a.address_line1?.trim())
    .map((a, idx) => ({
      client_id: client.id,
      label: a.label.trim(),
      recipient_name: a.recipient_name?.trim() || null,
      postal_code: a.postal_code?.trim() || null,
      address_line1: a.address_line1.trim(),
      address_line2: a.address_line2?.trim() || null,
      phone: a.phone?.trim() || null,
      email: a.email?.trim() || null,
      is_default: a.is_default ?? idx === 0,
      notes: a.notes?.trim() || null,
    }))
  if (addressRows.length > 0) {
    await supabase.from('client_addresses').insert(addressRows)
  }

  // 3. external_forms を 'submitted' に
  await supabase
    .from('external_forms')
    .update({
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      submitted_by_email: payload.email?.trim() || null,
      submission_ip: ip,
      submission_user_agent: ua,
      related_id: client.id,
      submission_data: payload as unknown as Record<string, unknown>,
    })
    .eq('id', form.id)

  revalidatePath('/master')
  return { success: true }
}

export async function submitFactoryRegistration(
  token: string,
  payload: FactorySelfRegistrationPayload
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { form, error: getErr } = await getFormByToken(token)
  if (getErr || !form) return { success: false, error: getErr || 'invalid token' }
  if (form.form_type !== 'factory_self_registration') {
    return { success: false, error: 'フォーム種別が一致しません' }
  }
  if (!payload.factory_name?.trim()) {
    return { success: false, error: '工場名は必須です' }
  }

  const { ip, ua } = await getRequestMeta()

  const { data: factory, error: insertErr } = await supabase
    .from('factories')
    .insert({
      factory_name: payload.factory_name.trim(),
      name_cn: payload.name_cn?.trim() || null,
      contact_name: payload.contact_name?.trim() || null,
      contact_phone: payload.contact_phone?.trim() || null,
      contact_email: payload.contact_email?.trim() || null,
      wechat: payload.wechat?.trim() || null,
      address: payload.address?.trim() || null,
      specialties: (payload.specialties || []).filter((s) => s?.trim()),
      payment_terms: payload.payment_terms?.trim() || null,
      incoterm: payload.incoterm?.trim() || null,
      lead_time_range: payload.lead_time_range?.trim() || null,
      bank_info: payload.bank_info_text?.trim()
        ? { raw: payload.bank_info_text.trim() }
        : null,
      notes: payload.notes?.trim() || null,
      basic_info_completed: true,
      self_registered_at: new Date().toISOString(),
      self_registration_form_id: form.id,
    })
    .select('id')
    .single()
  if (insertErr || !factory) return { success: false, error: insertErr?.message || 'INSERT失敗' }

  await supabase
    .from('external_forms')
    .update({
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      submitted_by_email: payload.contact_email?.trim() || null,
      submission_ip: ip,
      submission_user_agent: ua,
      related_id: factory.id,
      submission_data: payload as unknown as Record<string, unknown>,
    })
    .eq('id', form.id)

  revalidatePath('/master')
  return { success: true }
}

export async function submitRfqResponse(
  token: string,
  payload: RfqResponsePayload
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { form, error: getErr } = await getFormByToken(token)
  if (getErr || !form) return { success: false, error: getErr || 'invalid token' }
  if (form.form_type !== 'rfq_response') {
    return { success: false, error: 'フォーム種別が一致しません' }
  }

  const { ip, ua } = await getRequestMeta()

  // related_id = rfq_factory_invitations.id
  const { data: invitation } = await supabase
    .from('rfq_factory_invitations')
    .select('id, rfq_id, factory_id')
    .eq('id', form.related_id || '')
    .maybeSingle()

  if (!invitation) {
    return { success: false, error: '紐付く RFQ 招待が見つかりません' }
  }

  const { data: rfq } = await supabase
    .from('rfq_requests')
    .select('id, deal_id, product_ids')
    .eq('id', invitation.rfq_id)
    .single()

  if (!rfq) return { success: false, error: 'RFQ が見つかりません' }

  // 各商品ラインを deal_quotes として INSERT
  // factory_id は invitation.factory_id (NULL の場合は pending 工場 — 現 Sprint 8 では INSERT しない)
  const factoryId = invitation.factory_id
  if (factoryId) {
    const quoteRows = payload.products
      .filter((p) => p.product_id)
      .map((p) => ({
        deal_id: rfq.deal_id,
        variant_id: p.variant_id || null,
        factory_id: factoryId,
        quantity: null, // RFQ 段階では不確定、後でスタッフが採用時に確定
        moq: p.moq ?? null,
        factory_unit_price_usd: p.unit_price_usd ?? null,
        status: 'drafting',
        source_type: 'rfq_response',
        version: 1,
      }))
    if (quoteRows.length > 0) {
      await supabase.from('deal_quotes').insert(quoteRows)
    }
  }

  // invitation を responded
  await supabase
    .from('rfq_factory_invitations')
    .update({ responded_at: new Date().toISOString() })
    .eq('id', invitation.id)

  // RFQ 全体の status を partially_responded or fully_responded
  const { data: allInv } = await supabase
    .from('rfq_factory_invitations')
    .select('responded_at')
    .eq('rfq_id', invitation.rfq_id)
  const respondedCount = (allInv || []).filter((i) => i.responded_at).length
  const totalCount = (allInv || []).length
  await supabase
    .from('rfq_requests')
    .update({
      status: respondedCount >= totalCount ? 'fully_responded' : 'partially_responded',
    })
    .eq('id', invitation.rfq_id)

  // external_forms を submitted
  await supabase
    .from('external_forms')
    .update({
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      submitted_by_email: payload.factory_email?.trim() || null,
      submission_ip: ip,
      submission_user_agent: ua,
      submission_data: payload as unknown as Record<string, unknown>,
    })
    .eq('id', form.id)

  revalidatePath('/deals')
  revalidatePath(`/deals/${rfq.deal_id}`)
  return { success: true }
}
