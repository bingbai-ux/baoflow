import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { DealFilters } from '@/components/deals/deal-filters'
import { DealRow } from '@/components/deals/deal-row'
import { type MasterStatus } from '@/lib/types'

interface Props {
  searchParams: Promise<{
    phase?: string
    client?: string
    search?: string
  }>
}

// Map phase filter to status codes
function getStatusesForPhase(phase: string): MasterStatus[] {
  switch (phase) {
    case 'quote':
      return ['M01', 'M02', 'M03', 'M04', 'M05', 'M06', 'M07', 'M08', 'M09', 'M10']
    case 'order':
      return ['M11', 'M12', 'M13', 'M14', 'M15']
    case 'production':
      return ['M16', 'M17', 'M18', 'M19']
    case 'shipping':
      return ['M20', 'M21', 'M22', 'M23', 'M24', 'M25']
    default:
      return []
  }
}

export default async function DealsPage({ searchParams }: Props) {
  const params = await searchParams
  const supabase = await createClient()

  // Get clients for filter
  const { data: clients } = await supabase
    .from('clients')
    .select('id, company_name')
    .order('company_name')

  // Build deals query
  let query = supabase
    .from('deals')
    .select(`
      *,
      client:clients(id, company_name),
      specifications:deal_specifications(product_name, product_category),
      quotes:deal_quotes(total_billing_tax_jpy, status)
    `)
    .order('created_at', { ascending: false })

  // Apply phase filter
  if (params.phase && params.phase !== 'all') {
    const statuses = getStatusesForPhase(params.phase)
    if (statuses.length > 0) {
      query = query.in('master_status', statuses)
    }
  }

  // Apply client filter
  if (params.client) {
    query = query.eq('client_id', params.client)
  }

  // Apply search filter
  if (params.search) {
    query = query.or(`deal_code.ilike.%${params.search}%,deal_name.ilike.%${params.search}%`)
  }

  const { data: deals } = await query

  const winProbabilityLabels: Record<string, string> = {
    very_high: '非常に高い',
    high: '高い',
    medium: '中程度',
    low: '低い',
    won: '受注確定',
    lost: '失注',
  }

  return (
    <>
      {/* Page Header */}
      <div className="flex justify-between items-center py-[18px]">
        <h1 className="font-display text-[24px] font-semibold text-[#0a0a0a]">
          Orders
        </h1>
        <Link
          href="/deals/new"
          className="bg-[#0a0a0a] text-white rounded-[8px] px-4 py-2 text-[13px] font-medium font-body no-underline"
        >
          + 新規案件
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-4">
        <DealFilters clients={clients || []} />
      </div>

      {/* Deals Table */}
      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[rgba(0,0,0,0.06)]">
              <th className="px-4 py-3 text-left text-[11px] font-medium text-[#bbb] font-body">案件コード</th>
              <th className="px-4 py-3 text-left text-[11px] font-medium text-[#bbb] font-body">クライアント</th>
              <th className="px-4 py-3 text-left text-[11px] font-medium text-[#bbb] font-body">商品名</th>
              <th className="px-4 py-3 text-left text-[11px] font-medium text-[#bbb] font-body">ステータス</th>
              <th className="px-4 py-3 text-left text-[11px] font-medium text-[#bbb] font-body">受注角度</th>
              <th className="px-4 py-3 text-right text-[11px] font-medium text-[#bbb] font-body">金額</th>
              <th className="px-4 py-3 text-left text-[11px] font-medium text-[#bbb] font-body">最終更新</th>
            </tr>
          </thead>
          <tbody>
            {deals && deals.length > 0 ? (
              deals.map((deal, index) => (
                <DealRow
                  key={deal.id}
                  deal={deal}
                  winProbabilityLabels={winProbabilityLabels}
                  isLast={index === deals.length - 1}
                />
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-[#888] text-[13px] font-body">
                  案件がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
