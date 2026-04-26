'use client'

import { useUi } from './ui-store'

export function ToastHost() {
  const { toasts } = useUi()
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1500] flex flex-col gap-2 items-center">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-[18px] py-[10px] rounded-[10px] text-[12px] font-body shadow-[0_8px_24px_rgba(0,0,0,0.2)] flex items-center gap-2.5 ${
            t.tone === 'warn'
              ? 'bg-[#c0392b] text-white'
              : t.tone === 'info'
                ? 'bg-white text-[#0a0a0a] border border-[#e8e8e6]'
                : 'bg-[#0a0a0a] text-white'
          }`}
        >
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  )
}
