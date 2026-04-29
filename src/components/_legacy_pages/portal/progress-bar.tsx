'use client'

import { useMemo } from 'react'

type MasterStatus =
  | 'M01' | 'M02' | 'M03' | 'M04' | 'M05' | 'M06' | 'M07' | 'M08' | 'M09' | 'M10'
  | 'M11' | 'M12' | 'M13' | 'M14' | 'M15' | 'M16' | 'M17' | 'M18' | 'M19' | 'M20'
  | 'M21' | 'M22' | 'M23' | 'M24' | 'M25'

interface ClientProgressBarProps {
  status: MasterStatus
  size?: 'small' | 'large'
}

// 7ステップへのマッピング
const STEPS = [
  {
    id: 1,
    label: '依頼受付',
    statuses: ['M01', 'M02', 'M03', 'M04', 'M05'] as MasterStatus[],
    message: 'ご依頼を受け付けました。お見積もりを準備中です。',
  },
  {
    id: 2,
    label: '見積もり確認',
    statuses: ['M06', 'M07', 'M08', 'M09', 'M10'] as MasterStatus[],
    message: 'お見積書をご確認ください。',
  },
  {
    id: 3,
    label: '承認・お支払い',
    statuses: ['M11', 'M12', 'M13', 'M14'] as MasterStatus[],
    message: 'ご承認ありがとうございます。請求書をご確認ください。',
  },
  {
    id: 4,
    label: '製造中',
    statuses: ['M15', 'M16', 'M17', 'M18', 'M19', 'M20', 'M21'] as MasterStatus[],
    message: '製造を開始しました。',
  },
  {
    id: 5,
    label: '発送済み',
    statuses: ['M22', 'M23'] as MasterStatus[],
    message: '発送されました。',
  },
  {
    id: 6,
    label: '到着',
    statuses: ['M24'] as MasterStatus[],
    message: '到着しました。検品中です。',
  },
  {
    id: 7,
    label: '納品完了',
    statuses: ['M25'] as MasterStatus[],
    message: '納品完了しました。',
  },
]

// M01〜M25 → 7ステップへのマッピング関数
export function mapStatusToStep(status: MasterStatus): number {
  for (const step of STEPS) {
    if (step.statuses.includes(status)) {
      return step.id
    }
  }
  return 1
}

export function getStepMessage(status: MasterStatus): string {
  const stepId = mapStatusToStep(status)
  const step = STEPS.find((s) => s.id === stepId)
  return step?.message || ''
}

export function ClientProgressBar({ status, size = 'small' }: ClientProgressBarProps) {
  const currentStep = useMemo(() => mapStatusToStep(status), [status])
  const currentMessage = useMemo(() => getStepMessage(status), [status])

  const isLarge = size === 'large'

  return (
    <div className={isLarge ? 'space-y-4' : 'space-y-2'}>
      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const isCompleted = currentStep > step.id
          const isCurrent = currentStep === step.id
          const isUpcoming = currentStep < step.id

          return (
            <div key={step.id} className="flex items-center flex-1">
              {/* Step Circle */}
              <div className="flex flex-col items-center">
                <div
                  className={`
                    flex items-center justify-center rounded-full font-display tabular-nums
                    ${isLarge ? 'w-8 h-8 text-[13px]' : 'w-5 h-5 text-[10px]'}
                    ${isCompleted || isCurrent
                      ? 'bg-[#22c55e] text-white'
                      : 'bg-[#e8e8e6] text-[#888]'}
                  `}
                >
                  {isCompleted ? (
                    <svg
                      className={isLarge ? 'w-4 h-4' : 'w-3 h-3'}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step.id
                  )}
                </div>
                {/* Step Label */}
                <span
                  className={`
                    mt-1 font-body text-center whitespace-nowrap
                    ${isLarge ? 'text-[11px]' : 'text-[9px]'}
                    ${isCurrent ? 'text-[#0a0a0a] font-medium' : 'text-[#888]'}
                  `}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector Line */}
              {index < STEPS.length - 1 && (
                <div
                  className={`
                    flex-1 mx-1
                    ${isLarge ? 'h-[2px]' : 'h-[1px]'}
                    ${isCompleted ? 'bg-[#22c55e]' : 'bg-[#e8e8e6]'}
                  `}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Current Step Message */}
      {isLarge && currentMessage && (
        <div className="text-center">
          <p className="text-[13px] text-[#555] font-body">{currentMessage}</p>
        </div>
      )}
    </div>
  )
}

// Compact version for cards/lists
export function ClientProgressBarCompact({ status }: { status: MasterStatus }) {
  const currentStep = mapStatusToStep(status)
  const currentStepData = STEPS.find((s) => s.id === currentStep)

  return (
    <div className="flex items-center gap-2">
      {/* Mini progress dots */}
      <div className="flex gap-[3px]">
        {STEPS.map((step) => (
          <div
            key={step.id}
            className={`
              w-[5px] h-[5px] rounded-full
              ${currentStep >= step.id ? 'bg-[#22c55e]' : 'bg-[#e8e8e6]'}
            `}
          />
        ))}
      </div>
      {/* Current step label */}
      <span className="text-[11px] text-[#555] font-body">
        {currentStepData?.label}
      </span>
    </div>
  )
}
