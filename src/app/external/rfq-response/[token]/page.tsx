// Sprint 8-7: 工場の RFQ 回答フォーム (anonymous, §0.5-5)。
// 案件名 (deal_name) は表示しない — 商品仕様のみ。

import { createClient } from '@/lib/supabase/server'
import { getFormByToken } from '@/lib/actions/external-forms'
import { ExternalFormError } from '@/components/external/external-form-error'
import { RfqResponseForm } from '@/components/external/rfq-response-form'

interface Props {
  params: Promise<{ token: string }>
}

interface MaskedProduct {
  id: string
  description: string
  variants: Array<{
    id: string
    label: string
    width_mm: number | null
    height_mm: number | null
    depth_mm: number | null
    material: string | null
    print_color_count: string | null
    pcs_per_carton: number | null
  }>
}

export default async function RfqResponsePage({ params }: Props) {
  const { token } = await params
  const { form, error } = await getFormByToken(token)
  if (error || !form) return <ExternalFormError message={error || 'フォームが見つかりません'} />
  if (form.form_type !== 'rfq_response') {
    return <ExternalFormError message="フォーム種別が一致しません" />
  }

  // related_id = rfq_factory_invitation.id → rfq_id → product_ids → products+variants
  const supabase = await createClient()
  const { data: invitation } = await supabase
    .from('rfq_factory_invitations')
    .select('rfq_id')
    .eq('id', form.related_id || '')
    .single()
  if (!invitation) return <ExternalFormError message="紐付く RFQ が見つかりません" />

  const { data: rfq } = await supabase
    .from('rfq_requests')
    .select('id, product_ids, request_message, response_deadline, rfq_number')
    .eq('id', invitation.rfq_id)
    .single()
  if (!rfq) return <ExternalFormError message="RFQ が見つかりません" />

  // 商品 + バリエ取得 (案件名は意図的に取らない、§0.5-5 マスキング)
  const { data: products } = await supabase
    .from('deal_products')
    .select('id, description')
    .in('id', rfq.product_ids)

  const productIds = (products || []).map((p) => p.id)
  const { data: variantsRaw } = await supabase
    .from('deal_product_variants')
    .select(
      'id, product_id, variant_label, width_mm, height_mm, depth_mm, material, print_color_count, pcs_per_carton'
    )
    .in('product_id', productIds)

  const masked: MaskedProduct[] = (products || []).map((p) => ({
    id: p.id,
    description: p.description,
    variants: (variantsRaw || [])
      .filter((v) => v.product_id === p.id)
      .map((v) => ({
        id: v.id,
        label: v.variant_label || '',
        width_mm: v.width_mm,
        height_mm: v.height_mm,
        depth_mm: v.depth_mm,
        material: v.material,
        print_color_count: v.print_color_count,
        pcs_per_carton: v.pcs_per_carton,
      })),
  }))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-[24px] font-bold text-[#1a1a1a]">
          Quotation Request / 询价单
        </h1>
        <p className="text-[12px] text-[#555] mt-1 leading-relaxed">
          Reference: <span className="font-display tabular-nums">{rfq.rfq_number}</span>
          {rfq.response_deadline && (
            <>
              <span className="mx-2">·</span>Deadline / 截止日:{' '}
              <span className="font-display tabular-nums">{rfq.response_deadline}</span>
            </>
          )}
        </p>
        {rfq.request_message && (
          <p className="text-[12px] text-[#555] mt-2 p-3 bg-[#fffbf2] border border-[#f5d7a8] rounded-[8px]">
            {rfq.request_message}
          </p>
        )}
      </div>
      <RfqResponseForm token={token} products={masked} />
    </div>
  )
}
