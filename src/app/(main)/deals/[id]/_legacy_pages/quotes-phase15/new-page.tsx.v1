import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { QuoteForm } from '@/components/deals/quote-form'
import { getQuoteCalculationDefaults } from '@/lib/actions/quotes'

interface Props {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ spec_id?: string }>
}

export default async function NewQuotePage({ params, searchParams }: Props) {
  const { id } = await params
  const sp = searchParams ? await searchParams : {}
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: deal }, { data: specs }] = await Promise.all([
    supabase
      .from('deals')
      .select('id, deal_code, deal_name')
      .eq('id', id)
      .single(),
    supabase
      .from('deal_specifications')
      .select('id, product_name')
      .eq('deal_id', id)
      .order('created_at', { ascending: true }),
  ])
  if (!deal) notFound()

  const defaults = await getQuoteCalculationDefaults()

  return (
    <>
      <Link
        href={`/deals/${id}/quote`}
        className="inline-flex items-center gap-1 text-[13px] text-[#888] font-body no-underline hover:text-[#555] mt-4 mb-2"
      >
        <ChevronLeft className="w-4 h-4" />
        見積一覧に戻る
      </Link>

      <div className="py-3">
        <p className="text-[11px] text-[#888] font-body tabular-nums">{deal.deal_code}</p>
        <h1 className="font-display text-[24px] font-semibold text-[#0a0a0a]">見積を作成</h1>
        <p className="text-[12px] font-body text-[#888] mt-1">
          数量、工場単価、為替、掛け率を入力すると右側に計算結果が表示されます。
        </p>
      </div>

      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5 mt-2">
        <QuoteForm
          dealId={id}
          defaults={defaults}
          specs={specs || []}
          defaultSpecId={sp?.spec_id}
          cancelHref={`/deals/${id}/quote`}
        />
      </div>
    </>
  )
}
