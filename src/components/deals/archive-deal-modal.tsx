'use client'

// Sprint 9-2: 案件をクローズ (アーカイブ) するモーダル。
// §0.5-6: クローズ後は archive_note と tags のみ編集可。

import { useState, useTransition } from 'react'
import { X, Archive } from 'lucide-react'
import { archiveDeal, type ArchiveReasonInput } from '@/lib/actions/deals'
import { ARCHIVE_REASON_LABEL } from '@/lib/types'
import { useUi } from '@/components/ui/ui-store'

interface Props {
  dealId: string
  dealName: string
  onClose: () => void
  onArchived?: () => void
}

const REASON_OPTIONS: ArchiveReasonInput[] = ['completed', 'cancelled', 'lost', 'other']

export function ArchiveDealModal({ dealId, dealName, onClose, onArchived }: Props) {
  const { toast } = useUi()
  const [reason, setReason] = useState<ArchiveReasonInput>('completed')
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()

  const handleArchive = () => {
    startTransition(async () => {
      const r = await archiveDeal(dealId, reason, note || null)
      if (r.success) {
        toast(`「${dealName}」をアーカイブしました`)
        onArchived?.()
        onClose()
      } else {
        toast(r.error || 'アーカイブに失敗しました', 'warn')
      }
    })
  }

  return (
    <div
      className="fixed inset-0 z-[1100] bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[14px] shadow-2xl max-w-md w-full p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-[14px] font-semibold inline-flex items-center gap-1.5">
            <Archive className="w-4 h-4 text-[#888]" />
            案件をクローズ
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#888] hover:bg-[#fafaf9] rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[11px] text-[#555] mb-4">
          <span className="font-semibold text-[#0a0a0a]">{dealName}</span> をアーカイブします。
          <br />
          アーカイブ後は通常の編集ができなくなり、メモとタグのみ編集可能になります。
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-[11px] text-[#555] mb-1.5 font-medium">理由</label>
            <div className="grid grid-cols-2 gap-1.5">
              {REASON_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`text-[11px] py-1.5 rounded-[6px] border transition-colors ${
                    reason === r
                      ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]'
                      : 'bg-white text-[#555] border-[#e8e8e6] hover:bg-[#fafaf9]'
                  }`}
                >
                  {ARCHIVE_REASON_LABEL[r]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-[#555] mb-1.5 font-medium">
              メモ（任意）
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="アーカイブ理由の補足、後の参考メモなど"
              className="w-full px-2.5 py-1.5 text-[11px] border border-[#e8e8e6] rounded-[6px] bg-white focus:outline-none focus:border-[#888]"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="text-[11px] px-3 py-1.5 border border-[#e8e8e6] rounded-[6px] bg-white hover:bg-[#fafaf9] disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleArchive}
            disabled={pending}
            className="text-[11px] px-3 py-1.5 bg-[#0a0a0a] text-white rounded-[6px] hover:bg-[#222] disabled:opacity-50"
          >
            {pending ? 'アーカイブ中…' : 'アーカイブする'}
          </button>
        </div>
      </div>
    </div>
  )
}
