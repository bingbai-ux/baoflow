'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// F&C Design System: Cassis面のサイドバー(2層構造の濃い面)。
// 選択中だけ Wasabi。アイコンではなく語で示す。
interface NavItem {
  k: string
  label: string
  href: string
  match: (path: string) => boolean
}

const NAV: NavItem[] = [
  { k: 'home', label: 'ホーム', href: '/', match: (p) => p === '/' },
  { k: 'deals', label: '案件', href: '/deals', match: (p) => p.startsWith('/deals') },
  { k: 'archive', label: '案件履歴', href: '/archive', match: (p) => p.startsWith('/archive') },
  { k: 'master', label: '取引先', href: '/master', match: (p) => p.startsWith('/master') },
  { k: 'docs', label: '帳票', href: '/docs', match: (p) => p.startsWith('/docs') },
]

interface UserProfile {
  display_name: string | null
  email: string | null
}

export function Sidebar() {
  const pathname = usePathname()
  const [user, setUser] = useState<UserProfile | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) return
      supabase
        .from('profiles')
        .select('display_name, email')
        .eq('id', u.id)
        .single()
        .then(({ data }) => {
          setUser(
            data || {
              display_name: u.email?.split('@')[0] || 'User',
              email: u.email || null,
            }
          )
        })
    })
  }, [])

  const initial = (user?.display_name || user?.email || 'U').trim().charAt(0)

  const itemCls = (active: boolean) =>
    `block rounded-[12px] px-3 py-[9px] text-[12.5px] no-underline transition-colors duration-150 ${
      active
        ? 'bg-[#E9F056] text-[#666C14] font-extrabold'
        : 'text-[#C9A2B8] font-medium hover:bg-white/5'
    }`

  return (
    <aside className="fixed left-0 top-0 h-screen w-[236px] bg-[#351E28] flex flex-col px-3 pt-5 pb-4 z-50">
      {/* ブランドピル(ロゴ画像未支給のため文字ピルで表す) */}
      <span className="self-start whitespace-nowrap bg-[#E9F056] text-[#666C14] text-[12px] font-extrabold tracking-[.04em] leading-none px-3.5 py-1.5 rounded-full font-display">
        BAO Flow
      </span>

      <div className="mt-4 px-2 flex items-center justify-between gap-2">
        <span className="text-[13px] font-extrabold text-[#C9A2B8] leading-none">受発注管理</span>
        <span className="text-[10.5px] font-bold text-[#9C8290] leading-none">BAO</span>
      </div>

      {/* ナビ(語で示す。選択中だけ Wasabi) */}
      <nav className="mt-2 flex flex-col gap-0.5 overflow-auto min-h-0">
        {NAV.map((item) => (
          <Link key={item.k} href={item.href} className={itemCls(item.match(pathname))}>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="flex-1" />

      {/* 設定 + 本人表示 */}
      <div className="pt-3 border-t border-[#9C8290] flex flex-col gap-2">
        <Link href="/settings" className={itemCls(pathname.startsWith('/settings'))}>
          設定
        </Link>
        <div className="flex items-center gap-2 px-2 py-1" title={user?.display_name || user?.email || ''}>
          {/* 顔アイコンは Cool Blue(D78) */}
          <span className="w-7 h-7 rounded-full bg-[#D7EFFF] text-[#33566F] flex items-center justify-center text-[11px] font-bold flex-shrink-0">
            {initial}
          </span>
          <span className="min-w-0 truncate text-[11.5px] text-[#C9A2B8]">
            {user?.display_name || user?.email || ''}
          </span>
        </div>
      </div>
    </aside>
  )
}
