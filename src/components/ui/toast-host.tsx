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
          className={`px-[18px] py-[10px] rounded-[12px] text-[12px] font-body shadow-[0_8px_24px_rgba(53,30,40,0.2)] flex items-center gap-2.5 ${
            t.tone === 'warn'
              ? 'bg-[#FFD8C2] text-[#B03616] border-[1.5px] border-[#FF5C34]'
              : t.tone === 'info'
                ? 'bg-white text-[#351E28] border border-[#E2E1DA]'
                : 'bg-[#351E28] text-[#C9A2B8]'
          }`}
        >
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  )
}
