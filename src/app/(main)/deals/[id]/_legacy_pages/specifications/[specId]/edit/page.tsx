import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { SpecForm } from '@/components/deals/spec-form'
import { listFeesForSpec } from '@/lib/actions/fees'

interface Props {
  params: Promise<{ id: string; specId: string }>
}

export default async function EditSpecPage({ params }: Props) {
  const { id, specId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: spec } = await supabase
    .from('deal_specifications')
    .select(
      'id, deal_id, product_name, product_category, height_mm, width_mm, depth_mm, material_category, print_colors, printing_method, processing_list, specification_memo'
    )
    .eq('id', specId)
    .eq('deal_id', id)
    .single()
  if (!spec) notFound()

  const fees = await listFeesForSpec(specId)
  const initialFees = fees.map((f) => ({
    fee_type: f.fee_type,
    amount_jpy: f.amount_jpy,
    is_initial_only: f.is_initial_only,
    note: f.note,
  }))

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
        <h1 className="font-display text-[24px] font-semibold text-[#0a0a0a]">商品仕様を編集</h1>
      </div>

      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5 mt-2">
        <SpecForm dealId={id} initial={spec} initialFees={initialFees} cancelHref={`/deals/${id}`} />
      </div>
    </>
  )
}
