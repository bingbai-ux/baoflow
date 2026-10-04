'use server'

// Sprint 12: 外部アカウント招待 (クライアント / ロジ会社のログイン発行)。
// スタッフが対象組織を選んで招待リンクを生成 → 相手がリンクからサインアップ or
// ログインすると claim_account_invite RPC が profiles にロールと組織を紐付ける。

import crypto from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSalesAccess } from './deal-access'
import { normalizeAccountInviteEmail, prepareAccountInvite, type AccountInviteInput } from '@/lib/utils/account-invites'

export async function createAccountInvitation(input: AccountInviteInput): Promise<{ token: string | null; error: string | null }> {
  const supabase = await createClient()
  const accessError = await requireSalesAccess(supabase)
  if (accessError) return { token: null, error: accessError }
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { token: null, error: 'Unauthorized' }

  const prepared = prepareAccountInvite(input)
  if (!prepared.context) return { token: null, error: prepared.error }

  const token = crypto.randomBytes(24).toString('base64url')
  const { error } = await supabase.from('external_forms').insert({
    form_type: 'account_invite',
    token,
    status: 'pending',
    created_by: user.id,
    context: prepared.context,
  })
  if (error) return { token: null, error: error.message }
  revalidatePath('/master')
  return { token, error: null }
}

/** ログイン済みユーザーが招待を受け取る (RPC 呼び出し) */
export async function claimAccountInvite(
  token: string
): Promise<{ success: boolean; error?: string; portalRole?: 'client' | 'logistics' | 'factory' }> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('claim_account_invite', { p_token: token })
  if (error) return { success: false, error: error.message }
  const r = (data || {}) as { success: boolean; error?: string; portal_role?: 'client' | 'logistics' | 'factory' }
  if (!r.success) return { success: false, error: r.error || '招待の受け取りに失敗しました' }
  return { success: true, portalRole: r.portal_role }
}

/** 招待の中身 (対象組織名) を表示用に取得 — トークンを知っている人向け */
export async function getAccountInviteInfo(token: string): Promise<{
  valid: boolean
  error?: string
  portalRole?: 'client' | 'logistics' | 'factory'
  orgName?: string
  recipientEmail?: string
}> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('ext_form_by_token', { p_token: token }).maybeSingle()
  if (!data) return { valid: false, error: '招待リンクが見つかりません' }
  const form = data as {
    form_type: string
    status: string
    cancelled_at: string | null
    expires_at: string | null
    context: { portal_role?: string; client_id?: string; partner_id?: string; label?: string; recipient_email?: string } | null
  }
  if (form.form_type !== 'account_invite') return { valid: false, error: '招待リンクが見つかりません' }
  if (form.status === 'submitted') return { valid: false, error: 'この招待は既に使用されています' }
  if (form.status === 'cancelled' || form.cancelled_at)
    return { valid: false, error: 'この招待は無効化されました' }
  if (form.expires_at && new Date(form.expires_at) < new Date())
    return { valid: false, error: 'この招待は有効期限が切れています' }

  const role = (form.context?.portal_role || '') as 'client' | 'logistics' | 'factory'
  const recipientEmail = normalizeAccountInviteEmail(form.context?.recipient_email)
  if (!recipientEmail || !['client', 'factory', 'logistics'].includes(role)) return { valid: false, error: '宛先を指定した新しい招待を依頼してください' }
  return {
    valid: true,
    portalRole: role,
    orgName: form.context?.label || undefined,
    recipientEmail,
  }
}
