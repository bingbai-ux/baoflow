'use client'

import { type MasterStatus, MASTER_STATUS_CONFIG } from '@/lib/types'

// Status color mapping based on StatusColor type
const STATUS_COLOR_MAP: Record<string, string> = {
  pending: '#bbbbbb',
  confirmed: '#22c55e',
  warning: '#e5a32e',
  active: '#0a0a0a',
  shipping: '#888888',
}

// Legacy status color map (for backward compatibility)
const legacyStatusColorMap: Record<string, string> = {
  draft: '#bbbbbb',
  quoting: '#bbbbbb',
  quoted: '#bbbbbb',
  spec_confirmed: '#22c55e',
  sample_requested: '#0a0a0a',
  sample_approved: '#22c55e',
  payment_pending: '#e5a32e',
  deposit_paid: '#22c55e',
  in_production: '#0a0a0a',
  production_done: '#22c55e',
  inspection: '#888888',
  shipping: '#888888',
  customs: '#888888',
  delivered: '#22c55e',
  invoice_sent: '#e5a32e',
  payment_received: '#22c55e',
  completed: '#22c55e',
  cancelled: '#bbbbbb',
  on_hold: '#e5a32e',
}

// Legacy status label map (for backward compatibility)
const legacyStatusLabelMap: Record<string, string> = {
  draft: '下書き',
  quoting: '見積中',
  quoted: '見積済',
  spec_confirmed: '仕様確定',
  sample_requested: 'サンプル依頼中',
  sample_approved: 'サンプル承認',
  payment_pending: '入金待ち',
  deposit_paid: '前金入金済',
  in_production: '製造中',
  production_done: '製造完了',
  inspection: '検品中',
  shipping: '配送中',
  customs: '通関中',
  delivered: '納品済',
  invoice_sent: '請求書送付済',
  payment_received: '入金確認済',
  completed: '完了',
  cancelled: 'キャンセル',
  on_hold: '保留',
}

// Check if status is a MasterStatus (M01-M25 format)
function isMasterStatus(status: string): status is MasterStatus {
  return /^M\d{2}$/.test(status)
}

interface StatusDotProps {
  status: string
  showLabel?: boolean
  size?: number
}

export function StatusDot({ status, showLabel = true, size = 6 }: StatusDotProps) {
  let color: string
  let label: string

  if (isMasterStatus(status)) {
    // New MasterStatus format
    const config = MASTER_STATUS_CONFIG[status]
    color = STATUS_COLOR_MAP[config?.color] || '#bbbbbb'
    label = config?.label || status
  } else {
    // Legacy status format
    color = legacyStatusColorMap[status] || '#bbbbbb'
    label = legacyStatusLabelMap[status] || status
  }

  return (
    <div className="flex items-center gap-2">
      <div
        className="rounded-full flex-shrink-0"
        style={{
          width: size,
          height: size,
          backgroundColor: color,
        }}
      />
      {showLabel && (
        <span className="text-[12px] text-[#555] font-body">
          {label}
        </span>
      )}
    </div>
  )
}

export { legacyStatusColorMap as statusColorMap, legacyStatusLabelMap as statusLabelMap, STATUS_COLOR_MAP }
