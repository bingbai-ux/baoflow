import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { ProductForm } from '@/components/deals/product-form'

interface Props {
  params: Promise<{ id: string }>
}

export default async function NewProductPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: deal } = await supabase
    .from('deals')
    .select('id, deal_code, deal_name')
    .eq('id', id)
    .single()
  if (!deal) notFound()

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
        <p className="text-[11px] text-[#888] font-body tabular-nums">{deal.deal_code}</p>
        <h1 className="font-display text-[24px] font-semibold text-[#0a0a0a]">商品を追加</h1>
        <p className="text-[12px] font-body text-[#888] mt-1">
          商品を作成したあと、サイズなどのバリエーションと数量別見積を追加します。
        </p>
      </div>
      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5 mt-2">
        <ProductForm dealId={id} cancelHref={`/deals/${id}`} />
      </div>
    </>
  )
}
