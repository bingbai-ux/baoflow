'use client'

import { useRef, useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Image as ImageIcon, Trash2 } from 'lucide-react'
import { useUi } from '@/components/ui/ui-store'
import {
  uploadProductThumbnail,
  clearProductThumbnail,
} from '@/lib/actions/product-thumbnail'

interface Props {
  productId: string
  thumbnailUrl: string | null
}

/**
 * Sprint 7-4-2-A (§0.5-1): スプレッド画像列のサムネイルセル。
 *
 * - 既存のサムネがあればそのまま表示 (32×32、クリック不要 — §0.5-1 確定事項)
 * - 空セルは薄いグレー枠 + ImageIcon プレースホルダー
 * - クリック → file picker (image/*) → upload → Toast → router.refresh()
 * - ホバー時に右上に削除ボタン (✕) を表示
 *
 * TODO (Sprint 7-5): クリック動線の改善。
 *   現状: クリック → ファイル選択。
 *   Sprint 7-5 でパネル「添付」タブを開く動線に切替えるか検討
 *   (一覧クリック = 添付タブを開く、別ボタンで再アップロード)。
 */
export function ProductThumbnailCell({ productId, thumbnailUrl }: Props) {
  const router = useRouter()
  const { toast } = useUi()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()
  const [hover, setHover] = useState(false)

  const handlePick = () => {
    if (pending) return
    fileRef.current?.click()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // reset so the same file can be picked again later
    if (!file) return
    startTransition(async () => {
      const r = await uploadProductThumbnail(productId, file)
      if (r.error) {
        toast(r.error, 'warn')
      } else {
        toast('商品画像を更新しました')
        router.refresh()
      }
    })
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (pending) return
    if (!confirm('この商品の画像を削除しますか?')) return
    startTransition(async () => {
      const r = await clearProductThumbnail(productId)
      if (r.success) {
        toast('画像を削除しました')
        router.refresh()
      } else {
        toast(r.error || '削除に失敗しました', 'warn')
      }
    })
  }

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        onClick={handlePick}
        disabled={pending}
        className={`block w-8 h-8 rounded-[4px] overflow-hidden border ${
          thumbnailUrl ? 'border-[#e8e8e6]' : 'border-dashed border-[#d8d8d4] bg-[#fafaf9]'
        } hover:ring-1 hover:ring-[#e5a32e] disabled:opacity-50`}
        title={thumbnailUrl ? '画像を差し替える' : '画像をアップロード'}
      >
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt="商品サムネ"
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="flex items-center justify-center w-full h-full text-[#bbb]">
            <ImageIcon className="w-3.5 h-3.5" />
          </span>
        )}
      </button>
      {thumbnailUrl && hover && (
        <button
          type="button"
          onClick={handleClear}
          disabled={pending}
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white border border-[#e8e8e6] flex items-center justify-center text-[#c0392b] hover:bg-[#fef2f2] disabled:opacity-50"
          title="画像を削除"
          aria-label="画像を削除"
        >
          <Trash2 className="w-2 h-2" />
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  )
}
