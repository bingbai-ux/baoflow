'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { CatalogNode } from '@/lib/actions/catalog'
import type { DealProduct, DealProductVariant } from '@/lib/types'
import type { BuilderQuote } from './quote-builder'
import { SpecTable } from './spec-table'
import { ProductSpecEditor } from './product-spec-editor'

const button = 'min-h-[44px] rounded-full border border-[#E2E1DA] px-4 text-[12px] font-bold'
export function CaseProducts({ dealId, products, variants, quotes, catalog, onEditorChange }: { dealId: string; products: DealProduct[]; variants: DealProductVariant[]; quotes: BuilderQuote[]; catalog: CatalogNode[]; onEditorChange?: (editing: boolean) => void }) {
  const params = useSearchParams()
  const [selected, setSelected] = useState(params.get('product') || products[0]?.id || '')
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  useEffect(() => {
    onEditorChange?.(editing !== null)
    return () => onEditorChange?.(false)
  }, [editing, onEditorChange])
  useEffect(() => {
    const restore = () => setSelected(new URLSearchParams(window.location.search).get('product') || products[0]?.id || '')
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [products])
  const product = products.find(p => p.id === selected) || products[0]
  const select = (id: string) => {
    if (editing && !window.confirm('未保存の入力を閉じて別の商品を開きますか？')) return
    setEditing(null); setSelected(id)
    const url = new URL(window.location.href); url.searchParams.set('product', id)
    window.history.replaceState(null, '', url)
  }
  const start = (id: string | 'new') => {
    if (editing && !window.confirm('未保存の入力を閉じて新しい入力を始めますか？')) return
    setEditing(id)
  }
  const selectedVariants = variants.filter(v => v.product_id === product?.id)
  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-3 flex-wrap"><p className="text-[12px] text-[#84787D]">{products.length}商品 · {variants.length}仕様案 · 数量は各仕様の候補として登録</p><button type="button" onClick={() => start('new')} className={button}>商品を追加</button></div>
    <div className="grid lg:grid-cols-[220px_minmax(0,1fr)] gap-4">
      <nav aria-label="案件の商品" className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
        {products.map(p => {
          const vs = variants.filter(v => v.product_id === p.id)
          const quantityCount = quotes.filter(q => vs.some(v => v.id === q.variant_id) && q.quantity != null).length
          return <button key={p.id} type="button" aria-pressed={product?.id === p.id} onClick={() => select(p.id)} className={'shrink-0 lg:shrink min-w-[180px] lg:min-w-0 text-left rounded-card border px-3 py-3 ' + (product?.id === p.id ? 'border-[#351E28] bg-[#FBFAF6]' : 'border-[#E2E1DA] bg-white')}><span className="block text-[11px] text-[#84787D]">商品 {p.product_no}</span><span className="block text-[13px] font-bold break-words mt-1">{p.description}</span><span className="block text-[11px] text-[#84787D] mt-2">{vs.length ? `${vs.length}仕様案 · ${quantityCount}数量候補` : '仕様・数量が未登録'}</span></button>
        })}
        {!products.length && <p className="text-[12px] text-[#84787D]">商品が未登録です</p>}
      </nav>
      <div className="min-w-0 space-y-3">
        {editing ? <ProductSpecEditor key={editing} dealId={dealId} product={editing === 'new' ? null : products.find(p => p.id === editing) || null} catalog={catalog} onClose={() => setEditing(null)} /> : product ? <>
          <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-[15px] font-bold">{product.description}</h3><p className="text-[11px] text-[#84787D]">{[product.category_l1, product.category_l2, product.category_l3].filter(Boolean).join(' / ') || '分類未設定'}</p></div><button type="button" onClick={() => start(product.id)} className={button + (!selectedVariants.length ? ' bg-[#E9F056] text-[#666C14]' : ' bg-white')}>{selectedVariants.length ? '別の仕様案を追加' : '仕様・数量を入力'}</button></div>
          {selectedVariants.length ? <SpecTable dealId={dealId} products={[product]} variants={selectedVariants} quotes={quotes} hideProductNames /> : <div className="rounded-card border border-dashed border-[#E2E1DA] p-5 text-[13px]">サイズ・素材・印刷と数量候補を入力してください。まだ工場への依頼は作成されません。</div>}
        </> : <div className="rounded-card border border-dashed border-[#E2E1DA] p-5 text-[13px]">「商品を追加」から分類・仕様・数量を登録してください。</div>}
      </div>
    </div>
    <details className="text-[12px]"><summary className="min-h-[44px] flex items-center cursor-pointer text-[#84787D]">補助編集</summary><Link className="inline-flex min-h-[44px] items-center underline" href={`/deals?view=grid&selected=${dealId}`}>商品グリッドで詳細項目を編集</Link></details>
  </div>
}
