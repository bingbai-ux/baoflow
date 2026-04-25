'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { ChevronDown, ChevronRight, Search, AlertCircle, FileText } from 'lucide-react'
import { DocumentModal } from '@/components/documents/document-modal'
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

function daysUntil(dateStr: string | null): number {
  if (!dateStr) return 9999
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

function isUrgent(deal: DealRow): boolean {
  if (deal.simple_status === 'delivered' || deal.simple_status === 'shipped') return false
  const d = daysUntil(deal.desired_delivery_date)
  return d >= 0 && d <= 14
}

function isStale(deal: DealRow): boolean {
  if (deal.simple_status === 'delivered') return false
  return daysSince(deal.last_activity_at) >= 5
}

function approvedTotalForDeal(quotes: QuoteRow[]): number {
  return quotes
    .filter((q) => q.status === 'approved')
    .reduce((sum, q) => sum + (Number(q.total_billing_tax_jpy) || 0), 0)
}

export function DealsNestedTable({
  deals,
  products,
  variants,
  quotes,
}: DealsNestedTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentStatus = searchParams.get('status') || 'all'
  const currentSearch = searchParams.get('q') || ''
  const [searchValue, setSearchValue] = useState(currentSearch)
  const [allCollapsed, setAllCollapsed] = useState(false)

  const setParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (!value || value === 'all') params.delete(key)
    else params.set(key, value)
    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname)
  }

  const urgentCount = deals.filter(isUrgent).length
  const staleCount = deals.filter(isStale).length

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
    <div className="bg-white border border-[rgba(0,0,0,0.06)] rounded-[14px] overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 border-b border-[rgba(0,0,0,0.06)] flex-wrap">
        <div className="flex flex-wrap gap-1">
          <FilterChip label="すべて" count={deals.length} active={currentStatus === 'all'} onClick={() => setParam('status', null)} />
          {SIMPLE_STATUS_ORDER.map((s) => {
            const c = deals.filter((d) => d.simple_status === s).length
            if (c === 0) return null
            return (
              <FilterChip
                key={s}
                label={SIMPLE_STATUS_CONFIG[s].label}
                count={c}
                active={currentStatus === s}
                onClick={() => setParam('status', s)}
              />
            )
          })}
          {urgentCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-body text-[#e5a32e] bg-[#fffaf2] border border-[#f5d7a8] rounded-full">
              <AlertCircle className="w-2.5 h-2.5" />
              納期 ≤14日 {urgentCount}
            </span>
          )}
          {staleCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-body text-[#888] bg-[#fafaf9] border border-[#e8e8e6] rounded-full">
              停滞 {staleCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#888]" />
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
              placeholder="検索..."
              className="pl-7 pr-2 py-1 text-[11px] font-body bg-white border border-[#e8e8e6] rounded-[6px] focus:outline-none focus:border-[#0a0a0a] w-44"
            />
          </div>
          <button
            type="button"
            onClick={() => setAllCollapsed((v) => !v)}
            className="text-[11px] font-body text-[#555] border border-[#e8e8e6] rounded-[6px] px-2 py-1 bg-white hover:bg-[#fafaf8]"
          >
            {allCollapsed ? '全展開' : '全折り畳み'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        <table className="w-full border-collapse text-[11px] font-body" style={{ fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr className="bg-[#fafaf9]">
              <Th className="w-10" />
              <Th className="w-[100px]">ID</Th>
              <Th className="w-[260px]">案件名</Th>
              <Th className="w-[140px]">クライアント</Th>
              <Th className="w-[110px]">ステータス</Th>
              <Th className="w-[90px]" align="right">採用合計</Th>
              <Th className="w-[80px]">納期</Th>
              <Th className="w-[80px]">更新</Th>
              <Th className="w-[60px]" align="right">商品</Th>
              <Th className="w-[60px]" align="right">見積</Th>
              <Th className="w-[60px]" />
            </tr>
          </thead>
          <tbody>
            {clientGroups.length === 0 ? (
              <tr>
                <td colSpan={11} className="text-center py-12 text-[12px] text-[#888]">
                  {currentStatus !== 'all' || currentSearch
                    ? '条件に合う案件がありません'
                    : 'まだ案件がありません'}
                  {currentStatus === 'all' && !currentSearch && (
                    <Link
                      href="/deals/new"
                      className="ml-2 text-[#22c55e] no-underline hover:underline"
                    >
                      最初の案件を作成 →
                    </Link>
                  )}
                </td>
              </tr>
            ) : (
              clientGroups.map((cg) => (
                <ClientGroupRows
                  key={cg.clientName}
                  group={cg}
                  productsByDeal={productsByDeal}
                  variantsByProduct={variantsByProduct}
                  quotesByDeal={quotesByDeal}
                  quotesByVariant={quotesByVariant}
                  forceCollapsed={allCollapsed}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3.5 py-2 border-t border-[rgba(0,0,0,0.06)] bg-[#fafaf9] text-[10px] text-[#888] font-body">
        <span>
          {clientGroups.length} クライアント · {deals.length} 案件 · {quotes.filter((q) => q.status === 'approved').length} 採用見積
        </span>
        <span className="tabular-nums font-display text-[#0a0a0a]">
          採用合計{' '}
          {formatJPY(deals.reduce((s, d) => s + approvedTotalForDeal(quotesByDeal.get(d.id) || []), 0))}
        </span>
      </div>
    </div>
  )
}

function Th({
  children,
  className,
  align,
}: {
  children?: React.ReactNode
  className?: string
  align?: 'left' | 'right'
}) {
  return (
    <th
      className={`px-2.5 py-2 text-[10px] font-body font-medium text-[#888] uppercase tracking-[0.02em] border-b border-[rgba(0,0,0,0.08)] whitespace-nowrap ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${className || ''}`}
    >
      {children}
    </th>
  )
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-body rounded-full transition-colors ${
        active
          ? 'bg-[#0a0a0a] text-white'
          : 'bg-white text-[#555] border border-[#e8e8e6] hover:bg-[#fafaf8]'
      }`}
    >
      <span>{label}</span>
      <span className="tabular-nums opacity-70">{count}</span>
    </button>
  )
}

function ClientGroupRows({
  group,
  productsByDeal,
  variantsByProduct,
  quotesByDeal,
  quotesByVariant,
  forceCollapsed,
}: {
  group: ClientGroup
  productsByDeal: Map<string, ProductRow[]>
  variantsByProduct: Map<string, VariantRow[]>
  quotesByDeal: Map<string, QuoteRow[]>
  quotesByVariant: Map<string, QuoteRow[]>
  forceCollapsed: boolean
}) {
  const [expanded, setExpanded] = useState(true)
  const visible = forceCollapsed ? false : expanded
  const inProgress = group.deals.filter((d) => d.simple_status !== 'delivered').length
  const totalApproved = group.deals.reduce(
    (s, d) => s + approvedTotalForDeal(quotesByDeal.get(d.id) || []),
    0
  )

  return (
    <>
      <tr
        className="bg-[#f5f5f4] cursor-pointer hover:bg-[#eeeeec]"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-2 py-1.5 text-center" style={{ height: 32 }}>
          {visible ? (
            <ChevronDown className="w-3 h-3 text-[#555] inline" />
          ) : (
            <ChevronRight className="w-3 h-3 text-[#555] inline" />
          )}
        </td>
        <td colSpan={8} className="px-2.5 py-1.5">
          <span className="text-[12px] font-body font-semibold text-[#0a0a0a]">{group.clientName}</span>
          <span className="ml-2 text-[10px] text-[#888]">
            {group.deals.length} 件 · 進行中 {inProgress}
          </span>
        </td>
        <td colSpan={2} className="px-2.5 py-1.5 text-right">
          <span className="text-[11px] font-display tabular-nums text-[#22c55e]">
            {formatJPY(totalApproved)}
          </span>
        </td>
      </tr>
      {visible &&
        group.deals.map((deal) => (
          <DealRowItem
            key={deal.id}
            deal={deal}
            products={productsByDeal.get(deal.id) || []}
            variantsByProduct={variantsByProduct}
            quotes={quotesByDeal.get(deal.id) || []}
            quotesByVariant={quotesByVariant}
            forceCollapsed={forceCollapsed}
          />
        ))}
    </>
  )
}

function DealRowItem({
  deal,
  products,
  variantsByProduct,
  quotes,
  quotesByVariant,
  forceCollapsed,
}: {
  deal: DealRow
  products: ProductRow[]
  variantsByProduct: Map<string, VariantRow[]>
  quotes: QuoteRow[]
  quotesByVariant: Map<string, QuoteRow[]>
  forceCollapsed: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [docModalOpen, setDocModalOpen] = useState(false)
  const visible = forceCollapsed ? false : expanded
  const cfg = SIMPLE_STATUS_CONFIG[deal.simple_status]
  const approvedTax = approvedTotalForDeal(quotes)
  const dDays = daysUntil(deal.desired_delivery_date)
  const urgent = isUrgent(deal)
  const stale = isStale(deal)
  const overdue = dDays < 0 && deal.desired_delivery_date

  const rowBg = overdue
    ? 'bg-[#fef2f2] hover:bg-[#fde8e8]'
    : urgent
      ? 'bg-[#fffaf2] hover:bg-[#fff3e0]'
      : stale
        ? 'bg-[#fafaf9] hover:bg-[#f0f0ed]'
        : 'bg-white hover:bg-[#fafaf9]'

  return (
    <>
      <tr className={rowBg} style={{ height: 30 }}>
        <td className="px-2 py-1 text-center cursor-pointer" onClick={() => setExpanded(!expanded)}>
          {visible ? (
            <ChevronDown className="w-2.5 h-2.5 text-[#888] inline" />
          ) : (
            <ChevronRight className="w-2.5 h-2.5 text-[#888] inline" />
          )}
        </td>
        <td className="px-2.5 py-1 text-[10px] tabular-nums text-[#888] truncate">{deal.deal_code}</td>
        <td className="px-2.5 py-1 truncate">
          <Link
            href={`/deals/${deal.id}`}
            className="text-[11px] text-[#0a0a0a] no-underline hover:underline truncate block"
          >
            {urgent && <span className="inline-block w-1 h-1 rounded-full bg-[#e5a32e] mr-1.5 align-middle" />}
            {deal.deal_name || '(未設定)'}
          </Link>
        </td>
        <td className="px-2.5 py-1 text-[10px] text-[#555] truncate">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="truncate flex-1">{deal.client_name_text || '-'}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setDocModalOpen(true)
              }}
              className="flex-shrink-0 inline-flex items-center gap-0.5 text-[9px] font-body text-[#0a0a0a] bg-white border border-[#e8e8e6] rounded-[3px] px-1.5 py-0.5 hover:bg-[#fafaf8]"
              title="見積書 / 請求書 / 納品書 / RFQ"
            >
              <FileText className="w-2.5 h-2.5" />
              帳票
            </button>
          </div>
        </td>
        <td className="px-2.5 py-1">
          <span className="inline-flex items-center gap-1 text-[10px] text-[#555]">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STEP_COLOR_MAP[cfg.color] }} />
            {cfg.label}
          </span>
        </td>
        <td className="px-2.5 py-1 text-right text-[11px] font-display tabular-nums text-[#22c55e]">
          {approvedTax > 0 ? formatJPY(approvedTax) : '-'}
        </td>
        <td className="px-2.5 py-1 text-[10px] tabular-nums text-[#888]">
          {deal.desired_delivery_date ? formatDate(deal.desired_delivery_date) : '-'}
        </td>
        <td className="px-2.5 py-1 text-[10px] tabular-nums text-[#888]">
          {formatDate(deal.last_activity_at)}
        </td>
        <td className="px-2.5 py-1 text-right text-[10px] tabular-nums text-[#555]">{products.length}</td>
        <td className="px-2.5 py-1 text-right text-[10px] tabular-nums text-[#555]">{quotes.length}</td>
        <td className="px-2.5 py-1 text-right">
          <Link href={`/deals/${deal.id}`} className="text-[10px] text-[#22c55e] no-underline hover:underline">
            開く
          </Link>
        </td>
      </tr>
      {docModalOpen && <DocumentModal dealId={deal.id} onClose={() => setDocModalOpen(false)} />}
      {visible && (
        <tr>
          <td colSpan={11} className="bg-[#fafaf9] px-3.5 py-2 border-b border-[rgba(0,0,0,0.04)]">
            {products.length === 0 ? (
              <p className="text-[10px] text-[#888]">商品がまだありません</p>
            ) : (
              <ul className="space-y-1">
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
          </td>
        </tr>
      )}
    </>
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
      className={`rounded ${
        product.is_selected
          ? 'bg-[#f0fdf4] border-l-2 border-[#22c55e]'
          : 'bg-white border-l-2 border-[#e8e8e6]'
      } pl-2`}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-2 py-1 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? (
            <ChevronDown className="w-2.5 h-2.5 text-[#888]" />
          ) : (
            <ChevronRight className="w-2.5 h-2.5 text-[#888]" />
          )}
          <span className="text-[10px] tabular-nums text-[#888]">#{product.product_no}</span>
          <span className="text-[11px] font-body font-semibold text-[#0a0a0a] truncate">
            {product.description}
          </span>
          {product.factory_staff_code && (
            <span className="text-[9px] bg-[#0a0a0a] text-white px-1 py-0.5 rounded-full">
              {product.factory_staff_code}
            </span>
          )}
          <span className="text-[10px] text-[#888]">{variants.length} バリエ</span>
        </div>
      </button>
      {expanded && variants.length > 0 && (
        <ul className="border-t border-[#f0f0ed] py-1 space-y-0.5 ml-2">
          {variants.map((v) => {
            const vQuotes = quotesByVariant.get(v.id) || []
            const approved = vQuotes.find((q) => q.status === 'approved')
            return (
              <li
                key={v.id}
                className="flex items-center justify-between gap-2 text-[10px] font-body py-0.5"
              >
                <span className="text-[#555]">
                  <span
                    className={`inline-block w-1.5 h-3 mr-1.5 align-middle ${
                      v.is_selected ? 'bg-[#22c55e]' : 'bg-[#e8e8e6]'
                    }`}
                  />
                  {v.variant_label}
                  <span className="text-[#bbb] ml-1">({vQuotes.length} 見積)</span>
                </span>
                {approved ? (
                  <span className="tabular-nums text-[#22c55e]">
                    ★ {approved.quantity?.toLocaleString()}個 / {formatJPY(approved.total_billing_tax_jpy ?? 0)}
                  </span>
                ) : (
                  <Link
                    href={`/deals/${dealId}/products/${product.id}/variants/${v.id}/quotes/new`}
                    className="text-[#22c55e] no-underline hover:underline"
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
