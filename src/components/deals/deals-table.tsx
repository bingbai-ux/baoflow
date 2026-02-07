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

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '20px',
        border: '1px solid rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            {['案件番号', 'クライアント', '商品名', '数量', '工場', 'ステータス', '担当者', '更新日'].map((header) => (
              <th
                key={header}
                style={{
                  padding: '10px 14px',
                  textAlign: 'left',
                  fontSize: '11px',
                  fontWeight: 500,
                  color: '#bbbbbb',
                  fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                }}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {deals && deals.length > 0 ? (
            deals.map((deal) => (
              <tr
                key={deal.id}
                style={{
                  borderBottom: '1px solid rgba(0,0,0,0.06)',
                  cursor: 'pointer',
                }}
                onClick={() => handleRowClick(deal.id)}
              >
                <td
                  style={{
                    padding: '12px 14px',
                    fontFamily: "'Fraunces', serif",
                    fontSize: '13px',
                    color: '#0a0a0a',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {deal.deal_number}
                </td>
                <td
                  style={{
                    padding: '12px 14px',
                    fontSize: '12px',
                    color: '#555555',
                    fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                  }}
                >
                  {deal.clients?.company_name || '-'}
                </td>
                <td
                  style={{
                    padding: '12px 14px',
                    fontSize: '12px',
                    color: '#555555',
                    fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                  }}
                >
                  {deal.product_name}
                </td>
                <td
                  style={{
                    padding: '12px 14px',
                    fontSize: '13px',
                    color: '#0a0a0a',
                    fontFamily: "'Fraunces', serif",
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {deal.quantity?.toLocaleString() || '-'}
                </td>
                <td
                  style={{
                    padding: '12px 14px',
                    fontSize: '12px',
                    color: '#555555',
                    fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                  }}
                >
                  {deal.factories?.name || '-'}
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <StatusDot status={deal.status} />
                </td>
                <td
                  style={{
                    padding: '12px 14px',
                    fontSize: '12px',
                    color: '#555555',
                    fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                  }}
                >
                  {deal.profiles?.display_name || '-'}
                </td>
                <td
                  style={{
                    padding: '12px 14px',
                    fontSize: '12px',
                    color: '#888888',
                    fontFamily: "'Fraunces', serif",
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatDate(deal.updated_at)}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={8}
                style={{
                  padding: '40px 14px',
                  textAlign: 'center',
                  fontSize: '13px',
                  color: '#888888',
                  fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                }}
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
