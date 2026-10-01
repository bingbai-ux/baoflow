'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, Plus, Search } from 'lucide-react'
import { useUi } from '@/components/ui/ui-store'

const PAGE_META: Record<string, { title: string; sub: string; primary?: { label: string; href: string } | null }> = {
  '/': { title: 'ダッシュボード', sub: '今日のサマリー', primary: null },
  '/deals': { title: '案件管理', sub: 'すべての受注・見積', primary: null },
  '/inventory': { title: '在庫管理', sub: '物流倉庫の入庫・在庫・出庫', primary: null },
  '/archive': { title: '案件履歴', sub: 'アーカイブした案件', primary: null },
  '/analytics': { title: '売上分析', sub: '採用見積ベースの概況', primary: null },
  '/docs': { title: '帳票管理', sub: '請求書・見積書・納品書・RFQ', primary: null },
  '/master': { title: 'アカウント管理', sub: 'クライアント・工場・担当者・物流', primary: null },
  '/settings': { title: '設定', sub: '会社情報・既定値', primary: null },
}

function getMeta(pathname: string) {
  for (const k of Object.keys(PAGE_META).sort((a, b) => b.length - a.length)) {
    if (k === '/' ? pathname === '/' : pathname.startsWith(k)) return PAGE_META[k]
  }
  return { title: '', sub: '', primary: null }
}

export function TopBar() {
  const pathname = usePathname()
  const { openCmdk, toggleNotif, sidebarCollapsed, toggleSidebar } = useUi()
  const meta = getMeta(pathname)

  return (
    <div className="no-print min-h-[52px] px-3 sm:px-5 py-1 flex flex-wrap items-center gap-2 lg:gap-3.5 border-b border-[#E2E1DA] bg-[#EFEFEA] flex-shrink-0">
      <button type="button" onClick={toggleSidebar} aria-expanded={!sidebarCollapsed} className="hidden lg:inline-flex min-h-[44px] items-center rounded-full border border-[#E2E1DA] bg-white px-3 text-[11px]">ナビを{sidebarCollapsed ? '開く' : '閉じる'}</button>
      <div className="min-w-0 truncate font-display text-[17px] font-semibold tracking-tight text-[#351E28]">
        {meta.title}
      </div>
      <div className="hidden xl:block text-[11px] text-[#84787D] ml-2">{meta.sub}</div>

      <div className="flex-1" />

      <button
        onClick={openCmdk}
        aria-label="案件・取引先・書類を検索"
        type="button"
        className="min-h-[44px] flex items-center gap-2 px-3.5 py-1.5 border border-[#E2E1DA] rounded-full bg-white text-[#84787D] text-[12px] hover:border-[#351E28] transition-colors lg:min-w-[240px]"
        title="検索 (⌘K)"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="hidden lg:inline">案件・取引先・書類を検索</span>
        <span className="hidden lg:inline ml-auto text-[10px] text-[#84787D] bg-[#FBFAF6] border border-[#E2E1DA] rounded-full px-1.5 py-0.5">
          ⌘K
        </span>
      </button>

      <button
        onClick={toggleNotif}
        type="button"
        aria-label="通知を開く"
        className="relative w-[44px] h-[44px] rounded-full border border-[#E2E1DA] bg-white flex items-center justify-center hover:border-[#351E28] transition-colors"
        title="通知"
      >
        <Bell className="w-4 h-4 text-[#351E28]" />
      </button>

      {meta.primary && (
        <Link
          href={meta.primary.href}
          className="px-4 py-1.5 rounded-full bg-[#E9F056] text-[#666C14] text-[12px] font-extrabold font-body no-underline inline-flex items-center gap-1 hover:brightness-95 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          {meta.primary.label.replace('+ ', '')}
        </Link>
      )}
    </div>
  )
}
