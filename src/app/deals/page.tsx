import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { StatusDot } from '@/components/deals/status-dot'
import { DealFilters } from '@/components/deals/deal-filters'
import { type MasterStatus } from '@/lib/types'
import { formatJPY, formatRelativeDate } from '@/lib/utils/format'

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

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

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
      quotes:deal_quotes(total_jpy_incl_tax, status)
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
    <div className="min-h-screen bg-[#f2f2f0]">
      <Header userName={profile?.display_name || user.email || undefined} />

      <main className="px-[26px] pb-10">
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
        <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] overflow-hidden">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                <th style={thStyle}>案件コード</th>
                <th style={thStyle}>クライアント</th>
                <th style={thStyle}>商品名</th>
                <th style={thStyle}>ステータス</th>
                <th style={thStyle}>受注角度</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>金額</th>
                <th style={thStyle}>最終更新</th>
              </tr>
            </thead>
            <tbody>
              {deals && deals.length > 0 ? (
                deals.map((deal) => {
                  const spec = deal.specifications?.[0]
                  const approvedQuote = deal.quotes?.find((q: { status?: string }) => q.status === 'approved')
                  const amount = approvedQuote?.total_jpy_incl_tax

                  return (
                    <tr
                      key={deal.id}
                      style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', cursor: 'pointer' }}
                      onClick={() => window.location.href = `/deals/${deal.id}`}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fcfcfb'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={tdStyle}>
                        <span className="font-display tabular-nums text-[13px] text-[#0a0a0a]">
                          {deal.deal_code}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span className="font-body text-[13px] text-[#0a0a0a]">
                          {deal.client?.company_name || '-'}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span className="font-body text-[13px] text-[#0a0a0a]">
                          {spec?.product_name || deal.deal_name || '-'}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <StatusDot status={deal.master_status || 'M01'} />
                      </td>
                      <td style={tdStyle}>
                        <span className="font-body text-[12px] text-[#888]">
                          {winProbabilityLabels[deal.win_probability] || deal.win_probability}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <span className="font-display tabular-nums text-[13px] text-[#0a0a0a]">
                          {amount ? formatJPY(amount) : '-'}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span className="font-body text-[12px] text-[#888]">
                          {formatRelativeDate(deal.last_activity_at || deal.updated_at)}
                        </span>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={7} style={{ ...tdStyle, textAlign: 'center', color: '#888' }}>
                    案件がありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: 500,
  color: '#bbbbbb',
  fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
}

const tdStyle: React.CSSProperties = {
  padding: '12px 14px',
}
