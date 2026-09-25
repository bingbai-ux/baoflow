// Sprint 11: 物流パートナー (発送業者 / ロジ会社) ログイン画面。

import { PortalLogin } from '@/components/external/portal-login'

export const metadata = { title: 'kokon — 物流パートナーログイン' }

export default function LogisticsLoginPage() {
  return (
    <PortalLogin
      title="物流パートナーログイン"
      subtitle="入出庫・出荷指示の確認ができます"
      redirectTo="/logistics"
    />
  )
}
