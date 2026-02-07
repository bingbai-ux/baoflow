import type { deal_status } from '@/lib/types'

const statusColorMap: Record<string, string> = {
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

const statusLabelMap: Record<string, string> = {
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

interface StatusDotProps {
  status: string
  showLabel?: boolean
}

export function StatusDot({ status, showLabel = true }: StatusDotProps) {
  const color = statusColorMap[status] || '#bbbbbb'
  const label = statusLabelMap[status] || status

  return (
    <div className="flex items-center gap-2">
      <div
        style={{
          width: '5px',
          height: '5px',
          borderRadius: '50%',
          backgroundColor: color,
          flexShrink: 0,
        }}
      />
      {showLabel && (
        <span
          style={{
            fontSize: '12px',
            color: '#555555',
            fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
          }}
        >
          {label}
        </span>
      )}
    </div>
  )
}

export { statusColorMap, statusLabelMap }
