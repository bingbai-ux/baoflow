'use client'

type MasterStatus =
  | 'M01' | 'M02' | 'M03' | 'M04' | 'M05' | 'M06' | 'M07' | 'M08' | 'M09' | 'M10'
  | 'M11' | 'M12' | 'M13' | 'M14' | 'M15' | 'M16' | 'M17' | 'M18' | 'M19' | 'M20'
  | 'M21' | 'M22' | 'M23' | 'M24' | 'M25'

// Factory 6-step progress bar mapping
const FACTORY_STEPS = [
  {
    id: 1,
    label: '見積もり依頼',
    statuses: ['M03', 'M04'],
    message: '新しい見積もり依頼があります',
  },
  {
    id: 2,
    label: '見積もり回答済',
    statuses: ['M05', 'M06', 'M07', 'M08', 'M09', 'M10', 'M11', 'M12', 'M13', 'M14', 'M15'],
    message: '回答済み。選定結果をお待ちください',
  },
  {
    id: 3,
    label: '入金確認・製造開始',
    statuses: ['M16'],
    message: '入金が確認されました。製造を開始してください',
  },
  {
    id: 4,
    label: '製造中',
    statuses: ['M17', 'M18', 'M19'],
    message: '製造中です',
  },
  {
    id: 5,
    label: '発送準備',
    statuses: ['M20', 'M21'],
    message: '製造完了。パッキングリストを提出してください',
  },
  {
    id: 6,
    label: '発送完了',
    statuses: ['M22', 'M23', 'M24', 'M25'],
    message: '発送情報を入力してください',
  },
]

export function mapFactoryStatusToStep(status: MasterStatus): number {
  // Pre-quote statuses
  if (['M01', 'M02'].includes(status)) {
    return 0 // Before factory involvement
  }

  for (const step of FACTORY_STEPS) {
    if (step.statuses.includes(status)) {
      return step.id
    }
  }
  return 1
}

interface FactoryProgressBarProps {
  status: MasterStatus
  className?: string
}

export function FactoryProgressBar({ status, className = '' }: FactoryProgressBarProps) {
  const currentStep = mapFactoryStatusToStep(status)
  const currentStepData = FACTORY_STEPS.find(s => s.id === currentStep)

  return (
    <div className={`bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5 ${className}`}>
      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-4">
        {FACTORY_STEPS.map((step, index) => {
          const isCompleted = step.id < currentStep
          const isCurrent = step.id === currentStep
          const isUpcoming = step.id > currentStep

          return (
            <div key={step.id} className="flex items-center flex-1">
              {/* Step Circle */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-display font-semibold ${
                    isCompleted
                      ? 'bg-[#22c55e] text-white'
                      : isCurrent
                      ? 'bg-[#0a0a0a] text-white'
                      : 'bg-[#e8e8e6] text-[#888]'
                  }`}
                >
                  {isCompleted ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step.id
                  )}
                </div>
                <span
                  className={`mt-2 text-[10px] font-body text-center max-w-[80px] ${
                    isCurrent ? 'text-[#0a0a0a] font-medium' : 'text-[#888]'
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector Line */}
              {index < FACTORY_STEPS.length - 1 && (
                <div
                  className={`flex-1 h-[2px] mx-2 ${
                    step.id < currentStep ? 'bg-[#22c55e]' : 'bg-[#e8e8e6]'
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Current Status Message */}
      {currentStepData && (
        <div className="bg-[#f2f2f0] rounded-[10px] p-3 text-center">
          <p className="text-[12px] text-[#555] font-body">{currentStepData.message}</p>
        </div>
      )}
    </div>
  )
}
