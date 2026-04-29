import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getQuotesForDeal } from '@/lib/actions/quotes'
import { QuoteList } from '@/components/deals/quote-list'

interface Props {
  params: Promise<{ id: string }>
}

export default async function DealQuoteListPage({ params }: Props) {
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

  const [quotes, { data: specs }] = await Promise.all([
    getQuotesForDeal(id),
    supabase
      .from('deal_specifications')
      .select('id, product_name')
      .eq('deal_id', id)
      .order('created_at', { ascending: true }),
  ])

  return (
    <>
      <Link
        href={`/deals/${id}`}
        className="inline-flex items-center gap-1 text-[13px] text-[#888] font-body no-underline hover:text-[#555] mt-4 mb-2"
      >
        <ChevronLeft className="w-4 h-4" />
        案件詳細に戻る
      </Link>

      <div className="flex justify-between items-start py-3 gap-4">
        <div className="min-w-0">
          <p className="text-[11px] text-[#888] font-body tabular-nums">{deal.deal_code}</p>
          <h1 className="font-display text-[24px] font-semibold text-[#0a0a0a]">見積一覧</h1>
          <p className="text-[12px] font-body text-[#888] mt-1">
            数量や条件を変えた複数バージョンを保存できます。
          </p>
        </div>
        <Link
          href={`/deals/${id}/quotes/new`}
          className="bg-[#0a0a0a] text-white rounded-[8px] px-4 py-2 text-[13px] font-medium font-body no-underline whitespace-nowrap"
        >
          + 新しい見積
        </Link>
      </div>

      {quotes.length === 0 ? (
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-10 text-center">
          <p className="text-[13px] text-[#555] font-body">まだ見積がありません。</p>
          <Link
            href={`/deals/${id}/quotes/new`}
            className="mt-3 inline-block text-[12px] font-body text-[#22c55e] no-underline hover:underline"
          >
            最初の見積を作成する →
          </Link>
        </div>
      ) : (
        <QuoteList dealId={id} quotes={quotes} specs={specs || []} />
      )}
    </>
  )
}
