'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface FactoryHeaderProps {
  factoryName: string
}

const navItems = [
  { href: '/factory', label: 'ダッシュボード' },
  { href: '/factory/quotes', label: '見積もり依頼' },
  { href: '/factory/production', label: '製造中' },
  { href: '/factory/chat', label: 'チャット' },
]

export function FactoryHeader({ factoryName }: FactoryHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/factory/login')
    router.refresh()
  }

  const isActive = (href: string) => {
    if (href === '/factory') {
      return pathname === '/factory'
    }
    return pathname.startsWith(href)
  }

  return (
    <header className="h-[52px] bg-white border-b border-[rgba(0,0,0,0.06)] px-[26px] flex items-center justify-between">
      {/* Left: Logo + Factory Name */}
      <div className="flex items-center gap-6">
        <Link href="/factory" className="flex items-center gap-2 no-underline">
          <span className="text-[18px] font-bold font-display text-[#0a0a0a] tracking-[-0.02em]">
            (bao) flow
          </span>
          {factoryName && (
            <span className="text-[12px] text-[#888] font-body">
              | {factoryName}
            </span>
          )}
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-[18px] py-[7px] rounded-full text-[13px] no-underline transition-all ${
                isActive(item.href)
                  ? 'bg-[#0a0a0a] text-white font-display font-semibold'
                  : 'text-[#888] font-body hover:text-[#0a0a0a]'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Right: Logout */}
      <button
        onClick={handleLogout}
        className="text-[12px] text-[#888] font-body hover:text-[#0a0a0a] bg-transparent border-none cursor-pointer"
      >
        ログアウト
      </button>
    </header>
  )
}
