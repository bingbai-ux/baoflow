'use client'

import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { ChevronDown, ChevronRight, Search, AlertCircle, FileText } from 'lucide-react'
import { DocumentModal } from '@/components/documents/document-modal'
import { DealExcelGrid } from './deal-excel-grid'
import { DealPaneToggle } from './deal-pane-host'
import { InlineCell } from './inline-cell'
import { DealStatusDropdown } from './deal-status-dropdown'
import { updateDealField } from '@/lib/actions/inline-edit'
import { setDealsTableColumnWidths } from '@/lib/actions/user-preferences'
import {
  type SimpleStatus,
  SIMPLE_STATUS_CONFIG,
  SIMPLE_STATUS_ORDER,
} from '@/lib/types'
import { formatJPY, formatDate } from '@/lib/utils/format'

type ColKey =
  | 'expand'
  | 'id'
  | 'name'
  | 'client'
  | 'status'
  | 'amount'
  | 'delivery'
  | 'updated'
  | 'products'
  | 'quotes'
  | 'action'

interface ColumnDef {
  key: ColKey
  label: string
  width: number
  minWidth: number
  align?: 'left' | 'right'
  resizable?: boolean
}

const DEFAULT_COLUMNS: ColumnDef[] = [
  { key: 'expand', label: '', width: 40, minWidth: 28, resizable: false },
  { key: 'id', label: 'ID', width: 100, minWidth: 60 },
  { key: 'name', label: '案件名', width: 260, minWidth: 120 },
  { key: 'client', label: 'クライアント', width: 160, minWidth: 100 },
  { key: 'status', label: 'ステータス', width: 110, minWidth: 80 },
  { key: 'amount', label: '採用合計', width: 100, minWidth: 70, align: 'right' },
  { key: 'delivery', label: '納期', width: 90, minWidth: 60 },
  { key: 'updated', label: '更新', width: 90, minWidth: 60 },
  { key: 'products', label: '商品', width: 60, minWidth: 40, align: 'right' },
  { key: 'quotes', label: '見積', width: 60, minWidth: 40, align: 'right' },
  { key: 'action', label: '', width: 60, minWidth: 40, resizable: false },
]

const STORAGE_KEY = 'deals-nested-table:column-widths'

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
  production_process: string | null
  food_grade_status: string | null
  food_inspection_status: string | null
  product_memo: string | null
  is_selected: boolean
}

export interface VariantRow {
  id: string
  product_id: string
  variant_label: string
  width_mm: number | null
  height_mm: number | null
  depth_mm: number | null
  material: string | null
  color_description: string | null
  pantone_colors: string | null
  processing: string | null
  other_notes: string | null
  print_color_count: string | null
  print_method: string | null
  pcs_per_carton: number | null
  carton_width_cm: number | null
  carton_height_cm: number | null
  carton_depth_cm: number | null
  gross_weight_kg: number | null
  production_lead_days: number | null
  shipping_lead_days: number | null
  food_inspection_days: number | null
  shipping_address: string | null
  is_selected: boolean
}

export interface QuoteRow {
  id: string
  deal_id: string
  variant_id: string | null
  spec_id: string | null
  version: number | null
  quantity: number | null
  moq: number | null
  factory_unit_price_usd: number | null
  plate_fee_usd: number | null
  pantone_color_fee_usd: number | null
  sample_cost_usd: number | null
  sample_shipping_usd: number | null
  other_fees_usd: number | null
  domestic_china_freight_usd: number | null
  factory_calculated_freight_usd: number | null
  food_inspection_fee_yuan: number | null
  china_freight_yuan: number | null
  china_freight_usd: number | null
  exchange_rate: number | null
  cost_ratio: number | null
  selling_price_usd: number | null
  selling_price_jpy: number | null
  unit_cost_usd: number | null
  total_cost_usd: number | null
  total_billing_jpy: number | null
  total_billing_tax_jpy: number | null
  shipping_weight_kg: number | null
  incoterm: string | null
  packing_info_text: string | null
  sample_production_days: number | null
  sample_shipping_days: number | null
  status: string | null
}

