export type AccountInviteRole = 'client' | 'factory' | 'logistics'

export interface AccountInviteInput {
  portal_role: AccountInviteRole
  recipient_email: string
  client_id?: string | null
  partner_id?: string | null
  factory_id?: string | null
  label?: string | null
}

export function normalizeAccountInviteEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  return email.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}

export function prepareAccountInvite(input: AccountInviteInput) {
  if (!input || !['client', 'factory', 'logistics'].includes(input.portal_role)) return { context: null, error: '招待の種別を確認してください' }
  const email = normalizeAccountInviteEmail(input.recipient_email)
  if (!email) return { context: null, error: '招待先のメールアドレスを入力してください' }
  const target = input.portal_role === 'client' ? input.client_id : input.portal_role === 'factory' ? input.factory_id : input.partner_id
  if (typeof target !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target)) return { context: null, error: '招待先の会社を確認してください' }
  return { context: {
    portal_role: input.portal_role, recipient_email: email,
    client_id: input.portal_role === 'client' ? target : null,
    partner_id: input.portal_role === 'logistics' ? target : null,
    factory_id: input.portal_role === 'factory' ? target : null,
    label: input.label?.trim() || null,
  }, error: null }
}

export function accountInviteScope(role: AccountInviteRole, orgName: string) {
  if (role === 'logistics') return '共有倉庫の全顧客・在庫・入出庫を扱います。輸送は本人に割り当てられた便を扱います。'
  if (role === 'factory') return `${orgName}向けのRFQ・発注・製造・検品を扱います。`
  return `${orgName}の顧客ポータルで、案件・帳票・在庫・配送を確認できます。`
}
