'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown } from 'lucide-react'
import { useUi } from '@/components/ui/ui-store'
import { updateDealStatus } from '@/lib/actions/deal-status'
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

interface Props {
  dealId: string
  current: SimpleStatus
}

/**
 * Sprint 7-3-2 仕様書 §2-2-2: 案件行の「ステータス」セル用、7段階色付きドロップダウン。
 *
 * 既存 SIMPLE_STATUS_CONFIG / updateDealStatus を流用、shadcn/ui 風の最小実装
 * (新ライブラリ追加なし、notif-popover.tsx と同じ click-outside パターン)。
 */
export function DealStatusDropdown({ dealId, current }: Props) {
  const router = useRouter()
  const { toast } = useUi()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false)
    }
    const t = setTimeout(() => document.addEventListener('mousedown', onClick), 0)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  const cfg = SIMPLE_STATUS_CONFIG[current]
  const dot = STEP_COLOR_MAP[cfg.color]

  const setStatus = (next: SimpleStatus) => {
    if (next === current || pending) {
      setOpen(false)
      return
    }
    setOpen(false)
    startTransition(async () => {
      const r = await updateDealStatus(dealId, next)
      if (r.success) {
        toast(`ステータスを「${SIMPLE_STATUS_CONFIG[next].label}」に変更しました`)
        router.refresh()
      } else {
        toast(r.error || '更新に失敗しました', 'warn')
      }
    })
  }

  return (
    <div ref={popRef} className="relative inline-block w-full">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        disabled={pending}
        className="inline-flex items-center gap-1 w-full text-[10px] text-[#555] cursor-pointer hover:bg-[#fafaf8] rounded-[3px] px-1.5 py-0.5 disabled:opacity-50"
        title="クリックでステータス変更"
      >
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: dot }}
        />
        <span className="truncate">{cfg.label}</span>
        <ChevronDown className="w-2.5 h-2.5 text-[#888] ml-auto flex-shrink-0" />
      </button>
      {open && (
        <div
          className="absolute top-full left-0 z-30 mt-0.5 min-w-[160px] bg-white border border-[#e8e8e6] rounded-[8px] shadow-[0_8px_24px_rgba(0,0,0,0.12)] py-1 text-[11px] font-body"
          onClick={(e) => e.stopPropagation()}
        >
          {SIMPLE_STATUS_ORDER.map((s) => {
            const c = SIMPLE_STATUS_CONFIG[s]
            const isCurrent = s === current
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                disabled={isCurrent}
                className={`w-full text-left px-3 py-1.5 inline-flex items-center gap-2 hover:bg-[#fafaf9] ${
                  isCurrent ? 'bg-[#fff8e8] cursor-default' : ''
                }`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: STEP_COLOR_MAP[c.color] }}
                />
                <span className="flex-1">{c.label}</span>
                {isCurrent && <Check className="w-3 h-3 text-[#22c55e]" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
