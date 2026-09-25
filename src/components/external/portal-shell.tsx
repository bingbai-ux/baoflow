'use client'

// Sprint 11: 外部ポータル (準備中) の共通シェル + ログアウト。

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UiProvider } from '@/components/ui/ui-store'
import { ToastHost } from '@/components/ui/toast-host'

export function PortalShell({
  title,
  loginPath,
  userLabel,
  wide = false,
  children,
}: {
  title: string
  loginPath: string
  userLabel: string | null
  wide?: boolean
  children: React.ReactNode
}) {
  const maxW = wide ? 'max-w-5xl' : 'max-w-3xl'
  const router = useRouter()

  const logout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push(loginPath)
    router.refresh()
  }

  return (
    <UiProvider>
    <div className="min-h-screen font-body" style={{ background: '#FBFAF6', color: '#351E28' }}>
      <header className="border-b" style={{ borderColor: 'rgba(229,163,46,0.2)' }}>
        <div className={`${maxW} mx-auto px-6 py-4 flex items-center justify-between gap-3`}>
          <div className="flex items-center gap-3">
            <span className="font-display font-bold text-[24px] tracking-tight" style={{ color: '#B03616' }}>
              (bao)
            </span>
            <span className="text-[12px] text-[#84787D]">{title}</span>
          </div>
          <div className="flex items-center gap-3">
            {userLabel && <span className="text-[11px] text-[#84787D]">{userLabel}</span>}
            <button
              type="button"
              onClick={logout}
              className="rounded-full bg-white border border-[#E2E1DA] text-[#351E28] text-[11px] font-bold px-3 py-1.5 hover:bg-[#EFEFEA]"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>
      <main className={`${maxW} mx-auto px-6 py-8`}>{children}</main>
      <ToastHost />
    </div>
    </UiProvider>
  )
}
