import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { StatusDot } from '@/components/status-dot'
import { PipelineBar } from '@/components/dashboard/pipeline-bar'
import { formatJPY, formatDate } from '@/lib/utils/format'
import { type MasterStatus } from '@/lib/types'
import { ChevronRight } from 'lucide-react'

// Phase mappings for M01-M25
const QUOTE_PHASE: MasterStatus[] = ['M01', 'M02', 'M03', 'M04', 'M05', 'M06', 'M07', 'M08', 'M09', 'M10']
const ORDER_PHASE: MasterStatus[] = ['M11', 'M12', 'M13', 'M14', 'M15']
const PRODUCTION_PHASE: MasterStatus[] = ['M16', 'M17', 'M18', 'M19']
const SHIPPING_PHASE: MasterStatus[] = ['M20', 'M21', 'M22', 'M23', 'M24']
const COMPLETED_PHASE: MasterStatus[] = ['M25']

function getGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return 'おはようございます'
  if (hour >= 12 && hour < 17) return 'こんにちは'
  return 'おつかれさまです'
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

  // Fetch deals with related data
  const { data: deals } = await supabase
    .from('deals')
    .select(`
      id,
      deal_code,
      deal_name,
      master_status,
      win_probability,
      last_activity_at,
      created_at,
      updated_at,
      client:clients(id, company_name),
      specifications:deal_specifications(product_name),
      quotes:deal_quotes(total_billing_tax_jpy, status)
    `)
    .order('created_at', { ascending: false })

  const allDeals = deals || []

  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const hour = now.getHours()
  const greeting = getGreeting(hour)

  // Calculate monthly revenue from approved quotes
  const completedDealsThisMonth = allDeals.filter(d => {
    const updated = new Date(d.updated_at)
    return COMPLETED_PHASE.includes(d.master_status as MasterStatus) && updated >= thisMonthStart
  })

  const monthlyRevenue = completedDealsThisMonth.reduce((sum, d) => {
    const approvedQuote = d.quotes?.find((q: { status?: string }) => q.status === 'approved')
    return sum + (approvedQuote?.total_billing_tax_jpy || 0)
  }, 0)

  // In-progress = not M25
  const inProgressCount = allDeals.filter(d => !COMPLETED_PHASE.includes(d.master_status as MasterStatus)).length

  // Delivered this month
  const deliveredThisMonth = completedDealsThisMonth.length

  // Status counts by phase
  const statusCounts = {
    quote: allDeals.filter(d => QUOTE_PHASE.includes(d.master_status as MasterStatus)).length,
    order: allDeals.filter(d => ORDER_PHASE.includes(d.master_status as MasterStatus)).length,
    production: allDeals.filter(d => PRODUCTION_PHASE.includes(d.master_status as MasterStatus)).length,
    shipping: allDeals.filter(d => SHIPPING_PHASE.includes(d.master_status as MasterStatus)).length,
    completed: allDeals.filter(d => COMPLETED_PHASE.includes(d.master_status as MasterStatus)).length,
  }

  const pipelineData = [
    { stage: '見積中', count: statusCounts.quote },
    { stage: '発注', count: statusCounts.order },
    { stage: '製造中', count: statusCounts.production },
    { stage: '配送中', count: statusCounts.shipping },
    { stage: '完了', count: statusCounts.completed },
  ]

  const recentDeals = allDeals.slice(0, 6)

  // Stale deals (7 days without update, not completed)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const staleDeals = allDeals.filter(d => {
    const updated = new Date(d.last_activity_at || d.updated_at)
    return updated < sevenDaysAgo && !COMPLETED_PHASE.includes(d.master_status as MasterStatus)
  })

  // Fetch pending payments
  const { data: pendingPayments } = await supabase
    .from('deal_factory_payments')
    .select(`
      id,
      amount_usd,
      amount_jpy,
      payment_type,
      status,
      deal:deals(id, deal_code, client:clients(company_name))
    `)
    .eq('status', 'unpaid')
    .order('created_at', { ascending: false })
    .limit(5)

  // Calculate unpaid amount
  const unpaidAmount = (pendingPayments || []).reduce((sum, p) => sum + (p.amount_jpy || 0), 0)

  // Action items count
  const actionItemsCount = staleDeals.length + (pendingPayments?.length || 0)

  // Fetch current exchange rate
  const { data: settings } = await supabase
    .from('system_settings')
    .select('default_exchange_rate')
    .limit(1)
    .single()

  const currentExchangeRate = settings?.default_exchange_rate || 150

  return (
    <>
      {/* Greeting Section */}
      <div className="py-5 flex justify-between items-end">
        <div>
          <p className="text-[13px] text-[#888] font-body mb-1">{greeting}、</p>
          <h1 className="text-[24px] font-display font-semibold text-[#0a0a0a]">
            {profile?.display_name || 'User'}さん
          </h1>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-[#888] font-body">USD/JPY</p>
          <p className="text-[16px] font-display font-semibold tabular-nums text-[#0a0a0a]">
            ¥{Number(currentExchangeRate).toFixed(1)}
          </p>
        </div>
      </div>

      {/* Action Required Card */}
      {actionItemsCount > 0 && (
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5 mb-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[14px] font-body font-semibold text-[#0a0a0a]">対応が必要</h2>
            <span className="text-[12px] text-[#888] font-body">{actionItemsCount}件</span>
          </div>
          <div className="flex flex-col gap-2">
            {staleDeals.slice(0, 3).map((deal) => {
              const client = Array.isArray(deal.client) ? deal.client[0] : deal.client
              const approvedQuote = deal.quotes?.find((q: { status?: string }) => q.status === 'approved')
              const amount = approvedQuote?.total_billing_tax_jpy || 0
              const lastActivity = new Date(deal.last_activity_at || deal.updated_at)
              const elapsedDays = Math.floor((now.getTime() - lastActivity.getTime()) / (24 * 60 * 60 * 1000))
              return (
                <div
                  key={deal.id}
                  className="flex items-center justify-between px-4 py-3 bg-[#f5f5f3] rounded-[10px]"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-[6px] h-[6px] rounded-full bg-[#e5a32e]" />
                    <div>
                      <p className="text-[13px] text-[#0a0a0a] font-body">
                        {deal.deal_code} - <span className="text-[#e5a32e]">{elapsedDays}日経過</span>
                      </p>
                      <p className="text-[11px] text-[#888] font-body">
                        {client?.company_name || '未設定'}
                        {amount > 0 && <span className="ml-2 font-display tabular-nums">{formatJPY(amount)}</span>}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/deals/${deal.id}`}
                    className="bg-[#0a0a0a] text-white rounded-[6px] px-3 py-1.5 text-[11px] font-medium font-body no-underline"
                  >
                    対応する
                  </Link>
                </div>
              )
            })}
            {(pendingPayments || []).slice(0, 2).map((payment) => {
              const deal = Array.isArray(payment.deal) ? payment.deal[0] : payment.deal
              const client = deal?.client
              return (
                <div
                  key={payment.id}
                  className="flex items-center justify-between px-4 py-3 bg-[#f5f5f3] rounded-[10px]"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-[6px] h-[6px] rounded-full bg-[#e5a32e]" />
                    <div>
                      <p className="text-[13px] text-[#0a0a0a] font-body">
                        {deal?.deal_code || '-'} - 支払い待ち
                      </p>
                      <p className="text-[11px] text-[#888] font-body">
                        {(client as { company_name?: string })?.company_name || '未設定'}
                        <span className="ml-2 font-display tabular-nums">{formatJPY(payment.amount_jpy || 0)}</span>
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/payments"
                    className="bg-[#22c55e] text-white rounded-[6px] px-3 py-1.5 text-[11px] font-medium font-body no-underline"
                  >
                    支払い処理
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* KPI Cards Row */}
      <div className="grid grid-cols-4 gap-2 mb-2">
        {/* Monthly Revenue */}
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5">
          <p className="text-[11px] text-[#888] font-body mb-2">月間売上</p>
          <p className="text-[28px] font-display font-semibold text-[#0a0a0a] tabular-nums">
            {formatJPY(monthlyRevenue)}
          </p>
          <p className="text-[11px] text-[#888] font-body mt-1">
            {completedDealsThisMonth.length}件の納品
          </p>
        </div>

        {/* In Progress */}
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5">
          <p className="text-[11px] text-[#888] font-body mb-2">進行中案件</p>
          <p className="text-[28px] font-display font-semibold text-[#0a0a0a] tabular-nums">
            {inProgressCount}<span className="text-[14px] text-[#888] ml-1">件</span>
          </p>
          <p className="text-[11px] text-[#888] font-body mt-1">
            製造中 {statusCounts.production} / 配送中 {statusCounts.shipping}
          </p>
        </div>

        {/* Delivered This Month */}
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5">
          <p className="text-[11px] text-[#888] font-body mb-2">今月納品</p>
          <p className="text-[28px] font-display font-semibold text-[#0a0a0a] tabular-nums">
            {deliveredThisMonth}<span className="text-[14px] text-[#888] ml-1">件</span>
          </p>
          <p className="text-[11px] text-[#888] font-body mt-1">
            累計 {statusCounts.completed}件完了
          </p>
        </div>

        {/* Unpaid */}
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5">
          <p className="text-[11px] text-[#888] font-body mb-2">未入金</p>
          <p className="text-[28px] font-display font-semibold text-[#0a0a0a] tabular-nums">
            {formatJPY(unpaidAmount)}
          </p>
          <p className="text-[11px] text-[#888] font-body mt-1">
            {pendingPayments?.length || 0}件の支払い待ち
          </p>
        </div>
      </div>

      {/* Pipeline and Recent Deals */}
      <div className="grid grid-cols-[1fr_2fr] gap-2">
        {/* Pipeline */}
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5">
          <h2 className="text-[14px] font-body font-semibold text-[#0a0a0a] mb-4">パイプライン</h2>
          <PipelineBar data={pipelineData} />
        </div>

        {/* Recent Deals */}
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[rgba(0,0,0,0.06)] flex items-center justify-between">
            <h2 className="text-[14px] font-body font-semibold text-[#0a0a0a]">最近の案件</h2>
            <Link href="/deals" className="text-[12px] text-[#888] font-body no-underline hover:text-[#555]">
              すべて見る
            </Link>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[rgba(0,0,0,0.06)]">
                <th className="px-4 py-2 text-left text-[11px] font-medium text-[#bbb] font-body">案件</th>
                <th className="px-4 py-2 text-left text-[11px] font-medium text-[#bbb] font-body">クライアント</th>
                <th className="px-4 py-2 text-left text-[11px] font-medium text-[#bbb] font-body">ステータス</th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-[#bbb] font-body">金額</th>
              </tr>
            </thead>
            <tbody>
              {recentDeals.length > 0 ? recentDeals.map((deal, i) => {
                const approvedQuote = deal.quotes?.find((q: { status?: string }) => q.status === 'approved')
                const amount = approvedQuote?.total_billing_tax_jpy || 0
                const client = Array.isArray(deal.client) ? deal.client[0] : deal.client

                return (
                  <tr
                    key={deal.id}
                    className={`${i < recentDeals.length - 1 ? 'border-b border-[rgba(0,0,0,0.06)]' : ''} hover:bg-[#fcfcfb] transition-colors`}
                  >
                    <td className="px-4 py-3">
                      <Link href={`/deals/${deal.id}`} className="text-[#0a0a0a] no-underline font-display text-[12px] tabular-nums">
                        {deal.deal_code}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#0a0a0a] font-body">
                      {client?.company_name || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusDot status={deal.master_status || 'M01'} size={6} />
                    </td>
                    <td className="px-4 py-3 text-right font-display font-medium text-[13px] tabular-nums">
                      {amount > 0 ? formatJPY(amount) : '-'}
                    </td>
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-[#888] text-[13px] font-body">
                    案件がありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
