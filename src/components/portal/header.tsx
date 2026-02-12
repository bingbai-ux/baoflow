'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface PortalHeaderProps {
  clientName?: string
}

const navItems = [
  { href: '/portal', label: 'ホーム' },
  { href: '/portal/orders', label: '注文' },
  { href: '/portal/catalog', label: 'カタログ' },
  { href: '/portal/inventory', label: '在庫' },
  { href: '/portal/chat', label: 'チャット' },
]

export function PortalHeader({ clientName }: PortalHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/portal/login')
    router.refresh()
  }

  const isActive = (href: string) => {
    if (href === '/portal') {
      return pathname === '/portal'
    }
    return pathname.startsWith(href)
  }

  return (
    <header className="sticky top-0 z-50 h-[52px] bg-white border-b border-[rgba(0,0,0,0.06)] px-[26px]">
      <div className="flex items-center justify-between h-full max-w-[1400px] mx-auto">
        {/* Left: Logo */}
        <Link
          href="/portal"
          className="font-display text-[18px] font-semibold text-[#0a0a0a] tracking-[-0.02em] no-underline"
        >
          (bao)
        </Link>

        {/* Center: Navigation */}
        <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`relative text-[13px] font-body no-underline py-[15px] transition-colors ${
                isActive(item.href)
                  ? 'text-[#0a0a0a] font-semibold'
                  : 'text-[#888] hover:text-[#0a0a0a]'
              }`}
            >
              {item.label}
              {isActive(item.href) && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#0a0a0a]" />
              )}
            </Link>
          ))}
        </nav>

        {/* Right: Client Name + Logout */}
        <div className="flex items-center gap-3">
          {clientName && (
            <span className="text-[13px] text-[#555] font-body">
              {clientName}
            </span>
          )}
          <button
            onClick={handleLogout}
            className="bg-transparent text-[#888] border-none text-[12px] font-body cursor-pointer hover:text-[#0a0a0a] transition-colors"
          >
            ログアウト
          </button>
        </div>
      </div>
    </header>
  )
}
