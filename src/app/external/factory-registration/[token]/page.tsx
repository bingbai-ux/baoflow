// Sprint 8-4: 工場自己登録フォームページ。
// バイリンガル UI (英語 + 中文) — kokon ブランドの中で、中国工場向けに最低限の中文を併記。

import { getFormByToken } from '@/lib/actions/external-forms'
import { ExternalFormError } from '@/components/external/external-form-error'
import { FactoryRegistrationForm } from '@/components/external/factory-registration-form'

interface Props {
  params: Promise<{ token: string }>
}

export default async function FactoryRegistrationPage({ params }: Props) {
  const { token } = await params
  const { form, error } = await getFormByToken(token)
  if (error || !form) return <ExternalFormError message={error || 'フォームが見つかりません'} />
  if (form.form_type !== 'factory_self_registration') {
    return <ExternalFormError message="フォーム種別が一致しません" />
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-[24px] font-bold text-[#1a1a1a]">
          Factory Profile / 工厂资料登记
        </h1>
        <p className="text-[12px] text-[#555] mt-1 leading-relaxed">
          Please fill in your factory information so we can request quotations.<br />
          请填写工厂基本信息，以便我们发送询价请求。
        </p>
      </div>
      <FactoryRegistrationForm token={token} />
    </div>
  )
}
