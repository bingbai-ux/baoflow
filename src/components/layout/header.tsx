'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface HeaderProps {
  userName?: string
}

const navItems = [
  { href: '/', label: 'Overview' },
  { href: '/deals', label: 'Orders' },
  { href: '/clients', label: 'Clients' },
  { href: '/factories', label: 'Factories' },
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
    <header
      style={{
        height: '52px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 26px',
      }}
    >
      {/* Logo */}
      <Link
        href="/"
        style={{
          fontFamily: "'Fraunces', serif",
          fontSize: '18px',
          fontWeight: 600,
          color: '#0a0a0a',
          textDecoration: 'none',
        }}
      >
        (bao) flow
      </Link>

      {/* Navigation */}
      <nav style={{ display: 'flex', gap: '4px' }}>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              padding: '7px 18px',
              borderRadius: '9999px',
              fontSize: '13px',
              textDecoration: 'none',
              transition: 'all 0.15s ease',
              ...(isActive(item.href)
                ? {
                    backgroundColor: '#0a0a0a',
                    color: '#ffffff',
                    fontFamily: "'Fraunces', serif",
                    fontWeight: 600,
                  }
                : {
                    backgroundColor: 'transparent',
                    color: '#888888',
                    fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                    fontWeight: 400,
                  }),
            }}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* User */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {userName && (
          <span
            style={{
              fontSize: '13px',
              color: '#555555',
              fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
            }}
          >
            {userName}
          </span>
        )}
        <button
          onClick={handleLogout}
          style={{
            backgroundColor: '#ffffff',
            color: '#888888',
            border: '1px solid #e8e8e6',
            borderRadius: '8px',
            padding: '5px 13px',
            fontSize: '12px',
            fontWeight: 500,
            fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
            cursor: 'pointer',
          }}
        >
          ログアウト
        </button>
      </div>
    </header>
  )
}
