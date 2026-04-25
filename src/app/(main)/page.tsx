import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import {
  type SimpleStatus,
  SIMPLE_STATUS_CONFIG,
  SIMPLE_STATUS_ORDER,
} from '@/lib/types'
import { formatDate } from '@/lib/utils/format'
import { DealMiniProgress } from '@/components/deals/deal-mini-progress'

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

interface DealLite {
  id: string
  deal_code: string
  deal_name: string | null
  client_name_text: string | null
  desired_delivery_date: string | null
  simple_status: SimpleStatus
  last_activity_at: string
  sales_user?: { display_name: string | null } | null
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

  const { data: deals } = await supabase
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

  const allDeals: DealLite[] = (deals || []).map((d) => ({
    ...d,
    sales_user: Array.isArray(d.sales_user) ? d.sales_user[0] : d.sales_user,
  })) as DealLite[]

  const counts: Record<SimpleStatus, number> = {
    quoting: 0,
    quote_confirmed: 0,
    paid: 0,
    data_confirmed: 0,
    in_production: 0,
    shipped: 0,
    delivered: 0,
  }
  for (const d of allDeals) counts[d.simple_status] = (counts[d.simple_status] || 0) + 1

  const recent = allDeals.slice(0, 5)
  const inProgressTotal = allDeals.length - counts.delivered
  const greeting = getGreeting(new Date().getHours())
  const displayName = profile?.display_name || user.email?.split('@')[0] || ''

  return (
    <>
      {/* Header */}
      <div className="py-[18px]">
        <h1 className="font-display text-[24px] font-semibold text-[#0a0a0a]">
          {greeting}{displayName ? `、${displayName}さん` : ''}
        </h1>
        <p className="text-[12px] text-[#888] font-body mt-1">
          進行中 <span className="tabular-nums text-[#0a0a0a] font-semibold">{inProgressTotal}</span> 件 ·
          納品完了 <span className="tabular-nums text-[#0a0a0a] font-semibold">{counts.delivered}</span> 件 ·
          総 <span className="tabular-nums text-[#0a0a0a] font-semibold">{allDeals.length}</span> 件
        </p>
      </div>

      {/* Status Cards */}
      <section className="mb-6">
        <h2 className="text-[12px] font-body text-[#888] mb-2">ステータス別 件数</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {SIMPLE_STATUS_ORDER.map((status) => {
            const cfg = SIMPLE_STATUS_CONFIG[status]
            const count = counts[status]
            return (
              <Link
                key={status}
                href={`/deals?status=${status}`}
                className="block bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-3 no-underline hover:border-[#0a0a0a] transition-colors"
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: STEP_COLOR_MAP[cfg.color] }}
                  />
                  <span className="text-[10px] font-body text-[#888]">Step {cfg.step}</span>
                </div>
                <p className="text-[20px] font-display font-semibold text-[#0a0a0a] tabular-nums leading-none">
                  {count}
                </p>
                <p className="text-[11px] font-body text-[#555] mt-1 truncate">{cfg.label}</p>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Recent Deals */}
      <section>
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-[12px] font-body text-[#888]">最近更新された案件</h2>
          <Link
            href="/deals"
            className="text-[12px] font-body text-[#22c55e] no-underline hover:underline inline-flex items-center"
          >
            案件一覧 <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-8 text-center">
            <p className="text-[13px] font-body text-[#555]">まだ案件がありません。</p>
            <Link
              href="/deals/new"
              className="mt-3 inline-block text-[12px] font-body text-[#22c55e] no-underline hover:underline"
            >
              最初の案件を作成する →
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {recent.map((deal) => (
              <li key={deal.id}>
                <Link
                  href={`/deals/${deal.id}`}
                  className="block bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-3 no-underline hover:border-[#0a0a0a] transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-[#888] font-body tabular-nums">{deal.deal_code}</p>
                      <p className="text-[14px] text-[#0a0a0a] font-body font-semibold truncate">
                        {deal.deal_name || '(案件名未設定)'}
                      </p>
                      <p className="text-[12px] text-[#555] font-body truncate">
                        {deal.client_name_text || '(クライアント未設定)'}
                      </p>
                    </div>
                    <p className="text-[11px] text-[#888] font-body tabular-nums whitespace-nowrap">
                      {formatDate(deal.last_activity_at)}
                    </p>
                  </div>
                  <DealMiniProgress currentStatus={deal.simple_status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
