// Sprint 12: アカウント招待の受け取りページ。
// スタッフが発行したリンクから、クライアント/ロジ会社の担当者が
// サインアップ (またはログイン) してポータルアカウントを有効化する。

import { createClient } from '@/lib/supabase/server'
import { getAccountInviteInfo } from '@/lib/actions/account-invites'
import { AccountInviteClient } from '@/components/external/account-invite-client'

interface Props {
  params: Promise<{ token: string }>
}

export const metadata = { title: '(bao) — アカウント招待' }

export default async function AccountInvitePage({ params }: Props) {
  const { token } = await params
  const info = await getAccountInviteInfo(token)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <AccountInviteClient
      token={token}
      valid={info.valid}
      error={info.error}
      portalRole={info.portalRole}
      orgName={info.orgName}
      loggedInEmail={user?.email || null}
    />
  )
}
