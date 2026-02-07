import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { InsightBanner } from '@/components/dashboard/insight-banner'
import { BigNum } from '@/components/shared/big-num'
import { CardLabel } from '@/components/shared/card-label'
import { SmallVal } from '@/components/shared/small-val'
import { SmallLabel } from '@/components/shared/small-label'
import { BarcodeBarsClient, GaugeClient } from './dashboard-client'
import { PipelineBar } from '@/components/dashboard/pipeline-bar'
import { StatusDot } from '@/components/deals/status-dot'
import { formatCurrency } from '@/lib/utils/format'

// Icon helper
function Icon({ d }: { d: string }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#888888"
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

  // Get all deals
  const { data: deals } = await supabase
    .from('deals')
    .select(`
      *,
      clients (id, company_name)
    `)
    .order('created_at', { ascending: false })

  const allDeals = deals || []

  // Calculate KPIs
  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  // Monthly revenue (completed deals this month)
  const completedDealsThisMonth = allDeals.filter(d => {
    const updated = new Date(d.updated_at)
    return d.status === 'completed' && updated >= thisMonthStart
  })
  const monthlyRevenue = completedDealsThisMonth.reduce((sum, d) => {
    const unitPrice = (d.unit_price_cny || 0) * (d.exchange_rate || 21.5) * 1.8
    return sum + unitPrice * (d.quantity || 0)
  }, 0)

  // Progress rate
  const completedCount = allDeals.filter(d => d.status === 'completed').length
  const totalCount = allDeals.length
  const progressRate = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  // In-progress deals (draft to shipping)
  const inProgressStatuses = ['draft', 'quoting', 'quoted', 'spec_confirmed', 'sample_requested', 'sample_approved', 'payment_pending', 'deposit_paid', 'in_production', 'production_done', 'inspection', 'shipping']
  const inProgressCount = allDeals.filter(d => inProgressStatuses.includes(d.status)).length

  // Delivered this month
  const deliveredThisMonth = allDeals.filter(d => {
    const updated = new Date(d.updated_at)
    return (d.status === 'delivered' || d.status === 'completed') && updated >= thisMonthStart
  }).length

  // Pipeline data
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

  // Recent deals (top 10)
  const recentDeals = allDeals.slice(0, 10)

  // Stale deals (updated_at > 7 days, not completed/cancelled)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const staleDeals = allDeals.filter(d => {
    const updated = new Date(d.updated_at)
    return updated < sevenDaysAgo && d.status !== 'completed' && d.status !== 'cancelled'
  })

  // Format revenue
  const revenueMillions = monthlyRevenue / 1000000
  const revenueInteger = Math.floor(revenueMillions).toString()
  const revenueDecimal = ((revenueMillions % 1) * 100).toFixed(0).padStart(2, '0')

  // Format progress rate
  const progressInteger = Math.floor(progressRate).toString()
  const progressDecimal = ((progressRate % 1) * 100).toFixed(0).padStart(2, '0')

  // Sample bar data
  const barData = [3, 5, 2, 4, 6, 3, 5, 7, 4, 6, 8, 5, 7, 4, 6, 5, 7, 3, 8, 6, 4, 7, 5, 8, 6, 4, 7, 9, 5, 8]

  return (
    <div style={{ minHeight: '100vh', background: '#f2f2f0' }}>
      <Header userName={profile?.display_name || user.email || undefined} />

      {/* Page content */}
      <div style={{ padding: '24px 26px' }}>
        {/* Page Header */}
        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              fontSize: 11,
              color: '#bbbbbb',
              fontFamily: "'Fraunces', serif",
              marginBottom: 2,
            }}
          >
            Data Based on All Clients
          </div>
          <h1
            style={{
              fontSize: 36,
              fontWeight: 900,
              margin: 0,
              letterSpacing: '-0.02em',
              fontFamily: "'Fraunces', serif",
              lineHeight: 1.05,
              color: '#0a0a0a',
            }}
          >
            Overview Panel
            <span
              style={{
                display: 'inline-block',
                width: 80,
                height: 2,
                background: '#e8e8e6',
                marginLeft: 12,
                verticalAlign: 'middle',
              }}
            />
          </h1>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Insight Banner */}
          <InsightBanner />

          {/* KPI Cards Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {/* Monthly Revenue */}
            <div style={cardStyle}>
              <CardLabel icon={<Icon d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />}>
                月間売上
              </CardLabel>
              <div style={{ marginTop: 16 }}>
                <BigNum integer={revenueInteger} decimal={revenueDecimal} unit="M¥" size={44} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
                <div>
                  <SmallVal>{completedDealsThisMonth.length}</SmallVal>
                  <br />
                  <SmallLabel>完了案件</SmallLabel>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <SmallVal>+12%</SmallVal>
                  <br />
                  <SmallLabel>増減率</SmallLabel>
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <BarcodeBarsClient data={barData} width={200} height={22} />
              </div>
            </div>

            {/* Progress */}
            <div style={cardStyle}>
              <CardLabel icon={<Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />}>
                案件進捗
              </CardLabel>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
                <div>
                  <SmallVal>{completedCount}</SmallVal>
                  <br />
                  <SmallLabel>完了</SmallLabel>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <SmallVal>{totalCount - completedCount}</SmallVal>
                  <br />
                  <SmallLabel>進行中</SmallLabel>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', margin: '8px 0' }}>
                <GaugeClient value={progressRate} size={130} />
                <div
                  style={{
                    fontFamily: "'Fraunces', serif",
                    fontSize: 26,
                    fontWeight: 500,
                    letterSpacing: '-0.03em',
                    color: '#0a0a0a',
                    marginTop: -4,
                    display: 'flex',
                    alignItems: 'flex-start',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {progressInteger}
                  <span style={{ fontSize: 14 }}>,{progressDecimal}</span>
                  <span style={{ fontSize: 10, color: '#888888', marginTop: 2, marginLeft: 1 }}>%</span>
                </div>
              </div>
            </div>

            {/* In Progress */}
            <div style={cardStyle}>
              <CardLabel icon={<Icon d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />}>
                進行中案件
              </CardLabel>
              <div style={{ marginTop: 16 }}>
                <BigNum integer={inProgressCount.toString()} unit="件" size={44} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
                <div>
                  <SmallVal>{statusCounts.in_production}</SmallVal>
                  <br />
                  <SmallLabel>製造中</SmallLabel>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <SmallVal>{statusCounts.shipping}</SmallVal>
                  <br />
                  <SmallLabel>配送中</SmallLabel>
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <BarcodeBarsClient data={barData} width={200} height={22} />
              </div>
            </div>

            {/* Delivered this month */}
            <div style={cardStyle}>
              <CardLabel icon={<Icon d="M5 13l4 4L19 7" />}>
                今月納品
              </CardLabel>
              <div style={{ marginTop: 16 }}>
                <BigNum integer={deliveredThisMonth.toString()} unit="件" size={44} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
                <div>
                  <SmallVal>{statusCounts.completed}</SmallVal>
                  <br />
                  <SmallLabel>累計完了</SmallLabel>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <SmallVal>{totalCount > 0 ? Math.round((deliveredThisMonth / totalCount) * 100) : 0}%</SmallVal>
                  <br />
                  <SmallLabel>今月率</SmallLabel>
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <BarcodeBarsClient data={barData} width={200} height={22} />
              </div>
            </div>
          </div>

          {/* Pipeline and Recent Deals */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
            {/* Pipeline */}
            <div style={cardStyle}>
              <CardLabel icon={<Icon d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />}>
                パイプライン
              </CardLabel>
              <div style={{ marginTop: 16 }}>
                <PipelineBar data={pipelineData} />
              </div>
            </div>

            {/* Recent Deals */}
            <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 22px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#0a0a0a', fontFamily: "'Fraunces', serif" }}>
                  最近の案件
                </span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                    <th style={thStyle}>案件番号</th>
                    <th style={thStyle}>クライアント</th>
                    <th style={thStyle}>商品名</th>
                    <th style={thStyle}>ステータス</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>金額</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDeals.length > 0 ? recentDeals.map((deal, i) => {
                    const amount = (deal.unit_price_cny || 0) * (deal.exchange_rate || 21.5) * (deal.quantity || 0) * 1.8
                    return (
                      <tr
                        key={deal.id}
                        style={{
                          borderBottom: i < recentDeals.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <td style={tdStyle}>
                          <Link href={`/deals/${deal.id}`} style={{ color: '#bbbbbb', textDecoration: 'none', fontFamily: "'Fraunces', serif", fontVariantNumeric: 'tabular-nums' }}>
                            {deal.deal_number}
                          </Link>
                        </td>
                        <td style={{ ...tdStyle, fontFamily: "'Fraunces', serif", fontWeight: 600, color: '#0a0a0a' }}>
                          {deal.clients?.company_name || '-'}
                        </td>
                        <td style={tdStyle}>{deal.product_name}</td>
                        <td style={tdStyle}>
                          <StatusDot status={deal.status} />
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'Fraunces', serif", fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          {formatCurrency(amount)}
                        </td>
                      </tr>
                    )
                  }) : (
                    <tr>
                      <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', padding: '24px' }}>
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
            <div style={cardStyle}>
              <CardLabel icon={<Icon d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />}>
                停滞アラート（7日以上更新なし）
              </CardLabel>
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {staleDeals.slice(0, 5).map((deal) => (
                  <div
                    key={deal.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      backgroundColor: '#f2f2f0',
                      borderRadius: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: '50%',
                          backgroundColor: '#e5a32e',
                        }}
                      />
                      <div>
                        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 13, fontWeight: 500 }}>
                          {deal.deal_number}
                        </div>
                        <div style={{ fontSize: 11, color: '#888888' }}>
                          {deal.product_name} - {deal.clients?.company_name || '未設定'}
                        </div>
                      </div>
                    </div>
                    <Link
                      href={`/deals/${deal.id}`}
                      style={{
                        backgroundColor: '#0a0a0a',
                        color: '#ffffff',
                        borderRadius: 8,
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 500,
                        textDecoration: 'none',
                      }}
                    >
                      対応する
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: 20,
  border: '1px solid rgba(0,0,0,0.06)',
  padding: '20px 22px',
}

const thStyle: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 500,
  color: '#bbbbbb',
  fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
}

const tdStyle: React.CSSProperties = {
  padding: '12px 14px',
  fontSize: 12,
  color: '#888888',
  fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
}
