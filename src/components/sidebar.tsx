'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Home,
  FileText,
  Zap,
  Truck,
  Package,
  Users,
  Factory,
  Ship,
  UserCircle,
  Grid,
  BookOpen,
  BarChart3,
  Wallet,
  Settings,
} from 'lucide-react'

interface MenuItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

interface MenuCategory {
  label?: string
  items: MenuItem[]
}

const menuStructure: MenuCategory[] = [
  {
    items: [{ label: 'ホーム', href: '/', icon: Home }],
  },
  {
    label: '案件管理',
    items: [
      { label: '案件一覧', href: '/deals', icon: FileText },
      { label: 'Smart Quote', href: '/smart-quote', icon: Zap },
      { label: '出荷管理', href: '/shipments', icon: Truck },
      { label: '在庫管理', href: '/inventory', icon: Package },
    ],
  },
  {
    label: 'マスター',
    items: [
      { label: '顧客', href: '/clients', icon: Users },
      { label: '工場', href: '/factories', icon: Factory },
      { label: '物流エージェント', href: '/logistics', icon: Ship },
      { label: 'スタッフ', href: '/staff', icon: UserCircle },
      { label: 'カタログ', href: '/catalog', icon: Grid },
      { label: '品目台帳', href: '/registry', icon: BookOpen },
    ],
  },
  {
    label: '分析・設定',
    items: [
      { label: '経営分析', href: '/analytics', icon: BarChart3 },
      { label: '入出金管理', href: '/payments', icon: Wallet },
      { label: '設定', href: '/settings', icon: Settings },
    ],
  },
]

interface UserProfile {
  display_name: string | null
  email: string | null
  role: string
  avatar_url: string | null
}

export function Sidebar() {
  const pathname = usePathname()
  const [user, setUser] = useState<UserProfile | null>(null)

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient()
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (authUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, email, role, avatar_url')
          .eq('id', authUser.id)
          .single()

        if (profile) {
          setUser(profile)
        } else {
          setUser({
            display_name: authUser.email?.split('@')[0] || 'User',
            email: authUser.email || null,
            role: 'sales',
            avatar_url: null,
          })
        }
      }
    }

    fetchUser()
  }, [])

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/'
    }
    return pathname.startsWith(href)
  }

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U'
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const roleLabels: Record<string, string> = {
    admin: '管理者',
    sales: '営業',
    viewer: '閲覧者',
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-[220px] bg-[#1a1a1a] flex flex-col z-50">
      {/* Logo */}
      <div className="px-5 pt-6 pb-4">
        <h1 className="font-display text-[20px] text-white font-semibold tracking-tight">
          (bao) flow
        </h1>
        <p className="text-[10px] text-white/35 mt-0.5">Packaging Import Manager</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {menuStructure.map((category, categoryIndex) => (
          <div key={categoryIndex} className={categoryIndex > 0 ? 'mt-5' : ''}>
            {category.label && (
              <p className="px-3 mb-2 text-[9px] uppercase tracking-[1.5px] text-white/30 font-body">
                {category.label}
              </p>
            )}
            <div className="space-y-0.5">
              {category.items.map((item) => {
                const active = isActive(item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      flex items-center gap-3 px-3 py-2 rounded-[8px] text-[13px] font-body no-underline transition-colors
                      ${
                        active
                          ? 'bg-[#333] text-white border-l-2 border-white -ml-0.5 pl-[10px]'
                          : 'text-white/55 hover:bg-[#2a2a2a] hover:text-white/80'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4 opacity-70" />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User Info */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-[#333] flex items-center justify-center text-[11px] text-white font-body">
            {getInitials(user?.display_name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] text-white font-body truncate">
              {user?.display_name || 'Loading...'}
            </p>
            <p className="text-[10px] text-white/40 font-body">
              {user ? roleLabels[user.role] || user.role : ''}
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
