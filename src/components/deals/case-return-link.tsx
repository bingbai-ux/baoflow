'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { safeCaseReturn } from '@/lib/deals/case-workspace'

export function CaseReturnLink() {
  const params = useSearchParams()
  const pathname = usePathname()
  useEffect(() => { const main = document.getElementById('main-content'); if (main) main.scrollTop = 0 }, [pathname])
  return <Link href={safeCaseReturn(params.get('from'))} onClick={e => { if (document.querySelector('[data-case-unsaved="true"]') && !window.confirm('未保存の商品入力を閉じて一覧へ戻りますか？')) e.preventDefault() }} className="inline-flex min-h-[44px] items-center text-[12px] text-[#84787D] underline-offset-4 hover:underline">← 案件一覧へ戻る</Link>
}
