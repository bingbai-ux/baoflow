import {
  type SimpleStatus,
  SIMPLE_STATUS_CONFIG,
  SIMPLE_STATUS_ORDER,
} from '@/lib/types'

const STEP_COLOR_MAP: Record<string, string> = {
  pending: '#AEB8A0',
  confirmed: '#E9F056',
  warning: '#FF5C34',
  active: '#351E28',
  shipping: '#84787D',
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
        <span className="text-[11px] font-body text-[#351E28] font-semibold">
          {config.label}
        </span>
        <span className="text-[10px] font-body text-[#84787D] tabular-nums">
          {currentIndex + 1}/{SIMPLE_STATUS_ORDER.length}
        </span>
      </div>
      <div className="flex gap-0.5">
        {SIMPLE_STATUS_ORDER.map((status, index) => {
          const isDone = index < currentIndex
          const isCurrent = index === currentIndex
          const segColor = isDone
            ? '#E9F056'
            : isCurrent
              ? STEP_COLOR_MAP[SIMPLE_STATUS_CONFIG[status].color]
              : '#E2E1DA'
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
