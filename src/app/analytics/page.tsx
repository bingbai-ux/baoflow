import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { BigNum } from '@/components/shared/big-num'
import { CardLabel } from '@/components/shared/card-label'
import { SmallVal } from '@/components/shared/small-val'
import { SmallLabel } from '@/components/shared/small-label'
import { SvgBarChart } from '@/components/dashboard/svg-bar-chart'
import { SvgHorizontalBar } from '@/components/dashboard/svg-horizontal-bar'

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

  // Get all deals
  const { data: deals } = await supabase
    .from('deals')
    .select(`
      *,
      clients (id, company_name)
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
    .order('name')

  const allFactories = factories || []

  // Get payments
  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .order('payment_date', { ascending: false })

  const allPayments = payments || []

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
      return d.status === 'completed' &&
             updated >= monthStart &&
             updated <= monthEnd
    })

    const revenue = monthDeals.reduce((sum, d) => {
      const unitPrice = (d.unit_price_cny || 0) * (d.exchange_rate || 21.5) * 1.8
      return sum + unitPrice * (d.quantity || 0)
    }, 0)

    const monthLabel = monthStart.toLocaleDateString('ja-JP', { month: 'short' })
    monthlyData.push({ label: monthLabel, value: revenue })
  }

  // Top clients by revenue
  const clientRevenue: Record<string, { name: string; revenue: number }> = {}
  allDeals.forEach(d => {
    const clientName = d.clients?.company_name || '未設定'
    const revenue = (d.unit_price_cny || 0) * (d.exchange_rate || 21.5) * (d.quantity || 0) * 1.8
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
    if (d.status === 'completed') {
      const unitPrice = (d.unit_price_cny || 0) * (d.exchange_rate || 21.5) * 1.8
      return sum + unitPrice * (d.quantity || 0)
    }
    return sum
  }, 0)

  const averageDealSize = allDeals.length > 0
    ? allDeals.reduce((sum, d) => {
        const unitPrice = (d.unit_price_cny || 0) * (d.exchange_rate || 21.5) * 1.8
        return sum + unitPrice * (d.quantity || 0)
      }, 0) / allDeals.length
    : 0

  // Payment totals
  const totalPaymentsIn = allPayments
    .filter(p => p.direction === 'in')
    .reduce((sum, p) => sum + (p.amount_jpy || 0), 0)

  const totalPaymentsOut = allPayments
    .filter(p => p.direction === 'out')
    .reduce((sum, p) => sum + (p.amount_jpy || 0), 0)

  // Format revenue
  const revenueMillions = totalRevenue / 1000000
  const revenueInteger = Math.floor(revenueMillions).toString()
  const revenueDecimal = ((revenueMillions % 1) * 100).toFixed(0).padStart(2, '0')

  // Avg deal size
  const avgDealThousands = averageDealSize / 1000
  const avgDealInteger = Math.floor(avgDealThousands).toString()

  return (
    <div style={{ minHeight: '100vh', background: '#f2f2f0' }}>
      <Header userName={profile?.display_name || user.email || undefined} />

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
            Business Intelligence
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
            Analytics
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
          {/* KPI Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {/* Total Revenue */}
            <div style={cardStyle}>
              <CardLabel icon={<Icon d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />}>
                累計売上
              </CardLabel>
              <div style={{ marginTop: 16 }}>
                <BigNum integer={revenueInteger} decimal={revenueDecimal} unit="M¥" size={44} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
                <div>
                  <SmallVal>{allDeals.filter(d => d.status === 'completed').length}</SmallVal>
                  <br />
                  <SmallLabel>完了案件</SmallLabel>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <SmallVal>{allDeals.length}</SmallVal>
                  <br />
                  <SmallLabel>総案件数</SmallLabel>
                </div>
              </div>
            </div>

            {/* Average Deal Size */}
            <div style={cardStyle}>
              <CardLabel icon={<Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />}>
                平均案件単価
              </CardLabel>
              <div style={{ marginTop: 16 }}>
                <BigNum integer={avgDealInteger} unit="K¥" size={44} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
                <div>
                  <SmallVal>{allClients.length}</SmallVal>
                  <br />
                  <SmallLabel>取引先数</SmallLabel>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <SmallVal>{allFactories.length}</SmallVal>
                  <br />
                  <SmallLabel>工場数</SmallLabel>
                </div>
              </div>
            </div>

            {/* Payments In */}
            <div style={cardStyle}>
              <CardLabel icon={<Icon d="M7 17l9.2-9.2M17 17V7H7" />}>
                入金合計
              </CardLabel>
              <div style={{ marginTop: 16 }}>
                <BigNum
                  integer={Math.floor(totalPaymentsIn / 1000000).toString()}
                  decimal={((totalPaymentsIn / 1000000 % 1) * 100).toFixed(0).padStart(2, '0')}
                  unit="M¥"
                  size={44}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
                <div>
                  <SmallVal>{allPayments.filter(p => p.direction === 'in').length}</SmallVal>
                  <br />
                  <SmallLabel>入金件数</SmallLabel>
                </div>
              </div>
            </div>

            {/* Payments Out */}
            <div style={cardStyle}>
              <CardLabel icon={<Icon d="M17 7l-9.2 9.2M7 7v10h10" />}>
                出金合計
              </CardLabel>
              <div style={{ marginTop: 16 }}>
                <BigNum
                  integer={Math.floor(totalPaymentsOut / 1000000).toString()}
                  decimal={((totalPaymentsOut / 1000000 % 1) * 100).toFixed(0).padStart(2, '0')}
                  unit="M¥"
                  size={44}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
                <div>
                  <SmallVal>{allPayments.filter(p => p.direction === 'out').length}</SmallVal>
                  <br />
                  <SmallLabel>出金件数</SmallLabel>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {/* Monthly Revenue Chart */}
            <div style={cardStyle}>
              <CardLabel icon={<Icon d="M3 3v18h18M7 16l4-4 4 4 5-5" />}>
                月別売上推移
              </CardLabel>
              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}>
                <SvgBarChart
                  data={monthlyData}
                  width={380}
                  height={180}
                />
              </div>
            </div>

            {/* Top Clients */}
            <div style={cardStyle}>
              <CardLabel icon={<Icon d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8" />}>
                売上TOP5クライアント
              </CardLabel>
              <div style={{ marginTop: 20 }}>
                <SvgHorizontalBar
                  data={topClients}
                  width={380}
                  height={160}
                />
              </div>
            </div>
          </div>

          {/* Summary Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {/* Status Distribution */}
            <div style={cardStyle}>
              <CardLabel icon={<Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />}>
                ステータス分布
              </CardLabel>
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: '見積中', status: ['draft', 'quoting', 'quoted'] },
                  { label: '仕様確定', status: ['spec_confirmed', 'sample_requested', 'sample_approved'] },
                  { label: '製造中', status: ['in_production', 'production_done'] },
                  { label: '配送中', status: ['shipping', 'customs'] },
                  { label: '完了', status: ['delivered', 'completed'] },
                ].map(item => {
                  const count = allDeals.filter(d => item.status.includes(d.status)).length
                  const percentage = allDeals.length > 0 ? (count / allDeals.length) * 100 : 0
                  return (
                    <div key={item.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: '#888888' }}>{item.label}</span>
                        <span style={{ fontSize: 11, color: '#0a0a0a', fontFamily: "'Fraunces', serif" }}>
                          {count}
                        </span>
                      </div>
                      <div style={{ height: 4, backgroundColor: '#f2f2f0', borderRadius: 2 }}>
                        <div
                          style={{
                            height: 4,
                            backgroundColor: item.label === '完了' ? '#22c55e' : '#0a0a0a',
                            opacity: item.label === '完了' ? 0.7 : 0.15,
                            borderRadius: 2,
                            width: `${percentage}%`,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Quick Stats */}
            <div style={cardStyle}>
              <CardLabel icon={<Icon d="M13 10V3L4 14h7v7l9-11h-7z" />}>
                クイック統計
              </CardLabel>
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                  <span style={{ fontSize: 12, color: '#888888' }}>今月新規案件</span>
                  <span style={{ fontSize: 13, color: '#0a0a0a', fontFamily: "'Fraunces', serif", fontWeight: 500 }}>
                    {allDeals.filter(d => {
                      const created = new Date(d.created_at)
                      return created.getMonth() === thisMonth && created.getFullYear() === thisYear
                    }).length}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                  <span style={{ fontSize: 12, color: '#888888' }}>平均単価 (CNY)</span>
                  <span style={{ fontSize: 13, color: '#0a0a0a', fontFamily: "'Fraunces', serif", fontWeight: 500 }}>
                    ¥{allDeals.length > 0
                      ? (allDeals.reduce((sum, d) => sum + (d.unit_price_cny || 0), 0) / allDeals.length).toFixed(2)
                      : '0.00'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                  <span style={{ fontSize: 12, color: '#888888' }}>平均数量</span>
                  <span style={{ fontSize: 13, color: '#0a0a0a', fontFamily: "'Fraunces', serif", fontWeight: 500 }}>
                    {allDeals.length > 0
                      ? Math.round(allDeals.reduce((sum, d) => sum + (d.quantity || 0), 0) / allDeals.length).toLocaleString()
                      : '0'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                  <span style={{ fontSize: 12, color: '#888888' }}>キャンセル数</span>
                  <span style={{ fontSize: 13, color: '#0a0a0a', fontFamily: "'Fraunces', serif", fontWeight: 500 }}>
                    {allDeals.filter(d => d.status === 'cancelled').length}
                  </span>
                </div>
              </div>
            </div>

            {/* Net Cashflow */}
            <div style={cardStyle}>
              <CardLabel icon={<Icon d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}>
                キャッシュフロー
              </CardLabel>
              <div style={{ marginTop: 16 }}>
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: '#888888', marginBottom: 4 }}>純利益</div>
                  <div style={{
                    fontFamily: "'Fraunces', serif",
                    fontSize: 32,
                    fontWeight: 600,
                    color: totalPaymentsIn - totalPaymentsOut >= 0 ? '#22c55e' : '#e5a32e',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {totalPaymentsIn - totalPaymentsOut >= 0 ? '+' : ''}
                    {((totalPaymentsIn - totalPaymentsOut) / 1000000).toFixed(2)}M
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ fontSize: 10, color: '#888888' }}>入金</div>
                    <div style={{ fontSize: 14, color: '#22c55e', fontFamily: "'Fraunces', serif" }}>
                      +{(totalPaymentsIn / 1000000).toFixed(1)}M
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ fontSize: 10, color: '#888888' }}>出金</div>
                    <div style={{ fontSize: 14, color: '#0a0a0a', fontFamily: "'Fraunces', serif" }}>
                      -{(totalPaymentsOut / 1000000).toFixed(1)}M
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
