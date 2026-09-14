'use client'

import { type MasterStatus, MASTER_STATUS_CONFIG } from '@/lib/types'

// Status color mapping based on StatusColor type
const STATUS_COLOR_MAP: Record<string, string> = {
  pending: '#AEB8A0',
  confirmed: '#E9F056',
  warning: '#FF5C34',
  active: '#351E28',
  shipping: '#84787D',
}

// Legacy status color map (for backward compatibility)
const legacyStatusColorMap: Record<string, string> = {
  draft: '#AEB8A0',
  quoting: '#AEB8A0',
  quoted: '#AEB8A0',
  spec_confirmed: '#E9F056',
  sample_requested: '#351E28',
  sample_approved: '#E9F056',
  payment_pending: '#FF5C34',
  deposit_paid: '#E9F056',
  in_production: '#351E28',
  production_done: '#E9F056',
  inspection: '#84787D',
  shipping: '#84787D',
  customs: '#84787D',
  delivered: '#E9F056',
  invoice_sent: '#FF5C34',
  payment_received: '#E9F056',
  completed: '#E9F056',
  cancelled: '#AEB8A0',
  on_hold: '#FF5C34',
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
    color = STATUS_COLOR_MAP[config?.color] || '#AEB8A0'
    label = config?.label || status
  } else {
    // Legacy status format
    color = legacyStatusColorMap[status] || '#AEB8A0'
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
        <span className="text-[12px] text-[#351E28] font-body">
          {label}
        </span>
      )}
    </div>
  )
}

export { legacyStatusColorMap as statusColorMap, legacyStatusLabelMap as statusLabelMap, STATUS_COLOR_MAP }
