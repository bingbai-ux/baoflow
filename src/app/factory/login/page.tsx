// Sprint 11: 工場ログイン画面 (英中)。

import { PortalLogin } from '@/components/external/portal-login'

export const metadata = { title: 'kokon — Factory Login / 工厂登录' }

export default function FactoryLoginPage() {
  return (
    <PortalLogin
      title="Factory Login / 工厂登录"
      subtitle="Orders, production status & quotations / 订单·生产状态·报价"
      redirectTo="/factory"
      emailLabel="Email / 邮箱"
      passwordLabel="Password / 密码"
      buttonLabel="Log in / 登录"
      footnote="Accounts are issued by kokon. Contact us if you cannot log in. / 账号由 kokon 发放，无法登录请联系我们。"
    />
  )
}
