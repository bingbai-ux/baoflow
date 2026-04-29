'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Home, FileText, Users, Settings, FileBarChart, Archive } from 'lucide-react'

interface NavItem {
  k: string
  label: string
  href: string
  Icon: React.ComponentType<{ className?: string }>
  match: (path: string) => boolean
}

const NAV: NavItem[] = [
  { k: 'home', label: 'ホーム', href: '/', Icon: Home, match: (p) => p === '/' },
  { k: 'deals', label: '案件', href: '/deals', Icon: FileText, match: (p) => p.startsWith('/deals') },
  { k: 'archive', label: '案件履歴', href: '/archive', Icon: Archive, match: (p) => p.startsWith('/archive') },
  { k: 'master', label: '取引先', href: '/master', Icon: Users, match: (p) => p.startsWith('/master') },
  { k: 'docs', label: '帳票', href: '/docs', Icon: FileBarChart, match: (p) => p.startsWith('/docs') },
]

interface UserProfile {
  display_name: string | null
  email: string | null
}

export function Sidebar() {
  const pathname = usePathname()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [hover, setHover] = useState<string | null>(null)

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

  return (
    <aside className="fixed left-0 top-0 h-screen w-[64px] bg-[#0a0a0a] flex flex-col items-center py-3.5 z-50 gap-1">
      {/* Logo */}
      <div
        className="w-8 h-8 rounded-[8px] bg-[#f6f5f2] text-[#0a0a0a] flex items-center justify-center font-display font-bold text-[16px] mb-4"
        title="BAO Flow"
      >
        B
      </div>

      {/* Nav items */}
      {NAV.map((item) => {
        const active = item.match(pathname)
        return (
          <div
            key={item.k}
            className="relative"
            onMouseEnter={() => setHover(item.k)}
            onMouseLeave={() => setHover(null)}
          >
            <Link
              href={item.href}
              className={`w-11 h-11 rounded-[10px] flex items-center justify-center transition-colors no-underline ${
                active
                  ? 'bg-white/10 text-white'
                  : 'text-[#777] hover:text-[#bbb] hover:bg-white/5'
              }`}
            >
              <item.Icon className="w-5 h-5" />
            </Link>
            {hover === item.k && (
              <span className="absolute left-[54px] top-1/2 -translate-y-1/2 bg-[#0a0a0a] text-white px-2.5 py-1.5 rounded-[6px] text-[11px] whitespace-nowrap shadow-[0_4px_12px_rgba(0,0,0,0.3)] pointer-events-none z-[200]">
                {item.label}
              </span>
            )}
          </div>
        )
      })}

      <div className="flex-1" />

      {/* Settings */}
      <div
        className="relative"
        onMouseEnter={() => setHover('settings')}
        onMouseLeave={() => setHover(null)}
      >
        <Link
          href="/settings"
          className={`w-11 h-11 rounded-[10px] flex items-center justify-center transition-colors no-underline ${
            pathname.startsWith('/settings')
              ? 'bg-white/10 text-white'
              : 'text-[#777] hover:text-[#bbb] hover:bg-white/5'
          }`}
        >
          <Settings className="w-5 h-5" />
        </Link>
        {hover === 'settings' && (
          <span className="absolute left-[54px] top-1/2 -translate-y-1/2 bg-[#0a0a0a] text-white px-2.5 py-1.5 rounded-[6px] text-[11px] whitespace-nowrap shadow-[0_4px_12px_rgba(0,0,0,0.3)] pointer-events-none z-[200]">
            設定
          </span>
        )}
      </div>

      {/* User avatar */}
      <div
        className="w-8 h-8 rounded-full bg-[#5b6b5d] text-white flex items-center justify-center text-[11px] font-semibold mt-2 mb-1"
        title={user?.display_name || user?.email || ''}
      >
        {initial}
      </div>
    </aside>
  )
}
