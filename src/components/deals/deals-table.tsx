'use client'

import { useRouter } from 'next/navigation'
import { StatusDot } from './status-dot'

interface Deal {
  id: string
  deal_number: string
  product_name: string
  quantity: number | null
  status: string
  updated_at: string
  clients?: { id: string; company_name: string } | null
  factories?: { id: string; name: string } | null
  profiles?: { id: string; display_name: string } | null
}

interface DealsTableProps {
  deals: Deal[]
}

export function DealsTable({ deals }: DealsTableProps) {
  const router = useRouter()

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  const handleRowClick = (id: string) => {
    router.push(`/deals/${id}`)
  }

  const headers = ['案件番号', 'クライアント', '商品名', '数量', '工場', 'ステータス', '担当者', '更新日']

  return (
    <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-[rgba(0,0,0,0.06)]">
            {headers.map((header) => (
              <th
                key={header}
                className="px-[14px] py-[10px] text-left text-[11px] font-medium text-[#bbb] font-body"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {deals && deals.length > 0 ? (
            deals.map((deal, index) => (
              <tr
                key={deal.id}
                className={`${index < deals.length - 1 ? 'border-b border-[rgba(0,0,0,0.06)]' : ''} hover:bg-[#fcfcfb] transition-colors cursor-pointer`}
                onClick={() => handleRowClick(deal.id)}
              >
                <td className="px-[14px] py-[12px] font-display text-[13px] text-[#0a0a0a] tabular-nums">
                  {deal.deal_number}
                </td>
                <td className="px-[14px] py-[12px] text-[12px] text-[#555] font-body">
                  {deal.clients?.company_name || '-'}
                </td>
                <td className="px-[14px] py-[12px] text-[12px] text-[#555] font-body">
                  {deal.product_name}
                </td>
                <td className="px-[14px] py-[12px] font-display text-[13px] text-[#0a0a0a] tabular-nums">
                  {deal.quantity?.toLocaleString() || '-'}
                </td>
                <td className="px-[14px] py-[12px] text-[12px] text-[#555] font-body">
                  {deal.factories?.name || '-'}
                </td>
                <td className="px-[14px] py-[12px]">
                  <StatusDot status={deal.status} />
                </td>
                <td className="px-[14px] py-[12px] text-[12px] text-[#555] font-body">
                  {deal.profiles?.display_name || '-'}
                </td>
                <td className="px-[14px] py-[12px] font-display text-[12px] text-[#888] tabular-nums">
                  {formatDate(deal.updated_at)}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={8}
                className="px-[14px] py-[40px] text-center text-[13px] text-[#888] font-body"
              >
                案件がありません
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
