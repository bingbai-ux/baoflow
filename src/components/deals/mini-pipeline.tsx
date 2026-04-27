'use client'

import { Check } from 'lucide-react'
import {
  type SimpleStatus,
  SIMPLE_STATUS_ORDER,
  SIMPLE_STATUS_CONFIG,
} from '@/lib/types'
import { updateDealStatus } from '@/lib/actions/deal-status'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useUi } from '@/components/ui/ui-store'

const STEP_COLOR: Record<string, string> = {
  pending: '#bbbbbb',
  confirmed: '#22c55e',
  warning: '#e5a32e',
  active: '#0a0a0a',
  shipping: '#888888',
}

interface Props {
  dealId: string
  current: SimpleStatus
  interactive?: boolean
}

export function MiniPipeline({ dealId, current, interactive = true }: Props) {
  const router = useRouter()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const currentIdx = SIMPLE_STATUS_ORDER.indexOf(current)

  const handleClick = (target: SimpleStatus, idx: number) => {
    if (!interactive || pending) return
    if (target === current) return
    startTransition(async () => {
      const r = await updateDealStatus(dealId, target)
      if (r.success) {
        toast(`ステータスを「${SIMPLE_STATUS_CONFIG[target].label}」に変更しました`)
        router.refresh()
      } else {
        toast(r.error || 'ステータス変更に失敗しました', 'warn')
      }
    })
  }

  return (
    <div className="flex items-center gap-0 py-3 px-4 bg-[#fafaf9] rounded-[10px] border border-[#e8e8e6]">
      {SIMPLE_STATUS_ORDER.map((s, i) => {
        const isPast = i < currentIdx
        const isCurrent = i === currentIdx
        const isFuture = i > currentIdx
        const cfg = SIMPLE_STATUS_CONFIG[s]
        return (
          <div key={s} className="flex items-center flex-1">
            <button
              type="button"
              disabled={!interactive || pending}
              onClick={() => handleClick(s, i)}
              title={cfg.label}
              className={`w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-display font-semibold flex-shrink-0 transition-transform ${
                interactive && !pending ? 'cursor-pointer hover:scale-110' : 'cursor-default'
              } ${
                isPast
                  ? 'bg-[#0a0a0a] text-white'
                  : isCurrent
                    ? 'text-white'
                    : 'bg-[#e0dfd9] text-[#999]'
              }`}
              style={isCurrent ? { backgroundColor: STEP_COLOR[cfg.color] } : undefined}
            >
              {isPast ? <Check className="w-2.5 h-2.5" strokeWidth={3} /> : ''}
            </button>
            {i < SIMPLE_STATUS_ORDER.length - 1 && (
              <div
                className={`flex-1 h-px ${
                  isPast || isCurrent ? 'bg-[#0a0a0a]' : 'bg-[#e0dfd9]'
                }`}
                style={isFuture ? undefined : { opacity: 0.5 }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
