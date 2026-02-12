'use client'

import { useState, useTransition } from 'react'
import { approveDesign, requestDesignRevision } from '@/lib/actions/designs'
import { useRouter } from 'next/navigation'

interface DesignFile {
  id: string
  file_url: string | null
  file_name: string | null
  version_number: number
  status: string | null
  submitted_at: string | null
  reviewer_notes: string | null
}

interface Props {
  design: DesignFile
}

export function DesignReviewActions({ design }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showRevisionModal, setShowRevisionModal] = useState(false)
  const [revisionNotes, setRevisionNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleApprove = () => {
    startTransition(async () => {
      const result = await approveDesign(design.id)
      if (result.success) {
        router.refresh()
      } else {
        setError(result.error || 'エラーが発生しました')
      }
    })
  }

  const handleRequestRevision = () => {
    if (!revisionNotes.trim()) {
      setError('修正内容を入力してください')
      return
    }
    startTransition(async () => {
      const result = await requestDesignRevision(design.id, revisionNotes)
      if (result.success) {
        setShowRevisionModal(false)
        setRevisionNotes('')
        router.refresh()
      } else {
        setError(result.error || 'エラーが発生しました')
      }
    })
  }

  // Only show actions for submitted designs
  if (design.status !== 'submitted') {
    return null
  }

  return (
    <>
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleApprove}
          disabled={isPending}
          className="flex-1 bg-[#22c55e] text-white rounded-[8px] py-2 text-[12px] font-medium font-body disabled:opacity-50 transition-opacity"
        >
          {isPending ? '処理中...' : '承認する'}
        </button>
        <button
          onClick={() => setShowRevisionModal(true)}
          disabled={isPending}
          className="flex-1 bg-white border border-[#e8e8e6] text-[#555] rounded-[8px] py-2 text-[12px] font-body disabled:opacity-50 transition-opacity"
        >
          修正を依頼
        </button>
      </div>

      {error && (
        <div className="mt-2 p-2 bg-[#fef3c7] rounded-[8px] text-[11px] text-[#92400e] font-body">
          {error}
        </div>
      )}

      {/* Revision Request Modal */}
      {showRevisionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[14px] p-5 w-full max-w-md">
            <h3 className="text-[14px] font-display font-semibold text-[#0a0a0a] mb-3">
              修正を依頼
            </h3>
            <p className="text-[12px] text-[#888] font-body mb-3">
              修正したい内容を具体的にお知らせください
            </p>
            <textarea
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
              placeholder="例: ロゴの位置をもう少し上に移動してください"
              className="w-full bg-[#f2f2f0] rounded-[10px] px-[14px] py-[10px] text-[12px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6] transition-all resize-none h-24"
            />
            {error && (
              <p className="mt-2 text-[11px] text-[#e5a32e] font-body">{error}</p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleRequestRevision}
                disabled={isPending || !revisionNotes.trim()}
                className="flex-1 bg-[#0a0a0a] text-white rounded-[8px] py-2.5 text-[12px] font-medium font-body disabled:opacity-50"
              >
                {isPending ? '送信中...' : '送信する'}
              </button>
              <button
                onClick={() => {
                  setShowRevisionModal(false)
                  setRevisionNotes('')
                  setError(null)
                }}
                disabled={isPending}
                className="px-4 py-2.5 bg-white border border-[#e8e8e6] rounded-[8px] text-[12px] text-[#555] font-body"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
