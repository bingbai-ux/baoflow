'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { ChevronDown, ChevronRight, Search, Plus } from 'lucide-react'
import {
  type SimpleStatus,
  SIMPLE_STATUS_CONFIG,
  SIMPLE_STATUS_ORDER,
} from '@/lib/types'
import { formatJPY, formatDate } from '@/lib/utils/format'

const STEP_COLOR_MAP: Record<string, string> = {
  pending: '#bbbbbb',
  confirmed: '#22c55e',
  warning: '#e5a32e',
  active: '#0a0a0a',
  shipping: '#888888',
}

interface DealRow {
  id: string
  deal_code: string
  deal_name: string | null
  client_name_text: string | null
  desired_delivery_date: string | null
  simple_status: SimpleStatus
  last_activity_at: string
}

export interface ProductRow {
  id: string
  deal_id: string
  product_no: number
  description: string
  factory_staff_code: string | null
  is_selected: boolean
}

export interface VariantRow {
  id: string
  product_id: string
  variant_label: string
  is_selected: boolean
}

export interface QuoteRow {
  id: string
  deal_id: string
  variant_id: string | null
  spec_id: string | null
  version: number | null
  quantity: number | null
  total_billing_jpy: number | null
  total_billing_tax_jpy: number | null
  status: string | null
}

interface DealsNestedTableProps {
  deals: DealRow[]
  products: ProductRow[]
  variants: VariantRow[]
  quotes: QuoteRow[]
}

interface ClientGroup {
  clientName: string
  deals: DealRow[]
}

