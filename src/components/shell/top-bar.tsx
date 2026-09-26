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
  const { ccy, setCcy, openCmdk, toggleNotif } = useUi()
  const meta = getMeta(pathname)

  return (
    <div className="h-[52px] px-5 flex items-center gap-3.5 border-b border-[#E2E1DA] bg-[#EFEFEA] flex-shrink-0">
      <div className="font-display text-[17px] font-semibold tracking-tight text-[#351E28]">
        {meta.title}
      </div>
      <div className="text-[11px] text-[#84787D] ml-2">{meta.sub}</div>

      <div className="flex-1" />

      <button
        onClick={openCmdk}
        className="flex items-center gap-2 px-3.5 py-1.5 border border-[#E2E1DA] rounded-full bg-white text-[#84787D] text-[12px] hover:border-[#351E28] transition-colors min-w-[280px]"
        title="検索 (⌘K)"
      >
        <Search className="w-3.5 h-3.5" />
        <span>案件・取引先・書類を検索</span>
        <span className="ml-auto text-[10px] text-[#84787D] bg-[#FBFAF6] border border-[#E2E1DA] rounded-full px-1.5 py-0.5">
          ⌘K
        </span>
      </button>

      <div className="flex border border-[#E2E1DA] rounded-full overflow-hidden bg-white">
        {(['JPY', 'USD', 'BOTH'] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCcy(c)}
            className={`px-3 py-1.5 text-[11px] font-display font-semibold transition-colors ${
              ccy === c ? 'bg-[#351E28] text-[#C9A2B8]' : 'bg-transparent text-[#84787D] hover:text-[#351E28]'
            }`}
          >
            {c === 'BOTH' ? '両方' : c}
          </button>
        ))}
      </div>

      <button
        onClick={toggleNotif}
        className="relative w-[34px] h-[34px] rounded-full border border-[#E2E1DA] bg-white flex items-center justify-center hover:border-[#351E28] transition-colors"
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
