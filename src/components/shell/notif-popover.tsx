'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUi } from '@/components/ui/ui-store'
import type { NotifItem } from '@/lib/actions/notifications-types'

export function NotifPopover({ initial }: { initial: NotifItem[] }) {
  const router = useRouter()
  const { notifOpen, closeNotif } = useUi()
  const [items, setItems] = useState<NotifItem[]>(initial)
  const popRef = useRef<HTMLDivElement>(null)

  // Click outside to close
  useEffect(() => {
    if (!notifOpen) return
    const onClick = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) closeNotif()
    }
    const t = setTimeout(() => document.addEventListener('mousedown', onClick), 0)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', onClick)
    }
  }, [notifOpen, closeNotif])

  useEffect(() => {
    setItems(initial)
  }, [initial])

  if (!notifOpen) return null

  const select = (n: NotifItem) => {
    closeNotif()
    if (n.dealId) router.push(`/deals/${n.dealId}`)
  }

  return (
    <div
      ref={popRef}
      className="fixed top-[48px] right-4 w-[380px] bg-white border border-[#E2E1DA] rounded-[12px] shadow-[0_16px_40px_rgba(53,30,40,0.18)] z-[500] overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-[#E2E1DA] flex items-center justify-between">
        <div className="font-display text-[13px] font-semibold">通知 ({items.length})</div>
        <button
          onClick={() => setItems([])}
          className="text-[11px] text-[#84787D] hover:text-[#351E28]"
        >
          すべて既読
        </button>
      </div>
      <div className="max-h-[420px] overflow-auto">
        {items.length === 0 ? (
          <div className="p-8 text-center text-[#84787D] text-[12px]">通知はありません</div>
        ) : (
          items.map((n) => (
            <button
              key={n.id}
              onClick={() => select(n)}
              className="w-full text-left px-4 py-3 border-b border-[#EFEFEA] cursor-pointer flex gap-2.5 text-[11.5px] hover:bg-[#FBFAF6]"
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] flex-shrink-0 font-display ${
                  n.kind === 'urgent'
                    ? 'bg-[#FFD8C2] text-[#B03616]'
                    : 'bg-[#FBFAF6] text-[#351E28]'
                }`}
              >
                {n.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium mb-0.5 truncate">{n.title}</div>
                <div className="text-[#84787D] text-[10.5px] leading-relaxed">{n.body}</div>
                <div className="text-[#AEB8A0] text-[10px] mt-1 font-display tabular-nums">
                  {n.when}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