export function DealsNestedTable({ deals, products, variants, quotes }: DealsNestedTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentStatus = searchParams.get('status') || 'all'
  const currentSearch = searchParams.get('q') || ''
  const [searchValue, setSearchValue] = useState(currentSearch)

  const setParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (!value || value === 'all') params.delete(key)
    else params.set(key, value)
    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname)
  }

  const productsByDeal = useMemo(() => {
    const map = new Map<string, ProductRow[]>()
    for (const p of products) {
      const arr = map.get(p.deal_id) || []
      arr.push(p)
      map.set(p.deal_id, arr)
    }
    return map
  }, [products])

  const variantsByProduct = useMemo(() => {
    const map = new Map<string, VariantRow[]>()
    for (const v of variants) {
      const arr = map.get(v.product_id) || []
      arr.push(v)
      map.set(v.product_id, arr)
    }
    return map
  }, [variants])

  const quotesByDeal = useMemo(() => {
    const map = new Map<string, QuoteRow[]>()
    for (const q of quotes) {
      const arr = map.get(q.deal_id) || []
      arr.push(q)
      map.set(q.deal_id, arr)
    }
    return map
  }, [quotes])

  const quotesByVariant = useMemo(() => {
    const map = new Map<string, QuoteRow[]>()
    for (const q of quotes) {
      if (!q.variant_id) continue
      const arr = map.get(q.variant_id) || []
      arr.push(q)
      map.set(q.variant_id, arr)
    }
    return map
  }, [quotes])

  const clientGroups: ClientGroup[] = useMemo(() => {
    const map = new Map<string, ClientGroup>()
    for (const d of deals) {
      const name = d.client_name_text || '(クライアント未設定)'
      if (!map.has(name)) map.set(name, { clientName: name, deals: [] })
      map.get(name)!.deals.push(d)
    }
    return Array.from(map.values()).sort((a, b) => a.clientName.localeCompare(b.clientName))
  }, [deals])

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-3 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          <FilterPill label="すべて" active={currentStatus === 'all'} onClick={() => setParam('status', null)} />
          {SIMPLE_STATUS_ORDER.map((s) => (
            <FilterPill
              key={s}
              label={SIMPLE_STATUS_CONFIG[s].label}
              active={currentStatus === s}
              onClick={() => setParam('status', s)}
            />
          ))}
        </div>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#888]" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                setParam('q', searchValue)
              }
            }}
            onBlur={() => {
              if (searchValue !== currentSearch) setParam('q', searchValue)
            }}
            placeholder="案件名・案件コード・クライアントで検索"
            className="w-full pl-9 pr-3 py-2 text-[13px] font-body bg-white border border-[#e8e8e6] rounded-[8px] focus:outline-none focus:border-[#0a0a0a]"
          />
        </div>
      </div>

      {clientGroups.length === 0 ? (
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-10 text-center">
          <p className="text-[13px] text-[#555] font-body">
            {currentStatus !== 'all' || currentSearch ? '条件に合う案件がありません' : 'まだ案件がありません'}
          </p>
          {currentStatus === 'all' && !currentSearch && (
            <Link
              href="/deals/new"
              className="mt-3 inline-flex items-center gap-1 text-[12px] font-body text-[#22c55e] no-underline hover:underline"
            >
              <Plus className="w-3 h-3" /> 最初の案件を作成
            </Link>
          )}
        </div>
      ) : (
        clientGroups.map((cg) => (
          <ClientGroupRow
            key={cg.clientName}
            group={cg}
            productsByDeal={productsByDeal}
            variantsByProduct={variantsByProduct}
            quotesByDeal={quotesByDeal}
            quotesByVariant={quotesByVariant}
          />
        ))
      )}
    </div>
  )
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-[12px] font-body transition-colors ${
        active
          ? 'bg-[#0a0a0a] text-white'
          : 'bg-white text-[#555] border border-[#e8e8e6] hover:bg-[#f5f5f4]'
      }`}
    >
      {label}
    </button>
  )
}

function approvedTotalForDeal(quotes: QuoteRow[]): number {
  return quotes
    .filter((q) => q.status === 'approved')
    .reduce((sum, q) => sum + (Number(q.total_billing_tax_jpy) || 0), 0)
}

function ClientGroupRow({
  group,
  productsByDeal,
  variantsByProduct,
  quotesByDeal,
  quotesByVariant,
}: {
  group: ClientGroup
  productsByDeal: Map<string, ProductRow[]>
  variantsByProduct: Map<string, VariantRow[]>
  quotesByDeal: Map<string, QuoteRow[]>
  quotesByVariant: Map<string, QuoteRow[]>
}) {
  const [expanded, setExpanded] = useState(true)
  const inProgress = group.deals.filter((d) => d.simple_status !== 'delivered').length
  const totalApprovedTax = group.deals.reduce(
    (sum, d) => sum + approvedTotalForDeal(quotesByDeal.get(d.id) || []),
    0
  )

  return (
    <section className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#fafaf8]"
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? <ChevronDown className="w-4 h-4 text-[#555]" /> : <ChevronRight className="w-4 h-4 text-[#555]" />}
          <span className="text-[15px] font-body font-semibold text-[#0a0a0a] truncate">
            {group.clientName}
          </span>
          <span className="text-[11px] text-[#888]">
            {group.deals.length} 件 · 進行中 {inProgress}
          </span>
        </div>
        <span className="text-[12px] font-body text-[#22c55e] tabular-nums whitespace-nowrap">
          {formatJPY(totalApprovedTax)}
        </span>
      </button>

      {expanded && (
        <ul className="border-t border-[#f0f0ed] divide-y divide-[#f0f0ed]">
          {group.deals.map((deal) => (
            <DealRowItem
              key={deal.id}
              deal={deal}
              products={productsByDeal.get(deal.id) || []}
              variantsByProduct={variantsByProduct}
              quotes={quotesByDeal.get(deal.id) || []}
              quotesByVariant={quotesByVariant}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function DealRowItem({
  deal,
  products,
  variantsByProduct,
  quotes,
  quotesByVariant,
}: {
  deal: DealRow
  products: ProductRow[]
  variantsByProduct: Map<string, VariantRow[]>
  quotes: QuoteRow[]
  quotesByVariant: Map<string, QuoteRow[]>
}) {
  const [expanded, setExpanded] = useState(false)
  const cfg = SIMPLE_STATUS_CONFIG[deal.simple_status]
  const approvedTax = approvedTotalForDeal(quotes)

  return (
    <li>
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-[#fafaf8]">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 min-w-0 flex-1 text-left"
        >
          {expanded ? <ChevronDown className="w-3.5 h-3.5 text-[#888]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#888]" />}
          <span className="text-[10px] tabular-nums text-[#888] flex-shrink-0">{deal.deal_code}</span>
          <span className="text-[13px] font-body text-[#0a0a0a] truncate">
            {deal.deal_name || '(案件名未設定)'}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-body text-[#555] flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STEP_COLOR_MAP[cfg.color] }} />
            {cfg.label}
          </span>
        </button>
        <div className="flex items-center gap-3 text-[11px] font-body text-[#888] flex-shrink-0">
          <span>{products.length} 商品</span>
          <span className="text-[#22c55e] tabular-nums">{formatJPY(approvedTax)}</span>
          <span className="text-[10px] tabular-nums">{formatDate(deal.last_activity_at)}</span>
          <Link
            href={`/deals/${deal.id}`}
            className="text-[#22c55e] no-underline hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            開く →
          </Link>
        </div>
      </div>

      {expanded && (
        <div className="bg-[#fafaf8] px-4 py-2 border-t border-[#f0f0ed]">
          {products.length === 0 ? (
            <p className="text-[11px] text-[#888] py-2">商品がまだありません。</p>
          ) : (
            <ul className="space-y-1.5">
              {products.map((p) => (
                <ProductRowItem
                  key={p.id}
                  dealId={deal.id}
                  product={p}
                  variants={variantsByProduct.get(p.id) || []}
                  quotesByVariant={quotesByVariant}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  )
}

function ProductRowItem({
  dealId,
  product,
  variants,
  quotesByVariant,
}: {
  dealId: string
  product: ProductRow
  variants: VariantRow[]
  quotesByVariant: Map<string, QuoteRow[]>
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <li
      className={`rounded-[8px] border ${product.is_selected ? 'border-[#22c55e] bg-[#f0fdf4]' : 'border-[#e8e8e6] bg-white'}`}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? <ChevronDown className="w-3 h-3 text-[#888]" /> : <ChevronRight className="w-3 h-3 text-[#888]" />}
          <span className="text-[10px] tabular-nums text-[#888]">#{product.product_no}</span>
          <span className="text-[12px] font-body font-semibold text-[#0a0a0a] truncate">{product.description}</span>
          {product.factory_staff_code && (
            <span className="text-[9px] bg-[#0a0a0a] text-white px-1 py-0.5 rounded-full">
              {product.factory_staff_code}
            </span>
          )}
          <span className="text-[10px] text-[#888]">{variants.length} バリエ</span>
        </div>
      </button>
      {expanded && variants.length > 0 && (
        <ul className="border-t border-[#f0f0ed] px-3 py-1.5 space-y-1">
          {variants.map((v) => {
            const vQuotes = quotesByVariant.get(v.id) || []
            const approved = vQuotes.find((q) => q.status === 'approved')
            return (
              <li key={v.id} className="flex items-center justify-between gap-2 text-[11px] font-body">
                <span className="text-[#555]">
                  {v.variant_label} <span className="text-[#bbb]">({vQuotes.length} 見積)</span>
                </span>
                {approved ? (
                  <span className="tabular-nums text-[#22c55e]">
                    ★ {approved.quantity?.toLocaleString()}個 / {formatJPY(approved.total_billing_tax_jpy ?? 0)}
                  </span>
                ) : (
                  <Link
                    href={`/deals/${dealId}/products/${product.id}/variants/${v.id}/quotes/new`}
                    className="text-[10px] text-[#22c55e] no-underline hover:underline"
                  >
                    + 見積追加
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </li>
  )
}
