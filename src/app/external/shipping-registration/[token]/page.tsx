// Sprint 11: 発送業者(フォワーダー)自己登録フォームページ。英文+中文。

import { getFormByToken } from '@/lib/actions/external-forms'
import { ExternalFormError } from '@/components/external/external-form-error'
import { PartnerRegistrationForm } from '@/components/external/partner-registration-form'

interface Props {
  params: Promise<{ token: string }>
}

export default async function ShippingRegistrationPage({ params }: Props) {
  const { token } = await params
  const { form, error } = await getFormByToken(token)
  if (error || !form) return <ExternalFormError message={error || 'フォームが見つかりません'} />
  if (form.form_type !== 'shipping_self_registration') {
    return <ExternalFormError message="フォーム種別が一致しません" />
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-[24px] font-bold text-[#351E28]">
          Freight Partner Profile / 货代资料登记
        </h1>
        <p className="text-[12px] text-[#351E28] mt-1 leading-relaxed">
          Please fill in your company information so we can request shipping quotations.
          <br />
          请填写贵司基本信息，以便我们发送运费询价。
        </p>
      </div>
      <PartnerRegistrationForm token={token} kind="shipping" />
    </div>
  )
}
