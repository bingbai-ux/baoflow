'use client'

import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTransition } from 'react'
import { X, FileText, ExternalLink } from 'lucide-react'
import { MiniPipeline } from './mini-pipeline'
import { DealDetailTabs } from '@/app/(main)/deals/[id]/deal-detail-tabs'
import { DocumentModal } from '@/components/documents/document-modal'
import { useState } from 'react'
import { advanceSimpleStatus } from '@/lib/actions/deals'
import { useUi } from '@/components/ui/ui-store'
import {
  type SimpleStatus,
  SIMPLE_STATUS_CONFIG,
  SIMPLE_STATUS_ORDER,
} from '@/lib/types'
import type { DealPaneData } from '@/lib/actions/deal-pane-types'

interface Props {
  data: DealPaneData
}

export function DealPane({ data }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useUi()
  const [docModalOpen, setDocModalOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const close = () => {
    const p = new URLSearchParams(searchParams.toString())
    p.delete('selected')
    router.push(p.toString() ? `${pathname}?${p.toString()}` : pathname)
  }

  const advance = () => {
    if (pending) return
    startTransition(async () => {
      const r = await advanceSimpleStatus(data.deal.id)
      if (r.success) {
        toast('ステータスを次へ進めました')
        router.refresh()
      } else {
        toast(r.error || '進められません', 'warn')
      }
    })
  }

  const currentIdx = SIMPLE_STATUS_ORDER.indexOf(data.deal.simple_status)
  const isLast = currentIdx === SIMPLE_STATUS_ORDER.length - 1
  const nextLabel = !isLast
    ? SIMPLE_STATUS_CONFIG[SIMPLE_STATUS_ORDER[currentIdx + 1]].label
    : ''

  // Color seed for thumbnail (hash deal name)
  const thumb = thumbColor(data.deal.deal_name || data.deal.deal_code)

  return (
    <div className="w-[420px] border-l border-[#e8e8e6] bg-white flex flex-col flex-shrink-0 overflow-hidden h-full">
      {/* Header */}
      <div className="px-4 pt-3.5 pb-3 border-b border-[#e8e8e6] flex items-start gap-2.5">
        <div
          className="w-[42px] h-[42px] rounded-[8px] flex-shrink-0 flex items-center justify-center text-[14px] font-display font-semibold text-[#0a0a0a]"
          style={{ background: thumb }}
        >
          {(data.deal.deal_name || data.deal.deal_code).charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display text-[10px] text-[#888] tracking-[0.04em] tabular-nums">
            {data.deal.deal_code}
          </p>
          <p className="text-[13.5px] font-semibold leading-tight mt-0.5 truncate">
            {data.deal.deal_name || '(案件名未設定)'}
          </p>
          <p className="text-[10px] text-[#888] mt-1 truncate">
            {data.deal.client_name_text || '(クライアント未設定)'}
          </p>
        </div>
        <Link
          href={`/deals/${data.deal.id}`}
          className="w-6 h-6 rounded-[6px] text-[#888] cursor-pointer flex items-center justify-center hover:bg-[#fafaf9] transition-colors no-underline"
          title="詳細ページで開く"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
        <button
          type="button"
          onClick={close}
          className="w-6 h-6 rounded-[6px] border-none bg-transparent text-[#888] cursor-pointer flex items-center justify-center text-[16px] hover:bg-[#fafaf9] transition-colors"
          title="閉じる"
          aria-label="閉じる"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Mini pipeline */}
      <div className="px-4 py-2.5 border-b border-[#e8e8e6] bg-[#fafaf9]">
        <MiniPipeline dealId={data.deal.id} current={data.deal.simple_status} />
      </div>

      {/* Tabs body — reuse existing DealDetailTabs */}
      <div className="flex-1 overflow-auto px-4 py-3 text-[11.5px]">
        <DealDetailTabs
          deal={data.deal as never}
          products={data.products as never}
          variants={data.variants as never}
          quotes={data.quotes as never}
          fees={data.fees as never}
          designFiles={data.designFiles as never}
          statusHistory={data.statusHistory as never}
          communications={data.communications as never}
        />
      </div>

      {/* Footer — actions */}
      <div className="px-3.5 py-2.5 border-t border-[#e8e8e6] bg-[#fafaf9] flex gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => setDocModalOpen(true)}
          className="flex-1 px-2.5 py-2 rounded-[6px] text-[11px] cursor-pointer border border-[#e0dfd9] bg-white text-[#0a0a0a] inline-flex items-center justify-center gap-1 hover:bg-[#fafaf9] transition-colors"
        >
          <FileText className="w-3 h-3" />
          帳票
        </button>
        {!isLast ? (
          <button
            type="button"
            onClick={advance}
            disabled={pending}
            className="flex-1 px-2.5 py-2 rounded-[6px] text-[11px] cursor-pointer border border-[#0a0a0a] bg-[#0a0a0a] text-white font-medium hover:bg-[#222] disabled:opacity-50 transition-colors"
          >
            {pending ? '更新中…' : `→ ${nextLabel}`}
          </button>
        ) : (
          <span className="flex-1 px-2.5 py-2 rounded-[6px] text-[11px] text-center bg-[#e7f0e6] text-[#3a7d36] font-medium">
            納品完了
          </span>
        )}
      </div>

      {docModalOpen && (
        <DocumentModal dealId={data.deal.id} onClose={() => setDocModalOpen(false)} />
      )}
    </div>
  )
}

export function DealPaneEmpty() {
  return (
    <div className="w-[420px] border-l border-[#e8e8e6] bg-white flex flex-col items-center justify-center gap-3 text-center px-7 text-[#bbb] text-[11px] flex-shrink-0 h-full">
      <div className="w-[60px] h-[60px] rounded-full bg-[#fafaf9] flex items-center justify-center text-[28px] text-[#ddd] font-display">
        ◯
      </div>
      <p className="font-display text-[13px] text-[#888] font-semibold">案件を選択</p>
      <p className="text-[10.5px] text-[#aaa] leading-relaxed max-w-[240px]">
        左の表から案件をクリックすると、詳細・履歴・添付・通信がここに表示されます。
      </p>
    </div>
  )
}

function thumbColor(seed: string): string {
  const palette = [
    '#fde8e8', '#fff8e8', '#e7f0e6', '#e8f0f7',
    '#f0e8f5', '#f5f0dc', '#f0f5e8', '#fafaf9',
  ]
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0
  }
  return palette[h % palette.length]
}
