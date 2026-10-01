'use client'

// Sprint 15: 仕様の一覧表。
// 登録済みバリエーションを1行=1バリエの表にして、一覧性と比較をしやすくする。
// 各セルはその場でプルダウン(プリセット+自由入力)や数値入力で編集でき、
// 数量は丸い + でどんどん追加できる。

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useWorkflowRequest } from '@/lib/hooks/use-workflow-request'
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
  hideProductNames?: boolean
}

export function SpecTable({ dealId, products, variants, quotes, hideProductNames = false }: Props) {
  return (
    <>
    <div className="md:hidden space-y-3">{variants.map(v => <section key={v.id} aria-label={`仕様 ${v.variant_label}`} className="rounded-card border border-[#E2E1DA] p-3 space-y-3">
      <h4 className="text-[13px] font-bold">仕様 {v.variant_label}</h4>
      <div className="text-[12px]"><p className="text-[#84787D] mb-1">幅 × 高さ × 奥行（mm）</p><SizeCell variant={v} /></div>
      <div className="grid grid-cols-2 gap-2 text-[12px]"><label><span className="block text-[#84787D]">素材</span><SelectCell variantId={v.id} field="material" value={v.material} presets={MATERIAL_PRESETS} /></label><label><span className="block text-[#84787D]">印刷色数</span><SelectCell variantId={v.id} field="print_color_count" value={v.print_color_count} presets={COLOR_PRESETS} /></label><label className="col-span-2"><span className="block text-[#84787D]">加工</span><SelectCell variantId={v.id} field="processing" value={v.processing} presets={PROCESS_PRESETS} /></label></div>
      <div className="text-[12px]"><p className="text-[#84787D] mb-1">数量候補（個）</p><QtyCell dealId={dealId} variantId={v.id} quotes={quotes.filter(q => q.variant_id === v.id)} /></div>
    </section>)}</div>
    <div className="hidden md:block rounded-[12px] border border-[#E2E1DA] bg-white overflow-x-auto">
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
                hideName={hideProductNames}
              />
            )
          })}
        </tbody>
      </table>
    </div>
    </>
  )
}

function ProductRows({
  dealId,
  product,
  variants,
  quotes,
  hideName,
}: {
  dealId: string
  product: DealProduct
  variants: DealProductVariant[]
  quotes: BuilderQuote[]
  hideName: boolean
}) {
  return (
    <>
      {!hideName && <tr>
        <td colSpan={6} className="px-3 py-1.5 bg-[#EFEFEA] border-t border-[#E2E1DA]">
          <span className="fc-num text-[10.5px] text-[#84787D] mr-2">#{product.product_no}</span>
          <span className="text-[12px] font-bold text-[#351E28]">
            {[product.category_l1, product.category_l2, product.category_l3]
              .filter(Boolean)
              .join(' / ') || product.description}
          </span>
        </td>
      </tr>}
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
        aria-label="自由入力の仕様"
        className="min-h-[44px] w-full bg-white border border-[#351E28] rounded-[8px] px-1.5 py-1 text-[11.5px] outline-none"
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
      aria-label={field === 'material' ? '素材' : field === 'processing' ? '加工' : '印刷色数'}
      className={`min-h-[44px] w-full bg-transparent border border-transparent hover:border-[#E2E1DA] rounded-[8px] px-1 py-1 text-[11.5px] cursor-pointer outline-none focus:border-[#351E28] ${
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
      aria-label={field === 'width_mm' ? '幅（mm）' : field === 'height_mm' ? '高さ（mm）' : '奥行（mm）'}
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
      className="min-h-[44px] w-[60px] fc-num text-right bg-transparent border border-transparent hover:border-[#E2E1DA] rounded-[6px] px-1 py-1 text-[11.5px] outline-none focus:border-[#351E28] placeholder:text-[#AEB8A0]"
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
  const recovery = useWorkflowRequest(`quantity/${dealId}/${variantId}`, 'quantity', dealId)
  const { recovered, complete: completeRecovery } = recovery
  const router = useRouter()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const [adding, setAdding] = useState(false)
  const [qty, setQty] = useState('')
  useEffect(() => {
    if (recovered) { completeRecovery(); toast('前回保存した数量パターンを確認しました'); router.refresh() }
  }, [recovered, completeRecovery, router, toast])

  const addQty = () => {
    const n = Number(qty)
    if (!(n > 0)) return
    startTransition(async () => {
      try {
      const r = await addQuantityToVariant(dealId, variantId, n, await recovery.requestId({ dealId, variantId, quantity: n }))
      if (r.success) {
        recovery.complete()
        toast('数量パターンを追加しました')
        setQty('')
        setAdding(false)
        router.refresh()
      } else { toast(r.error || '追加に失敗しました', 'warn') }
      } catch (e) { toast(e instanceof Error ? e.message : '保存結果を確認できませんでした。同じ数量で再試行してください', 'warn') }
    })
  }

  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      {recovery.error && <span role="alert" className="text-[#B03616] text-[11px]">{recovery.error}</span>}
      {recovery.unfinished && !recovery.recovered && <button type="button" className="underline text-[11px]" onClick={recovery.complete}>登録済み数量を確認済み・新しい入力</button>}
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
            aria-label="追加する数量"
            className="min-h-[44px] w-[84px] text-right fc-num bg-white rounded-[8px] px-2 py-1 text-[11px] border border-[#351E28] outline-none"
            placeholder="数量"
            autoFocus
          />
          <button
            type="button"
            onClick={addQty}
            disabled={!recovery.ready || pending || !(Number(qty) > 0)}
            className="min-h-[44px] rounded-full bg-[#351E28] text-[#C9A2B8] text-[10px] font-bold px-2.5 py-1 disabled:opacity-40"
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
          aria-label="数量を追加"
          className="min-w-[44px] min-h-[44px] rounded-full bg-white border border-[#E2E1DA] text-[#351E28] text-[13px] font-bold leading-none hover:bg-[#FBFAF6] inline-flex items-center justify-center"
        >
          +
        </button>
      )}
    </span>
  )
}
