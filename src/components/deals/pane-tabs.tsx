'use client'

// Sprint 7-5 (仕様書 §2-4): 案件詳細パネル専用タブ。
//
// 旧 DealDetailTabs (基本情報 / 商品 / 見積 / 画像 / 通信 / 履歴) は
// /deals/[id] フルページ用に温存。スプレッド本体で全項目編集できる現状では
// パネル側に「基本情報・商品・見積」タブは不要 (仕様書 §2-4 確定)。
//
// パネルのタブは 4 種に限定:
//   履歴 (status_history)
//   通信 (communications)
//   添付 (design_files — Sprint 7-4-2-B Masonry)
//   帳票 (DocumentModal を開くショートカット — タブ自体は概要表示)

import { useState } from 'react'
import Link from 'next/link'
import { FileText, ExternalLink } from 'lucide-react'
import { DealCommunicationTab } from './deal-communication-tab'
import { AttachmentGallery } from './attachment-gallery'
import { formatDate } from '@/lib/utils/format'
import {
  SIMPLE_STATUS_CONFIG,
  type SimpleStatus,
  type DealCommunication,
} from '@/lib/types'

type TabId = 'history' | 'comm' | 'attach' | 'docs'

interface StatusHistoryLite {
  id: string
  from_simple_status: SimpleStatus | null
  to_simple_status: SimpleStatus | null
  changed_at: string
  note: string | null
  kind: string | null
  changer?: { display_name: string | null } | null
}

interface DesignFileForGallery {
  id: string
  deal_id: string
  file_url: string
  storage_path: string | null
  file_name: string | null
  file_type: string | null
  comment: string | null
  category: string | null
  created_at: string
  file_extension: string | null
  file_size_bytes: number | null
  thumbnail_generated: boolean
  file_category: 'image' | 'pdf' | 'zip' | 'design' | 'document' | 'other'
}

interface PaneTabsProps {
  dealId: string
  statusHistory: StatusHistoryLite[]
  communications: DealCommunication[]
  designFiles: DesignFileForGallery[]
  onOpenDocumentModal: () => void
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'history', label: '履歴' },
  { id: 'comm', label: '通信' },
  { id: 'attach', label: '添付' },
  { id: 'docs', label: '帳票' },
]

export function PaneTabs({
  dealId,
  statusHistory,
  communications,
  designFiles,
  onOpenDocumentModal,
}: PaneTabsProps) {
  const [active, setActive] = useState<TabId>('history')
  const unreadComm = communications.filter((c) => !c.is_read).length

  return (
    <div className="flex flex-col h-full">
      {/* Tab strip */}
      <div className="flex gap-0 px-3 border-b border-[#e8e8e6] flex-shrink-0">
        {TABS.map((t) => {
          const isActive = active === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              className={`px-2.5 py-2 text-[11px] font-body cursor-pointer border-b-2 -mb-px ${
                isActive
                  ? 'text-[#0a0a0a] font-semibold border-[#0a0a0a]'
                  : 'text-[#888] border-transparent hover:text-[#555]'
              }`}
            >
              {t.label}
              {t.id === 'comm' && communications.length > 0 && (
                <span
                  className={`ml-1 text-[9.5px] tabular-nums ${
                    unreadComm > 0 ? 'text-[#22c55e] font-semibold' : 'text-[#888]'
                  }`}
                >
                  {communications.length}
                  {unreadComm > 0 ? ` · ${unreadComm}未読` : ''}
                </span>
              )}
              {t.id === 'attach' && designFiles.length > 0 && (
                <span className="ml-1 text-[9.5px] text-[#888] tabular-nums">
                  {designFiles.length}
                </span>
              )}
              {t.id === 'history' && statusHistory.length > 0 && (
                <span className="ml-1 text-[9.5px] text-[#888] tabular-nums">
                  {statusHistory.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab body — scrollable */}
      <div className="flex-1 overflow-auto px-3.5 py-3 text-[11.5px]">
        {active === 'history' && <HistoryTab rows={statusHistory} />}
        {active === 'comm' && (
          <DealCommunicationTab dealId={dealId} initial={communications} />
        )}
        {active === 'attach' && (
          <AttachmentGallery dealId={dealId} initial={designFiles} />
        )}
        {active === 'docs' && (
          <DocsTab dealId={dealId} onOpenModal={onOpenDocumentModal} />
        )}
      </div>
    </div>
  )
}

// 履歴タブ — シンプル版 (フィルタなし、最新順)。
// /deals/[id] 詳細ページの HistoryTab はリッチなフィルタ付きで残置。
function HistoryTab({ rows }: { rows: StatusHistoryLite[] }) {
  if (rows.length === 0) {
    return <p className="text-[#888] text-center py-6">まだ履歴がありません</p>
  }

  return (
    <ul className="space-y-2">
      {rows.slice(0, 30).map((h) => {
        const fromCfg = h.from_simple_status ? SIMPLE_STATUS_CONFIG[h.from_simple_status] : null
        const toCfg = h.to_simple_status ? SIMPLE_STATUS_CONFIG[h.to_simple_status] : null
        return (
          <li key={h.id} className="flex gap-2.5 py-1 border-b border-[#f5f4f0] last:border-b-0">
            <span className="text-[10px] text-[#aaa] tabular-nums w-[58px] flex-shrink-0 font-display">
              {formatDate(h.changed_at)}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#0a0a0a] mt-1.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px]">
                {h.changer?.display_name && (
                  <span className="font-semibold mr-1">{h.changer.display_name}</span>
                )}
                {toCfg ? (
                  <>
                    が
                    <span className="mx-1 inline-flex items-center px-1.5 py-0.5 bg-[#fafaf9] border border-[#e8e8e6] rounded-[4px] text-[10px]">
                      {fromCfg ? `${fromCfg.label} → ` : ''}
                      {toCfg.label}
                    </span>
                    に変更
                  </>
                ) : (
                  <span className="text-[#555]">{h.kind || '更新'}</span>
                )}
              </p>
              {h.note && (
                <p className="text-[10px] text-[#888] mt-0.5 italic">"{h.note}"</p>
              )}
            </div>
          </li>
        )
      })}
      {rows.length > 30 && (
        <p className="text-[10px] text-[#888] text-center pt-2">
          + 他 {rows.length - 30} 件
        </p>
      )}
    </ul>
  )
}

// 帳票タブ — 主アクションボタンのみ。フルページへのリンクも添付。
function DocsTab({
  dealId,
  onOpenModal,
}: {
  dealId: string
  onOpenModal: () => void
}) {
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onOpenModal}
        className="w-full px-3 py-2.5 rounded-[8px] bg-[#0a0a0a] text-white text-[12px] font-medium font-body inline-flex items-center justify-center gap-1.5 hover:bg-[#222]"
      >
        <FileText className="w-3.5 h-3.5" />
        見積書 / 請求書 / 納品書 / RFQ 発行
      </button>
      <p className="text-[10px] text-[#888] leading-relaxed">
        モーダルが開き、4 種の帳票テンプレートから選択して PDF 化できます。
      </p>
      <Link
        href={`/deals/${dealId}/documents`}
        className="block text-center text-[10px] text-[#888] no-underline hover:text-[#0a0a0a]"
      >
        <ExternalLink className="w-3 h-3 inline mr-1 align-text-bottom" />
        フルページで帳票を管理
      </Link>
    </div>
  )
}
