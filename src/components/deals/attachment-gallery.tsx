'use client'

// Sprint 7-4-2-B (§0.5-1): 添付ファイル Masonry 一覧。
//
// PDF サムネ生成は採用せず、アイコン + ファイル名 + 容量で代替 (1行判断):
//   pdf.js のクライアント生成は worker bundle が重く、Next.js での導入も
//   webpack 設定変更が必要。Sprint 7 のスコープ (§0.5-1) には PDF サムネを
//   "実装可否を見極めて" とあるので、軽量パスを選択。Phase 2 で必要なら
//   サーバー側 (pdf-poppler 等) で再検討。

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileText,
  FileArchive,
  FileBox,
  File as FileIcon,
  Trash2,
  Upload,
} from 'lucide-react'
import {
  uploadDesignImage,
  deleteDesignImage,
  type DesignFileRow,
} from '@/lib/actions/designs'
import { useUi } from '@/components/ui/ui-store'
import {
  classifyFile,
  formatFileSize,
  type FileType,
} from '@/lib/utils/file-classify'

interface Props {
  dealId: string
  initial: DesignFileRow[]
}

// File category → アイコンと色 (画像以外の表示で使用)
const TYPE_ICON: Record<FileType, { Icon: typeof FileIcon; bg: string; fg: string; label: string }> = {
  image: { Icon: FileIcon, bg: '#f0fdf4', fg: '#15803d', label: 'IMG' },
  pdf: { Icon: FileText, bg: '#fef2f2', fg: '#c0392b', label: 'PDF' },
  zip: { Icon: FileArchive, bg: '#fffbf2', fg: '#e5a32e', label: 'ZIP' },
  design: { Icon: FileBox, bg: '#faf5ff', fg: '#a855f7', label: 'DSGN' },
  document: { Icon: FileText, bg: '#eff6ff', fg: '#3b82f6', label: 'DOC' },
  other: { Icon: FileIcon, bg: '#fafaf9', fg: '#888', label: 'FILE' },
}

export function AttachmentGallery({ dealId, initial }: Props) {
  const router = useRouter()
  const { toast } = useUi()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, startUpload] = useTransition()
  const [isDeleting, startDelete] = useTransition()
  const [isDragging, setDragging] = useState(false)

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    startUpload(async () => {
      for (const file of Array.from(files)) {
        const r = await uploadDesignImage(dealId, file, null, null)
        if (r.error) {
          toast(`${file.name}: ${r.error}`, 'warn')
          break
        }
      }
      router.refresh()
    })
  }

  const handleDelete = (id: string, fname: string) => {
    if (!confirm(`「${fname}」を削除しますか?`)) return
    startDelete(async () => {
      const r = await deleteDesignImage(id)
      if (!r.success) toast(r.error || '削除に失敗しました', 'warn')
      else router.refresh()
    })
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div className="space-y-3">
      {/* Upload dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-[8px] p-3 text-center text-[11px] transition-colors ${
          isDragging
            ? 'border-[#0a0a0a] bg-[#fafaf9] text-[#0a0a0a]'
            : 'border-[#e8e8e6] text-[#888] hover:border-[#d8d8d4]'
        }`}
      >
        <Upload className="w-4 h-4 inline mr-1.5 align-text-bottom" />
        <span>ファイルをドラッグ&ドロップ、または </span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="underline text-[#0a0a0a] disabled:opacity-50"
        >
          {isUploading ? 'アップロード中…' : '選択'}
        </button>
        <span className="block text-[9.5px] text-[#aaa] mt-0.5">
          画像 / PDF / ZIP / AI / PSD / DOC / XLSX … 全形式 OK · 上限 50 MB / 件
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {initial.length === 0 ? (
        <p className="text-[11px] text-[#888] text-center py-4">添付ファイルはまだありません</p>
      ) : (
        // Masonry: CSS columns で 2 列に均等分配。画像は縦サイズが異なってもスムーズに並ぶ。
        <div className="columns-1 sm:columns-2 gap-2 [column-fill:_balance]">
          {initial.map((f) => (
            <Card
              key={f.id}
              file={f}
              onDelete={(fname) => handleDelete(f.id, fname)}
              isDeleting={isDeleting}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Card({
  file,
  onDelete,
  isDeleting,
}: {
  file: DesignFileRow
  onDelete: (fname: string) => void
  isDeleting: boolean
}) {
  const cat: FileType = file.file_category || classifyFile(file.file_extension)
  const isImage = cat === 'image'
  const meta = TYPE_ICON[cat]
  const Icon = meta.Icon

  return (
    <div className="group/card relative mb-2 break-inside-avoid bg-white border border-[#e8e8e6] rounded-[8px] overflow-hidden hover:border-[#d8d8d4]">
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={file.file_url}
          alt={file.file_name || ''}
          className="w-full block"
          loading="lazy"
        />
      ) : (
        <a
          href={file.file_url}
          target="_blank"
          rel="noreferrer"
          className="block px-3 py-3 hover:bg-[#fafaf9] no-underline text-inherit"
        >
          <div className="flex items-center gap-2 mb-1">
            <span
              className="inline-flex items-center justify-center w-7 h-7 rounded-[6px] flex-shrink-0"
              style={{ background: meta.bg, color: meta.fg }}
            >
              <Icon className="w-3.5 h-3.5" />
            </span>
            <span
              className="text-[9px] font-display font-bold tracking-wider"
              style={{ color: meta.fg }}
            >
              {meta.label}
            </span>
            {file.file_extension && (
              <span className="text-[9px] text-[#888] uppercase tabular-nums">
                .{file.file_extension}
              </span>
            )}
          </div>
        </a>
      )}
      {/* Footer: filename + size + delete */}
      <div className="px-2.5 py-1.5 border-t border-[#f0f0ed] flex items-start gap-1.5">
        <div className="flex-1 min-w-0">
          <p className="text-[10.5px] text-[#0a0a0a] truncate" title={file.file_name || ''}>
            {file.file_name || '(無名)'}
          </p>
          <p className="text-[9px] text-[#888] tabular-nums">
            {formatFileSize(file.file_size_bytes)}
          </p>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onDelete(file.file_name || '(無名)')
          }}
          disabled={isDeleting}
          className="opacity-0 group-hover/card:opacity-100 transition-opacity flex-shrink-0 text-[#c0392b] hover:bg-[#fef2f2] rounded-[3px] p-0.5 disabled:opacity-30"
          aria-label="削除"
          title="削除"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}
