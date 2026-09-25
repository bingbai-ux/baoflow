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
//
// Sprint 11 (migration 032): 匿名側の読み取り/送信は SECURITY DEFINER RPC 経由。
//   RLS は authenticated のみのままにし、anon にはトークン必須の関数だけ公開する
//   (テーブルを anon に開放するとトークン列挙が可能になるため)。

import crypto from 'crypto'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type {
  ExternalFormRow,
  ClientSelfRegistrationPayload,
  FactorySelfRegistrationPayload,
  LogisticsPartnerPayload,
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
 * トークンから external_form を取得。anonymous でアクセス可 (RPC 経由)。
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
    .rpc('ext_form_by_token', { p_token: token })
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
  revalidatePath('/settings')
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
  revalidatePath('/settings')
  return { token, error: null }
}

/** Sprint 11: 発送業者 / ロジスティック会社の招待リンク生成 */
export async function createPartnerInvitation(
  kind: 'shipping' | 'logistics'
): Promise<{ token: string | null; error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { token: null, error: 'Unauthorized' }

  const token = generateToken()
  const { error } = await supabase.from('external_forms').insert({
    form_type: kind === 'shipping' ? 'shipping_self_registration' : 'logistics_self_registration',
    token,
    status: 'pending',
    created_by: user.id,
  })
  if (error) return { token: null, error: error.message }
  revalidatePath('/master')
  revalidatePath('/settings')
  return { token, error: null }
}

/**
 * Sprint 11: 設定画面の招待リンク管理用。発行済みの自己登録フォームを新しい順に返す。
 * トークン(=URL)も返すのでスタッフ認証必須。RFQ 回答フォームは案件側で管理するため除外。
 */
export async function listExternalForms(): Promise<{
  forms: ExternalFormRow[]
  error: string | null
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { forms: [], error: 'Unauthorized' }

  const { data, error } = await supabase
    .from('external_forms')
    .select('*')
    .in('form_type', [
      'client_self_registration',
      'factory_self_registration',
      'shipping_self_registration',
      'logistics_self_registration',
    ])
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) return { forms: [], error: error.message }
  return { forms: (data || []) as ExternalFormRow[], error: null }
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
  revalidatePath('/settings')
  return { success: true }
}

// ============================================================================
// 外部側: 提出処理 (anonymous → SECURITY DEFINER RPC)
// ============================================================================

interface RpcResult {
  success: boolean
  error?: string
  deal_id?: string
}

export async function submitClientRegistration(
  token: string,
  payload: ClientSelfRegistrationPayload
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { ip, ua } = await getRequestMeta()
  const { data, error } = await supabase.rpc('ext_submit_client', {
    p_token: token,
    p_payload: payload as unknown as Record<string, unknown>,
    p_ip: ip,
    p_ua: ua,
  })
  if (error) return { success: false, error: error.message }
  const r = (data || {}) as RpcResult
  if (!r.success) return { success: false, error: r.error || '送信に失敗しました' }
  // revalidatePath は呼ばない: 呼ぶと送信直後に現在の外部ページが再描画され、
  // 成功画面が「既に送信されています」に置き換わる。スタッフ画面は動的取得のため不要。
  return { success: true }
}

export async function submitFactoryRegistration(
  token: string,
  payload: FactorySelfRegistrationPayload
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { ip, ua } = await getRequestMeta()
  const { data, error } = await supabase.rpc('ext_submit_factory', {
    p_token: token,
    p_payload: payload as unknown as Record<string, unknown>,
    p_ip: ip,
    p_ua: ua,
  })
  if (error) return { success: false, error: error.message }
  const r = (data || {}) as RpcResult
  if (!r.success) return { success: false, error: r.error || '送信に失敗しました' }
  return { success: true }
}

/** Sprint 11: 発送業者 / ロジ会社の自己登録送信 (anonymous → RPC) */
export async function submitPartnerRegistration(
  token: string,
  payload: LogisticsPartnerPayload
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { ip, ua } = await getRequestMeta()
  const { data, error } = await supabase.rpc('ext_submit_partner', {
    p_token: token,
    p_payload: payload as unknown as Record<string, unknown>,
    p_ip: ip,
    p_ua: ua,
  })
  if (error) return { success: false, error: error.message }
  const r = (data || {}) as RpcResult
  if (!r.success) return { success: false, error: r.error || '送信に失敗しました' }
  return { success: true }
}

export async function submitRfqResponse(
  token: string,
  payload: RfqResponsePayload
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { ip, ua } = await getRequestMeta()
  const { data, error } = await supabase.rpc('ext_submit_rfq', {
    p_token: token,
    p_payload: payload as unknown as Record<string, unknown>,
    p_ip: ip,
    p_ua: ua,
  })
  if (error) return { success: false, error: error.message }
  const r = (data || {}) as RpcResult
  if (!r.success) return { success: false, error: r.error || '送信に失敗しました' }
  return { success: true }
}

/**
 * RFQ 回答フォームの表示データ (anonymous)。案件名は返さない (§0.5-5 マスキング)。
 */
export interface RfqContext {
  rfq: {
    id: string
    rfq_number: string | null
    request_message: string | null
    response_deadline: string | null
  }
  products: Array<{
    id: string
    description: string
    variants: Array<{
      id: string
      label: string
      width_mm: number | null
      height_mm: number | null
      depth_mm: number | null
      material: string | null
      print_color_count: string | null
      pcs_per_carton: number | null
    }>
  }>
}

export async function getRfqContext(
  token: string
): Promise<{ context: RfqContext | null; error: string | null }> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('ext_rfq_context', { p_token: token })
  if (error) return { context: null, error: error.message }
  const r = data as (RfqContext & { error?: string }) | null
  if (!r || r.error) return { context: null, error: r?.error || 'データ取得に失敗しました' }
  return { context: r, error: null }
}