interface DealsNestedTableProps {
  deals: DealRow[]
  products: ProductRow[]
  variants: VariantRow[]
  quotes: QuoteRow[]
  selectedDealId?: string | null
  // Sprint 7-3-3: server side で fetch した列幅 (user_preferences.deals_table_column_widths)
  serverColWidths?: Record<string, number> | null
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
  selectedDealId,
  serverColWidths,
}: DealsNestedTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const selectDeal = (dealId: string) => {
    const p = new URLSearchParams(searchParams.toString())
    p.set('selected', dealId)
    router.push(`${pathname}?${p.toString()}`, { scroll: false })
  }

  const currentStatus = searchParams.get('status') || 'all'
  const currentSearch = searchParams.get('q') || ''
  const [searchValue, setSearchValue] = useState(currentSearch)

  // Bug A 修正 (Sprint 7-2): expand 状態を 3 階層独立管理。
  // 旧 allCollapsed は全階層を強制 collapse していたため、再展開時に商品が出ない症状の根本原因だった。
  // 仕様書 §2-3 Bug A の通り、deal / product / variant の 3 セットを top-level で持つ。
  const [expandedDealIds, setExpandedDealIds] = useState<Set<string>>(new Set())
  const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(new Set())
  const [expandedVariantIds, setExpandedVariantIds] = useState<Set<string>>(new Set())

  // 「全バリエ閉じる」: variant 階層 (= product 配下のバリエ行 + 将来の variant 詳細) のみ閉じる。
  // deal / client 階層は維持されるので、Excel グリッドは開いたままで products 行のバナーだけが残る。
  const collapseAllVariants = useCallback(() => {
    setExpandedProductIds(new Set())
    setExpandedVariantIds(new Set())
  }, [])

  // 案件行の ▶ クリック: deal を展開する場合、その配下の product 全てを expandedProductIds にも追加
  // (初回展開時はバリエ行も自動表示。ユーザーが個別に閉じれば次回からは閉じたまま)
  const toggleDealExpanded = useCallback((dealId: string, productIdsToSeed: string[]) => {
    setExpandedDealIds((prev) => {
      const next = new Set(prev)
      if (next.has(dealId)) {
        next.delete(dealId)
      } else {
        next.add(dealId)
        if (productIdsToSeed.length > 0) {
          setExpandedProductIds((p) => {
            const np = new Set(p)
            for (const id of productIdsToSeed) np.add(id)
            return np
          })
        }
      }
      return next
    })
  }, [])

  const toggleProductExpanded = useCallback((productId: string) => {
    setExpandedProductIds((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }, [])

  // Sprint 7-3-3: 列幅の優先順 1) サーバー (user_preferences) → 2) localStorage → 3) デフォルト
  const [colWidths, setColWidths] = useState<Record<ColKey, number>>(() => {
    const init = {} as Record<ColKey, number>
    for (const c of DEFAULT_COLUMNS) init[c.key] = c.width
    // 1) サーバーから受け取った値を最優先で適用 (SSR で既に分かっている)
    if (serverColWidths) {
      for (const c of DEFAULT_COLUMNS) {
        const v = serverColWidths[c.key]
        if (typeof v === 'number' && v >= c.minWidth) init[c.key] = v
      }
    }
    return init
  })

  // 2) localStorage fallback (server に値がない初回ユーザー or オフライン時)
  useEffect(() => {
    if (serverColWidths && Object.keys(serverColWidths).length > 0) return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as Partial<Record<ColKey, number>>
      setColWidths((prev) => {
        const next = { ...prev }
        for (const c of DEFAULT_COLUMNS) {
          const v = saved[c.key]
          if (typeof v === 'number' && v >= c.minWidth) next[c.key] = v
        }
        return next
      })
    } catch {}
  }, [serverColWidths])

  // Sprint 7-3-3: localStorage への即時保存 + DB への非同期 upsert (fire-and-forget)。
  // ネット失敗時も localStorage が残っているので次回開いた時はその値が使われる。
  const persistWidths = useCallback((next: Record<ColKey, number>) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {}
    // DB upsert は非同期、結果を待たない (UI を block しない)
    void setDealsTableColumnWidths(next as Record<string, number>).catch(() => {
      // 失敗時は localStorage 側で次回ロード時にも復元できるので silent
    })
  }, [])

  const dragRef = useRef<{ key: ColKey; startX: number; startWidth: number; min: number } | null>(null)

  const onResizeStart = useCallback(
    (key: ColKey, e: React.PointerEvent<HTMLSpanElement>) => {
      e.preventDefault()
      e.stopPropagation()
      const col = DEFAULT_COLUMNS.find((c) => c.key === key)
      if (!col) return
      dragRef.current = {
        key,
        startX: e.clientX,
        startWidth: colWidths[key],
        min: col.minWidth,
      }
      const onMove = (ev: PointerEvent) => {
        const drag = dragRef.current
        if (!drag) return
        const delta = ev.clientX - drag.startX
        const w = Math.max(drag.min, drag.startWidth + delta)
        setColWidths((prev) => ({ ...prev, [drag.key]: w }))
      }
      const onUp = () => {
        document.removeEventListener('pointermove', onMove)
        document.removeEventListener('pointerup', onUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        if (dragRef.current) {
          setColWidths((prev) => {
            persistWidths(prev)
            return prev
          })
        }
        dragRef.current = null
      }
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('pointermove', onMove)
      document.addEventListener('pointerup', onUp)
    },
    [colWidths, persistWidths]
  )

  const resetWidths = useCallback(() => {
    const init = {} as Record<ColKey, number>
    for (const c of DEFAULT_COLUMNS) init[c.key] = c.width
    setColWidths(init)
    persistWidths(init)
  }, [persistWidths])

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

  // 帳票モーダル: 表の外に持ち上げて HTML を <tbody> 構造に閉じ込めない (hydration 安全)
  const [docModalDealId, setDocModalDealId] = useState<string | null>(null)

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
            onClick={collapseAllVariants}
            className="text-[11px] font-body text-[#555] border border-[#e8e8e6] rounded-[6px] px-2 py-1 bg-white hover:bg-[#fafaf8]"
            title="全商品のバリエを閉じる (案件・商品の見出しは維持)"
          >
            全バリエ閉じる
          </button>
          <button
            type="button"
            onClick={resetWidths}
            className="text-[11px] font-body text-[#555] border border-[#e8e8e6] rounded-[6px] px-2 py-1 bg-white hover:bg-[#fafaf8]"
            title="列幅をデフォルトに戻す"
          >
            列幅リセット
          </button>
          <DealPaneToggle />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        <table
          className="border-collapse text-[11px] font-body"
          style={{
            fontVariantNumeric: 'tabular-nums',
            tableLayout: 'fixed',
            width: DEFAULT_COLUMNS.reduce((s, c) => s + colWidths[c.key], 0),
          }}
        >
          <colgroup>
            {DEFAULT_COLUMNS.map((c) => (
              <col key={c.key} style={{ width: colWidths[c.key] }} />
            ))}
          </colgroup>
          <thead>
            <tr className="bg-[#fafaf9]">
              {DEFAULT_COLUMNS.map((c) => (
                <Th
                  key={c.key}
                  align={c.align}
                  resizable={c.resizable !== false}
                  onResizeStart={(e) => onResizeStart(c.key, e)}
                >
                  {c.label}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clientGroups.length === 0 ? (
              <tr>
                <td colSpan={DEFAULT_COLUMNS.length} className="text-center py-12 text-[12px] text-[#888]">
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
                  expandedDealIds={expandedDealIds}
                  expandedProductIds={expandedProductIds}
                  onToggleDeal={toggleDealExpanded}
                  onToggleProduct={toggleProductExpanded}
                  onOpenDocModal={setDocModalDealId}
                  onSelectDeal={selectDeal}
                  selectedDealId={selectedDealId}
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

      {/* 帳票モーダル: 表の外で render し、tbody/tr 直下に div を入れない */}
      {docModalDealId && (
        <DocumentModal dealId={docModalDealId} onClose={() => setDocModalDealId(null)} />
      )}
    </div>
  )
}

function Th({
  children,
  className,
  align,
  resizable,
  onResizeStart,
}: {
  children?: React.ReactNode
  className?: string
  align?: 'left' | 'right'
  resizable?: boolean
  onResizeStart?: (e: React.PointerEvent<HTMLSpanElement>) => void
}) {
  return (
    <th
      className={`relative px-2.5 py-2 text-[10px] font-body font-medium text-[#888] uppercase tracking-[0.02em] border-b border-[rgba(0,0,0,0.08)] whitespace-nowrap overflow-hidden text-ellipsis ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${className || ''}`}
    >
      {children}
      {resizable && onResizeStart && (
        <span
          onPointerDown={onResizeStart}
          onClick={(e) => e.stopPropagation()}
          className="absolute top-0 right-0 h-full w-[6px] cursor-col-resize select-none group flex items-center justify-center"
          aria-label="列幅をドラッグで変更"
          role="separator"
        >
          <span className="block w-px h-3/5 bg-[#e8e8e6] group-hover:bg-[#0a0a0a] group-active:bg-[#0a0a0a]" />
        </span>
      )}
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
  expandedDealIds,
  expandedProductIds,
  onToggleDeal,
  onToggleProduct,
  onOpenDocModal,
  onSelectDeal,
  selectedDealId,
}: {
  group: ClientGroup
  productsByDeal: Map<string, ProductRow[]>
  variantsByProduct: Map<string, VariantRow[]>
  quotesByDeal: Map<string, QuoteRow[]>
  quotesByVariant: Map<string, QuoteRow[]>
  expandedDealIds: Set<string>
  expandedProductIds: Set<string>
  onToggleDeal: (dealId: string, productIdsToSeed: string[]) => void
  onToggleProduct: (productId: string) => void
  onOpenDocModal: (dealId: string) => void
  onSelectDeal: (dealId: string) => void
  selectedDealId?: string | null
}) {
  // クライアント階層の expand/collapse はローカル state のまま (仕様書 §2-3 Bug A は deal/product/variant のみ言及)
  const [expanded, setExpanded] = useState(true)
  const visible = expanded
  const inProgress = group.deals.filter((d) => d.simple_status !== 'delivered').length
  const totalApproved = group.deals.reduce(
    (s, d) => s + approvedTotalForDeal(quotesByDeal.get(d.id) || []),
    0
  )

  // 帳票ボタン: 1案件なら直接、複数なら最新案件 (group.deals は last_activity_at desc)
  const primaryDealId = group.deals[0]?.id || null

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
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[12px] font-body font-semibold text-[#0a0a0a] truncate">
              {group.clientName}
            </span>
            <span className="text-[10px] text-[#888] flex-shrink-0">
              {group.deals.length} 件 · 進行中 {inProgress}
            </span>
            {primaryDealId && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenDocModal(primaryDealId)
                }}
                className="flex-shrink-0 inline-flex items-center gap-0.5 text-[10px] font-body text-[#0a0a0a] bg-white border border-[#e8e8e6] rounded-[4px] px-1.5 py-0.5 hover:bg-[#fafaf8]"
                title={
                  group.deals.length > 1
                    ? `見積書 / 請求書 / 納品書 / RFQ (最新案件: ${group.deals[0].deal_name || group.deals[0].deal_code})`
                    : '見積書 / 請求書 / 納品書 / RFQ'
                }
              >
                <FileText className="w-2.5 h-2.5" />
                帳票
              </button>
            )}
          </div>
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
            isExpanded={expandedDealIds.has(deal.id)}
            expandedProductIds={expandedProductIds}
            onToggleDeal={onToggleDeal}
            onToggleProduct={onToggleProduct}
            onSelectDeal={onSelectDeal}
            isSelected={selectedDealId === deal.id}
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
  isExpanded,
  expandedProductIds,
  onToggleDeal,
  onToggleProduct,
  onSelectDeal,
  isSelected,
}: {
  deal: DealRow
  products: ProductRow[]
  variantsByProduct: Map<string, VariantRow[]>
  quotes: QuoteRow[]
  quotesByVariant: Map<string, QuoteRow[]>
  isExpanded: boolean
  expandedProductIds: Set<string>
  onToggleDeal: (dealId: string, productIdsToSeed: string[]) => void
  onToggleProduct: (productId: string) => void
  onSelectDeal: (dealId: string) => void
  isSelected: boolean
}) {
  const visible = isExpanded
  const cfg = SIMPLE_STATUS_CONFIG[deal.simple_status]
  const approvedTax = approvedTotalForDeal(quotes)
  const dDays = daysUntil(deal.desired_delivery_date)
  const urgent = isUrgent(deal)
  const stale = isStale(deal)
  const overdue = dDays < 0 && deal.desired_delivery_date

  const baseBg = overdue
    ? 'bg-[#fef2f2] hover:bg-[#fde8e8]'
    : urgent
      ? 'bg-[#fffaf2] hover:bg-[#fff3e0]'
      : stale
        ? 'bg-[#fafaf9] hover:bg-[#f0f0ed]'
        : 'bg-white hover:bg-[#fafaf9]'
  const rowBg = isSelected
    ? 'bg-[#fff8e8] hover:bg-[#fff8e8] ring-1 ring-inset ring-[#e5a32e]'
    : baseBg

  return (
    <>
      <tr
        className={`${rowBg} cursor-pointer`}
        style={{ height: 30 }}
        onClick={() => onSelectDeal(deal.id)}
      >
        <td
          className="px-2 py-1 text-center cursor-pointer"
          onClick={(e) => {
            e.stopPropagation()
            onToggleDeal(deal.id, products.map((p) => p.id))
          }}
        >
          {visible ? (
            <ChevronDown className="w-2.5 h-2.5 text-[#888] inline" />
          ) : (
            <ChevronRight className="w-2.5 h-2.5 text-[#888] inline" />
          )}
        </td>
        <td className="px-2.5 py-1 text-[10px] tabular-nums text-[#888] truncate">{deal.deal_code}</td>
        <td className="px-1.5 py-0.5 truncate" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            {urgent && <span className="inline-block w-1 h-1 rounded-full bg-[#e5a32e] flex-shrink-0" />}
            <span className="flex-1 min-w-0">
              <InlineCell
                value={deal.deal_name}
                onSave={(val) => updateDealField(deal.id, 'deal_name', val || null)}
                placeholder="(案件名)"
                dataCol="deal_name"
              />
            </span>
          </div>
        </td>
        <td className="px-1.5 py-0.5 truncate" onClick={(e) => e.stopPropagation()}>
          <InlineCell
            value={deal.client_name_text}
            onSave={(val) => updateDealField(deal.id, 'client_name_text', val || null)}
            placeholder="(クライアント)"
            dataCol="client_name_text"
          />
        </td>
        <td className="px-1.5 py-0.5" onClick={(e) => e.stopPropagation()}>
          <DealStatusDropdown dealId={deal.id} current={deal.simple_status} />
        </td>
        <td className="px-2.5 py-1 text-right text-[11px] font-display tabular-nums text-[#22c55e]">
          {approvedTax > 0 ? formatJPY(approvedTax) : '-'}
        </td>
        <td className="px-1.5 py-0.5" onClick={(e) => e.stopPropagation()}>
          <InlineCell
            type="date"
            value={deal.desired_delivery_date}
            onSave={(val) => updateDealField(deal.id, 'desired_delivery_date', val || null)}
            placeholder="-"
            dataCol="desired_delivery_date"
          />
        </td>
        <td className="px-2.5 py-1 text-[10px] tabular-nums text-[#888]">
          {formatDate(deal.last_activity_at)}
        </td>
        <td className="px-2.5 py-1 text-right text-[10px] tabular-nums text-[#555]">{products.length}</td>
        <td className="px-2.5 py-1 text-right text-[10px] tabular-nums text-[#555]">{quotes.length}</td>
        <td className="px-2.5 py-1 text-right">
          <Link
            href={`/deals/${deal.id}`}
            className="text-[10px] text-[#22c55e] no-underline hover:underline"
            onClick={(e) => e.stopPropagation()}
            title="フルページで開く"
          >
            ↗
          </Link>
        </td>
      </tr>
      {visible && (
        <tr>
          <td colSpan={DEFAULT_COLUMNS.length} className="p-0 border-b border-[rgba(0,0,0,0.04)]">
            <DealExcelGrid
              dealId={deal.id}
              products={products}
              variantsByProduct={variantsByProduct}
              quotesByVariant={quotesByVariant}
              expandedProductIds={expandedProductIds}
              onToggleProduct={onToggleProduct}
            />
          </td>
        </tr>
      )}
    </>
  )
}

