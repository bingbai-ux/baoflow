'use client'

import { useRouter } from 'next/navigation'
import { StatusDot } from '@/components/status-dot'
import { formatJPY, formatDate } from '@/lib/utils/format'
import { type MasterStatus } from '@/lib/types'

interface DealRowProps {
  deal: {
    id: string
    deal_code: string
    deal_name?: string
    master_status?: MasterStatus
    win_probability?: string
    last_activity_at?: string
    updated_at?: string
    client?: { company_name?: string }
    specifications?: { product_name?: string }[]
    quotes?: { total_billing_tax_jpy?: number; status?: string }[]
  }
  winProbabilityLabels: Record<string, string>
  isLast?: boolean
}

export function DealRow({ deal, winProbabilityLabels, isLast = false }: DealRowProps) {
  const router = useRouter()
  const spec = deal.specifications?.[0]
  const approvedQuote = deal.quotes?.find((q) => q.status === 'approved')
  const amount = approvedQuote?.total_billing_tax_jpy

  return (
    <tr
      className={`${!isLast ? 'border-b border-[rgba(0,0,0,0.06)]' : ''} hover:bg-[#fcfcfb] transition-colors cursor-pointer`}
      onClick={() => router.push(`/deals/${deal.id}`)}
    >
      <td className="px-4 py-3">
        <span className="font-display tabular-nums text-[13px] text-[#0a0a0a]">
          {deal.deal_code}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="font-body text-[13px] text-[#0a0a0a]">
          {deal.client?.company_name || '-'}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="font-body text-[13px] text-[#888]">
          {spec?.product_name || deal.deal_name || '-'}
        </span>
      </td>
      <td className="px-4 py-3">
        <StatusDot status={deal.master_status || 'M01'} size={6} />
      </td>
      <td className="px-4 py-3">
        <span className="font-body text-[12px] text-[#888]">
          {winProbabilityLabels[deal.win_probability || ''] || deal.win_probability || '-'}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="font-display tabular-nums text-[13px] text-[#0a0a0a]">
          {amount ? formatJPY(amount) : '-'}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="font-body text-[12px] text-[#888]">
          {formatDate(deal.last_activity_at || deal.updated_at)}
        </span>
      </td>
    </tr>
  )
}
