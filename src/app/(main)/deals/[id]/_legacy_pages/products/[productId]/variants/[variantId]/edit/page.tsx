import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { VariantForm } from '@/components/deals/variant-form'

interface Props {
  params: Promise<{ id: string; productId: string; variantId: string }>
}

export default async function EditVariantPage({ params }: Props) {
  const { id, productId, variantId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: variant } = await supabase
    .from('deal_product_variants')
    .select('*')
    .eq('id', variantId)
    .eq('product_id', productId)
    .single()
  if (!variant) notFound()

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
        <h1 className="font-display text-[24px] font-semibold text-[#0a0a0a]">バリエーションを編集</h1>
      </div>
      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5 mt-2">
        <VariantForm
          dealId={id}
          productId={productId}
          initial={variant}
          cancelHref={`/deals/${id}`}
        />
      </div>
    </>
  )
}
