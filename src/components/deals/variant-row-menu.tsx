'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal } from 'lucide-react'
import { useUi } from '@/components/ui/ui-store'
import {
  duplicateVariant,
  deleteVariant,
  markVariantSelected,
} from '@/lib/actions/variants'

interface Props {
  variantId: string
  isSelected: boolean
  variantLabel: string
}

/**
 * Sprint 7-3-2 仕様書 §2-2-4: バリ行のアクションメニュー (採用切替 / 複製 / 削除)。
 *
 * notif-popover.tsx と同じく click-outside で閉じる軽量ポップオーバー。
 * 行末に「⋯」アイコンを置き、クリックで右下にメニュー表示。
 */
export function VariantRowMenu({ variantId, isSelected, variantLabel }: Props) {
  const router = useRouter()
  const { toast } = useUi()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false)
    }
    const t = setTimeout(() => document.addEventListener('mousedown', onClick), 0)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  const onAdopt = () => {
    if (pending) return
    setOpen(false)
    startTransition(async () => {
      const r = await markVariantSelected(variantId, !isSelected)
      if (r.success) {
        toast(isSelected ? '採用を解除しました' : `「${variantLabel}」を採用に変更しました`)
        router.refresh()
      } else {
        toast(r.error || '採用切替に失敗しました', 'warn')
      }
    })
  }

  const onDuplicate = () => {
    if (pending) return
    setOpen(false)
    startTransition(async () => {
      const r = await duplicateVariant(variantId)
      if (r.error) {
        toast(r.error, 'warn')
      } else {
        toast('バリエを複製しました')
        router.refresh()
      }
    })
  }

  const onDelete = () => {
    if (pending) return
    setOpen(false)
    if (!confirm(`「${variantLabel}」を削除しますか? この操作は取り消せません。`)) return
    startTransition(async () => {
      const r = await deleteVariant(variantId)
      if (r.success) {
        toast('バリエを削除しました')
        router.refresh()
      } else {
        toast(r.error || '削除に失敗しました', 'warn')
      }
    })
  }

  return (
    <div ref={popRef} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        disabled={pending}
        className="inline-flex items-center justify-center w-5 h-5 rounded-[4px] text-[#888] hover:text-[#0a0a0a] hover:bg-[#f0f0ed] disabled:opacity-40"
        title="バリエ操作"
        aria-label="バリエ操作メニュー"
      >
        <MoreHorizontal className="w-3 h-3" />
      </button>
      {open && (
        <div
          className="absolute top-6 right-0 z-30 min-w-[140px] bg-white border border-[#e8e8e6] rounded-[8px] shadow-[0_8px_24px_rgba(0,0,0,0.12)] py-1 text-[11px] font-body"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onAdopt}
            className="w-full text-left px-3 py-1.5 hover:bg-[#fafaf9]"
          >
            {isSelected ? '採用を解除' : '採用にする'}
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            className="w-full text-left px-3 py-1.5 hover:bg-[#fafaf9]"
          >
            複製
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="w-full text-left px-3 py-1.5 text-[#c0392b] hover:bg-[#fef2f2]"
          >
            削除
          </button>
        </div>
      )}
    </div>
  )
}
