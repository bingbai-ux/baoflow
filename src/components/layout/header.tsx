'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface HeaderProps {
  userName?: string
}

const navItems = [
  { href: '/', label: 'Overview' },
  { href: '/deals', label: 'Deals' },
  { href: '/clients', label: 'Clients' },
  { href: '/factories', label: 'Factories' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/payments', label: 'Payments' },
  { href: '/settings', label: 'Settings' },
]

export function Header({ userName }: HeaderProps) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/'
    }
    return pathname.startsWith(href)
  }

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between h-[52px] bg-white border-b border-[rgba(0,0,0,0.06)] px-[26px]">
      {/* Logo + Nav */}
      <div className="flex items-center gap-5">
        <Link
          href="/"
          className="font-display text-[17px] font-semibold text-[#0a0a0a] tracking-[-0.04em] no-underline"
        >
          (bao)
        </Link>
        <nav className="flex gap-[2px]">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-[18px] py-[7px] rounded-full text-[13px] no-underline transition-all duration-150 ${
                isActive(item.href)
                  ? 'bg-[#0a0a0a] text-white font-display font-semibold'
                  : 'bg-transparent text-[#888] font-body font-normal hover:text-[#0a0a0a]'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* User */}
      <div className="flex items-center gap-3">
        {userName && (
          <span className="text-[13px] text-[#555] font-body">
            {userName}
          </span>
        )}
        <button
          onClick={handleLogout}
          className="bg-white text-[#888] border border-[#e8e8e6] rounded-[8px] px-[13px] py-[5px] text-[12px] font-medium font-body cursor-pointer hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-all"
        >
          ログアウト
        </button>
      </div>
    </header>
  )
}
