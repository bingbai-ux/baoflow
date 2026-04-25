import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { VariantForm } from '@/components/deals/variant-form'
import { getSettings } from '@/lib/actions/settings'

interface Props {
  params: Promise<{ id: string; productId: string }>
}

export default async function NewVariantPage({ params }: Props) {
  const { id, productId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: deal }, { data: product }, settings] = await Promise.all([
    supabase.from('deals').select('id, deal_code').eq('id', id).single(),
    supabase
      .from('deal_products')
      .select('id, description, deal_id')
      .eq('id', productId)
      .eq('deal_id', id)
      .single(),
    getSettings(),
  ])
  if (!deal || !product) notFound()

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
          {deal.deal_code} · {product.description}
        </p>
        <h1 className="font-display text-[24px] font-semibold text-[#0a0a0a]">
          バリエーションを追加
        </h1>
      </div>
      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5 mt-2">
        <VariantForm
          dealId={id}
          productId={productId}
          defaultShippingAddress={settings?.default_shipping_address || null}
          cancelHref={`/deals/${id}`}
        />
      </div>
    </>
  )
}
