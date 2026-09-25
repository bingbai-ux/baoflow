// Sprint 11: ロジスティック会社(在庫保管)自己登録フォームページ。日本語。

import { getFormByToken } from '@/lib/actions/external-forms'
import { ExternalFormError } from '@/components/external/external-form-error'
import { PartnerRegistrationForm } from '@/components/external/partner-registration-form'

interface Props {
  params: Promise<{ token: string }>
}

export default async function LogisticsRegistrationPage({ params }: Props) {
  const { token } = await params
  const { form, error } = await getFormByToken(token)
  if (error || !form) return <ExternalFormError message={error || 'フォームが見つかりません'} />
  if (form.form_type !== 'logistics_self_registration') {
    return <ExternalFormError message="フォーム種別が一致しません" />
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-[24px] font-bold text-[#351E28]">
          物流パートナー情報のご入力
        </h1>
        <p className="text-[12px] text-[#351E28] mt-1 leading-relaxed">
          在庫保管・入出庫のお取引に必要な情報をご入力ください。
          ご入力いただいた情報は kokon の担当者のみが確認します。
        </p>
      </div>
      <PartnerRegistrationForm token={token} kind="warehouse" />
    </div>
  )
}
