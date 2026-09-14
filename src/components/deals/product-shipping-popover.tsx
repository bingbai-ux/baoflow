'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin } from 'lucide-react'
import { useUi } from '@/components/ui/ui-store'
import { updateProductShippingAddress } from '@/lib/actions/product-shipping'
import type { ProductRow } from './deals-nested-table'

interface Props {
  product: ProductRow
}

/**
 * Sprint 7-4-1 仕様書 §2-2-2 / §0.5-1 / 業務理解:
 *   納品先は「商品の属性」(バリエではない、Excel C23 と一致)。
 *
 * cell クリックで開く小型ポップオーバー。4 フィールドを一括編集して保存。
 * notif-popover.tsx と同じ click-outside パターン。
 *
 * 表示 (cell 内):
 *   - shipping_address_label がある → ラベルを表示
 *   - なければ shipping_address_full の先頭 (truncate)
 *   - 全部空 → '-' (placeholder)
 *
 * Sprint 8 で client_addresses テーブル + プルダウンを追加する時、このポップオーバー内に
 * 「既存住所から選択」セレクタを足す予定 (shipping_address_id を埋める)。
 */
export function ProductShippingPopover({ product }: Props) {
  const router = useRouter()
  const { toast } = useUi()
  const [open, setOpen] = useState(false)
  const [pending, startSave] = useTransition()
  const popRef = useRef<HTMLDivElement>(null)

  // ローカル draft: 開くたびに product の最新値を反映
  const [draft, setDraft] = useState({
    label: product.shipping_address_label || '',
    full: product.shipping_address_full || '',
    recipient: product.shipping_recipient_name || '',
    phone: product.shipping_phone || '',
  })

  useEffect(() => {
    if (!open) return
    setDraft({
      label: product.shipping_address_label || '',
      full: product.shipping_address_full || '',
      recipient: product.shipping_recipient_name || '',
      phone: product.shipping_phone || '',
    })
  }, [open, product])

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

  const summary = (() => {
    if (product.shipping_address_label) return product.shipping_address_label
    if (product.shipping_address_full) return product.shipping_address_full
    return null
  })()

  const handleSave = () => {
    if (pending) return
    startSave(async () => {
      const r = await updateProductShippingAddress(product.id, {
        shipping_address_label: draft.label,
        shipping_address_full: draft.full,
        shipping_recipient_name: draft.recipient,
        shipping_phone: draft.phone,
      })
      if (r.success) {
        toast('納品先を保存しました')
        setOpen(false)
        router.refresh()
      } else {
        toast(r.error || '保存に失敗しました', 'warn')
      }
    })
  }

  return (
    <div ref={popRef} className="relative w-full">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className="block w-full px-1.5 py-1 text-[11px] font-body text-left cursor-pointer hover:bg-[#FBFAF6] hover:ring-1 hover:ring-[#E2E1DA] rounded-[2px] truncate"
        title={
          summary
            ? `${product.shipping_address_full || ''}\n${product.shipping_recipient_name || ''} ${product.shipping_phone || ''}`.trim()
            : 'クリックで納品先を編集'
        }
      >
        {summary ? (
          <span className="inline-flex items-center gap-1">
            <MapPin className="w-2.5 h-2.5 text-[#84787D] flex-shrink-0" />
            <span className="truncate">{summary}</span>
          </span>
        ) : (
          <span className="text-[#AEB8A0]">-</span>
        )}
      </button>

      {open && (
        <div
          className="absolute top-full left-0 z-30 mt-1 w-[340px] bg-white border border-[#E2E1DA] rounded-[12px] shadow-[0_8px_24px_rgba(53,30,40,0.12)] p-3 text-[11px] font-body"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false)
          }}
        >
          <p className="text-[10px] text-[#84787D] uppercase tracking-[0.06em] mb-2">
            納品先 (商品 #{product.product_no})
          </p>

          <div className="space-y-2">
            <Field label="ラベル">
              <input
                type="text"
                value={draft.label}
                onChange={(e) => setDraft((s) => ({ ...s, label: e.target.value }))}
                placeholder="例: 石津様 青山"
                className="w-full px-2 py-1 text-[11px] border border-[#E2E1DA] rounded-[4px] focus:outline-none focus:border-[#351E28]"
              />
            </Field>

            <Field label="住所">
              <textarea
                value={draft.full}
                onChange={(e) => setDraft((s) => ({ ...s, full: e.target.value }))}
                placeholder="〒〜 都道府県市区町村番地 建物名 部屋番号"
                rows={2}
                className="w-full px-2 py-1 text-[11px] border border-[#E2E1DA] rounded-[4px] focus:outline-none focus:border-[#351E28] resize-y"
              />
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label="受取人">
                <input
                  type="text"
                  value={draft.recipient}
                  onChange={(e) => setDraft((s) => ({ ...s, recipient: e.target.value }))}
                  placeholder="氏名"
                  className="w-full px-2 py-1 text-[11px] border border-[#E2E1DA] rounded-[4px] focus:outline-none focus:border-[#351E28]"
                />
              </Field>
              <Field label="電話">
                <input
                  type="tel"
                  value={draft.phone}
                  onChange={(e) => setDraft((s) => ({ ...s, phone: e.target.value }))}
                  placeholder="090-…"
                  className="w-full px-2 py-1 text-[11px] border border-[#E2E1DA] rounded-[4px] focus:outline-none focus:border-[#351E28]"
                />
              </Field>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-3 pt-2 border-t border-[#EFEFEA]">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[11px] text-[#351E28] px-2.5 py-1 rounded-[5px] hover:bg-[#FBFAF6]"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={pending}
              className="text-[11px] text-[#C9A2B8] bg-[#351E28] px-3 py-1 rounded-[5px] hover:brightness-95 disabled:opacity-50"
            >
              {pending ? '保存中…' : '保存'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[9px] text-[#84787D] uppercase tracking-[0.04em] mb-0.5">
        {label}
      </span>
      {children}
    </label>
  )
}
