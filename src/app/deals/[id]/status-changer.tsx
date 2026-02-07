'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateDealStatus } from '@/lib/actions/deals'
import { statusLabelMap } from '@/components/deals/status-dot'
import type { deal_status } from '@/lib/types'

const statusOrder: deal_status[] = [
  'draft',
  'quoting',
  'quoted',
  'spec_confirmed',
  'sample_requested',
  'sample_approved',
  'payment_pending',
  'deposit_paid',
  'in_production',
  'production_done',
  'inspection',
  'shipping',
  'customs',
  'delivered',
  'invoice_sent',
  'payment_received',
  'completed',
]

interface StatusChangerProps {
  dealId: string
  currentStatus: string
  userId: string
}

export function StatusChanger({ dealId, currentStatus, userId }: StatusChangerProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleStatusChange = async (newStatus: deal_status) => {
    setLoading(true)
    await updateDealStatus(dealId, newStatus, userId)
    setLoading(false)
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <select
        value={currentStatus}
        onChange={(e) => handleStatusChange(e.target.value as deal_status)}
        disabled={loading}
        style={{
          width: '100%',
          backgroundColor: '#f2f2f0',
          borderRadius: '10px',
          padding: '10px 14px',
          fontSize: '13px',
          fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
          color: '#0a0a0a',
          border: '1px solid transparent',
          outline: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.5 : 1,
        }}
      >
        {statusOrder.map((status) => (
          <option key={status} value={status}>
            {statusLabelMap[status] || status}
          </option>
        ))}
        <option value="cancelled">キャンセル</option>
        <option value="on_hold">保留</option>
      </select>
      {loading && (
        <div
          style={{
            fontSize: '11px',
            color: '#888888',
            fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
          }}
        >
          更新中...
        </div>
      )}
    </div>
  )
}
