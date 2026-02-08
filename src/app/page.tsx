import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { InsightBanner } from '@/components/dashboard/insight-banner'
import { BigNum } from '@/components/shared/big-num'
import { CardLabel } from '@/components/shared/card-label'
import { SmallVal } from '@/components/shared/small-val'
import { SmallLabel } from '@/components/shared/small-label'
import { BarcodeBarsClient, GaugeClient } from './dashboard-client'
import { PipelineBar } from '@/components/dashboard/pipeline-bar'
import { StatusDot } from '@/components/deals/status-dot'
import { formatCurrency } from '@/lib/utils/format'

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

export default async function DashboardPage() {
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

  const { data: deals } = await supabase
    .from('deals')
    .select(`*, clients (id, company_name)`)
    .order('created_at', { ascending: false })

  const allDeals = deals || []

  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const completedDealsThisMonth = allDeals.filter(d => {
    const updated = new Date(d.updated_at)
    return d.status === 'completed' && updated >= thisMonthStart
  })
  const monthlyRevenue = completedDealsThisMonth.reduce((sum, d) => {
    const unitPrice = (d.unit_price_cny || 0) * (d.exchange_rate || 21.5) * 1.8
    return sum + unitPrice * (d.quantity || 0)
  }, 0)

  const completedCount = allDeals.filter(d => d.status === 'completed').length
  const totalCount = allDeals.length
  const progressRate = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  const inProgressStatuses = ['draft', 'quoting', 'quoted', 'spec_confirmed', 'sample_requested', 'sample_approved', 'payment_pending', 'deposit_paid', 'in_production', 'production_done', 'inspection', 'shipping']
  const inProgressCount = allDeals.filter(d => inProgressStatuses.includes(d.status)).length

  const deliveredThisMonth = allDeals.filter(d => {
    const updated = new Date(d.updated_at)
    return (d.status === 'delivered' || d.status === 'completed') && updated >= thisMonthStart
  }).length

  const statusCounts = {
    draft: allDeals.filter(d => d.status === 'draft' || d.status === 'quoting').length,
    quoting: allDeals.filter(d => d.status === 'quoted').length,
    spec_confirmed: allDeals.filter(d => d.status === 'spec_confirmed' || d.status === 'sample_requested' || d.status === 'sample_approved').length,
    in_production: allDeals.filter(d => d.status === 'in_production' || d.status === 'production_done').length,
    shipping: allDeals.filter(d => d.status === 'shipping' || d.status === 'customs').length,
    completed: allDeals.filter(d => d.status === 'completed' || d.status === 'delivered').length,
  }

  const pipelineData = [
    { stage: '見積中', count: statusCounts.draft + statusCounts.quoting },
    { stage: '仕様確定', count: statusCounts.spec_confirmed },
    { stage: '製造中', count: statusCounts.in_production },
    { stage: '配送中', count: statusCounts.shipping },
    { stage: '完了', count: statusCounts.completed },
  ]

  const recentDeals = allDeals.slice(0, 8)

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const staleDeals = allDeals.filter(d => {
    const updated = new Date(d.updated_at)
    return updated < sevenDaysAgo && d.status !== 'completed' && d.status !== 'cancelled'
  })

  const revenueMillions = monthlyRevenue / 1000000
  const revenueInteger = Math.floor(revenueMillions).toString()
  const revenueDecimal = ((revenueMillions % 1) * 100).toFixed(0).padStart(2, '0')

  const progressInteger = Math.floor(progressRate).toString()
  const progressDecimal = ((progressRate % 1) * 100).toFixed(0).padStart(2, '0')

  const barData = [3, 5, 2, 4, 6, 3, 5, 7, 4, 6, 8, 5, 7, 4, 6, 5, 7, 3, 8, 6, 4, 7, 5, 8, 6, 4, 7, 9, 5, 8]

  return (
    <div className="min-h-screen bg-[#f2f2f0]">
      <Header userName={profile?.display_name || user.email || undefined} />

      <main className="px-[26px] pb-10">
        <PageHeader title="Overview Panel" subtitle="Data Based on All Clients" />

        <div className="flex flex-col gap-2">
          <InsightBanner />

          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-2">
            {/* Monthly Revenue */}
            <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-[20px_22px] flex flex-col justify-between min-h-[200px]">
              <CardLabel icon={<Icon d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />}>
                月間売上
              </CardLabel>
              <BigNum integer={revenueInteger} decimal={revenueDecimal} unit="M¥" size={44} />
              <div className="flex justify-between mt-1">
                <div><SmallVal>{completedDealsThisMonth.length}</SmallVal><br /><SmallLabel>完了案件</SmallLabel></div>
                <div className="text-right"><SmallVal>+12%</SmallVal><br /><SmallLabel>増減率</SmallLabel></div>
              </div>
              <div className="mt-2">
                <BarcodeBarsClient data={barData} width={200} height={22} />
              </div>
            </div>

            {/* Progress */}
            <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-[20px_22px] flex flex-col justify-between min-h-[200px]">
              <CardLabel icon={<Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />}>
                案件進捗
              </CardLabel>
              <div className="flex justify-between">
                <div><SmallVal>{completedCount}</SmallVal><br /><SmallLabel>完了</SmallLabel></div>
                <div className="text-right"><SmallVal>{totalCount - completedCount}</SmallVal><br /><SmallLabel>進行中</SmallLabel></div>
              </div>
              <div className="flex justify-center items-center flex-col my-1">
                <GaugeClient value={progressRate} size={130} />
                <div className="font-display text-[26px] font-medium tracking-[-0.03em] text-[#0a0a0a] -mt-1 flex items-start tabular-nums">
                  {progressInteger}<span className="text-[14px]">,{progressDecimal}</span>
                  <span className="text-[10px] text-[#888] mt-[2px] ml-[1px]">%</span>
                </div>
              </div>
            </div>

            {/* In Progress */}
            <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-[20px_22px] flex flex-col justify-between min-h-[200px]">
              <CardLabel icon={<Icon d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />}>
                進行中案件
              </CardLabel>
              <BigNum integer={inProgressCount.toString()} unit="件" size={44} />
              <div className="flex justify-between mt-1">
                <div><SmallVal>{statusCounts.in_production}</SmallVal><br /><SmallLabel>製造中</SmallLabel></div>
                <div className="text-right"><SmallVal>{statusCounts.shipping}</SmallVal><br /><SmallLabel>配送中</SmallLabel></div>
              </div>
              <div className="mt-2">
                <BarcodeBarsClient data={barData} width={200} height={22} />
              </div>
            </div>

            {/* Delivered */}
            <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-[20px_22px] flex flex-col justify-between min-h-[200px]">
              <CardLabel icon={<Icon d="M5 13l4 4L19 7" />}>
                今月納品
              </CardLabel>
              <BigNum integer={deliveredThisMonth.toString()} unit="件" size={44} />
              <div className="flex justify-between mt-1">
                <div><SmallVal>{statusCounts.completed}</SmallVal><br /><SmallLabel>累計完了</SmallLabel></div>
                <div className="text-right"><SmallVal>{totalCount > 0 ? Math.round((deliveredThisMonth / totalCount) * 100) : 0}%</SmallVal><br /><SmallLabel>今月率</SmallLabel></div>
              </div>
              <div className="mt-2">
                <BarcodeBarsClient data={barData} width={200} height={22} />
              </div>
            </div>
          </div>

          {/* Pipeline and Recent Deals */}
          <div className="grid grid-cols-3 gap-2">
            {/* Pipeline */}
            <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-[20px_22px]">
              <CardLabel icon={<Icon d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />}>
                パイプライン
              </CardLabel>
              <div className="mt-4">
                <PipelineBar data={pipelineData} />
              </div>
            </div>

            {/* Recent Deals */}
            <div className="col-span-2 bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] overflow-hidden">
              <div className="px-[22px] py-[14px] border-b border-[rgba(0,0,0,0.06)]">
                <span className="text-[14px] font-semibold text-[#0a0a0a] font-display">最近の案件</span>
              </div>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[rgba(0,0,0,0.06)]">
                    <th className="px-[14px] py-[10px] text-left text-[11px] font-medium text-[#bbb] font-body">案件番号</th>
                    <th className="px-[14px] py-[10px] text-left text-[11px] font-medium text-[#bbb] font-body">クライアント</th>
                    <th className="px-[14px] py-[10px] text-left text-[11px] font-medium text-[#bbb] font-body">商品名</th>
                    <th className="px-[14px] py-[10px] text-left text-[11px] font-medium text-[#bbb] font-body">ステータス</th>
                    <th className="px-[14px] py-[10px] text-right text-[11px] font-medium text-[#bbb] font-body">金額</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDeals.length > 0 ? recentDeals.map((deal, i) => {
                    const amount = (deal.unit_price_cny || 0) * (deal.exchange_rate || 21.5) * (deal.quantity || 0) * 1.8
                    return (
                      <tr
                        key={deal.id}
                        className={`${i < recentDeals.length - 1 ? 'border-b border-[rgba(0,0,0,0.06)]' : ''} hover:bg-[#fcfcfb] transition-colors cursor-pointer`}
                      >
                        <td className="px-[14px] py-[12px]">
                          <Link href={`/deals/${deal.id}`} className="text-[#bbb] no-underline font-display text-[12px] tabular-nums">
                            {deal.deal_number}
                          </Link>
                        </td>
                        <td className="px-[14px] py-[12px] font-display font-semibold text-[13px] text-[#0a0a0a]">
                          {deal.clients?.company_name || '-'}
                        </td>
                        <td className="px-[14px] py-[12px] text-[12px] text-[#888] font-body">{deal.product_name}</td>
                        <td className="px-[14px] py-[12px]">
                          <StatusDot status={deal.status} />
                        </td>
                        <td className="px-[14px] py-[12px] text-right font-display font-semibold text-[13px] tabular-nums">
                          {formatCurrency(amount)}
                        </td>
                      </tr>
                    )
                  }) : (
                    <tr>
                      <td colSpan={5} className="px-[14px] py-[24px] text-center text-[#888] text-[13px]">
                        案件がありません
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Stale Deals Alert */}
          {staleDeals.length > 0 && (
            <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-[20px_22px]">
              <CardLabel icon={<Icon d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />}>
                停滞アラート（7日以上更新なし）
              </CardLabel>
              <div className="mt-3 flex flex-col gap-2">
                {staleDeals.slice(0, 5).map((deal) => (
                  <div
                    key={deal.id}
                    className="flex justify-between items-center px-[14px] py-[10px] bg-[#f2f2f0] rounded-[10px]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-[5px] h-[5px] rounded-full bg-[#e5a32e]" />
                      <div>
                        <div className="font-display text-[13px] font-medium">{deal.deal_number}</div>
                        <div className="text-[11px] text-[#888]">{deal.product_name} - {deal.clients?.company_name || '未設定'}</div>
                      </div>
                    </div>
                    <Link
                      href={`/deals/${deal.id}`}
                      className="bg-[#0a0a0a] text-white rounded-[8px] px-[12px] py-[6px] text-[12px] font-medium no-underline"
                    >
                      対応する
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
