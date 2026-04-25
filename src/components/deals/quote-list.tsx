'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { deleteQuote, type QuoteRow } from '@/lib/actions/quotes'
import { formatJPY, formatUSD, formatDate } from '@/lib/utils/format'

interface QuoteListProps {
  quotes: QuoteRow[]
}

export function QuoteList({ quotes }: QuoteListProps) {
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const handleDelete = (quoteId: string) => {
    if (!confirm('この見積を削除しますか？')) return
    setPendingId(quoteId)
    startTransition(async () => {
      const result = await deleteQuote(quoteId)
      setPendingId(null)
      if (!result.success) {
        alert(result.error || '削除に失敗しました')
        return
      }
      router.refresh()
    })
  }

  return (
    <ul className="space-y-2">
      {quotes.map((q) => {
        const totalTax = q.total_billing_tax_jpy
        const totalNoTax = q.total_billing_jpy
        const sellingJpy = q.selling_price_jpy
        const isDeleting = pendingId === q.id

        return (
          <li
            key={q.id}
            className="bg-white border border-[#e8e8e6] rounded-[10px] p-4 font-body"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
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
              <button
                type="button"
                onClick={() => handleDelete(q.id)}
                disabled={isDeleting}
                className="text-[#ef4444] p-1.5 rounded-[6px] hover:bg-[#fef2f2] disabled:opacity-50"
                title="見積を削除"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-3">
              <Stat label="販売単価 JPY" value={sellingJpy != null ? formatJPY(sellingJpy) : '-'} />
              <Stat
                label="請求合計 税抜"
                value={totalNoTax != null ? formatJPY(totalNoTax) : '-'}
              />
              <Stat
                label="請求合計 税込"
                value={totalTax != null ? formatJPY(totalTax) : '-'}
                highlight
              />
            </div>
          </li>
        )
      })}
    </ul>
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
