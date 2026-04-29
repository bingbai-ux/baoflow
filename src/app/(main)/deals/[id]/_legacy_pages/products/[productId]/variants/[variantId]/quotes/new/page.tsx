import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { VariantQuoteForm } from '@/components/deals/variant-quote-form'
import { getQuoteCalculationDefaults } from '@/lib/actions/quotes'
import { getVariantById } from '@/lib/actions/variants'

interface Props {
  params: Promise<{ id: string; productId: string; variantId: string }>
}

export default async function NewVariantQuotePage({ params }: Props) {
  const { id, productId, variantId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: deal }, { data: product }, variant, defaults] = await Promise.all([
    supabase.from('deals').select('id, deal_code, deal_name').eq('id', id).single(),
    supabase
      .from('deal_products')
      .select('id, description')
      .eq('id', productId)
      .single(),
    getVariantById(variantId),
    getQuoteCalculationDefaults(),
  ])

  if (!deal || !product || !variant) notFound()

  return (
    <>
      <Link
        href={`/deals/${id}`}
        className="inline-flex items-center gap-1 text-[13px] text-[#888] font-body no-underline hover:text-[#555] mt-4 mb-2"
      >
        <ChevronLeft className="w-4 h-4" />
        案件詳細に戻る
      </Link>
      <div className="py-3">
        <p className="text-[11px] text-[#888] font-body tabular-nums">
          {deal.deal_code} · {product.description} · {variant.variant_label}
        </p>
        <h1 className="font-display text-[24px] font-semibold text-[#0a0a0a]">数量別見積を追加</h1>
        <p className="text-[12px] font-body text-[#888] mt-1">
          このバリエーションのカートン情報を元に容積重量・送料を自動計算します。
        </p>
      </div>
      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5 mt-2">
        <VariantQuoteForm
          dealId={id}
          variant={variant}
          defaults={defaults}
          cancelHref={`/deals/${id}`}
        />
      </div>
    </>
  )
}
