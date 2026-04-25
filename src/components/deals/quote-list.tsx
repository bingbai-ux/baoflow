'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Trash2, Check } from 'lucide-react'
import { deleteQuote, selectQuote, unselectQuote, type QuoteRow } from '@/lib/actions/quotes'
import { formatJPY, formatUSD, formatDate } from '@/lib/utils/format'

interface SpecLite {
  id: string
  product_name: string | null
}

interface QuoteListProps {
  dealId: string
  quotes: QuoteRow[]
  specs: SpecLite[]
}

export function QuoteList({ dealId, quotes, specs }: QuoteListProps) {
  const groups = useMemo(() => {
    const specMap = new Map<string, SpecLite>()
    for (const s of specs) specMap.set(s.id, s)

    const map = new Map<string | null, { spec: SpecLite | null; quotes: QuoteRow[] }>()
    for (const q of quotes) {
      const key = q.spec_id || null
      if (!map.has(key)) {
        map.set(key, { spec: q.spec_id ? specMap.get(q.spec_id) || null : null, quotes: [] })
      }
      map.get(key)!.quotes.push(q)
    }

    // Sort: spec-bound groups first (by product_name), then "案件全体" (null)
    return Array.from(map.entries()).sort((a, b) => {
      if (a[0] === null) return 1
      if (b[0] === null) return -1
      const an = a[1].spec?.product_name || ''
      const bn = b[1].spec?.product_name || ''
      return an.localeCompare(bn)
    })
  }, [quotes, specs])

  return (
    <div className="space-y-5">
      {groups.map(([key, { spec, quotes: list }]) => (
        <section key={key || '__none'}>
          <header className="flex items-baseline justify-between mb-2">
            <h3 className="text-[14px] font-body font-semibold text-[#0a0a0a]">
              {spec ? spec.product_name || '(商品名未設定)' : '案件全体 (商品未指定)'}
            </h3>
            <Link
              href={`/deals/${dealId}/quotes/new${spec ? `?spec_id=${spec.id}` : ''}`}
              className="text-[12px] font-body text-[#22c55e] no-underline hover:underline"
            >
              + この商品の見積を追加
            </Link>
          </header>
          <ul className="space-y-2">
            {list.map((q) => (
              <QuoteCard key={q.id} dealId={dealId} quote={q} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function QuoteCard({ dealId: _dealId, quote: q }: { dealId: string; quote: QuoteRow }) {
  const router = useRouter()
  const [busy, startBusy] = useTransition()

  const isApproved = q.status === 'approved'

  const handleDelete = () => {
    if (!confirm('この見積を削除しますか？')) return
    startBusy(async () => {
      const r = await deleteQuote(q.id)
      if (!r.success) alert(r.error || '削除に失敗しました')
      else router.refresh()
    })
  }

  const handleToggleSelect = () => {
    startBusy(async () => {
      const r = isApproved ? await unselectQuote(q.id) : await selectQuote(q.id)
      if (!r.success) alert(r.error || '更新に失敗しました')
      else router.refresh()
    })
  }

  return (
    <li
      className={`bg-white border rounded-[10px] p-4 font-body ${
        isApproved ? 'border-[#22c55e] ring-1 ring-[#22c55e]' : 'border-[#e8e8e6]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            {isApproved && (
              <span className="text-[10px] font-body text-white bg-[#22c55e] px-1.5 py-0.5 rounded-full">採用</span>
            )}
            <span className="text-[14px] font-semibold text-[#0a0a0a]">v{q.version || 1}</span>
            <span className="text-[11px] text-[#888] tabular-nums">
              {q.quantity?.toLocaleString() || '-'} 個
            </span>
            <span className="text-[10px] text-[#bbb]">{formatDate(q.created_at)}</span>
          </div>
          <p className="mt-1 text-[12px] text-[#555]">
            工場単価 {q.factory_unit_price_usd != null ? formatUSD(q.factory_unit_price_usd) : '-'} ·
            為替 {q.exchange_rate?.toFixed(2) || '-'} ·
            掛け率 {q.cost_ratio?.toFixed(2) || '-'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleToggleSelect}
            disabled={busy}
            className={`text-[11px] font-body px-2 py-1 rounded-[6px] inline-flex items-center gap-1 disabled:opacity-50 ${
              isApproved
                ? 'bg-white text-[#555] border border-[#e8e8e6]'
                : 'bg-[#22c55e] text-white'
            }`}
          >
            {isApproved ? '採用解除' : <><Check className="w-3 h-3" /> 採用</>}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="text-[#ef4444] p-1.5 rounded-[6px] hover:bg-[#fef2f2] disabled:opacity-50"
            title="削除"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <Stat
          label="販売単価 JPY"
          value={q.selling_price_jpy != null ? formatJPY(q.selling_price_jpy) : '-'}
        />
        <Stat
          label="請求合計 税抜"
          value={q.total_billing_jpy != null ? formatJPY(q.total_billing_jpy) : '-'}
        />
        <Stat
          label="請求合計 税込"
          value={q.total_billing_tax_jpy != null ? formatJPY(q.total_billing_tax_jpy) : '-'}
          highlight
        />
      </div>
    </li>
  )
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div>
      <p className="text-[10px] text-[#888]">{label}</p>
      <p
        className={`tabular-nums ${
          highlight ? 'text-[14px] font-semibold text-[#22c55e]' : 'text-[13px] text-[#0a0a0a]'
        }`}
      >
        {value}
      </p>
    </div>
  )
}
