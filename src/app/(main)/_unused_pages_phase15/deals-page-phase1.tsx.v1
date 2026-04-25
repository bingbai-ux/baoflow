import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { DealListFilters } from '@/components/deals/deal-list-filters'
import { DealCard } from '@/components/deals/deal-card'
import { type SimpleStatus, SIMPLE_STATUS_ORDER } from '@/lib/types'

interface Props {
  searchParams: Promise<{
    status?: string
    q?: string
  }>
}

function isValidStatus(value: string): value is SimpleStatus {
  return (SIMPLE_STATUS_ORDER as string[]).includes(value)
}

export default async function DealsPage({ searchParams }: Props) {
  const params = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let query = supabase
    .from('deals')
    .select(
      `
      id,
      deal_code,
      deal_name,
      client_name_text,
      desired_delivery_date,
      simple_status,
      last_activity_at,
      sales_user:profiles!deals_sales_user_id_fkey(display_name)
    `
    )
    .order('last_activity_at', { ascending: false })

  if (params.status && isValidStatus(params.status)) {
    query = query.eq('simple_status', params.status)
  }

  if (params.q) {
    const escaped = params.q.replace(/[%_]/g, (m) => `\\${m}`)
    query = query.or(
      `deal_name.ilike.%${escaped}%,client_name_text.ilike.%${escaped}%,deal_code.ilike.%${escaped}%`
    )
  }

  const { data: deals } = await query

  return (
    <>
      {/* Page Header */}
      <div className="flex justify-between items-center py-[18px]">
        <h1 className="font-display text-[24px] font-semibold text-[#0a0a0a]">案件</h1>
        <Link
          href="/deals/new"
          className="bg-[#0a0a0a] text-white rounded-[8px] px-4 py-2 text-[13px] font-medium font-body no-underline"
        >
          + 新規案件
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-4">
        <DealListFilters />
      </div>

      {/* Cards */}
      {deals && deals.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {deals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={{
                ...deal,
                sales_user: Array.isArray(deal.sales_user) ? deal.sales_user[0] : deal.sales_user,
              }}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-10 text-center">
          <p className="text-[13px] text-[#555] font-body">
            {params.status || params.q ? '条件に合う案件がありません' : 'まだ案件がありません'}
          </p>
          {!params.status && !params.q && (
            <Link
              href="/deals/new"
              className="mt-3 inline-block text-[12px] font-body text-[#22c55e] no-underline hover:underline"
            >
              最初の案件を作成する →
            </Link>
          )}
        </div>
      )}
    </>
  )
}
