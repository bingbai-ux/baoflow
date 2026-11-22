'use client'

// 再設計 工程2: 案件の商品一覧（1商品=1カード）。追加・編集・コピー・並べ替え（つかんで動かす / 上下ボタン）・削除。

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, GripVertical, Pencil, Trash2 } from 'lucide-react'
import type { CatalogNode } from '@/lib/actions/catalog'
import type { OptionItem } from '@/lib/actions/product-master'
import type { DealProduct, DealProductVariant } from '@/lib/types'
import { deleteProjectProduct, reorderProjectProducts } from '@/lib/actions/project-products'
import { ProductForm, EMPTY_PRODUCT, type ProductFormValue } from '@/components/process/product-form'
import { useUi } from '@/components/ui/ui-store'

// 工程2で足した列（src/lib/types.ts の型は従来のまま残し、ここで足して読む）
type Product = DealProduct & { sort_order?: number | null; shipping_mode?: 'sea' | 'air' | null; shipping_arranger?: 'factory' | 'partner' | null; sample_required?: boolean; food_inspection_required?: boolean; category_note?: string | null }
type Variant = DealProductVariant & { size_mode?: ProductFormValue['sizeMode'] | null; diameter_mm?: number | null; capacity_text?: string | null; size_note?: string | null; material_note?: string | null; print_note?: string | null; accessories?: string[] | null; accessories_note?: string | null }
interface QuoteLite { variant_id?: string | null; quantity?: number | null }

const fmt = (n: number) => n.toLocaleString('ja-JP')
const str = (v: number | string | null | undefined) => v == null ? '' : String(Number(v))
const ghost = 'min-h-[44px] inline-flex items-center justify-center gap-1 rounded-full border border-[#E2E1DA] bg-white px-3 text-[12px] font-bold text-[#351E28] hover:bg-[#FBFAF6] disabled:opacity-40'
const pill = 'rounded-full px-2 py-[3px] text-[11px] font-bold whitespace-nowrap'

function toForm(p: Product, v: Variant | undefined, quantities: number[]): ProductFormValue {
  const mode = v?.size_mode || (v?.width_mm != null || v?.height_mm != null || v?.depth_mm != null ? 'box' : 'undecided') // 以前の画面で登録した商品は、寸法があれば「縦×横×奥行」として開く
  return {
    l1: p.category_l1, l2: p.category_l2, l3: p.category_l3, categoryNote: p.category_note || '',
    material: v?.material || null, materialNote: v?.material_note || '', print: v?.print_color_count || null, printNote: v?.print_note || '',
    accessories: v?.accessories || [], accessoriesNote: v?.accessories_note || '',
    sizeMode: mode, w: str(v?.width_mm), h: str(v?.height_mm), d: str(v?.depth_mm), dia: str(v?.diameter_mm), capacity: v?.capacity_text || '', sizeNote: v?.size_note || '',
    quantities, shippingMode: p.shipping_mode || null, arranger: p.shipping_arranger || null, sample: !!p.sample_required, food: !!p.food_inspection_required, memo: p.product_memo || '',
  }
}

