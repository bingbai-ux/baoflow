'use client'

// Sprint 9-3: アーカイブ案件の一覧 + 検索 + ソート + フィルタ + リオーダー操作

import { useTransition, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Search, RotateCcw, ArrowDown, ArrowUp, RotateCw } from 'lucide-react'
import { reorderDeal, unarchiveDeal } from '@/lib/actions/deals'
import { ARCHIVE_REASON_LABEL, type ArchiveReason } from '@/lib/types'
import { useUi } from '@/components/ui/ui-store'
import { formatJPY, formatDate } from '@/lib/utils/format'

interface ArchiveRow {
  id: string
  deal_code: string
  deal_name: string | null
  client_name_text: string | null
  archived_at: string | null
  archive_reason: ArchiveReason | null
  archive_note: string | null
  tags: string[]
  created_at: string
  approved_total_jpy: number
}

interface Props {
  rows: ArchiveRow[]
  currentQ: string
  currentReason: 'all' | ArchiveReason
  currentSortBy: 'archived_at' | 'created_at' | 'deal_name'
  currentSortOrder: 'asc' | 'desc'
}

const REASON_FILTER: Array<'all' | ArchiveReason> = ['all', 'completed', 'cancelled', 'lost', 'other']

export function ArchiveListClient({
  rows,
  currentQ,
  currentReason,
  currentSortBy,
  currentSortOrder,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const [q, setQ] = useState(currentQ)
  const [reorderingId, setReorderingId] = useState<string | null>(null)

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(search?.toString() || '')
    if (value === null || value === '' || (key === 'reason' && value === 'all')) {
      next.delete(key)
    } else {
      next.set(key, value)
    }
    const qs = next.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname || '/archive')
  }

  const handleReorder = (dealId: string, dealName: string) => {
    if (!confirm(`「${dealName}」を複製して新規案件を作成します。よろしいですか？`)) return
    setReorderingId(dealId)
    startTransition(async () => {
      const r = await reorderDeal(dealId)
      setReorderingId(null)
      if (r.error || !r.data) {
        toast(r.error || 'リオーダーに失敗しました', 'warn')
        return
      }
      toast(`新規案件 ${r.data.deal_code} を作成しました`)
      router.push(`/deals?focus=${r.data.id}`)
    })
  }

  const handleUnarchive = (dealId: string, dealName: string) => {
    if (!confirm(`「${dealName}」のアーカイブを解除して /deals に戻しますか？`)) return
    startTransition(async () => {
      const r = await unarchiveDeal(dealId)
      if (r.success) {
        toast('アーカイブを解除しました')
        router.refresh()
      } else {
        toast(r.error || '解除に失敗しました', 'warn')
      }
    })
  }

  const sortLabel = (key: typeof currentSortBy) => {
    if (key === currentSortBy) {
      return currentSortOrder === 'desc' ? <ArrowDown className="w-3 h-3 inline" /> : <ArrowUp className="w-3 h-3 inline" />
    }
    return null
  }

  const toggleSort = (key: typeof currentSortBy) => {
    if (key === currentSortBy) {
      updateParam('sortOrder', currentSortOrder === 'desc' ? 'asc' : 'desc')
    } else {
      updateParam('sortBy', key)
      updateParam('sortOrder', 'desc')
    }
  }

  return (
    <div>
      {/* フィルタバー */}
      <div className="bg-white border border-[rgba(0,0,0,0.06)] rounded-[12px] p-3 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#888]" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') updateParam('q', q)
              }}
              placeholder="案件名 / クライアント / 案件番号で検索"
              className="w-full pl-7 pr-3 py-1.5 text-[12px] border border-[#e8e8e6] rounded-[8px] bg-white focus:outline-none focus:border-[#888]"
            />
          </div>
          <button
            type="button"
            onClick={() => updateParam('q', q)}
            className="text-[11px] px-3 py-1.5 bg-[#0a0a0a] text-white rounded-[6px] hover:bg-[#222]"
          >
            検索
          </button>

          <div className="flex items-center gap-1">
            {REASON_FILTER.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => updateParam('reason', r)}
                className={`text-[11px] px-2.5 py-1 rounded-full border ${
                  currentReason === r
                    ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]'
                    : 'bg-white text-[#555] border-[#e8e8e6] hover:bg-[#fafaf9]'
                }`}
              >
                {r === 'all' ? 'すべて' : ARCHIVE_REASON_LABEL[r]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* テーブル */}
      <div className="bg-white border border-[rgba(0,0,0,0.06)] rounded-[12px] overflow-hidden">
        <table className="w-full text-[11px]">
          <thead className="bg-[#fafaf9] border-b border-[rgba(0,0,0,0.08)]">
            <tr>
              <th className="px-3 py-2 text-left font-body font-medium text-[#888] uppercase tracking-[0.02em]">
                案件番号
              </th>
              <th
                className="px-3 py-2 text-left font-body font-medium text-[#888] uppercase tracking-[0.02em] cursor-pointer hover:text-[#0a0a0a]"
                onClick={() => toggleSort('deal_name')}
              >
                案件名 {sortLabel('deal_name')}
              </th>
              <th className="px-3 py-2 text-left font-body font-medium text-[#888] uppercase tracking-[0.02em]">
                クライアント
              </th>
              <th className="px-3 py-2 text-left font-body font-medium text-[#888] uppercase tracking-[0.02em]">
                理由
              </th>
              <th className="px-3 py-2 text-right font-body font-medium text-[#888] uppercase tracking-[0.02em]">
                採用合計
              </th>
              <th
                className="px-3 py-2 text-left font-body font-medium text-[#888] uppercase tracking-[0.02em] cursor-pointer hover:text-[#0a0a0a]"
                onClick={() => toggleSort('archived_at')}
              >
                アーカイブ日 {sortLabel('archived_at')}
              </th>
              <th className="px-3 py-2 text-right font-body font-medium text-[#888] uppercase tracking-[0.02em]">
                アクション
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-[#888]">
                  該当するアーカイブ案件がありません
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-[rgba(0,0,0,0.05)] hover:bg-[#fafaf9]">
                  <td className="px-3 py-2 tabular-nums text-[#888]">{r.deal_code}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/deals/${r.id}`}
                      className="text-[#0a0a0a] hover:underline font-medium"
                    >
                      {r.deal_name || '(無題)'}
                    </Link>
                    {r.archive_note && (
                      <div className="text-[10px] text-[#888] mt-0.5 truncate max-w-[280px]">
                        📝 {r.archive_note}
                      </div>
                    )}
                    {r.tags && r.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {r.tags.map((t) => (
                          <span
                            key={t}
                            className="text-[9.5px] px-1.5 py-0.5 bg-[#f5f5f4] text-[#555] rounded-full"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[#555]">{r.client_name_text || '-'}</td>
                  <td className="px-3 py-2">
                    {r.archive_reason && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-[#f5f5f4] text-[#555] rounded">
                        {ARCHIVE_REASON_LABEL[r.archive_reason]}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-display">
                    {r.approved_total_jpy > 0 ? formatJPY(r.approved_total_jpy) : '-'}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-[#888]">
                    {r.archived_at ? formatDate(r.archived_at) : '-'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={pending && reorderingId === r.id}
                        onClick={() => handleReorder(r.id, r.deal_name || r.deal_code)}
                        className="text-[10px] px-2 py-1 bg-[#0a0a0a] text-white rounded-[6px] hover:bg-[#222] disabled:opacity-50 inline-flex items-center gap-1"
                        title="複製して新規案件を作成"
                      >
                        <RotateCw className="w-2.5 h-2.5" />
                        {pending && reorderingId === r.id ? '複製中…' : 'リオーダー'}
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => handleUnarchive(r.id, r.deal_name || r.deal_code)}
                        className="text-[10px] px-2 py-1 border border-[#e8e8e6] rounded-[6px] hover:bg-[#fafaf9] disabled:opacity-50 inline-flex items-center gap-1"
                        title="アーカイブを解除"
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                        解除
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-[#888] mt-2">
        {rows.length} 件 · リオーダーは商品・バリエ構成のみコピーされ、見積は再依頼が必要です
      </p>
    </div>
  )
}
