import {
  type SimpleStatus,
  SIMPLE_STATUS_CONFIG,
  SIMPLE_STATUS_ORDER,
} from '@/lib/types'

const STEP_COLOR_MAP: Record<string, string> = {
  pending: '#bbbbbb',
  confirmed: '#22c55e',
  warning: '#e5a32e',
  active: '#0a0a0a',
  shipping: '#888888',
}

interface DealMiniProgressProps {
  currentStatus: SimpleStatus
}

export function DealMiniProgress({ currentStatus }: DealMiniProgressProps) {
  const currentIndex = SIMPLE_STATUS_ORDER.indexOf(currentStatus)
  const config = SIMPLE_STATUS_CONFIG[currentStatus]

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <div
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: STEP_COLOR_MAP[config.color] }}
        />
        <span className="text-[11px] font-body text-[#0a0a0a] font-semibold">
          {config.label}
        </span>
        <span className="text-[10px] font-body text-[#888] tabular-nums">
          {currentIndex + 1}/{SIMPLE_STATUS_ORDER.length}
        </span>
      </div>
      <div className="flex gap-0.5">
        {SIMPLE_STATUS_ORDER.map((status, index) => {
          const isDone = index < currentIndex
          const isCurrent = index === currentIndex
          const segColor = isDone
            ? '#22c55e'
            : isCurrent
              ? STEP_COLOR_MAP[SIMPLE_STATUS_CONFIG[status].color]
              : '#e8e8e6'
          return (
            <div
              key={status}
              className="flex-1 h-[3px] rounded-full"
              style={{ backgroundColor: segColor }}
            />
          )
        })}
      </div>
    </div>
  )
}
