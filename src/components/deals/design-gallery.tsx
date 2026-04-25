'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Upload, X } from 'lucide-react'
import {
  uploadDesignImage,
  deleteDesignImage,
  updateDesignComment,
  type DesignFileRow,
} from '@/lib/actions/designs'
import { formatDate } from '@/lib/utils/format'

interface DesignGalleryProps {
  dealId: string
  initial: DesignFileRow[]
}

export function DesignGallery({ dealId, initial }: DesignGalleryProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, startUpload] = useTransition()
  const [isDeleting, startDelete] = useTransition()
  const [isDragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lightboxId, setLightboxId] = useState<string | null>(null)

  const lightbox = lightboxId ? initial.find((f) => f.id === lightboxId) : null

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    setError(null)
    startUpload(async () => {
      for (const file of Array.from(files)) {
        const result = await uploadDesignImage(dealId, file)
        if (result.error) {
          setError(`${file.name}: ${result.error}`)
          break
        }
      }
      router.refresh()
    })
  }

  const handleDelete = (id: string) => {
    if (!confirm('この画像を削除しますか？')) return
    setError(null)
    startDelete(async () => {
      const r = await deleteDesignImage(id)
      if (!r.success) {
        setError(r.error || '削除に失敗しました')
        return
      }
      if (lightboxId === id) setLightboxId(null)
      router.refresh()
    })
  }

  return (
    <>
      {error && (
        <div className="bg-[#fef2f2] border border-[#fca5a5] rounded-[8px] px-3 py-2 text-[12px] text-[#b91c1c] font-body mb-3">
          {error}
        </div>
      )}

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
        className={`rounded-[14px] border-2 border-dashed p-6 text-center transition-colors ${
          isDragging ? 'border-[#0a0a0a] bg-[#fafafa]' : 'border-[#e8e8e6] bg-white'
        }`}
      >
        <Upload className="w-5 h-5 mx-auto text-[#888]" />
        <p className="mt-2 text-[13px] font-body text-[#0a0a0a]">
          画像をドラッグ＆ドロップ、または
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="ml-1 text-[#22c55e] underline"
            disabled={isUploading}
          >
            ファイルを選択
          </button>
        </p>
        <p className="mt-1 text-[11px] font-body text-[#888]">
          JPEG / PNG / WebP / GIF · 1 ファイル最大 10MB · 複数枚対応
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
        {isUploading && (
          <p className="mt-2 text-[11px] font-body text-[#22c55e]">アップロード中...</p>
        )}
      </div>

      {/* Grid */}
      {initial.length === 0 ? (
        <p className="mt-6 text-center text-[13px] font-body text-[#888]">
          まだ画像が登録されていません。
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {initial.map((f) => (
            <DesignCard
              key={f.id}
              file={f}
              onView={() => setLightboxId(f.id)}
              onDelete={() => handleDelete(f.id)}
              busy={isDeleting}
            />
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <Lightbox
          file={lightbox}
          onClose={() => setLightboxId(null)}
          onDelete={() => handleDelete(lightbox.id)}
          busy={isDeleting}
        />
      )}
    </>
  )
}

function DesignCard({
  file,
  onView,
  onDelete,
  busy,
}: {
  file: DesignFileRow
  onView: () => void
  onDelete: () => void
  busy: boolean
}) {
  return (
    <div className="bg-white rounded-[10px] border border-[#e8e8e6] overflow-hidden">
      <button
        type="button"
        onClick={onView}
        className="block w-full aspect-square bg-[#f5f5f4] focus:outline-none"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={file.file_url}
          alt={file.file_name || ''}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </button>
      <div className="p-2">
        <p className="text-[11px] font-body text-[#0a0a0a] truncate" title={file.file_name || ''}>
          {file.file_name || '(無題)'}
        </p>
        {file.comment && (
          <p className="text-[10px] font-body text-[#555] mt-0.5 line-clamp-2">{file.comment}</p>
        )}
        <div className="mt-1 flex items-center justify-between text-[10px] font-body text-[#888]">
          <span className="tabular-nums">{formatDate(file.created_at)}</span>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="text-[#ef4444] p-1 rounded-[4px] hover:bg-[#fef2f2] disabled:opacity-50"
            title="削除"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  )
}

function Lightbox({
  file,
  onClose,
  onDelete,
  busy,
}: {
  file: DesignFileRow
  onClose: () => void
  onDelete: () => void
  busy: boolean
}) {
  const [comment, setComment] = useState(file.comment || '')
  const [isSaving, startSave] = useTransition()
  const [savedNotice, setSavedNotice] = useState(false)

  const handleSaveComment = () => {
    if (comment === (file.comment || '')) return
    startSave(async () => {
      const r = await updateDesignComment(file.id, comment)
      if (r.success) {
        setSavedNotice(true)
        setTimeout(() => setSavedNotice(false), 2000)
      }
    })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-[14px] max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-2 border-b border-[#e8e8e6]">
          <p className="text-[13px] font-body text-[#0a0a0a] truncate flex-1">
            {file.file_name || '(無題)'}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[#f5f5f4]"
            aria-label="閉じる"
          >
            <X className="w-4 h-4 text-[#555]" />
          </button>
        </div>
        <div className="flex-1 overflow-auto bg-[#0a0a0a] flex items-center justify-center min-h-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={file.file_url}
            alt={file.file_name || ''}
            className="max-w-full max-h-[60vh] object-contain"
          />
        </div>
        <div className="p-4 border-t border-[#e8e8e6] space-y-2">
          <label className="block">
            <span className="text-[11px] font-body text-[#888]">メモ (300 文字まで)</span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 300))}
              onBlur={handleSaveComment}
              rows={2}
              className="mt-1 w-full px-3 py-2 text-[12px] font-body bg-white border border-[#e8e8e6] rounded-[8px] focus:outline-none focus:border-[#0a0a0a] resize-y"
              placeholder="この画像に関するメモ"
            />
          </label>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-body text-[#888] tabular-nums">
              {comment.length} / 300
              {isSaving && ' · 保存中...'}
              {savedNotice && ' · 保存しました'}
            </span>
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="text-[12px] font-body text-[#ef4444] hover:underline disabled:opacity-50 inline-flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              削除
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
