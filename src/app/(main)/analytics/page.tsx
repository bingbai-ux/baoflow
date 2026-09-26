import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatJPY } from '@/lib/utils/format'
import { SIMPLE_STATUS_CONFIG, SIMPLE_STATUS_ORDER, type SimpleStatus } from '@/lib/types'

// Sprint 14: 売上分析 (シンプル版)。
// 採用見積 (approved) の税込金額を「月別」「クライアント別」「ステータス別」で見る。
// D78: チャートは外部ライブラリを使わず線と細いバーの手書き SVG。

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: deals }, { data: quotes }] = await Promise.all([
    supabase
      .from('deals')
      .select('id, deal_code, deal_name, client_name_text, simple_status, created_at, archived_at'),
    supabase
      .from('deal_quotes')
      .select('deal_id, total_billing_tax_jpy, status, updated_at')
      .eq('status', 'approved'),
  ])

  const dealMap = new Map((deals || []).map((d) => [d.id, d]))

  // 月別 (直近6ヶ月、採用見積の updated_at ベース)
  const months: Array<{ key: string; label: string; total: number }> = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: `${d.getMonth() + 1}月`,
      total: 0,
    })
  }
  const byClient = new Map<string, number>()
  const byStatus = new Map<SimpleStatus, { count: number; total: number }>()
  let grandTotal = 0

  for (const q of quotes || []) {
    const amt = Number(q.total_billing_tax_jpy) || 0
    if (amt <= 0) continue
    grandTotal += amt
    const mkey = (q.updated_at || '').slice(0, 7)
    const m = months.find((x) => x.key === mkey)
    if (m) m.total += amt
    const deal = dealMap.get(q.deal_id)
    if (deal) {
      const cname = deal.client_name_text || '(未設定)'
      byClient.set(cname, (byClient.get(cname) || 0) + amt)
      const st = (deal.simple_status || 'quoting') as SimpleStatus
      const cur = byStatus.get(st) || { count: 0, total: 0 }
      cur.total += amt
      byStatus.set(st, cur)
    }
  }
  for (const d of deals || []) {
    if (d.archived_at) continue
    const st = (d.simple_status || 'quoting') as SimpleStatus
    const cur = byStatus.get(st) || { count: 0, total: 0 }
    cur.count += 1
    byStatus.set(st, cur)
  }

  const clientRows = Array.from(byClient.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
  const maxMonth = Math.max(1, ...months.map((m) => m.total))
  const maxClient = Math.max(1, ...clientRows.map(([, v]) => v))

  return (
    <div className="pb-8">
      <div className="py-[18px]">
        <h1 className="font-display text-[21px] font-extrabold text-[#351E28]">売上分析</h1>
        <p className="text-[12.5px] text-[#84787D] font-body mt-1">
          採用見積(税込)ベースの概況です。累計{' '}
          <span className="fc-num font-bold text-[#351E28]">{formatJPY(grandTotal)}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* 月別 (バー: 過去=Cool Blue / 当月=Wasabi) */}
        <div className="bg-white rounded-[16px] border border-[#E2E1DA] p-5">
          <h2 className="font-display text-[15px] font-bold text-[#351E28] mb-3">月別売上(直近6ヶ月)</h2>
          <div className="flex items-end gap-3 h-[160px]">
            {months.map((m, i) => {
              const h = Math.round((m.total / maxMonth) * 130)
              const isCurrent = i === months.length - 1
              return (
                <div key={m.key} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                  <span className="fc-num text-[10px] text-[#84787D]">
                    {m.total > 0 ? `¥${Math.round(m.total / 10000).toLocaleString()}万` : ''}
                  </span>
                  <div
                    className={`w-full max-w-[36px] rounded-t-[4px] ${isCurrent ? 'bg-[#E9F056]' : 'bg-[#D7EFFF]'}`}
                    style={{ height: `${Math.max(h, m.total > 0 ? 4 : 0)}px` }}
                  />
                  <span className="text-[10.5px] text-[#84787D] font-body">{m.label}</span>
                </div>
              )
            })}
          </div>
          <div className="border-t-2 border-[#351E28] mt-0" />
        </div>

        {/* ステータス別 */}
        <div className="bg-white rounded-[16px] border border-[#E2E1DA] p-5">
          <h2 className="font-display text-[15px] font-bold text-[#351E28] mb-3">ステータス別(進行中)</h2>
          <ul className="space-y-1.5">
            {SIMPLE_STATUS_ORDER.map((st) => {
              const v = byStatus.get(st)
              if (!v || (v.count === 0 && v.total === 0)) return null
              return (
                <li key={st} className="flex items-center gap-2 text-[12px] font-body">
                  <Link
                    href={`/deals?status=${st}`}
                    className="w-[150px] flex-shrink-0 text-[#351E28] no-underline hover:underline"
                  >
                    {SIMPLE_STATUS_CONFIG[st].label}
                  </Link>
                  <span className="fc-num w-[46px] text-right text-[#84787D]">{v.count}件</span>
                  <span className="flex-1 h-[8px] rounded-full bg-[#EFEFEA] overflow-hidden">
                    <span
                      className="block h-full bg-[#D7EFFF]"
                      style={{ width: `${Math.min(100, (v.total / Math.max(1, grandTotal)) * 100)}%` }}
                    />
                  </span>
                  <span className="fc-num w-[110px] text-right font-bold text-[#351E28]">
                    {v.total > 0 ? formatJPY(v.total) : '—'}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      {/* クライアント別トップ10 */}
      <div className="bg-white rounded-[16px] border border-[#E2E1DA] p-5 mt-3">
        <h2 className="font-display text-[15px] font-bold text-[#351E28] mb-3">クライアント別(累計トップ10)</h2>
        {clientRows.length === 0 ? (
          <p className="text-[12px] text-[#84787D] font-body">採用見積のある案件がまだありません。</p>
        ) : (
          <ul className="space-y-1.5">
            {clientRows.map(([name, total], i) => (
              <li key={name} className="flex items-center gap-2 text-[12px] font-body">
                <span className="fc-num w-[22px] text-[#84787D]">{i + 1}.</span>
                <span className="w-[180px] flex-shrink-0 truncate font-bold text-[#351E28]">{name}</span>
                <span className="flex-1 h-[8px] rounded-full bg-[#EFEFEA] overflow-hidden">
                  <span className="block h-full bg-[#D7EFFF]" style={{ width: `${(total / maxClient) * 100}%` }} />
                </span>
                <span className="fc-num w-[110px] text-right font-bold text-[#351E28]">{formatJPY(total)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-[10.5px] text-[#84787D] font-body mt-3">
        ※ 採用見積(税込)を月・クライアント・ステータスで集計した簡易版です。実入金ベースの分析は出入金管理の実装後に拡張します。
      </p>
    </div>
  )
}
