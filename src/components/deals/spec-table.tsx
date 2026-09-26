'use client'

// Sprint 15: 仕様の一覧表。
// 登録済みバリエーションを1行=1バリエの表にして、一覧性と比較をしやすくする。
// 各セルはその場でプルダウン(プリセット+自由入力)や数値入力で編集でき、
// 数量は丸い + でどんどん追加できる。

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateVariantField } from '@/lib/actions/inline-edit'
import { addQuantityToVariant } from '@/lib/actions/deal-wizard'
import {
  MATERIAL_PRESETS,
  COLOR_PRESETS,
  PROCESS_PRESETS,
} from '@/components/deals/product-wizard'
import { useUi } from '@/components/ui/ui-store'
import type { DealProduct, DealProductVariant } from '@/lib/types'
import type { BuilderQuote } from '@/components/deals/quote-builder'

interface Props {
  dealId: string
  products: DealProduct[]
  variants: DealProductVariant[]
  quotes: BuilderQuote[]
}

export function SpecTable({ dealId, products, variants, quotes }: Props) {
  return (
    <div className="rounded-[12px] border border-[#E2E1DA] bg-white overflow-x-auto">
      <table className="w-full text-[12px] border-collapse min-w-[760px]">
        <thead>
          <tr className="bg-[#FBFAF6] text-[10.5px] text-[#84787D]">
            <th className="text-left font-normal px-3 py-1.5 w-[52px]">バリエ</th>
            <th className="text-left font-normal px-2 py-1.5 w-[168px]">サイズ W×H×D (mm)</th>
            <th className="text-left font-normal px-2 py-1.5 w-[128px]">素材</th>
            <th className="text-left font-normal px-2 py-1.5 w-[96px]">色数</th>
            <th className="text-left font-normal px-2 py-1.5 w-[128px]">加工</th>
            <th className="text-left font-normal px-2 py-1.5">数量 (クリックで追加)</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => {
            const vs = variants.filter((v) => v.product_id === p.id)
            if (vs.length === 0) return null
            return (
              <ProductRows
                key={p.id}
                dealId={dealId}
                product={p}
                variants={vs}
                quotes={quotes}
              />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ProductRows({
  dealId,
  product,
  variants,
  quotes,
}: {
  dealId: string
  product: DealProduct
  variants: DealProductVariant[]
  quotes: BuilderQuote[]
}) {
  return (
    <>
      <tr>
        <td colSpan={6} className="px-3 py-1.5 bg-[#EFEFEA] border-t border-[#E2E1DA]">
          <span className="fc-num text-[10.5px] text-[#84787D] mr-2">#{product.product_no}</span>
          <span className="text-[12px] font-bold text-[#351E28]">
            {[product.category_l1, product.category_l2, product.category_l3]
              .filter(Boolean)
              .join(' / ') || product.description}
          </span>
        </td>
      </tr>
      {variants.map((v, i) => (
        <VariantRow
          key={v.id}
          dealId={dealId}
          variant={v}
          quotes={quotes.filter((q) => q.variant_id === v.id)}
          zebra={i % 2 === 1}
        />
      ))}
    </>
  )
}

function VariantRow({
  dealId,
  variant,
  quotes,
  zebra,
}: {
  dealId: string
  variant: DealProductVariant
  quotes: BuilderQuote[]
  zebra: boolean
}) {
  return (
    <tr className={`border-t border-[#EFEFEA] ${zebra ? 'bg-[#FBFAF6]' : 'bg-white'}`}>
      <td className="px-3 py-1.5 align-middle">
        <span className="fc-num text-[11px] font-bold text-[#33566F] bg-[#D7EFFF] rounded-full px-2 py-[2px]">
          {variant.variant_label}
        </span>
      </td>
      <td className="px-2 py-1.5 align-middle">
        <SizeCell variant={variant} />
      </td>
      <td className="px-2 py-1.5 align-middle">
        <SelectCell
          variantId={variant.id}
          field="material"
          value={variant.material}
          presets={MATERIAL_PRESETS}
        />
      </td>
      <td className="px-2 py-1.5 align-middle">
        <SelectCell
          variantId={variant.id}
          field="print_color_count"
          value={variant.print_color_count}
          presets={COLOR_PRESETS}
        />
      </td>
      <td className="px-2 py-1.5 align-middle">
        <SelectCell
          variantId={variant.id}
          field="processing"
          value={variant.processing}
          presets={PROCESS_PRESETS}
        />
      </td>
      <td className="px-2 py-1.5 align-middle">
        <QtyCell dealId={dealId} variantId={variant.id} quotes={quotes} />
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// セル部品
// ---------------------------------------------------------------------------

const CUSTOM = '__custom__'

/** プリセットのプルダウン + 自由入力。値はその場で保存する */
function SelectCell({
  variantId,
  field,
  value,
  presets,
}: {
  variantId: string
  field: string
  value: string | null
  presets: string[]
}) {
  const router = useRouter()
  const { toast } = useUi()
  const [, startTransition] = useTransition()
  const [local, setLocal] = useState(value || '')
  const [custom, setCustom] = useState(false)

  const save = (next: string) => {
    setLocal(next)
    startTransition(async () => {
      const r = await updateVariantField(variantId, field, next || null)
      if (!r.success) toast(r.error || '保存に失敗しました', 'warn')
      else router.refresh()
    })
  }

  if (custom) {
    return (
      <input
        autoFocus
        defaultValue={local}
        onBlur={(e) => {
          setCustom(false)
          if (e.target.value !== local) save(e.target.value.trim())
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') setCustom(false)
        }}
        className="w-full bg-white border border-[#351E28] rounded-[8px] px-1.5 py-1 text-[11.5px] outline-none"
        placeholder="自由入力"
      />
    )
  }

  const options = presets.includes(local) || !local ? presets : [local, ...presets]
  return (
    <select
      value={local}
      onChange={(e) => {
        if (e.target.value === CUSTOM) setCustom(true)
        else save(e.target.value)
      }}
      className={`w-full bg-transparent border border-transparent hover:border-[#E2E1DA] rounded-[8px] px-1 py-1 text-[11.5px] cursor-pointer outline-none focus:border-[#351E28] ${
        local ? 'text-[#351E28]' : 'text-[#AEB8A0]'
      }`}
    >
      <option value="">未設定</option>
      {options.map((x) => (
        <option key={x} value={x}>
          {x}
        </option>
      ))}
      <option value={CUSTOM}>その他(自由入力)…</option>
    </select>
  )
}

/** W×H×D の3連数値入力。変更したフィールドだけ保存する */
function SizeCell({ variant }: { variant: DealProductVariant }) {
  const router = useRouter()
  const { toast } = useUi()
  const [, startTransition] = useTransition()

  const dim = (field: 'width_mm' | 'height_mm' | 'depth_mm', v: number | null) => (
    <input
      type="number"
      min={0}
      defaultValue={v ?? ''}
      onBlur={(e) => {
        const next = e.target.value === '' ? null : String(Number(e.target.value))
        if ((v == null ? '' : String(v)) === (next ?? '')) return
        startTransition(async () => {
          const r = await updateVariantField(variant.id, field, next)
          if (!r.success) toast(r.error || '保存に失敗しました', 'warn')
          else router.refresh()
        })
      }}
      className="w-[44px] fc-num text-right bg-transparent border border-transparent hover:border-[#E2E1DA] rounded-[6px] px-1 py-1 text-[11.5px] outline-none focus:border-[#351E28] placeholder:text-[#AEB8A0]"
      placeholder="—"
    />
  )

  return (
    <span className="inline-flex items-center gap-0.5 text-[10.5px] text-[#84787D]">
      {dim('width_mm', variant.width_mm)}
      ×
      {dim('height_mm', variant.height_mm)}
      ×
      {dim('depth_mm', variant.depth_mm)}
    </span>
  )
}

/** 数量チップ + 丸い + でその場追加 */
function QtyCell({
  dealId,
  variantId,
  quotes,
}: {
  dealId: string
  variantId: string
  quotes: BuilderQuote[]
}) {
  const router = useRouter()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const [adding, setAdding] = useState(false)
  const [qty, setQty] = useState('')

  const addQty = () => {
    const n = Number(qty)
    if (!(n > 0)) return
    startTransition(async () => {
      const r = await addQuantityToVariant(dealId, variantId, n)
      if (r.success) {
        toast('数量パターンを追加しました')
        setQty('')
        setAdding(false)
        router.refresh()
      } else toast(r.error || '追加に失敗しました', 'warn')
    })
  }

  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      {quotes.length === 0 && !adding && (
        <span className="text-[10.5px] text-[#AEB8A0]">未設定</span>
      )}
      {quotes
        .slice()
        .sort((a, b) => (a.quantity || 0) - (b.quantity || 0))
        .map((q) => (
          <span
            key={q.id}
            className={`fc-num rounded-full text-[11px] font-bold px-2.5 py-[3px] ${
              q.status === 'approved'
                ? 'bg-[#E9F056] text-[#666C14]'
                : 'bg-[#EFEFEA] border border-[#E2E1DA] text-[#351E28]'
            }`}
          >
            {(q.quantity || 0).toLocaleString()}
          </span>
        ))}
      {adding ? (
        <span className="inline-flex items-center gap-1">
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addQty()
              if (e.key === 'Escape') setAdding(false)
            }}
            className="w-[84px] text-right fc-num bg-white rounded-[8px] px-2 py-1 text-[11px] border border-[#351E28] outline-none"
            placeholder="数量"
            autoFocus
          />
          <button
            type="button"
            onClick={addQty}
            disabled={pending || !(Number(qty) > 0)}
            className="rounded-full bg-[#351E28] text-[#C9A2B8] text-[10px] font-bold px-2.5 py-1 disabled:opacity-40"
          >
            追加
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="text-[10px] text-[#84787D] underline"
          >
            やめる
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          title="枚数違いを追加"
          className="w-6 h-6 rounded-full bg-white border border-[#E2E1DA] text-[#351E28] text-[13px] font-bold leading-none hover:bg-[#FBFAF6] inline-flex items-center justify-center"
        >
          +
        </button>
      )}
    </span>
  )
}
