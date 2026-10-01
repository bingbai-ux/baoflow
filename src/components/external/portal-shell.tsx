'use client'

// Sprint 11: 外部ポータル (準備中) の共通シェル + ログアウト。

import { useState } from 'react'
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
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const logout = async () => {
    setPending(true)
    setError(null)
    try {
      const { error } = await createClient().auth.signOut()
      if (error) throw error
      router.push(loginPath)
      router.refresh()
    } catch { setError('ログアウトできませんでした。もう一度お試しください。'); setPending(false) }
  }

  return (
    <UiProvider>
    <div className="min-h-screen font-body" style={{ background: '#FBFAF6', color: '#351E28' }}>
      <a href="#portal-content" className="sr-only focus:not-sr-only">本文へ移動</a>
      <header className="border-b border-[#E2E1DA]">
        <div className={`${maxW} mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2`}>
          <div className="flex min-w-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/bao-logo.png" alt="(bao)" className="h-[26px] w-auto" />
            <span className="text-[12px] text-[#84787D]">{title}</span>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            {userLabel && <span className="max-w-[160px] truncate text-[11px] text-[#84787D]">{userLabel}</span>}
            <button
              type="button"
              onClick={logout}
              disabled={pending}
              className="rounded-full bg-white border border-[#E2E1DA] text-[#351E28] text-[11px] font-bold px-3 min-h-[44px] whitespace-nowrap disabled:opacity-40 hover:bg-[#EFEFEA]"
            >
              {pending ? 'ログアウト中…' : 'ログアウト'}
            </button>
          </div>
        </div>
      </header>
      <main id="portal-content" className={`${maxW} mx-auto px-4 sm:px-6 py-5`}>{error && <p role="alert" className="text-[12px] text-[#B03616] mb-3">{error}</p>}{children}</main>
      <ToastHost />
    </div>
    </UiProvider>
  )
}
