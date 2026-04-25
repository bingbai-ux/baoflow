'use client'

import { useState } from 'react'
import { Check, Circle } from 'lucide-react'

interface Phase {
  id: string
  label: string
  color: string
  statusRange: [number, number]
  subSteps: { status: string; label: string }[]
}

const phases: Phase[] = [
  {
    id: 'quote',
    label: '見積もり',
    color: '#3b82f6',
    statusRange: [1, 10],
    subSteps: [
      { status: 'M01', label: '依頼受付' },
      { status: 'M02', label: '営業確認' },
      { status: 'M03', label: '工場依頼' },
      { status: 'M04', label: '工場回答待ち' },
      { status: 'M05', label: '回答受領' },
      { status: 'M06', label: '見積もり提示' },
      { status: 'M07', label: 'クライアント検討1' },
      { status: 'M08', label: 'クライアント検討2' },
      { status: 'M09', label: 'クライアント検討3' },
      { status: 'M10', label: 'クライアント検討4' },
    ],
  },
  {
    id: 'order',
    label: '発注・支払い',
    color: '#22c55e',
    statusRange: [11, 15],
    subSteps: [
      { status: 'M11', label: '承認' },
      { status: 'M12', label: '請求書発行' },
      { status: 'M13', label: '入金待ち' },
      { status: 'M14', label: '入金確認' },
      { status: 'M15', label: '工場前払い' },
    ],
  },
  {
    id: 'production',
    label: '製造',
    color: '#e5a32e',
    statusRange: [16, 19],
    subSteps: [
      { status: 'M16', label: '製造開始待ち' },
      { status: 'M17', label: '製造開始' },
      { status: 'M18', label: '製造中' },
      { status: 'M19', label: '完了・検品' },
    ],
  },
  {
    id: 'shipping',
    label: '出荷・配送',
    color: '#8b5cf6',
    statusRange: [20, 24],
    subSteps: [
      { status: 'M20', label: '残金支払い' },
      { status: 'M21', label: '発送準備' },
      { status: 'M22', label: '発送済み' },
      { status: 'M23', label: '輸送中' },
      { status: 'M24', label: '到着・検品' },
    ],
  },
  {
    id: 'complete',
    label: '完了',
    color: '#22c55e',
    statusRange: [25, 25],
    subSteps: [{ status: 'M25', label: '納品完了' }],
  },
]

function getStatusNumber(status: string): number {
  const match = status.match(/M(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}

function getPhaseState(
  phase: Phase,
  currentStatusNum: number
): 'done' | 'current' | 'pending' {
  const [start, end] = phase.statusRange
  if (currentStatusNum > end) return 'done'
  if (currentStatusNum >= start && currentStatusNum <= end) return 'current'
  return 'pending'
}

function getCompletedCount(phase: Phase, currentStatusNum: number): number {
  const [start] = phase.statusRange
  if (currentStatusNum < start) return 0
  const completedInPhase = currentStatusNum - start
  return Math.min(completedInPhase, phase.subSteps.length)
}

interface DealProgressBarProps {
  currentStatus: string
}

export function DealProgressBar({ currentStatus }: DealProgressBarProps) {
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null)
  const currentStatusNum = getStatusNumber(currentStatus)

  return (
    <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5">
      {/* Main Progress Bar */}
      <div className="flex gap-2">
        {phases.map((phase) => {
          const state = getPhaseState(phase, currentStatusNum)
          const completed = getCompletedCount(phase, currentStatusNum)
          const total = phase.subSteps.length
          const progress = state === 'done' ? 100 : (completed / total) * 100
          const isExpanded = expandedPhase === phase.id

          return (
            <button
              key={phase.id}
              onClick={() => setExpandedPhase(isExpanded ? null : phase.id)}
              className="flex-1 text-left focus:outline-none"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className={`text-[11px] font-body ${
                    state === 'pending' ? 'text-[#bbb]' : 'text-[#555]'
                  }`}
                >
                  {phase.label}
                </span>
                <span
                  className={`text-[10px] font-display tabular-nums ${
                    state === 'pending' ? 'text-[#bbb]' : 'text-[#888]'
                  }`}
                >
                  {state === 'done' ? total : completed}/{total}
                </span>
              </div>
              <div className="h-[3px] bg-[#e8e8e6] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${progress}%`,
                    backgroundColor: state === 'pending' ? '#ddd' : phase.color,
                  }}
                />
              </div>
            </button>
          )
        })}
      </div>

      {/* Expanded Sub-steps */}
      {expandedPhase && (
        <div className="mt-4 pt-4 border-t border-[rgba(0,0,0,0.06)]">
          {phases
            .filter((p) => p.id === expandedPhase)
            .map((phase) => (
              <div key={phase.id} className="grid grid-cols-5 gap-2">
                {phase.subSteps.map((step) => {
                  const stepNum = getStatusNumber(step.status)
                  const isDone = currentStatusNum > stepNum
                  const isCurrent = currentStatusNum === stepNum
                  const isPending = currentStatusNum < stepNum

                  return (
                    <div key={step.status} className="flex flex-col items-center gap-1.5">
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center ${
                          isDone
                            ? ''
                            : isCurrent
                              ? 'border-2'
                              : 'border border-[#ddd]'
                        }`}
                        style={{
                          backgroundColor: isDone ? phase.color : 'transparent',
                          borderColor: isCurrent ? phase.color : undefined,
                        }}
                      >
                        {isDone ? (
                          <Check className="w-3 h-3 text-white" strokeWidth={3} />
                        ) : isCurrent ? (
                          <Circle
                            className="w-2 h-2"
                            fill={phase.color}
                            stroke="none"
                          />
                        ) : null}
                      </div>
                      <span
                        className={`text-[9px] font-body text-center leading-tight ${
                          isPending ? 'text-[#bbb]' : 'text-[#555]'
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
