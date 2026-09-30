'use client'

// Sprint 10 (D): ボール管理バッジ。「いま誰の返答/作業を待っているか」を
// F&C のバッジ5種で示し、クリックで us → client → factory → none と切り替える。
// 色面の文字は同色相インク(白文字禁止)。

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateDealField } from '@/lib/actions/inline-edit'
import { useUi } from '@/components/ui/ui-store'
import {
  type WaitingOn,
  WAITING_ON_CONFIG,
  normalizeWaitingOn,
} from '@/lib/utils/waiting-on'

// 共有定義の再エクスポート(既存の import 互換のため)
export { WAITING_ON_CONFIG, normalizeWaitingOn }
export type { WaitingOn }

const CYCLE: WaitingOn[] = ['us', 'client', 'factory', 'none']

interface Props {
  dealId: string
  value: string | null | undefined
  /** true なら表示のみ(切替不可) */
  readonly?: boolean
  size?: 'sm' | 'md'
}

export function WaitingOnBadge({ dealId, value, readonly = false, size = 'md' }: Props) {
  const router = useRouter()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const current = normalizeWaitingOn(value)
  const cfg = WAITING_ON_CONFIG[current]

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (readonly) return
    const next = e.target.value as WaitingOn
    if (next === current) return
    startTransition(async () => {
      const r = await updateDealField(dealId, 'waiting_on', next)
      if (r.success) {
        toast(`ボール: ${WAITING_ON_CONFIG[next].label}`)
        router.refresh()
      } else {
        toast(r.error || '更新に失敗しました', 'warn')
      }
    })
  }

  const base = {
    background: cfg.bg,
    color: cfg.ink,
    border: `1px solid ${cfg.border || 'transparent'}`,
    opacity: pending ? 0.5 : 1,
  }

  if (readonly) {
    return (
      <span
        className={`inline-block whitespace-nowrap rounded-full font-bold leading-none ${
          size === 'sm' ? 'text-[10px] px-2 py-[3px]' : 'text-[11px] px-2.5 py-1'
        }`}
        style={base}
      >
        {cfg.label}
      </span>
    )
  }

  return (
    <select
      aria-label="案件の待ち先"
      aria-busy={pending}
      value={current}
      onChange={handleChange}
      onClick={(e) => e.stopPropagation()}
      disabled={pending}
      className={`min-h-[44px] max-w-full whitespace-nowrap rounded-full font-bold cursor-pointer border transition-[filter] duration-150 hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#351E28] ${
        size === 'sm' ? 'text-[10px] px-2' : 'text-[11px] px-3'
      }`}
      style={base}
    >
      {CYCLE.map((option) => <option key={option} value={option}>{WAITING_ON_CONFIG[option].label}</option>)}
    </select>
  )
}
