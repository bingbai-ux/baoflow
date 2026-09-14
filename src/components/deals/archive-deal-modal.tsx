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
        className="bg-white rounded-[16px] shadow-2xl max-w-md w-full p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-[14px] font-semibold inline-flex items-center gap-1.5">
            <Archive className="w-4 h-4 text-[#84787D]" />
            案件をクローズ
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#84787D] hover:bg-[#FBFAF6] rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[11px] text-[#351E28] mb-4">
          <span className="font-semibold text-[#351E28]">{dealName}</span> をアーカイブします。
          <br />
          アーカイブ後は通常の編集ができなくなり、メモとタグのみ編集可能になります。
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-[11px] text-[#351E28] mb-1.5 font-medium">理由</label>
            <div className="grid grid-cols-2 gap-1.5">
              {REASON_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`text-[11px] py-1.5 rounded-[8px] border transition-colors ${
                    reason === r
                      ? 'bg-[#351E28] text-[#C9A2B8] border-[#351E28]'
                      : 'bg-white text-[#351E28] border-[#E2E1DA] hover:bg-[#FBFAF6]'
                  }`}
                >
                  {ARCHIVE_REASON_LABEL[r]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-[#351E28] mb-1.5 font-medium">
              メモ（任意）
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="アーカイブ理由の補足、後の参考メモなど"
              className="w-full px-2.5 py-1.5 text-[11px] border border-[#E2E1DA] rounded-[8px] bg-white focus:outline-none focus:border-[#84787D]"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="text-[11px] px-3 py-1.5 border border-[#E2E1DA] rounded-[8px] bg-white hover:bg-[#FBFAF6] disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleArchive}
            disabled={pending}
            className="text-[11px] px-3 py-1.5 bg-[#351E28] text-[#C9A2B8] rounded-[8px] hover:brightness-95 disabled:opacity-50"
          >
            {pending ? 'アーカイブ中…' : 'アーカイブする'}
          </button>
        </div>
      </div>
    </div>
  )
}
