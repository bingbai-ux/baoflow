// Sprint 8-7: 工場の RFQ 回答フォーム (anonymous, §0.5-5)。
// 案件名 (deal_name) は表示しない — 商品仕様のみ。
// Sprint 11 (migration 032): データ取得は anon 実行可能な RPC (ext_rfq_context) 経由。

import { getFormByToken, getRfqContext } from '@/lib/actions/external-forms'
import { ExternalFormError } from '@/components/external/external-form-error'
import { RfqResponseForm } from '@/components/external/rfq-response-form'

interface Props {
  params: Promise<{ token: string }>
}

export default async function RfqResponsePage({ params }: Props) {
  const { token } = await params
  const { form, error } = await getFormByToken(token)
  if (error || !form) return <ExternalFormError message={error || 'フォームが見つかりません'} />
  if (form.form_type !== 'rfq_response') {
    return <ExternalFormError message="フォーム種別が一致しません" />
  }

  const { context, error: ctxErr } = await getRfqContext(token)
  if (ctxErr || !context) {
    return <ExternalFormError message={ctxErr || 'データ取得に失敗しました'} />
  }
  const { rfq, products } = context

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-[24px] font-bold text-[#351E28]">
          Quotation Request / 询价单
        </h1>
        <p className="text-[12px] text-[#351E28] mt-1 leading-relaxed">
          Reference: <span className="font-display tabular-nums">{rfq.rfq_number}</span>
          {rfq.response_deadline && (
            <>
              <span className="mx-2">·</span>Deadline / 截止日:{' '}
              <span className="font-display tabular-nums">{rfq.response_deadline}</span>
            </>
          )}
        </p>
        {rfq.request_message && (
          <p className="text-[12px] text-[#351E28] mt-2 p-3 bg-[#FFD8C2] border border-[#FFD8C2] rounded-[12px]">
            {rfq.request_message}
          </p>
        )}
      </div>
      <RfqResponseForm token={token} products={products} />
    </div>
  )
}