export function ProductRegistry({ dealId, products: rows, variants, quotes, catalog, options, readOnly, onEditorChange }: {
  dealId: string; products: DealProduct[]; variants: DealProductVariant[]; quotes: QuoteLite[]; catalog: CatalogNode[]; options: OptionItem[]
  readOnly?: boolean; onEditorChange?: (editing: boolean) => void
}) {
  const router = useRouter()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const [order, setOrder] = useState<string[]>(rows.map(p => p.id))
  useEffect(() => { setOrder(rows.map(p => p.id)) }, [rows])
  const [editor, setEditor] = useState<{ mode: 'new' | 'edit' | 'copy'; productId: string | null; initial: ProductFormValue; key: number } | null>(null)
  useEffect(() => { onEditorChange?.(editor !== null); return () => onEditorChange?.(false) }, [editor, onEditorChange])
  const [confirm, setConfirm] = useState<Product | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const products = order.map(id => rows.find(p => p.id === id)).filter((p): p is Product => !!p)
  const variantsOf = (id: string) => (variants as Variant[]).filter(v => v.product_id === id).sort((a, b) => a.variant_order - b.variant_order)
  const quantitiesOf = (id: string) => { const v = variantsOf(id)[0]; return v ? [...new Set(quotes.filter(q => q.variant_id === v.id && q.quantity != null).map(q => Number(q.quantity)))].sort((a, b) => a - b) : [] }

  const open = (mode: 'new' | 'edit' | 'copy', p?: Product) => {
    if (editor && !window.confirm('入力中の内容を捨てて、別の入力を始めますか？')) return
    setError(null)
    setEditor({ mode, productId: mode === 'edit' && p ? p.id : null, initial: p ? toForm(p, variantsOf(p.id)[0], quantitiesOf(p.id)) : EMPTY_PRODUCT, key: Date.now() })
  }
  const saveOrder = (next: string[]) => {
    const before = order
    setOrder(next); setError(null)
    startTransition(async () => {
      const res = await reorderProjectProducts(dealId, next)
      if (res.error) { setOrder(before); setError(`並べ替えを保存できませんでした（${res.error}）。元の順番に戻しました。`); return }
      router.refresh()
    })
  }
  const move = (id: string, to: number) => {
    const from = order.indexOf(id)
    if (from < 0 || to < 0 || to >= order.length || from === to) return
    const next = [...order]; next.splice(from, 1); next.splice(to, 0, id)
    saveOrder(next)
  }
  const remove = (p: Product) => {
    setConfirm(null); setError(null)
    startTransition(async () => {
      const res = await deleteProjectProduct(p.id, dealId)
      if (res.error) { setError(res.error); return }
      toast('商品を削除しました'); router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12.5px] text-[#84787D] tabular-nums">{products.length}商品</p>
        {!readOnly && <button type="button" onClick={() => open('new')} className={ghost + ' !bg-[#351E28] !text-[#C9A2B8] !border-[#351E28]'}>＋ 商品を追加</button>}
      </div>
      {error && <p role="alert" className="rounded-[16px] border-[1.5px] border-[#FF5C34] bg-[#FFD8C2] p-3 text-[12.5px] text-[#B03616]">{error}</p>}

      <ol aria-label="登録した商品" className="space-y-2">
        {products.map((p, i) => {
          const vs = variantsOf(p.id), v = vs[0], qs = quantitiesOf(p.id)
          const path = [p.category_l1, p.category_l2, p.category_l3].filter(Boolean).join(' › ')
          const notes = [p.category_note, v?.material_note, v?.print_note, v?.accessories_note, v?.size_note].filter(Boolean).join(' / ')
          const isEditing = editor?.mode === 'edit' && editor.productId === p.id
          return (
            <li key={p.id} data-product-id={p.id} draggable={!readOnly && !editor && products.length > 1}
              onDragStart={e => { setDragging(p.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', p.id) }}
              onDragOver={e => { if (dragging && dragging !== p.id) { e.preventDefault(); e.dataTransfer.dropEffect = 'move' } }}
              onDrop={e => { e.preventDefault(); if (dragging) move(dragging, i); setDragging(null) }}
              onDragEnd={() => setDragging(null)}
              className={'rounded-[16px] border bg-white ' + (isEditing ? 'border-[#351E28]' : 'border-[#E2E1DA]') + (dragging === p.id ? ' opacity-50' : '')}>
              <div className="flex gap-2 p-3 sm:gap-3 sm:p-4">
                {!readOnly && products.length > 1 && <span aria-hidden="true" title="つかんで並べ替え" className="hidden cursor-grab select-none self-start pt-1 text-[#84787D] sm:block"><GripVertical className="h-4 w-4" /></span>}
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-[#351E28] break-words"><span className="mr-2 tabular-nums text-[#84787D]">{i + 1}</span>{p.description}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-[#84787D]">
                    {path && <span>{path}</span>}
                    <span className={pill + ' border border-[#E2E1DA] bg-[#EFEFEA] text-[#351E28]'}>{p.shipping_mode === 'sea' ? '船便' : p.shipping_mode === 'air' ? 'エアー' : '配送方法 未定'}{p.shipping_arranger === 'factory' ? '・工場手配' : p.shipping_arranger === 'partner' ? '・提携業者' : ''}</span>
                    {p.sample_required && <span className={pill + ' bg-[#D7EFFF] text-[#33566F]'}>サンプルあり</span>}
                    {p.food_inspection_required && <span className={pill + ' bg-[#D7EFFF] text-[#33566F]'}>食品検査あり</span>}
                    {vs.length > 1 && <span className={pill + ' border border-[#E2E1DA] bg-[#EFEFEA] text-[#351E28]'}>仕様案 {vs.length}件（1件目を表示）</span>}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    <span className="mr-1 text-[11px] text-[#84787D]">数量</span>
                    {qs.map(q => <span key={q} className={pill + ' !text-[12.5px] bg-[#EFEFEA] border border-[#E2E1DA] text-[#351E28] tabular-nums'}>{fmt(q)}</span>)}
                    {!qs.length && <span className={pill + ' bg-[#FFD8C2] text-[#B03616]'}>数量が未登録です</span>}
                  </div>
                  {(notes || p.product_memo) && <p className="mt-2 text-[12px] text-[#351E28] break-words">{notes && <span className="block"><span className="text-[#84787D]">自由記入: </span>{notes}</span>}{p.product_memo && <span className="block"><span className="text-[#84787D]">備考: </span>{p.product_memo}</span>}</p>}
                </div>
                {!readOnly && <div className="flex flex-shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-start">
                  {products.length > 1 && <span className="flex gap-1">
                    <button type="button" aria-label={`${i + 1}番目の商品を上へ`} disabled={pending || i === 0 || !!editor} onClick={() => move(p.id, i - 1)} className={ghost + ' !px-0 w-[44px]'}>↑</button>
                    <button type="button" aria-label={`${i + 1}番目の商品を下へ`} disabled={pending || i === products.length - 1 || !!editor} onClick={() => move(p.id, i + 1)} className={ghost + ' !px-0 w-[44px]'}>↓</button>
                  </span>}
                  <button type="button" onClick={() => open('edit', p)} className={ghost} aria-label={`${i + 1}番目の商品を編集`}><Pencil className="h-3.5 w-3.5" aria-hidden="true" />編集</button>
                  <button type="button" onClick={() => open('copy', p)} className={ghost} aria-label={`${i + 1}番目の商品をコピー`}><Copy className="h-3.5 w-3.5" aria-hidden="true" />コピー</button>
                  <button type="button" onClick={() => setConfirm(p)} disabled={pending} aria-label={`${i + 1}番目の商品を削除`} className={ghost + ' !border-[#FF5C34] !text-[#B03616] !px-0 w-[44px]'}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                </div>}
              </div>
              {isEditing && editor && <div className="border-t border-[#E2E1DA] p-3 sm:p-4">
                <ProductForm key={editor.key} dealId={dealId} productId={p.id} initial={editor.initial} catalog={catalog} options={options} title={`${i + 1}番目の商品を編集`}
                  onCancel={() => setEditor(null)} onSaved={() => { setEditor(null); toast('商品を保存しました'); router.refresh() }} />
              </div>}
            </li>
          )
        })}
      </ol>
      {!products.length && !editor && <div className="rounded-[16px] border border-dashed border-[#E2E1DA] p-6 text-center text-[13px]">商品はまだありません</div>}

      {editor && editor.mode !== 'edit' && (
        <ProductForm key={editor.key} dealId={dealId} productId={null} initial={editor.initial} catalog={catalog} options={options}
          title={editor.mode === 'copy' ? 'コピーして追加' : '商品を追加'}
          onCancel={() => setEditor(null)} onSaved={name => { setEditor(null); toast(`「${name}」を登録しました`); router.refresh() }} />
      )}
      {!readOnly && !editor && products.length > 0 && <button type="button" onClick={() => open('new')} className={ghost + ' w-full !rounded-[16px] border-dashed'}>＋ 商品を追加</button>}

      {confirm && (
        <div role="dialog" aria-modal="true" aria-label="削除の確認" className="fixed inset-0 z-[70] flex items-center justify-center bg-[#351E28]/40 p-4">
          <div className="w-full max-w-[440px] rounded-[16px] border border-[#E2E1DA] bg-white p-4 shadow-[0_20px_50px_rgba(53,30,40,.12)]">
            <p className="text-[15px] font-bold">この商品を削除しますか？</p>
            <p className="mt-2 text-[13px] break-words">{confirm.description}</p>
            <p className="mt-1 text-[12.5px] text-[#84787D]">元に戻せません。</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={ghost} onClick={() => setConfirm(null)}>やめる</button>
              <button type="button" className={ghost + ' !border-[#FF5C34] !text-[#B03616]'} onClick={() => remove(confirm)}>削除する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
