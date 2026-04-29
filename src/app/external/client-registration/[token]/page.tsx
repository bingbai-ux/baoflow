// Sprint 8-3: クライアント自己登録フォームページ。

import { getFormByToken } from '@/lib/actions/external-forms'
import { ExternalFormError } from '@/components/external/external-form-error'
import { ClientRegistrationForm } from '@/components/external/client-registration-form'

interface Props {
  params: Promise<{ token: string }>
}

export default async function ClientRegistrationPage({ params }: Props) {
  const { token } = await params
  const { form, error } = await getFormByToken(token)
  if (error || !form) return <ExternalFormError message={error || 'フォームが見つかりません'} />
  if (form.form_type !== 'client_self_registration') {
    return <ExternalFormError message="フォーム種別が一致しません" />
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-[24px] font-bold text-[#1a1a1a]">
          会社情報のご入力
        </h1>
        <p className="text-[12px] text-[#555] mt-1 leading-relaxed">
          パッケージ製作のお見積もり・発注に必要な情報をご入力ください。
          ご入力いただいた情報は kokon の担当者のみが確認します。
        </p>
      </div>
      <ClientRegistrationForm token={token} />
    </div>
  )
}
