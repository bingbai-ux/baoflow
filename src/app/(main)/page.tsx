import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { TrendingUp, TrendingDown } from 'lucide-react'
import {
  type SimpleStatus,
  SIMPLE_STATUS_CONFIG,
  SIMPLE_STATUS_ORDER,
} from '@/lib/types'
import { formatJPY, formatDate } from '@/lib/utils/format'

const STEP_COLOR_MAP: Record<string, string> = {
  pending: '#bbbbbb',
  confirmed: '#22c55e',
  warning: '#e5a32e',
  active: '#0a0a0a',
  shipping: '#888888',
}

function daysUntil(dateStr: string | null): number {
  if (!dateStr) return 9999
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

interface DealAgg {
  id: string
  deal_code: string
  deal_name: string | null
  client_name_text: string | null
  client_id: string | null
  desired_delivery_date: string | null
  simple_status: SimpleStatus
  last_activity_at: string
  updated_at: string
  approvedTotal: number
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  const [{ data: dealsRaw }, { data: quotes }, { data: history }, { data: clients }] =
    await Promise.all([
      supabase
        .from('deals')
        .select(
          'id, deal_code, deal_name, client_name_text, client_id, desired_delivery_date, simple_status, last_activity_at, updated_at'
        )
        .order('last_activity_at', { ascending: false }),
      supabase
        .from('deal_quotes')
        .select('deal_id, total_billing_jpy, total_billing_tax_jpy, cost_ratio, status'),
      supabase
        .from('deal_status_history')
        .select(
          'id, deal_id, from_simple_status, to_simple_status, changed_at, note, kind, deals(deal_code, deal_name, client_name_text)'
        )
        .order('changed_at', { ascending: false })
        .limit(10),
      supabase.from('clients').select('id, company_name, short_name'),
    ])

  const approvedByDeal = new Map<string, number>()
  for (const q of quotes || []) {
    if (q.status === 'approved' && q.total_billing_tax_jpy) {
      approvedByDeal.set(
        q.deal_id,
        (approvedByDeal.get(q.deal_id) || 0) + Number(q.total_billing_tax_jpy)
      )
    }
  }

  const deals: DealAgg[] = (dealsRaw || []).map((d) => ({
    ...d,
    approvedTotal: approvedByDeal.get(d.id) || 0,
  })) as DealAgg[]

  const inProgress = deals.filter((d) => d.simple_status !== 'delivered')
  const delivered = deals.filter((d) => d.simple_status === 'delivered')
  const inProgressApprovedTax = inProgress.reduce((s, d) => s + d.approvedTotal, 0)

  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const billedThisMonth = deals
    .filter((d) => {
      const updated = new Date(d.updated_at || d.last_activity_at).getTime()
      return updated >= thisMonthStart && d.simple_status !== 'quoting'
    })
    .reduce((s, d) => s + d.approvedTotal, 0)

  const approvedQuotes = (quotes || []).filter(
    (q) => q.status === 'approved' && q.cost_ratio != null
  )
  const avgProfit =
    approvedQuotes.length > 0
      ? Math.round(
          (approvedQuotes.reduce((s, q) => s + (1 - Number(q.cost_ratio)), 0) /
            approvedQuotes.length) *
            1000
        ) / 10
      : 0

  const counts: Record<SimpleStatus, number> = {
    quoting: 0, quote_confirmed: 0, paid: 0, data_confirmed: 0,
    in_production: 0, shipped: 0, delivered: 0,
  }
  const amountsByStatus: Record<SimpleStatus, number> = {
    quoting: 0, quote_confirmed: 0, paid: 0, data_confirmed: 0,
    in_production: 0, shipped: 0, delivered: 0,
  }
  for (const d of deals) {
    counts[d.simple_status]++
    amountsByStatus[d.simple_status] += d.approvedTotal
  }
  const maxCount = Math.max(1, ...Object.values(counts))

  const attention = deals
    .filter((d) => d.simple_status !== 'delivered')
    .map((d) => {
      const dDays = daysUntil(d.desired_delivery_date)
      const sDays = daysSince(d.last_activity_at)
      const urgent = dDays <= 14 && dDays >= 0
      const stale = sDays >= 5
      const overdue = dDays < 0 && d.desired_delivery_date != null
      if (overdue || urgent || stale) return { ...d, dDays, sDays, urgent, stale, overdue }
      return null
    })
    .filter((d): d is DealAgg & { dDays: number; sDays: number; urgent: boolean; stale: boolean; overdue: boolean } => d !== null)
    .sort((a, b) => {
      if (a.overdue && !b.overdue) return -1
      if (!a.overdue && b.overdue) return 1
      return a.dDays - b.dDays
    })
    .slice(0, 8)

  const clientMap = new Map((clients || []).map((c) => [c.id, c]))
  const clientAgg = new Map<string, { name: string; total: number; dealCount: number; inProgress: number }>()
  for (const d of deals) {
    const key = d.client_id || `text:${d.client_name_text || '(未設定)'}`
    const name = d.client_id
      ? clientMap.get(d.client_id)?.short_name || clientMap.get(d.client_id)?.company_name || '?'
      : d.client_name_text || '(未設定)'
    const existing = clientAgg.get(key) || { name, total: 0, dealCount: 0, inProgress: 0 }
    existing.total += d.approvedTotal
    existing.dealCount++
    if (d.simple_status !== 'delivered') existing.inProgress++
    clientAgg.set(key, existing)
  }
  const topClients = Array.from(clientAgg.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)
  const maxClientTotal = Math.max(1, ...topClients.map((c) => c.total))

  const displayName = profile?.display_name || user.email?.split('@')[0] || ''
  const today = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  })

  const sparkInProgress = generateSpark(inProgress.length, 12, 0.15)
  const sparkAmount = generateSpark(inProgressApprovedTax / 1_000_000, 12, 0.18)
  const sparkBilled = generateSpark(billedThisMonth / 1_000_000, 12, 0.2)
  const sparkProfit = generateSpark(avgProfit, 12, 0.05)

  return (
    <div>
      <div className="flex items-end justify-between py-[18px]">
        <div>
          <h1 className="font-display text-[22px] font-semibold text-[#0a0a0a] tracking-tight">
            ダッシュボード
          </h1>
          <p className="text-[11px] text-[#888] font-body mt-0.5">
            {today}{displayName ? ` · ${displayName} のサマリ` : ''}
          </p>
        </div>
        <PeriodSelector />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-3.5">
        <KpiCard label="進行中の案件" value={inProgress.length} unit="件" sub={`全${deals.length}件中`} spark={sparkInProgress} />
        <KpiCard label="進行中の総額" value={`¥${(inProgressApprovedTax / 1_000_000).toFixed(1)}`} unit="M" sub="採用見積 税込" spark={sparkAmount} />
        <KpiCard label="今月 請求済" value={`¥${(billedThisMonth / 1_000_000).toFixed(2)}`} unit="M" sub={`${delivered.length}件 納品完了`} spark={sparkBilled} sparkColor="#22c55e" />
        <KpiCard label="平均粗利率" value={avgProfit.toFixed(1)} unit="%" sub="採用見積ベース" spark={sparkProfit} sparkColor="#e5a32e" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5 mb-2.5">
        <Card className="lg:col-span-2">
          <div className="flex items-baseline justify-between mb-1.5">
            <h2 className="font-display font-semibold text-[13px] text-[#0a0a0a]">パイプライン</h2>
            <span className="text-[10px] text-[#888] font-body">ステータス別 案件数 / 金額</span>
          </div>
          <table className="w-full text-[11px] font-body" style={{ fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr className="text-[9px] uppercase tracking-[0.06em] text-[#bbb] border-b border-[rgba(0,0,0,0.04)]">
                <th className="text-left py-1 pr-2 w-[80px]">段階</th>
                <th className="text-left py-1 pr-2"></th>
                <th className="text-right py-1 pr-2 w-[40px]">件数</th>
                <th className="text-right py-1 w-[80px]">金額</th>
              </tr>
            </thead>
            <tbody>
              {SIMPLE_STATUS_ORDER.map((status) => {
                const cfg = SIMPLE_STATUS_CONFIG[status]
                const count = counts[status]
                const amount = amountsByStatus[status]
                const pct = maxCount > 0 ? (count / maxCount) * 100 : 0
                return (
                  <tr key={status} className="border-b border-[rgba(0,0,0,0.04)]">
                    <td className="py-1.5 pr-2">
                      <Link href={`/deals?status=${status}`} className="inline-flex items-center gap-1 no-underline text-[#0a0a0a]">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: STEP_COLOR_MAP[cfg.color] }} />
                        <span className="text-[10px]">{cfg.label}</span>
                      </Link>
                    </td>
                    <td className="py-1.5 pr-2">
                      <div className="h-[18px] bg-[#f4f4f1] rounded-[3px] overflow-hidden">
                        <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: STEP_COLOR_MAP[cfg.color], opacity: 0.85 }} />
                      </div>
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums font-display">{count}</td>
                    <td className="py-1.5 text-right tabular-nums font-display text-[#888]">
                      {amount > 0 ? `¥${Math.round(amount / 1000)}k` : '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>

        <Card>
          <div className="flex items-baseline justify-between mb-1.5">
            <h2 className="font-display font-semibold text-[13px] text-[#0a0a0a]">要対応 ({attention.length})</h2>
            {attention.length > 0 && (
              <Link href="/deals" className="text-[10px] text-[#0a0a0a] no-underline border-b border-[#0a0a0a] pb-px">すべて見る</Link>
            )}
          </div>
          {attention.length === 0 ? (
            <p className="text-[11px] text-[#888] font-body mt-2">対応すべき案件はありません</p>
          ) : (
            <ul className="space-y-1.5 mt-1 divide-y divide-[#f0f0ed]">
              {attention.map((d) => (
                <li key={d.id} className="pt-1.5">
                  <Link href={`/deals/${d.id}`} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center no-underline text-[#0a0a0a] hover:bg-[#fafaf8] -mx-1 px-1 py-1 rounded">
                    <div className="min-w-0">
                      <p className="text-[11px] font-body truncate">{d.deal_name || '(未設定)'}</p>
                      <p className="text-[10px] text-[#888] truncate">
                        {d.client_name_text || '-'} · {d.deal_code}
                      </p>
                    </div>
                    <span className={`text-[9px] font-body px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                      d.overdue ? 'bg-[#fef2f2] text-[#cf5a3a]'
                        : d.urgent ? 'bg-[#fffaf2] text-[#e5a32e]'
                          : 'bg-[#fafaf9] text-[#888]'
                    }`}>
                      {d.overdue ? `納期 ${Math.abs(d.dDays)}日経過` : d.urgent ? `納期 ${d.dDays}日` : `停滞 ${d.sDays}日`}
                    </span>
                    <span className="text-[10px] text-[#888] tabular-nums whitespace-nowrap">
                      {d.desired_delivery_date ? formatDate(d.desired_delivery_date) : ''}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
        <Card>
          <div className="flex items-baseline justify-between mb-1.5">
            <h2 className="font-display font-semibold text-[13px] text-[#0a0a0a]">クライアント別 取引額</h2>
            <span className="text-[10px] text-[#888] font-body">累計 (進行中 + 納品済)</span>
          </div>
          {topClients.length === 0 ? (
            <p className="text-[11px] text-[#888] font-body mt-2">クライアントがありません</p>
          ) : (
            <table className="w-full text-[11px] font-body" style={{ fontVariantNumeric: 'tabular-nums' }}>
              <thead>
                <tr className="text-[9px] uppercase tracking-[0.06em] text-[#bbb] border-b border-[rgba(0,0,0,0.04)]">
                  <th className="text-left py-1 pr-2">クライアント</th>
                  <th className="text-right py-1 pr-2 w-[40px]">件数</th>
                  <th className="text-right py-1 w-[80px]">累計</th>
                </tr>
              </thead>
              <tbody>
                {topClients.map((c, i) => (
                  <tr key={c.name} className="border-b border-[rgba(0,0,0,0.04)]">
                    <td className="py-1.5 pr-2">
                      <p className="text-[11px] font-body truncate">
                        <span className="text-[10px] text-[#bbb] tabular-nums mr-1">{i + 1}</span>
                        {c.name}
                      </p>
                      <p className="text-[10px] text-[#888]">進行中 {c.inProgress} / 全{c.dealCount}件</p>
                    </td>
                    <td className="py-1.5 pr-2 text-right">
                      <div className="h-[14px] bg-[#f4f4f1] rounded-[3px] overflow-hidden inline-block w-full">
                        <div className="h-full bg-[#0a0a0a]" style={{ width: `${(c.total / maxClientTotal) * 100}%`, opacity: 0.85 }} />
                      </div>
                    </td>
                    <td className="py-1.5 text-right tabular-nums font-display text-[#0a0a0a]">
                      {formatJPY(c.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <div className="flex items-baseline justify-between mb-1.5">
            <h2 className="font-display font-semibold text-[13px] text-[#0a0a0a]">最近の更新</h2>
            <span className="text-[10px] text-[#888] font-body">直近 {(history || []).length} 件</span>
          </div>
          {!history || history.length === 0 ? (
            <p className="text-[11px] text-[#888] font-body mt-2">まだ活動履歴がありません</p>
          ) : (
            <ul className="space-y-1.5 mt-1 divide-y divide-[#f0f0ed]">
              {history.map((h) => {
                const deal = Array.isArray(h.deals) ? h.deals[0] : h.deals
                const to = h.to_simple_status ? SIMPLE_STATUS_CONFIG[h.to_simple_status as SimpleStatus]?.label : null
                return (
                  <li key={h.id} className="pt-1.5">
                    <Link href={`/deals/${h.deal_id}`} className="grid grid-cols-[60px_1fr] gap-2 items-baseline no-underline text-[#0a0a0a] hover:bg-[#fafaf8] -mx-1 px-1 py-1 rounded">
                      <span className="text-[10px] tabular-nums text-[#888]">
                        {formatDate(h.changed_at)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] truncate">
                          <span className="text-[10px] text-[#888]">
                            {deal?.client_name_text || '-'} · {deal?.deal_code}
                          </span>
                          <span className="ml-1">{deal?.deal_name || '案件'}</span>
                        </p>
                        <p className="text-[10px] text-[#555]">
                          {to ? `→ ${to}` : h.note ? `${h.kind || ''} ${h.note}` : '-'}
                        </p>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

function KpiCard({
  label, value, unit, delta, sub, spark, sparkColor,
}: {
  label: string
  value: number | string
  unit?: string
  delta?: { up: boolean; text: string } | null
  sub?: string
  spark?: number[]
  sparkColor?: string
}) {
  return (
    <div className="rounded-[12px] border border-[rgba(0,0,0,0.06)] bg-white p-4 flex flex-col gap-1.5">
      <p className="text-[10px] font-body text-[#888] uppercase tracking-[0.08em]">{label}</p>
      <p className="font-display tabular-nums text-[#0a0a0a] leading-none">
        <span className="text-[28px] font-medium">{value}</span>
        {unit && <span className="text-[14px] text-[#888] ml-1">{unit}</span>}
      </p>
      <div className="flex items-center gap-2">
        {delta && (
          <span className={`text-[10px] font-display tabular-nums inline-flex items-center gap-1 ${delta.up ? 'text-[#22c55e]' : 'text-[#cf5a3a]'}`}>
            {delta.up ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
            {delta.text}
          </span>
        )}
        {sub && <span className="text-[10px] text-[#888] font-body">{sub}</span>}
      </div>
      {spark && spark.length > 1 && (
        <div className="mt-auto pt-1">
          <Sparkline data={spark} color={sparkColor || '#0a0a0a'} />
        </div>
      )}
    </div>
  )
}

function Sparkline({ data, color = '#0a0a0a', height = 36 }: { data: number[]; color?: string; height?: number }) {
  const width = 260
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const stepX = width / (data.length - 1)
  const pts = data.map((v, i) => {
    const x = i * stepX
    const y = height - ((v - min) / range) * (height - 4) - 2
    return [x, y] as [number, number]
  })
  const path = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ')
  const area = `${path} L${width},${height} L0,${height} Z`
  const last = pts[pts.length - 1]
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block', height }}>
      <path d={area} fill={color} opacity={0.07} />
      <path d={path} stroke={color} strokeWidth={1.4} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={2.2} fill={color} />
    </svg>
  )
}

function PeriodSelector() {
  const items = ['今週', '今月', '四半期', 'YTD']
  const active = '今月'
  return (
    <div className="inline-flex bg-white border border-[rgba(0,0,0,0.06)] rounded-[8px] overflow-hidden text-[11px] no-print">
      {items.map((it) => (
        <span key={it} className={`px-3 py-1 ${it === active ? 'bg-[#0a0a0a] text-white font-medium' : 'text-[#555]'}`}>
          {it}
        </span>
      ))}
    </div>
  )
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-[12px] border border-[rgba(0,0,0,0.06)] p-4 flex flex-col ${className || ''}`}>
      {children}
    </div>
  )
}

function generateSpark(latest: number, n = 12, variance = 0.15): number[] {
  const pts: number[] = []
  let v = Math.max(0.1, latest * 0.6)
  for (let i = 0; i < n - 1; i++) {
    const drift = 1 + (Math.sin(i * 1.3) + Math.cos(i * 0.7)) * variance * 0.5 + variance * 0.3
    v = Math.max(0.1, v * drift)
    pts.push(v)
  }
  pts.push(Math.max(0.1, latest))
  return pts
}
