// Sprint 11: クライアント様ログイン画面。

import { PortalLogin } from '@/components/external/portal-login'

export const metadata = { title: 'kokon — クライアントログイン' }

export default function PortalLoginPage() {
  return (
    <PortalLogin
      title="クライアント様ログイン"
      subtitle="案件の進捗・在庫の確認ができます"
      redirectTo="/portal"
    />
  )
}
