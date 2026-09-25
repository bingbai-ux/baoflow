'use server'

// Sprint 12: 外部アカウント招待 (クライアント / ロジ会社のログイン発行)。
// スタッフが対象組織を選んで招待リンクを生成 → 相手がリンクからサインアップ or
// ログインすると claim_account_invite RPC が profiles にロールと組織を紐付ける。

import crypto from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createAccountInvitation(input: {
  portal_role: 'client' | 'logistics'
  client_id?: string | null
  partner_id?: string | null
  label?: string | null
}): Promise<{ token: string | null; error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { token: null, error: 'Unauthorized' }

  if (input.portal_role === 'client' && !input.client_id)
    return { token: null, error: 'クライアントを指定してください' }
  if (input.portal_role === 'logistics' && !input.partner_id)
    return { token: null, error: '物流パートナーを指定してください' }

  const token = crypto.randomBytes(24).toString('base64url')
  const { error } = await supabase.from('external_forms').insert({
    form_type: 'account_invite',
    token,
    status: 'pending',
    created_by: user.id,
    context: {
      portal_role: input.portal_role,
      client_id: input.client_id || null,
      partner_id: input.partner_id || null,
      label: input.label || null,
    },
  })
  if (error) return { token: null, error: error.message }
  revalidatePath('/master')
  return { token, error: null }
}

/** ログイン済みユーザーが招待を受け取る (RPC 呼び出し) */
export async function claimAccountInvite(
  token: string
): Promise<{ success: boolean; error?: string; portalRole?: 'client' | 'logistics' }> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('claim_account_invite', { p_token: token })
  if (error) return { success: false, error: error.message }
  const r = (data || {}) as { success: boolean; error?: string; portal_role?: 'client' | 'logistics' }
  if (!r.success) return { success: false, error: r.error || '招待の受け取りに失敗しました' }
  return { success: true, portalRole: r.portal_role }
}

/** 招待の中身 (対象組織名) を表示用に取得 — トークンを知っている人向け */
export async function getAccountInviteInfo(token: string): Promise<{
  valid: boolean
  error?: string
  portalRole?: 'client' | 'logistics'
  orgName?: string
}> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('ext_form_by_token', { p_token: token }).maybeSingle()
  if (!data) return { valid: false, error: '招待リンクが見つかりません' }
  const form = data as {
    form_type: string
    status: string
    cancelled_at: string | null
    expires_at: string | null
    context: { portal_role?: string; client_id?: string; partner_id?: string; label?: string } | null
  }
  if (form.form_type !== 'account_invite') return { valid: false, error: '招待リンクが見つかりません' }
  if (form.status === 'submitted') return { valid: false, error: 'この招待は既に使用されています' }
  if (form.status === 'cancelled' || form.cancelled_at)
    return { valid: false, error: 'この招待は無効化されました' }
  if (form.expires_at && new Date(form.expires_at) < new Date())
    return { valid: false, error: 'この招待は有効期限が切れています' }

  const role = (form.context?.portal_role || '') as 'client' | 'logistics'
  return {
    valid: true,
    portalRole: role,
    orgName: form.context?.label || undefined,
  }
}
