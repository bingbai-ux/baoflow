'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, Plus, Search } from 'lucide-react'
import { useUi } from '@/components/ui/ui-store'

const PAGE_META: Record<string, { title: string; sub: string; primary?: { label: string; href: string } | null }> = {
  '/': { title: 'ホーム', sub: '今日のサマリー', primary: { label: '+ 新規案件', href: '/deals/new' } },
  '/deals': { title: '案件', sub: 'すべての受注・見積', primary: { label: '+ 新規案件', href: '/deals/new' } },
  '/master': { title: '取引先', sub: 'クライアント・工場・担当者', primary: null },
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
  const { ccy, setCcy, openCmdk, toggleNotif } = useUi()
  const meta = getMeta(pathname)

  return (
    <div className="h-[52px] px-5 flex items-center gap-3.5 border-b border-[#e8e8e6] bg-[#f6f5f2] flex-shrink-0">
      <div className="font-display text-[17px] font-semibold tracking-tight text-[#0a0a0a]">
        {meta.title}
      </div>
      <div className="text-[11px] text-[#888] ml-2">{meta.sub}</div>

      <div className="flex-1" />

      <button
        onClick={openCmdk}
        className="flex items-center gap-2 px-3 py-1.5 border border-[#e0dfd9] rounded-[8px] bg-white text-[#888] text-[12px] hover:border-[#0a0a0a] transition-colors min-w-[280px]"
        title="検索 (⌘K)"
      >
        <Search className="w-3.5 h-3.5" />
        <span>案件・取引先・書類を検索</span>
        <span className="ml-auto text-[10px] text-[#aaa] bg-[#fafaf9] border border-[#e8e8e6] rounded-[4px] px-1.5 py-0.5 font-mono">
          ⌘K
        </span>
      </button>

      <div className="flex border border-[#e0dfd9] rounded-[8px] overflow-hidden bg-white">
        {(['JPY', 'USD', 'BOTH'] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCcy(c)}
            className={`px-3 py-1.5 text-[11px] font-display font-semibold transition-colors ${
              ccy === c ? 'bg-[#0a0a0a] text-white' : 'bg-transparent text-[#888] hover:text-[#0a0a0a]'
            }`}
          >
            {c === 'BOTH' ? '両方' : c}
          </button>
        ))}
      </div>

      <button
        onClick={toggleNotif}
        className="relative w-[34px] h-[34px] rounded-[8px] border border-[#e0dfd9] bg-white flex items-center justify-center hover:border-[#0a0a0a] transition-colors"
        title="通知"
      >
        <Bell className="w-4 h-4 text-[#555]" />
      </button>

      {meta.primary && (
        <Link
          href={meta.primary.href}
          className="px-3.5 py-1.5 rounded-[8px] bg-[#0a0a0a] text-white text-[12px] font-medium font-body no-underline inline-flex items-center gap-1 hover:bg-[#222] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          {meta.primary.label.replace('+ ', '')}
        </Link>
      )}
    </div>
  )
}
