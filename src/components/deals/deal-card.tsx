import Link from 'next/link'
import { type SimpleStatus } from '@/lib/types'
import { DealMiniProgress } from './deal-mini-progress'
import { formatDate } from '@/lib/utils/format'

interface DealCardProps {
  deal: {
    id: string
    deal_code: string
    deal_name: string | null
    client_name_text: string | null
    desired_delivery_date: string | null
    simple_status: SimpleStatus
    last_activity_at: string
    sales_user?: { display_name: string | null } | null
  }
}

export function DealCard({ deal }: DealCardProps) {
  return (
    <Link
      href={`/deals/${deal.id}`}
      className="block bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-4 hover:border-[#0a0a0a] transition-colors no-underline"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-body text-[#888] tabular-nums">{deal.deal_code}</p>
          <h3 className="text-[14px] font-body font-semibold text-[#0a0a0a] truncate">
            {deal.deal_name || '(案件名未設定)'}
          </h3>
          <p className="text-[12px] font-body text-[#555] mt-0.5 truncate">
            {deal.client_name_text || '(クライアント未設定)'}
          </p>
        </div>
        {deal.desired_delivery_date && (
          <div className="flex-shrink-0 text-right">
            <p className="text-[10px] font-body text-[#888]">希望納期</p>
            <p className="text-[12px] font-body text-[#0a0a0a] tabular-nums">
              {formatDate(deal.desired_delivery_date)}
            </p>
          </div>
        )}
      </div>

      <DealMiniProgress currentStatus={deal.simple_status} />

      <div className="mt-3 flex items-center justify-between text-[11px] font-body text-[#888]">
        <span>担当: {deal.sales_user?.display_name || '-'}</span>
        <span className="tabular-nums">更新: {formatDate(deal.last_activity_at)}</span>
      </div>
    </Link>
  )
}
