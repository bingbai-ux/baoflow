'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateDealStatus } from '@/lib/actions/deals'
import { MasterStatus, MASTER_STATUS_CONFIG } from '@/lib/types'
import { statusLabelMap } from '@/components/status-dot'

// Master Status order (M01-M25)
const statusOrder: MasterStatus[] = [
  'M01', 'M02', 'M03', 'M04', 'M05', 'M06', 'M07', 'M08', 'M09', 'M10',
  'M11', 'M12', 'M13', 'M14', 'M15', 'M16', 'M17', 'M18', 'M19', 'M20',
  'M21', 'M22', 'M23', 'M24', 'M25',
]

interface StatusChangerProps {
  dealId: string
  currentStatus: string
}

export function StatusChanger({ dealId, currentStatus }: StatusChangerProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleStatusChange = async (newStatus: MasterStatus) => {
    setLoading(true)
    await updateDealStatus(dealId, newStatus, 'ステータス変更')
    setLoading(false)
    router.refresh()
  }

  // Check if current status is MasterStatus format
  const isMasterStatus = (status: string): status is MasterStatus => {
    return /^M\d{2}$/.test(status)
  }

  // Get label for status (supports both old and new formats)
  const getStatusLabel = (status: string) => {
    if (isMasterStatus(status)) {
      return MASTER_STATUS_CONFIG[status]?.label || status
    }
    return statusLabelMap[status] || status
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <select
        value={currentStatus}
        onChange={(e) => handleStatusChange(e.target.value as MasterStatus)}
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
            {getStatusLabel(status)}
          </option>
        ))}
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
