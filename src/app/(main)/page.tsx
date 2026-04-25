import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowUpRight, AlertCircle, Clock } from 'lucide-react'
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

function getGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return 'おはようございます'
  if (hour >= 12 && hour < 17) return 'こんにちは'
  return 'おつかれさまです'
}

function daysUntil(dateStr: string | null): number {
  if (!dateStr) return 9999
  const d = new Date(dateStr).getTime()
  return Math.ceil((d - Date.now()) / (24 * 60 * 60 * 1000))
}

function daysSince(dateStr: string): number {
  const d = new Date(dateStr).getTime()
  return Math.floor((Date.now() - d) / (24 * 60 * 60 * 1000))
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
          'id, deal_code, deal_name, client_name_text, client_id, desired_delivery_date, simple_status, last_activity_at'
        )
        .order('last_activity_at', { ascending: false }),
      supabase
        .from('deal_quotes')
        .select('deal_id, total_billing_tax_jpy, status'),
      supabase
        .from('deal_status_history')
        .select(
          'id, deal_id, from_simple_status, to_simple_status, changed_at, note, deals(deal_code, deal_name, client_name_text)'
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
  const totalApprovedAll = deals.reduce((s, d) => s + d.approvedTotal, 0)
  const inProgressApproved = inProgress.reduce((s, d) => s + d.approvedTotal, 0)

  const counts: Record<SimpleStatus, number> = {
    quoting: 0,
    quote_confirmed: 0,
    paid: 0,
    data_confirmed: 0,
    in_production: 0,
    shipped: 0,
    delivered: 0,
  }
  for (const d of deals) counts[d.simple_status]++

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
    .filter(
      (
        d
      ): d is DealAgg & {
        dDays: number
        sDays: number
        urgent: boolean
        stale: boolean
        overdue: boolean
      } => d !== null
    )
    .sort((a, b) => {
      if (a.overdue && !b.overdue) return -1
      if (!a.overdue && b.overdue) return 1
      return a.dDays - b.dDays
    })
    .slice(0, 6)

  const clientMap = new Map((clients || []).map((c) => [c.id, c]))
  const clientAgg = new Map<string, { name: string; total: number; dealCount: number }>()
  for (const d of deals) {
    const key = d.client_id || `text:${d.client_name_text || '(未設定)'}`
    const name = d.client_id
      ? clientMap.get(d.client_id)?.short_name || clientMap.get(d.client_id)?.company_name || '?'
      : d.client_name_text || '(未設定)'
    const existing = clientAgg.get(key) || { name, total: 0, dealCount: 0 }
    existing.total += d.approvedTotal
    existing.dealCount++
    clientAgg.set(key, existing)
  }
  const topClients = Array.from(clientAgg.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
  const maxClientTotal = Math.max(1, ...topClients.map((c) => c.total))

  const greeting = getGreeting(new Date().getHours())
  const displayName = profile?.display_name || user.email?.split('@')[0] || ''

  return (
    <>
      <div className="py-[18px]">
        <h1 className="font-display text-[22px] font-semibold text-[#0a0a0a] tracking-tight">
          {greeting}{displayName ? `、${displayName}さん` : ''}
        </h1>
        <p className="text-[11px] text-[#888] font-body mt-1">
          {new Date().toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'short',
          })} のサマリ
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-3.5">
        <KpiCard label="進行中の案件" value={inProgress.length} unit="件" sub={`全${deals.length}件中`} />
        <KpiCard
          label="進行中の採用合計"
          value={`¥${(inProgressApproved / 1_000_000).toFixed(1)}`}
          unit="M"
          sub="税込"
        />
        <KpiCard
          label="納品完了"
          value={delivered.length}
          unit="件"
          sub={`累計 ¥${(totalApprovedAll / 1_000_000).toFixed(1)}M`}
        />
        <KpiCard
          label="要対応"
          value={attention.length}
          unit="件"
          sub="納期迫り or 停滞"
          accent={attention.length > 0}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5 mb-2.5">
        <Card className="lg:col-span-2">
          <CardHeader title="ステータス・パイプライン" meta={`${deals.length}件`} />
          <ul className="space-y-1.5 mt-1">
            {SIMPLE_STATUS_ORDER.map((status) => {
              const cfg = SIMPLE_STATUS_CONFIG[status]
              const count = counts[status]
              const pct = maxCount > 0 ? (count / maxCount) * 100 : 0
              return (
                <li
                  key={status}
                  className="grid grid-cols-[110px_1fr_40px] items-center gap-2 text-[11px] font-body"
                >
                  <Link
                    href={`/deals?status=${status}`}
                    className="flex items-center gap-1.5 no-underline text-[#0a0a0a] hover:text-[#22c55e]"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: STEP_COLOR_MAP[cfg.color] }}
                    />
                    <span className="truncate">{cfg.label}</span>
                  </Link>
                  <div className="h-[14px] bg-[#f4f4f1] rounded-[3px] overflow-hidden">
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: STEP_COLOR_MAP[cfg.color],
                        opacity: 0.7,
                      }}
                    />
                  </div>
                  <span className="text-right tabular-nums font-display">{count}</span>
                </li>
              )
            })}
          </ul>
        </Card>

        <Card>
          <CardHeader title="トップクライアント" meta={`${clientAgg.size}社`} />
          {topClients.length === 0 ? (
            <p className="text-[11px] text-[#888] font-body mt-2">クライアントがありません</p>
          ) : (
            <ul className="space-y-2 mt-1">
              {topClients.map((c, i) => (
                <li key={c.name} className="text-[11px] font-body">
                  <div className="flex items-baseline justify-between gap-2 mb-0.5">
                    <span className="truncate text-[#0a0a0a]">
                      <span className="text-[10px] text-[#bbb] tabular-nums mr-1">{i + 1}</span>
                      {c.name}
                    </span>
                    <span className="tabular-nums font-display text-[#0a0a0a] flex-shrink-0">
                      {formatJPY(c.total)}
                    </span>
                  </div>
                  <div className="h-[3px] bg-[#f4f4f1] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#22c55e]"
                      style={{ width: `${(c.total / maxClientTotal) * 100}%`, opacity: 0.7 }}
                    />
                  </div>
                  <p className="text-[10px] text-[#888] mt-0.5">{c.dealCount} 案件</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
        <Card>
          <CardHeader
            title="要対応リスト"
            meta={`${attention.length}件`}
            link={attention.length > 0 ? { href: '/deals', label: '案件一覧へ' } : undefined}
          />
          {attention.length === 0 ? (
            <p className="text-[11px] text-[#888] font-body mt-2">対応すべき案件はありません</p>
          ) : (
            <ul className="space-y-1.5 mt-1 divide-y divide-[#f0f0ed]">
              {attention.map((d) => (
                <li key={d.id} className="pt-1.5">
                  <Link
                    href={`/deals/${d.id}`}
                    className="block no-underline text-[#0a0a0a] hover:bg-[#fafaf8] -mx-1 px-1 py-1 rounded"
                  >
                    <div className="flex items-center gap-2 text-[11px] font-body">
                      {d.overdue ? (
                        <AlertCircle className="w-3 h-3 text-[#cf5a3a] flex-shrink-0" />
                      ) : d.urgent ? (
                        <Clock className="w-3 h-3 text-[#e5a32e] flex-shrink-0" />
                      ) : (
                        <Clock className="w-3 h-3 text-[#888] flex-shrink-0" />
                      )}
                      <span className="text-[10px] tabular-nums text-[#888]">{d.deal_code}</span>
                      <span className="truncate flex-1">{d.deal_name || '(未設定)'}</span>
                      <span className="text-[10px] text-[#888] truncate">
                        {d.client_name_text || '-'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-[#888] mt-0.5 ml-5">
                      <span className="tabular-nums">
                        {d.overdue
                          ? `納期 ${Math.abs(d.dDays)}日経過`
                          : d.urgent
                            ? `納期まで ${d.dDays}日`
                            : `${d.sDays}日更新なし`}
                      </span>
                      <span>·</span>
                      <span className="text-[#0a0a0a]">
                        {SIMPLE_STATUS_CONFIG[d.simple_status].label}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="直近のアクティビティ" meta={`最新 ${(history || []).length} 件`} />
          {!history || history.length === 0 ? (
            <p className="text-[11px] text-[#888] font-body mt-2">まだ活動履歴がありません</p>
          ) : (
            <ul className="space-y-1.5 mt-1 divide-y divide-[#f0f0ed]">
              {history.map((h) => {
                const deal = Array.isArray(h.deals) ? h.deals[0] : h.deals
                const to = h.to_simple_status
                  ? SIMPLE_STATUS_CONFIG[h.to_simple_status as SimpleStatus]?.label
                  : null
                return (
                  <li key={h.id} className="pt-1.5">
                    <Link
                      href={`/deals/${h.deal_id}`}
                      className="block no-underline text-[#0a0a0a] hover:bg-[#fafaf8] -mx-1 px-1 py-1 rounded"
                    >
                      <div className="flex items-baseline gap-2 text-[11px] font-body">
                        <span className="text-[10px] tabular-nums text-[#888] flex-shrink-0">
                          {formatDate(h.changed_at)}
                        </span>
                        <span className="truncate">
                          <span className="text-[10px] text-[#888]">{deal?.deal_code} </span>
                          {deal?.deal_name || '案件'}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#555] mt-0.5 ml-[60px]">
                        {to ? `→ ${to}` : h.note || '-'}
                      </p>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}

function KpiCard({
  label,
  value,
  unit,
  sub,
  accent,
}: {
  label: string
  value: number | string
  unit?: string
  sub?: string
  accent?: boolean
}) {
  return (
    <div
      className={`rounded-[12px] border p-4 flex flex-col gap-1.5 ${
        accent ? 'bg-white border-[#e5a32e]' : 'bg-white border-[rgba(0,0,0,0.06)]'
      }`}
    >
      <p className="text-[10px] font-body text-[#888] uppercase tracking-[0.08em]">{label}</p>
      <p className="font-display tabular-nums text-[#0a0a0a] leading-none">
        <span className="text-[28px] font-medium">{value}</span>
        {unit && <span className="text-[14px] text-[#888] ml-1">{unit}</span>}
      </p>
      {sub && <p className="text-[10px] text-[#888] font-body mt-auto">{sub}</p>}
    </div>
  )
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-white rounded-[12px] border border-[rgba(0,0,0,0.06)] p-4 flex flex-col ${
        className || ''
      }`}
    >
      {children}
    </div>
  )
}

function CardHeader({
  title,
  meta,
  link,
}: {
  title: string
  meta?: string
  link?: { href: string; label: string }
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 mb-1.5">
      <h2 className="font-display font-semibold text-[13px] text-[#0a0a0a]">{title}</h2>
      <div className="flex items-baseline gap-2">
        {meta && <span className="text-[10px] text-[#888] font-body">{meta}</span>}
        {link && (
          <Link
            href={link.href}
            className="text-[10px] text-[#0a0a0a] no-underline border-b border-[#0a0a0a] pb-px inline-flex items-center gap-0.5"
          >
            {link.label}
            <ArrowUpRight className="w-2.5 h-2.5" />
          </Link>
        )}
      </div>
    </div>
  )
}
