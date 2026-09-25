import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  type SimpleStatus,
  SIMPLE_STATUS_CONFIG,
  SIMPLE_STATUS_ORDER,
} from '@/lib/types'
import { formatJPY, formatDate } from '@/lib/utils/format'
import { WaitingOnBadge } from '@/components/deals/waiting-on-badge'
import { normalizeWaitingOn, type WaitingOn } from '@/lib/utils/waiting-on'

// F&C Sprint 10 (A): ホーム=「きょうやること」。
// 期限・停滞・ボール(waiting_on)から要対応を拾い、次のアクションに直結させる。

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
  waiting_on: string | null
  last_activity_at: string
  updated_at: string
  approvedTotal: number
}

// ステータス別「次のアクション」の行き先
function nextActionHref(d: DealAgg): string {
  if (d.simple_status === 'quote_confirmed') return `/deals/${d.id}/documents`
  return `/deals/${d.id}`
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

  const [
    { data: dealsRaw },
    { data: quotes },
    { data: history },
    { data: clients },
    { count: openRequests },
    { count: inTransitInbound },
    { data: stockItems },
  ] = await Promise.all([
      supabase
        .from('deals')
        .select(
          'id, deal_code, deal_name, client_name_text, client_id, desired_delivery_date, simple_status, waiting_on, last_activity_at, updated_at'
        )
        .is('archived_at', null)
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
        .limit(8),
      supabase.from('clients').select('id, company_name, short_name'),
      supabase
        .from('shipment_requests')
        .select('id', { count: 'exact', head: true })
        .in('status', ['requested', 'confirmed']),
      supabase
        .from('inbound_shipments')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'in_transit'),
      supabase
        .from('inventory_items')
        .select('id, quantity_on_hand, low_stock_threshold')
        .not('low_stock_threshold', 'is', null),
    ])

  const lowStock = (stockItems || []).filter(
    (i) => i.low_stock_threshold != null && i.quantity_on_hand <= i.low_stock_threshold
  ).length

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

  // ---- きょうやることキュー -------------------------------------------
  type QueueItem = DealAgg & { dDays: number; sDays: number }
  const withDays = (d: DealAgg): QueueItem => ({
    ...d,
    dDays: daysUntil(d.desired_delivery_date),
    sDays: daysSince(d.last_activity_at),
  })

  const active = inProgress.map(withDays)

  // 1) 期限: 納期超過 or 14日以内
  const deadline = active
    .filter((d) => d.desired_delivery_date && d.dDays <= 14)
    .sort((a, b) => a.dDays - b.dDays)

  const deadlineIds = new Set(deadline.map((d) => d.id))

  // 2) 自分の番(ボール=us)
  const myTurn = active
    .filter((d) => !deadlineIds.has(d.id) && normalizeWaitingOn(d.waiting_on) === 'us')
    .sort((a, b) => b.sDays - a.sDays)

  // 3) 返答待ちが3日以上 → 催促どき
  const chase = active
    .filter((d) => {
      const w = normalizeWaitingOn(d.waiting_on)
      return !deadlineIds.has(d.id) && (w === 'client' || w === 'factory') && d.sDays >= 3
    })
    .sort((a, b) => b.sDays - a.sDays)

  const todoCount = deadline.length + myTurn.length + chase.length

  // ---- パイプライン・クライアント集計(下段) --------------------------
  const counts: Record<SimpleStatus, number> = {
    quoting: 0, quote_confirmed: 0, paid: 0, data_confirmed: 0,
    in_production: 0, shipped: 0, delivered: 0,
  }
  const amountsByStatus: Record<SimpleStatus, number> = { ...counts }
  for (const d of deals) {
    counts[d.simple_status]++
    amountsByStatus[d.simple_status] += d.approvedTotal
  }
  const maxCount = Math.max(1, ...Object.values(counts))

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

  return (
    <div>
      {/* 画面見出し + 読み方(F&C ScreenHeader) */}
      <div className="py-[18px]">
        <h1 className="font-display text-[21px] font-extrabold text-[#351E28]">
          きょうやること
        </h1>
        <p className="text-[12.5px] text-[#84787D] font-body mt-1">
          {today}
          {displayName ? ` · ${displayName}` : ''} · 納期・ボール・停滞から拾った{' '}
          <span className="fc-num tabular-nums">{todoCount}件</span>。上から順に片づけてください。
        </p>
      </div>

      {/* 数値の帯(D79: 数値データ = Cool Blue 面) */}
      <div className="rounded-[16px] bg-[#D7EFFF] px-5 py-4 mb-3 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="進行中の案件" value={`${inProgress.length}件`} sub={`全${deals.length}件中`} />
        <Stat label="進行中の総額(採用見積・税込)" value={formatJPY(inProgressApprovedTax)} sub={inProgressApprovedTax === 0 ? '採用見積なし' : undefined} />
        <Stat label="今月の請求(概算)" value={formatJPY(billedThisMonth)} sub={`納品完了 ${delivered.length}件`} />
        <Stat label="平均粗利率(採用見積)" value={approvedQuotes.length > 0 ? `${avgProfit.toFixed(1)}%` : '—'} sub={approvedQuotes.length === 0 ? '算定できる見積なし' : `${approvedQuotes.length}件から算定`} />
      </div>

      {/* 在庫サービスの動き (出荷依頼・輸送中・在庫少) */}
      {((openRequests || 0) > 0 || (inTransitInbound || 0) > 0 || lowStock > 0) && (
        <div className="rounded-[16px] bg-white border border-[#E2E1DA] px-5 py-3 mb-3 flex items-center gap-3 flex-wrap text-[12px] font-body">
          <span className="font-bold text-[#351E28]">在庫サービス:</span>
          {(openRequests || 0) > 0 && (
            <Link href="/inventory?tab=requests" className="rounded-full bg-[#E9F056] text-[#666C14] font-bold px-3 py-1 no-underline hover:brightness-95">
              出荷依頼 <span className="fc-num">{openRequests}</span>件 未処理
            </Link>
          )}
          {(inTransitInbound || 0) > 0 && (
            <Link href="/inventory?tab=inbound" className="rounded-full bg-[#D7EFFF] text-[#33566F] font-bold px-3 py-1 no-underline hover:brightness-95">
              入庫予定 <span className="fc-num">{inTransitInbound}</span>件 輸送中
            </Link>
          )}
          {lowStock > 0 && (
            <Link href="/inventory" className="rounded-full bg-[#FFD8C2] text-[#B03616] font-bold px-3 py-1 no-underline hover:brightness-95">
              在庫少 <span className="fc-num">{lowStock}</span>品目
            </Link>
          )}
        </div>
      )}

      {/* きょうやることキュー(主役・全幅) */}
      <div className="bg-white rounded-[16px] border border-[#E2E1DA] mb-3 overflow-hidden">
        {todoCount === 0 ? (
          <p className="text-[12.5px] text-[#84787D] font-body px-5 py-6">
            いま対応が必要な案件はありません。新しい動きがあるとここに並びます。
          </p>
        ) : (
          <>
            <QueueSection
              title="納期が近い・過ぎている"
              hint="納期14日以内と超過分。最優先です"
              items={deadline}
              tone="alert"
            />
            <QueueSection
              title="自分の番"
              hint="ボールがこちらにある案件。次のアクションへ"
              items={myTurn}
              tone="normal"
            />
            <QueueSection
              title="返事を待って3日以上"
              hint="そろそろ催促のタイミングです"
              items={chase}
              tone="muted"
            />
          </>
        )}
      </div>

      {/* 下段: パイプライン / クライアント別 / 最近の更新 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
        <div className="bg-white rounded-[16px] border border-[#E2E1DA] p-4">
          <div className="flex items-baseline justify-between mb-1.5">
            <h2 className="font-display font-bold text-[15px] text-[#351E28]">パイプライン</h2>
            <span className="text-[11px] text-[#84787D] font-body">段階別の件数 / 金額</span>
          </div>
          <table className="w-full text-[12.5px] font-body" style={{ fontVariantNumeric: 'tabular-nums' }}>
            <tbody>
              {SIMPLE_STATUS_ORDER.map((status) => {
                const cfg = SIMPLE_STATUS_CONFIG[status]
                const count = counts[status]
                const amount = amountsByStatus[status]
                const pct = maxCount > 0 ? (count / maxCount) * 100 : 0
                return (
                  <tr key={status} className="border-b border-[#EFEFEA]">
                    <td className="py-1.5 pr-2 w-[120px]">
                      <Link href={`/deals?status=${status}`} className="no-underline text-[#351E28] text-[11px]">
                        {cfg.label}
                      </Link>
                    </td>
                    <td className="py-1.5 pr-2">
                      {/* D78: 細いバー。現在値 = Wasabi */}
                      <div className="h-[6px] bg-[#EFEFEA] rounded-[2px] overflow-hidden">
                        <div className="h-full bg-[#E9F056]" style={{ width: `${pct}%` }} />
                      </div>
                    </td>
                    <td className="py-1.5 pr-2 text-right fc-num w-[48px]">{count}件</td>
                    <td className="py-1.5 text-right fc-num text-[#84787D] w-[80px] text-[11px]">
                      {amount > 0 ? formatJPY(amount) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-[16px] border border-[#E2E1DA] p-4">
          <div className="flex items-baseline justify-between mb-1.5">
            <h2 className="font-display font-bold text-[15px] text-[#351E28]">クライアント別 取引額</h2>
            <span className="text-[11px] text-[#84787D] font-body">累計・上位{topClients.length}社</span>
          </div>
          {topClients.length === 0 ? (
            <p className="text-[12.5px] text-[#84787D] font-body mt-2">
              まだクライアントがいません。案件を作るとここに並びます。
            </p>
          ) : (
            <table className="w-full text-[12.5px] font-body" style={{ fontVariantNumeric: 'tabular-nums' }}>
              <tbody>
                {topClients.map((c) => (
                  <tr key={c.name} className="border-b border-[#EFEFEA]">
                    <td className="py-1.5 pr-2 min-w-0">
                      <p className="text-[11.5px] truncate">{c.name}</p>
                      <p className="text-[10.5px] text-[#84787D]">進行中 {c.inProgress} / 全{c.dealCount}件</p>
                    </td>
                    <td className="py-1.5 pr-2 w-[70px]">
                      <div className="h-[6px] bg-[#EFEFEA] rounded-[2px] overflow-hidden">
                        <div className="h-full bg-[#D7EFFF]" style={{ width: `${(c.total / maxClientTotal) * 100}%` }} />
                      </div>
                    </td>
                    <td className="py-1.5 text-right fc-num text-[#351E28] w-[90px] text-[11.5px]">
                      {formatJPY(c.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white rounded-[16px] border border-[#E2E1DA] p-4">
          <div className="flex items-baseline justify-between mb-1.5">
            <h2 className="font-display font-bold text-[15px] text-[#351E28]">最近の更新</h2>
            <span className="text-[11px] text-[#84787D] font-body">直近{(history || []).length}件</span>
          </div>
          {!history || history.length === 0 ? (
            <p className="text-[12.5px] text-[#84787D] font-body mt-2">
              まだ動きがありません。案件が動くとここに並びます。
            </p>
          ) : (
            <ul className="divide-y divide-[#EFEFEA]">
              {history.map((h) => {
                const deal = Array.isArray(h.deals) ? h.deals[0] : h.deals
                const to = h.to_simple_status ? SIMPLE_STATUS_CONFIG[h.to_simple_status as SimpleStatus]?.label : null
                return (
                  <li key={h.id}>
                    <Link href={`/deals/${h.deal_id}`} className="grid grid-cols-[52px_1fr] gap-2 items-baseline no-underline text-[#351E28] hover:bg-[#FBFAF6] -mx-1 px-1 py-1.5 rounded-[8px]">
                      <span className="text-[10.5px] fc-num text-[#84787D]">{formatDate(h.changed_at)}</span>
                      <div className="min-w-0">
                        <p className="text-[11.5px] truncate">{deal?.deal_name || '案件'}</p>
                        <p className="text-[10.5px] text-[#84787D] truncate">
                          {deal?.client_name_text || '—'} · {to ? `→ ${to}` : h.note || ''}
                        </p>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

// ---- 部品 ------------------------------------------------------------

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-body font-bold text-[#33566F] leading-tight">{label}</p>
      <p className="fc-num text-[24px] font-extrabold text-[#33566F] leading-none mt-1.5">{value}</p>
      {sub && <p className="text-[10.5px] font-body text-[#33566F] opacity-80 mt-1">{sub}</p>}
    </div>
  )
}

function QueueSection({
  title,
  hint,
  items,
  tone,
}: {
  title: string
  hint: string
  items: Array<{
    id: string
    deal_code: string
    deal_name: string | null
    client_name_text: string | null
    desired_delivery_date: string | null
    simple_status: SimpleStatus
    waiting_on: string | null
    dDays: number
    sDays: number
  }>
  tone: 'alert' | 'normal' | 'muted'
}) {
  if (items.length === 0) return null
  return (
    <div>
      <div className={`px-5 py-2.5 border-b border-[#E2E1DA] flex items-baseline gap-2 ${
        tone === 'alert' ? 'bg-[#FFD8C2]' : 'bg-[#FBFAF6]'
      }`}>
        <h2 className={`font-display font-bold text-[13px] ${tone === 'alert' ? 'text-[#B03616]' : 'text-[#351E28]'}`}>
          {title} <span className="fc-num">{items.length}件</span>
        </h2>
        <span className={`text-[11px] font-body ${tone === 'alert' ? 'text-[#B03616] opacity-80' : 'text-[#84787D]'}`}>
          {hint}
        </span>
      </div>
      <ul>
        {items.map((d) => {
          const cfg = SIMPLE_STATUS_CONFIG[d.simple_status]
          const overdue = d.desired_delivery_date && d.dDays < 0
          const w = normalizeWaitingOn(d.waiting_on) as WaitingOn
          const actionLabel =
            w === 'client' || w === 'factory'
              ? '催促する'
              : cfg.nextAction || '開く'
          const href =
            d.simple_status === 'quote_confirmed' && w === 'us'
              ? `/deals/${d.id}/documents`
              : `/deals/${d.id}`
          return (
            <li key={d.id} className="border-b border-[#EFEFEA] last:border-b-0">
              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] items-center gap-3 px-5 py-2.5 hover:bg-[#FBFAF6]">
                <Link href={`/deals/${d.id}`} className="min-w-0 no-underline text-[#351E28]">
                  <p className="text-[12.5px] font-bold truncate">{d.deal_name || '(名称未設定)'}</p>
                  <p className="text-[11px] text-[#84787D] truncate">
                    {d.client_name_text || '—'} · <span className="fc-num">{d.deal_code}</span> · {cfg.label}
                  </p>
                </Link>
                <WaitingOnBadge dealId={d.id} value={d.waiting_on} size="sm" />
                <span className={`text-[10.5px] fc-num whitespace-nowrap px-2 py-[3px] rounded-full font-bold ${
                  overdue
                    ? 'bg-[#FFD8C2] text-[#B03616]'
                    : d.desired_delivery_date && d.dDays <= 14
                      ? 'bg-[#FFD8C2] text-[#B03616]'
                      : 'bg-[#EFEFEA] text-[#84787D] border border-[#E2E1DA]'
                }`}>
                  {overdue
                    ? `納期 ${Math.abs(d.dDays)}日超過`
                    : d.desired_delivery_date && d.dDays <= 14
                      ? `納期まで ${d.dDays}日`
                      : `動きなし ${d.sDays}日`}
                </span>
                <span className="text-[10.5px] fc-num text-[#84787D] whitespace-nowrap w-[76px] text-right">
                  {d.desired_delivery_date ? formatDate(d.desired_delivery_date) : ''}
                </span>
                <Link
                  href={href}
                  className="no-underline whitespace-nowrap rounded-full bg-[#351E28] text-[#C9A2B8] text-[11px] font-bold px-3.5 py-1.5 hover:brightness-95 transition-[filter]"
                >
                  {actionLabel}
                </Link>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
