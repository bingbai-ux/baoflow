'use client'

// 再設計 工程1: 案件ヘッダーの9工程バー・残り日数・工程の手動変更。

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PROCESS_STAGES, clampStage, daysLeft, stageLabel } from '@/lib/process/stages'
import { ProcessBar, DaysLeftBadge } from '@/components/process/process-bar'
import { setProcessStage } from '@/lib/actions/projects'
import { formatDate } from '@/lib/utils/format'
import { useUi } from '@/components/ui/ui-store'

export function StageHeader({ dealId, stage, dueDate, today, archived }: { dealId: string; stage: number; dueDate: string | null; today: string; archived?: boolean }) {
  const router = useRouter()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const current = clampStage(stage)
  const left = daysLeft(dueDate, today, current)
  const change = (next: number) => {
    if (next === current) return
    setError(null)
    startTransition(async () => {
      const res = await setProcessStage(dealId, next)
      if (!res.success) { setError(res.error || '工程を変更できませんでした'); return }
      toast(`工程を「${stageLabel(next)}」に変更しました`)
      router.refresh()
    })
  }
  return (
    <section aria-label="工程と納期" className="mb-3 rounded-[16px] border border-[#E2E1DA] bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-[15px] font-bold text-[#351E28]"><span className="tabular-nums">{current} / 9</span> {stageLabel(current)}</p>
        <p className="flex flex-wrap items-center gap-2 text-[12.5px] text-[#351E28]">
          <span className="text-[#84787D]">希望納期</span>
          <span className="tabular-nums">{dueDate ? formatDate(dueDate) : '—'}</span>
          <DaysLeftBadge value={left} />
        </p>
      </div>
      <ProcessBar stage={current} />
      {!archived && (
        <details className="mt-2">
          <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-[11px] text-[#84787D] underline">工程を手で直す</summary>
          <div role="group" aria-label="工程を選ぶ" className="flex flex-wrap gap-1">
            {PROCESS_STAGES.map(s => (
              <button key={s.n} type="button" disabled={pending} aria-pressed={s.n === current} onClick={() => change(s.n)}
                className={'min-h-[44px] rounded-full border px-3 text-[12px] font-bold disabled:opacity-60 ' + (s.n === current ? 'border-[#351E28] bg-[#351E28] text-[#C9A2B8]' : 'border-[#E2E1DA] bg-white text-[#351E28] hover:bg-[#FBFAF6]')}>
                <span className="tabular-nums">{s.n}</span> {s.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-[#84787D]">変更は履歴に残ります。</p>
        </details>
      )}
      {error && <p role="alert" className="mt-2 text-[12.5px] text-[#B03616]">{error}</p>}
    </section>
  )
}
