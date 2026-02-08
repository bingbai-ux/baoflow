import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { BigNum } from '@/components/shared/big-num'
import { CardLabel } from '@/components/shared/card-label'
import { SmallVal } from '@/components/shared/small-val'
import { SmallLabel } from '@/components/shared/small-label'
import { SvgBarChart } from '@/components/dashboard/svg-bar-chart'
import { SvgHorizontalBar } from '@/components/dashboard/svg-horizontal-bar'
import { type MasterStatus } from '@/lib/types'

function Icon({ d }: { d: string }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#888"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  )
}

// Phase mappings for M01-M25
const QUOTE_PHASE: MasterStatus[] = ['M01', 'M02', 'M03', 'M04', 'M05', 'M06', 'M07', 'M08', 'M09', 'M10']
const ORDER_PHASE: MasterStatus[] = ['M11', 'M12', 'M13', 'M14', 'M15']
const PRODUCTION_PHASE: MasterStatus[] = ['M16', 'M17', 'M18', 'M19']
const SHIPPING_PHASE: MasterStatus[] = ['M20', 'M21', 'M22', 'M23', 'M24']
const COMPLETED_PHASE: MasterStatus[] = ['M25']

export default async function AnalyticsPage() {
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

  // Get all deals with quotes
  const { data: deals } = await supabase
    .from('deals')
    .select(`
      id,
      deal_code,
      deal_name,
      master_status,
      created_at,
      updated_at,
      client:clients(id, company_name),
      quotes:deal_quotes(total_jpy_incl_tax, status)
    `)
    .order('created_at', { ascending: false })

  const allDeals = deals || []

  // Get clients
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .order('company_name')

  const allClients = clients || []

  // Get factories
  const { data: factories } = await supabase
    .from('factories')
    .select('*')
    .order('factory_name')

  const allFactories = factories || []

  // Get transactions (replaces old payments table)
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .order('transaction_date', { ascending: false })

  const allTransactions = transactions || []

  const now = new Date()
  const thisYear = now.getFullYear()
  const thisMonth = now.getMonth()

  // Monthly revenue data (last 6 months)
  const monthlyData = []
  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(thisYear, thisMonth - i, 1)
    const monthEnd = new Date(thisYear, thisMonth - i + 1, 0)

    const monthDeals = allDeals.filter(d => {
      const updated = new Date(d.updated_at)
      return COMPLETED_PHASE.includes(d.master_status as MasterStatus) &&
             updated >= monthStart &&
             updated <= monthEnd
    })

    const revenue = monthDeals.reduce((sum, d) => {
      const approvedQuote = d.quotes?.find((q: { status?: string }) => q.status === 'approved')
      return sum + (approvedQuote?.total_jpy_incl_tax || 0)
    }, 0)

    const monthLabel = monthStart.toLocaleDateString('ja-JP', { month: 'short' })
    monthlyData.push({ label: monthLabel, value: revenue })
  }

  // Top clients by revenue
  const clientRevenue: Record<string, { name: string; revenue: number }> = {}
  allDeals.forEach(d => {
    const client = Array.isArray(d.client) ? d.client[0] : d.client
    const clientName = client?.company_name || '未設定'
    const approvedQuote = d.quotes?.find((q: { status?: string }) => q.status === 'approved')
    const revenue = approvedQuote?.total_jpy_incl_tax || 0

    if (!clientRevenue[clientName]) {
      clientRevenue[clientName] = { name: clientName, revenue: 0 }
    }
    clientRevenue[clientName].revenue += revenue
  })
  const topClients = Object.values(clientRevenue)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map(c => ({ label: c.name, value: c.revenue }))

  // Calculate KPIs
  const totalRevenue = allDeals.reduce((sum, d) => {
    if (COMPLETED_PHASE.includes(d.master_status as MasterStatus)) {
      const approvedQuote = d.quotes?.find((q: { status?: string }) => q.status === 'approved')
      return sum + (approvedQuote?.total_jpy_incl_tax || 0)
    }
    return sum
  }, 0)

  const averageDealSize = allDeals.length > 0
    ? allDeals.reduce((sum, d) => {
        const approvedQuote = d.quotes?.find((q: { status?: string }) => q.status === 'approved')
        return sum + (approvedQuote?.total_jpy_incl_tax || 0)
      }, 0) / allDeals.length
    : 0

  // Transaction totals
  const totalTransactionsIn = allTransactions
    .filter(t => t.direction === 'in')
    .reduce((sum, t) => sum + (t.amount_jpy || 0), 0)

  const totalTransactionsOut = allTransactions
    .filter(t => t.direction === 'out')
    .reduce((sum, t) => sum + (t.amount_jpy || 0), 0)

  // Format revenue
  const revenueMillions = totalRevenue / 1000000
  const revenueInteger = Math.floor(revenueMillions).toString()
  const revenueDecimal = ((revenueMillions % 1) * 100).toFixed(0).padStart(2, '0')

  // Avg deal size
  const avgDealThousands = averageDealSize / 1000
  const avgDealInteger = Math.floor(avgDealThousands).toString()

  return (
    <div className="min-h-screen bg-[#f2f2f0]">
      <Header userName={profile?.display_name || user.email || undefined} />

      <main className="px-[26px] pb-10">
        <div className="py-[18px]">
          <PageHeader title="Analytics" subtitle="Business Intelligence" />
        </div>

        <div className="flex flex-col gap-2">
          {/* KPI Row */}
          <div className="grid grid-cols-4 gap-2">
            {/* Total Revenue */}
            <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-[20px_22px]">
              <CardLabel icon={<Icon d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />}>
                累計売上
              </CardLabel>
              <div className="mt-4">
                <BigNum integer={revenueInteger} decimal={revenueDecimal} unit="M¥" size={44} />
              </div>
              <div className="flex justify-between mt-3">
                <div>
                  <SmallVal>{allDeals.filter(d => COMPLETED_PHASE.includes(d.master_status as MasterStatus)).length}</SmallVal>
                  <br />
                  <SmallLabel>完了案件</SmallLabel>
                </div>
                <div className="text-right">
                  <SmallVal>{allDeals.length}</SmallVal>
                  <br />
                  <SmallLabel>総案件数</SmallLabel>
                </div>
              </div>
            </div>

            {/* Average Deal Size */}
            <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-[20px_22px]">
              <CardLabel icon={<Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />}>
                平均案件単価
              </CardLabel>
              <div className="mt-4">
                <BigNum integer={avgDealInteger} unit="K¥" size={44} />
              </div>
              <div className="flex justify-between mt-3">
                <div>
                  <SmallVal>{allClients.length}</SmallVal>
                  <br />
                  <SmallLabel>取引先数</SmallLabel>
                </div>
                <div className="text-right">
                  <SmallVal>{allFactories.length}</SmallVal>
                  <br />
                  <SmallLabel>工場数</SmallLabel>
                </div>
              </div>
            </div>

            {/* Transactions In */}
            <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-[20px_22px]">
              <CardLabel icon={<Icon d="M7 17l9.2-9.2M17 17V7H7" />}>
                入金合計
              </CardLabel>
              <div className="mt-4">
                <BigNum
                  integer={Math.floor(totalTransactionsIn / 1000000).toString()}
                  decimal={((totalTransactionsIn / 1000000 % 1) * 100).toFixed(0).padStart(2, '0')}
                  unit="M¥"
                  size={44}
                />
              </div>
              <div className="flex justify-between mt-3">
                <div>
                  <SmallVal>{allTransactions.filter(t => t.direction === 'in').length}</SmallVal>
                  <br />
                  <SmallLabel>入金件数</SmallLabel>
                </div>
              </div>
            </div>

            {/* Transactions Out */}
            <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-[20px_22px]">
              <CardLabel icon={<Icon d="M17 7l-9.2 9.2M7 7v10h10" />}>
                出金合計
              </CardLabel>
              <div className="mt-4">
                <BigNum
                  integer={Math.floor(totalTransactionsOut / 1000000).toString()}
                  decimal={((totalTransactionsOut / 1000000 % 1) * 100).toFixed(0).padStart(2, '0')}
                  unit="M¥"
                  size={44}
                />
              </div>
              <div className="flex justify-between mt-3">
                <div>
                  <SmallVal>{allTransactions.filter(t => t.direction === 'out').length}</SmallVal>
                  <br />
                  <SmallLabel>出金件数</SmallLabel>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-2 gap-2">
            {/* Monthly Revenue Chart */}
            <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-[20px_22px]">
              <CardLabel icon={<Icon d="M3 3v18h18M7 16l4-4 4 4 5-5" />}>
                月別売上推移
              </CardLabel>
              <div className="mt-5 flex justify-center">
                <SvgBarChart
                  data={monthlyData}
                  width={380}
                  height={180}
                />
              </div>
            </div>

            {/* Top Clients */}
            <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-[20px_22px]">
              <CardLabel icon={<Icon d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8" />}>
                売上TOP5クライアント
              </CardLabel>
              <div className="mt-5">
                <SvgHorizontalBar
                  data={topClients}
                  width={380}
                  height={160}
                />
              </div>
            </div>
          </div>

          {/* Summary Row */}
          <div className="grid grid-cols-3 gap-2">
            {/* Status Distribution */}
            <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-[20px_22px]">
              <CardLabel icon={<Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />}>
                ステータス分布
              </CardLabel>
              <div className="mt-4 flex flex-col gap-2">
                {[
                  { label: '見積中', statuses: QUOTE_PHASE },
                  { label: '発注・支払い', statuses: ORDER_PHASE },
                  { label: '製造中', statuses: PRODUCTION_PHASE },
                  { label: '配送中', statuses: SHIPPING_PHASE },
                  { label: '完了', statuses: COMPLETED_PHASE },
                ].map(item => {
                  const count = allDeals.filter(d => item.statuses.includes(d.master_status as MasterStatus)).length
                  const percentage = allDeals.length > 0 ? (count / allDeals.length) * 100 : 0
                  return (
                    <div key={item.label}>
                      <div className="flex justify-between mb-1">
                        <span className="text-[11px] text-[#888] font-body">{item.label}</span>
                        <span className="text-[11px] text-[#0a0a0a] font-display">{count}</span>
                      </div>
                      <div className="h-1 bg-[#f2f2f0] rounded-[2px]">
                        <div
                          className={`h-1 rounded-[2px] ${item.label === '完了' ? 'bg-[#22c55e] opacity-70' : 'bg-[#0a0a0a] opacity-15'}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-[20px_22px]">
              <CardLabel icon={<Icon d="M13 10V3L4 14h7v7l9-11h-7z" />}>
                クイック統計
              </CardLabel>
              <div className="mt-4 flex flex-col gap-3">
                <div className="flex justify-between py-2 border-b border-[rgba(0,0,0,0.06)]">
                  <span className="text-[12px] text-[#888] font-body">今月新規案件</span>
                  <span className="text-[13px] text-[#0a0a0a] font-display font-medium">
                    {allDeals.filter(d => {
                      const created = new Date(d.created_at)
                      return created.getMonth() === thisMonth && created.getFullYear() === thisYear
                    }).length}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-[rgba(0,0,0,0.06)]">
                  <span className="text-[12px] text-[#888] font-body">クライアント数</span>
                  <span className="text-[13px] text-[#0a0a0a] font-display font-medium">
                    {allClients.length}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-[rgba(0,0,0,0.06)]">
                  <span className="text-[12px] text-[#888] font-body">工場数</span>
                  <span className="text-[13px] text-[#0a0a0a] font-display font-medium">
                    {allFactories.length}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-[12px] text-[#888] font-body">進行中案件</span>
                  <span className="text-[13px] text-[#0a0a0a] font-display font-medium">
                    {allDeals.filter(d => !COMPLETED_PHASE.includes(d.master_status as MasterStatus)).length}
                  </span>
                </div>
              </div>
            </div>

            {/* Net Cashflow */}
            <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-[20px_22px]">
              <CardLabel icon={<Icon d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}>
                キャッシュフロー
              </CardLabel>
              <div className="mt-4">
                <div className="text-center mb-4">
                  <div className="text-[11px] text-[#888] font-body mb-1">純利益</div>
                  <div className={`font-display text-[32px] font-semibold tabular-nums ${totalTransactionsIn - totalTransactionsOut >= 0 ? 'text-[#22c55e]' : 'text-[#e5a32e]'}`}>
                    {totalTransactionsIn - totalTransactionsOut >= 0 ? '+' : ''}
                    {((totalTransactionsIn - totalTransactionsOut) / 1000000).toFixed(2)}M
                  </div>
                </div>
                <div className="flex justify-between py-2 border-t border-[rgba(0,0,0,0.06)]">
                  <div className="text-center flex-1">
                    <div className="text-[10px] text-[#888] font-body">入金</div>
                    <div className="text-[14px] text-[#22c55e] font-display">
                      +{(totalTransactionsIn / 1000000).toFixed(1)}M
                    </div>
                  </div>
                  <div className="text-center flex-1">
                    <div className="text-[10px] text-[#888] font-body">出金</div>
                    <div className="text-[14px] text-[#0a0a0a] font-display">
                      -{(totalTransactionsOut / 1000000).toFixed(1)}M
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
