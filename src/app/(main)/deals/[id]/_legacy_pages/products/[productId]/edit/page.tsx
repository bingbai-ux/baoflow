import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { ProductForm } from '@/components/deals/product-form'

interface Props {
  params: Promise<{ id: string; productId: string }>
}

export default async function EditProductPage({ params }: Props) {
  const { id, productId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: product } = await supabase
    .from('deal_products')
    .select('*')
    .eq('id', productId)
    .eq('deal_id', id)
    .single()
  if (!product) notFound()

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
        <h1 className="font-display text-[24px] font-semibold text-[#0a0a0a]">商品を編集</h1>
      </div>
      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5 mt-2">
        <ProductForm dealId={id} initial={product} cancelHref={`/deals/${id}`} />
      </div>
    </>
  )
}
