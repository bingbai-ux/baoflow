// Sprint 8-2: トークンを受け取り、form_type に応じて適切な専用ページにリダイレクト。

import { redirect } from 'next/navigation'
import { getFormByToken } from '@/lib/actions/external-forms'
import { ExternalFormError } from '@/components/external/external-form-error'

interface Props {
  params: Promise<{ token: string }>
}

export default async function ExternalTokenPage({ params }: Props) {
  const { token } = await params
  const { form, error } = await getFormByToken(token)

  if (error || !form) {
    return <ExternalFormError message={error || 'フォームが見つかりません'} />
  }

  if (form.form_type === 'client_self_registration') {
    redirect(`/external/client-registration/${token}`)
  }
  if (form.form_type === 'factory_self_registration') {
    redirect(`/external/factory-registration/${token}`)
  }
  if (form.form_type === 'rfq_response') {
    redirect(`/external/rfq-response/${token}`)
  }

  return <ExternalFormError message="未対応のフォーム種別です" />
}
