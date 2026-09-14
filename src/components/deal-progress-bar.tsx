'use client'

import { useState, useTransition } from 'react'
import { Check } from 'lucide-react'
import {
  type SimpleStatus,
  SIMPLE_STATUS_CONFIG,
  SIMPLE_STATUS_ORDER,
} from '@/lib/types'
import { advanceSimpleStatus } from '@/lib/actions/deals'

const STEP_COLOR_MAP: Record<string, string> = {
  pending: '#AEB8A0',
  confirmed: '#E9F056',
  warning: '#FF5C34',
  active: '#351E28',
  shipping: '#84787D',
}

interface DealProgressBarProps {
  dealId: string
  currentStatus: SimpleStatus
}

export function DealProgressBar({ dealId, currentStatus }: DealProgressBarProps) {
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentConfig = SIMPLE_STATUS_CONFIG[currentStatus]
  const currentIndex = SIMPLE_STATUS_ORDER.indexOf(currentStatus)
  const isLast = currentIndex === SIMPLE_STATUS_ORDER.length - 1

  const handleAdvance = () => {
    setError(null)
    startTransition(async () => {
      const result = await advanceSimpleStatus(dealId)
      if (!result.success) {
        setError(result.error || '更新に失敗しました')
      }
      setConfirming(false)
    })
  }

  return (
    <div className="bg-white rounded-[16px] border border-[rgba(53,30,40,0.06)] p-5">
      {/* Steps */}
      <div className="flex items-start justify-between gap-2">
        {SIMPLE_STATUS_ORDER.map((status, index) => {
          const config = SIMPLE_STATUS_CONFIG[status]
          const state: 'done' | 'current' | 'pending' =
            index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'pending'
          // F&C D78: 過去 = Cool Blue / 現在 = Wasabi / 未来 = Line
          const dotColor =
            state === 'done'
              ? '#D7EFFF'
              : state === 'current'
                ? '#E9F056'
                : '#E2E1DA'

          return (
            <div key={status} className="flex-1 flex flex-col items-center min-w-0">
              <div className="flex items-center w-full">
                {/* Left connector */}
                <div
                  className="flex-1 h-px"
                  style={{
                    backgroundColor: index === 0 ? 'transparent' : index <= currentIndex ? '#D7EFFF' : '#E2E1DA',
                  }}
                />
                {/* Dot */}
                <div
                  className={`flex-shrink-0 rounded-full flex items-center justify-center ${
                    state === 'current' ? 'w-4 h-4' : 'w-3 h-3'
                  }`}
                  style={{ backgroundColor: dotColor }}
                  aria-current={state === 'current'}
                >
                  {state === 'done' && (
                    <Check className="w-2 h-2 text-[#33566F]" strokeWidth={3} />
                  )}
                </div>
                {/* Right connector */}
                <div
                  className="flex-1 h-px"
                  style={{
                    backgroundColor:
                      index === SIMPLE_STATUS_ORDER.length - 1
                        ? 'transparent'
                        : index < currentIndex
                          ? '#D7EFFF'
                          : '#E2E1DA',
                  }}
                />
              </div>
              <span
                className={`mt-2 text-[10px] font-body text-center leading-tight ${
                  state === 'pending'
                    ? 'text-[#AEB8A0]'
                    : state === 'current'
                      ? 'text-[#351E28] font-semibold'
                      : 'text-[#351E28]'
                }`}
              >
                {config.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Action area */}
      <div className="mt-5 pt-4 border-t border-[rgba(53,30,40,0.06)] flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] text-[#84787D] font-body">現在のステップ</p>
          <p className="text-[14px] text-[#351E28] font-body font-semibold">
            {currentConfig.label}
          </p>
          {currentConfig.nextAction && (
            <p className="text-[11px] text-[#351E28] font-body mt-0.5">
              次のアクション: {currentConfig.nextAction}
            </p>
          )}
        </div>

        {!isLast && !confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="px-4 py-2 rounded-full bg-[#351E28] text-[#C9A2B8] text-[12px] font-body whitespace-nowrap hover:brightness-95 transition-colors"
            disabled={isPending}
          >
            {currentConfig.nextLabel ? `「${currentConfig.nextLabel}」へ進める` : '次のステップへ進める'}
          </button>
        )}

        {!isLast && confirming && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="px-3 py-2 rounded-full text-[12px] text-[#351E28] font-body hover:bg-[#EFEFEA] transition-colors"
              disabled={isPending}
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleAdvance}
              className="px-4 py-2 rounded-full bg-[#E9F056] text-[#666C14] text-[12px] font-body hover:brightness-95 transition-colors disabled:opacity-50"
              disabled={isPending}
            >
              {isPending ? '更新中...' : '確定'}
            </button>
          </div>
        )}

        {isLast && (
          <span className="text-[12px] font-body text-[#666C14] font-semibold">
            納品完了
          </span>
        )}
      </div>

      {error && (
        <p className="mt-2 text-[11px] text-[#B03616] font-body">{error}</p>
      )}
    </div>
  )
}
