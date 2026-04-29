'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Search, FileText } from 'lucide-react'
import {
  type SimpleStatus,
  SIMPLE_STATUS_CONFIG,
  SIMPLE_STATUS_ORDER,
} from '@/lib/types'
import { formatJPY, formatUSD, formatDate } from '@/lib/utils/format'
import { InlineCell } from './inline-cell'
import { DocumentModal } from '@/components/documents/document-modal'
import {
  updateDealField,
  updateVariantField,
  updateQuoteField,
} from '@/lib/actions/inline-edit'

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
  sales_user_id: string | null
}

interface ProductRow {
  id: string
  deal_id: string
  product_no: number
  description: string
  factory_staff_code: string | null
  is_selected: boolean
}

interface VariantRow {
  id: string
  product_id: string
  variant_label: string
  width_mm: number | null
  height_mm: number | null
  depth_mm: number | null
  material: string | null
  print_color_count: string | null
  pcs_per_carton: number | null
  gross_weight_kg: number | null
  is_selected: boolean
}

interface QuoteRow {
  id: string
  deal_id: string
  variant_id: string | null
  spec_id: string | null
  version: number | null
  quantity: number | null
  moq: number | null
  factory_unit_price_usd: number | null
  exchange_rate: number | null
  cost_ratio: number | null
  selling_price_jpy: number | null
  total_billing_jpy: number | null
  total_billing_tax_jpy: number | null
  shipping_weight_kg: number | null
  status: string | null
}

interface Props {
  deals: DealRow[]
  products: ProductRow[]
  variants: VariantRow[]
  quotes: QuoteRow[]
}

interface FlatRow {
  rowKey: string
  deal: DealRow
  product: ProductRow | null
  variant: VariantRow | null
  quote: QuoteRow | null
}

export function DealsExcelTable({ deals, products, variants, quotes }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentStatus = searchParams.get('status') || 'all'
  const currentSearch = searchParams.get('q') || ''
  const [searchValue, setSearchValue] = useState(currentSearch)
  const [docModalDealId, setDocModalDealId] = useState<string | null>(null)

  const setParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (!value || value === 'all') params.delete(key)
    else params.set(key, value)
    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname)
  }

  // Flatten: 1 行 = 1 見積 (見積がない variant は variant 行、variant がない deal は deal 行)
  const rows: FlatRow[] = useMemo(() => {
    const productById = new Map(products.map((p) => [p.id, p]))
    const variantById = new Map(variants.map((v) => [v.id, v]))
    const quotesByVariant = new Map<string, QuoteRow[]>()
    for (const q of quotes) {
      if (!q.variant_id) continue
      const arr = quotesByVariant.get(q.variant_id) || []
      arr.push(q)
      quotesByVariant.set(q.variant_id, arr)
    }
    const variantsByProduct = new Map<string, VariantRow[]>()
    for (const v of variants) {
      const arr = variantsByProduct.get(v.product_id) || []
      arr.push(v)
      variantsByProduct.set(v.product_id, arr)
    }
    const productsByDeal = new Map<string, ProductRow[]>()
    for (const p of products) {
      const arr = productsByDeal.get(p.deal_id) || []
      arr.push(p)
      productsByDeal.set(p.deal_id, arr)
    }

    const out: FlatRow[] = []
    for (const deal of deals) {
      const ps = productsByDeal.get(deal.id) || []
      if (ps.length === 0) {
        out.push({ rowKey: `d-${deal.id}`, deal, product: null, variant: null, quote: null })
        continue
      }
      for (const product of ps) {
        const vs = variantsByProduct.get(product.id) || []
        if (vs.length === 0) {
          out.push({ rowKey: `p-${product.id}`, deal, product, variant: null, quote: null })
          continue
        }
        for (const variant of vs) {
          const qs = (quotesByVariant.get(variant.id) || []).sort((a, b) => (a.quantity || 0) - (b.quantity || 0))
          if (qs.length === 0) {
            out.push({ rowKey: `v-${variant.id}`, deal, product, variant, quote: null })
            continue
          }
          for (const quote of qs) {
            out.push({ rowKey: `q-${quote.id}`, deal, product, variant, quote })
          }
        }
      }
    }
    return out
  }, [deals, products, variants, quotes])

  return (
    <div className="bg-white border border-[rgba(0,0,0,0.06)] rounded-[14px] overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-3.5 py-2 border-b border-[rgba(0,0,0,0.06)] flex-wrap">
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
          <span className="text-[10px] text-[#888]">{rows.length} 行</span>
        </div>
      </div>

      {/* Excel-like table with horizontal scroll */}
      <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 240px)' }}>
        <table className="border-collapse text-[10px] font-body" style={{ fontVariantNumeric: 'tabular-nums', minWidth: 2200 }}>
          <thead className="sticky top-0 z-30 bg-[#fafaf9]">
            <tr>
              <Th sticky="left-0" w={70} bg>ID</Th>
              <Th sticky="left-[70px]" w={180} border bg>案件名</Th>
              <Th w={120} bg>クライアント</Th>
              <Th w={70} bg>担当 code</Th>
              <Th w={120} bg>商品</Th>
              <Th w={70} bg>バリエ</Th>
              <Th w={90} bg>サイズ mm</Th>
              <Th w={80} bg>素材</Th>
              <Th w={100} bg>印刷色数</Th>
              <Th w={70} bg align="right">PCS/CTN</Th>
              <Th w={60} bg align="right">G.W kg</Th>
              <Th w={70} bg align="right">数量</Th>
              <Th w={60} bg align="right">MOQ</Th>
              <Th w={80} bg align="right">単価USD</Th>
              <Th w={60} bg align="right">為替</Th>
              <Th w={60} bg align="right">掛け率</Th>
              <Th w={80} bg align="right">送料計算kg</Th>
              <Th w={90} bg align="right">単価JPY</Th>
              <Th w={100} bg align="right">税抜合計</Th>
              <Th w={100} bg align="right">税込合計</Th>
              <Th w={100} bg>ステータス</Th>
              <Th w={90} bg>納期</Th>
              <Th w={70} bg>更新</Th>
              <Th w={100} bg>アクション</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={24} className="text-center py-8 text-[12px] text-[#888]">
                  {currentStatus !== 'all' || currentSearch ? '条件に合う案件がありません' : 'まだ案件がありません'}
                </td>
              </tr>
            ) : (
              rows.map((r, i) => {
                const prevDealId = i > 0 ? rows[i - 1].deal.id : null
                const newDeal = r.deal.id !== prevDealId
                return (
                  <ExcelRow
                    key={r.rowKey}
                    row={r}
                    newDeal={newDeal}
                    onOpenDocs={() => setDocModalDealId(r.deal.id)}
                  />
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-3.5 py-2 border-t border-[rgba(0,0,0,0.06)] bg-[#fafaf9] text-[10px] text-[#888] font-body">
        <span>
          {deals.length} 案件 · {products.length} 商品 · {variants.length} バリエ ·{' '}
          {quotes.length} 見積 · {quotes.filter((q) => q.status === 'approved').length} 採用
        </span>
        <span className="text-[#888]">セルクリックで編集 (黄色枠) · Enter 確定 / Esc 取消</span>
      </div>

      {docModalDealId && <DocumentModal dealId={docModalDealId} onClose={() => setDocModalDealId(null)} />}
    </div>
  )
}

function ExcelRow({
  row,
  newDeal,
  onOpenDocs,
}: {
  row: FlatRow
  newDeal: boolean
  onOpenDocs: () => void
}) {
  const { deal, product, variant, quote } = row
  const cfg = SIMPLE_STATUS_CONFIG[deal.simple_status]
  const isApproved = quote?.status === 'approved'

  const rowBg = newDeal
    ? isApproved
      ? 'bg-[#f0fdf4] border-t-2 border-t-[#0a0a0a]'
      : 'bg-white border-t-2 border-t-[#0a0a0a]'
    : isApproved
      ? 'bg-[#f0fdf4]'
      : 'bg-white hover:bg-[#fafaf8]'

  const sizeStr =
    variant && variant.width_mm && variant.height_mm
      ? `${variant.width_mm}×${variant.height_mm}${variant.depth_mm ? `×${variant.depth_mm}` : ''}`
      : null

  return (
    <tr className={rowBg} style={{ height: 28 }}>
      {/* ID */}
      <Td sticky="left-0" w={70} bg={isApproved ? '#f0fdf4' : '#fff'} border>
        {newDeal && (
          <Link href={`/deals/${deal.id}`} className="text-[10px] text-[#888] no-underline hover:underline tabular-nums">
            {deal.deal_code}
          </Link>
        )}
      </Td>
      {/* 案件名 */}
      <Td sticky="left-[70px]" w={180} bg={isApproved ? '#f0fdf4' : '#fff'} border>
        {newDeal && (
          <InlineCell
            value={deal.deal_name}
            onSave={(v) => updateDealField(deal.id, 'deal_name', v)}
            placeholder="(未設定)"
          />
        )}
      </Td>
      {/* クライアント + 帳票ボタン */}
      <Td w={120}>
        {newDeal && (
          <div className="flex items-center gap-1">
            <InlineCell
              value={deal.client_name_text}
              onSave={(v) => updateDealField(deal.id, 'client_name_text', v)}
              placeholder="-"
              className="flex-1 truncate"
            />
            <button
              type="button"
              onClick={onOpenDocs}
              className="flex-shrink-0 inline-flex items-center text-[9px] text-[#0a0a0a] bg-white border border-[#e8e8e6] rounded-[3px] px-1 py-0.5 hover:bg-[#fafaf8]"
              title="帳票発行"
            >
              <FileText className="w-2.5 h-2.5" />
            </button>
          </div>
        )}
      </Td>
      {/* 担当 code */}
      <Td w={70}>
        {product && (
          <InlineCell
            value={product.factory_staff_code}
            onSave={() => Promise.resolve({ success: false, error: '商品 code は商品編集ページから' })}
            disabled
            placeholder="-"
          />
        )}
      </Td>
      {/* 商品 */}
      <Td w={120}>
        {product && (
          <span className="block px-1.5 py-0.5 text-[10px] truncate text-[#0a0a0a]">
            #{product.product_no} {product.description}
          </span>
        )}
      </Td>
      {/* バリエ */}
      <Td w={70}>
        {variant && (
          <InlineCell
            value={variant.variant_label}
            onSave={(v) => updateVariantField(variant.id, 'variant_label', v)}
            className={variant.is_selected ? 'text-[#22c55e] font-semibold' : ''}
          />
        )}
      </Td>
      {/* サイズ */}
      <Td w={90}>
        {variant && (
          <span className="block px-1.5 py-0.5 text-[10px] tabular-nums text-[#555]">{sizeStr || '-'}</span>
        )}
      </Td>
      {/* 素材 */}
      <Td w={80}>
        {variant && (
          <InlineCell
            value={variant.material}
            onSave={(v) => updateVariantField(variant.id, 'material', v)}
            placeholder="-"
          />
        )}
      </Td>
      {/* 印刷色数 */}
      <Td w={100}>
        {variant && (
          <InlineCell
            value={variant.print_color_count}
            onSave={(v) => updateVariantField(variant.id, 'print_color_count', v)}
            placeholder="-"
          />
        )}
      </Td>
      {/* PCS/CTN */}
      <Td w={70} align="right">
        {variant && (
          <InlineCell
            type="number"
            value={variant.pcs_per_carton}
            onSave={(v) => updateVariantField(variant.id, 'pcs_per_carton', v)}
            align="right"
            placeholder="-"
          />
        )}
      </Td>
      {/* G.W */}
      <Td w={60} align="right">
        {variant && (
          <InlineCell
            type="number"
            value={variant.gross_weight_kg}
            onSave={(v) => updateVariantField(variant.id, 'gross_weight_kg', v)}
            align="right"
            placeholder="-"
          />
        )}
      </Td>
      {/* 数量 */}
      <Td w={70} align="right">
        {quote ? (
          <InlineCell
            type="number"
            value={quote.quantity}
            onSave={(v) => updateQuoteField(quote.id, 'quantity', v)}
            format={(v) => (v != null ? Number(v).toLocaleString() : '')}
            align="right"
          />
        ) : (
          variant && (
            <Link
              href={`/deals/${deal.id}/products/${product?.id}/variants/${variant.id}/quotes/new`}
              className="block text-center text-[9px] text-[#22c55e] no-underline hover:underline px-1 py-0.5"
            >
              + 見積
            </Link>
          )
        )}
      </Td>
      {/* MOQ */}
      <Td w={60} align="right">
        {quote && (
          <InlineCell
            type="number"
            value={quote.moq}
            onSave={(v) => updateQuoteField(quote.id, 'moq', v)}
            align="right"
            placeholder="-"
          />
        )}
      </Td>
      {/* 単価USD */}
      <Td w={80} align="right">
        {quote && (
          <InlineCell
            type="number"
            value={quote.factory_unit_price_usd}
            onSave={(v) => updateQuoteField(quote.id, 'factory_unit_price_usd', v)}
            format={(v) => (v != null ? formatUSD(Number(v)) : '')}
            align="right"
          />
        )}
      </Td>
      {/* 為替 */}
      <Td w={60} align="right">
        {quote && (
          <InlineCell
            type="number"
            value={quote.exchange_rate}
            onSave={(v) => updateQuoteField(quote.id, 'exchange_rate', v)}
            align="right"
          />
        )}
      </Td>
      {/* 掛け率 */}
      <Td w={60} align="right">
        {quote && (
          <InlineCell
            type="number"
            value={quote.cost_ratio}
            onSave={(v) => updateQuoteField(quote.id, 'cost_ratio', v)}
            align="right"
          />
        )}
      </Td>
      {/* 送料計算kg */}
      <Td w={80} align="right">
        {quote && (
          <span className="block px-1.5 py-0.5 text-[#888] text-right tabular-nums">
            {quote.shipping_weight_kg != null ? `${quote.shipping_weight_kg}` : '-'}
          </span>
        )}
      </Td>
      {/* 単価JPY */}
      <Td w={90} align="right">
        {quote && (
          <span className="block px-1.5 py-0.5 text-[#0a0a0a] text-right tabular-nums">
            {quote.selling_price_jpy != null ? formatJPY(quote.selling_price_jpy) : '-'}
          </span>
        )}
      </Td>
      {/* 税抜合計 */}
      <Td w={100} align="right">
        {quote && (
          <span className="block px-1.5 py-0.5 text-[#0a0a0a] text-right tabular-nums">
            {quote.total_billing_jpy != null ? formatJPY(quote.total_billing_jpy) : '-'}
          </span>
        )}
      </Td>
      {/* 税込合計 */}
      <Td w={100} align="right">
        {quote && (
          <span className={`block px-1.5 py-0.5 text-right tabular-nums font-semibold ${isApproved ? 'text-[#22c55e]' : 'text-[#0a0a0a]'}`}>
            {quote.total_billing_tax_jpy != null ? formatJPY(quote.total_billing_tax_jpy) : '-'}
          </span>
        )}
      </Td>
      {/* ステータス */}
      <Td w={100}>
        {newDeal && (
          <span className="inline-flex items-center gap-1 text-[10px] text-[#555] px-1.5 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STEP_COLOR_MAP[cfg.color] }} />
            {cfg.label}
          </span>
        )}
      </Td>
      {/* 納期 */}
      <Td w={90}>
        {newDeal && (
          <InlineCell
            type="date"
            value={deal.desired_delivery_date}
            onSave={(v) => updateDealField(deal.id, 'desired_delivery_date', v)}
            format={(v) => (v ? formatDate(String(v)) : '')}
            placeholder="-"
          />
        )}
      </Td>
      {/* 更新 */}
      <Td w={70}>
        {newDeal && (
          <span className="block px-1.5 py-0.5 text-[10px] text-[#888] tabular-nums">
            {formatDate(deal.last_activity_at)}
          </span>
        )}
      </Td>
      {/* アクション */}
      <Td w={100}>
        {newDeal && (
          <div className="flex items-center gap-1.5 px-1.5">
            <Link href={`/deals/${deal.id}`} className="text-[9px] text-[#22c55e] no-underline hover:underline">
              詳細
            </Link>
            <button onClick={onOpenDocs} className="text-[9px] text-[#0a0a0a] inline-flex items-center gap-0.5 hover:underline">
              <FileText className="w-2.5 h-2.5" />帳票
            </button>
          </div>
        )}
      </Td>
    </tr>
  )
}

function Th({
  children,
  className,
  align,
  w,
  sticky,
  bg,
  border,
}: {
  children?: React.ReactNode
  className?: string
  align?: 'left' | 'right'
  w?: number
  sticky?: string
  bg?: boolean
  border?: boolean
}) {
  const stickyClass = sticky ? `sticky ${sticky} z-40` : ''
  return (
    <th
      className={`px-2 py-1.5 text-[9px] font-body font-medium text-[#888] uppercase tracking-[0.02em] border-b border-[rgba(0,0,0,0.08)] whitespace-nowrap ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${bg ? 'bg-[#fafaf9]' : ''} ${border ? 'border-r border-r-[rgba(0,0,0,0.08)]' : ''} ${stickyClass} ${className || ''}`}
      style={w ? { width: w, minWidth: w, maxWidth: w } : {}}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  className,
  align,
  w,
  sticky,
  bg,
  border,
}: {
  children?: React.ReactNode
  className?: string
  align?: 'left' | 'right'
  w?: number
  sticky?: string
  bg?: string
  border?: boolean
}) {
  const stickyClass = sticky ? `sticky ${sticky} z-10` : ''
  return (
    <td
      className={`border-b border-[rgba(0,0,0,0.04)] ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${border ? 'border-r border-r-[rgba(0,0,0,0.04)]' : ''} ${stickyClass} ${className || ''}`}
      style={{
        ...(w ? { width: w, minWidth: w, maxWidth: w } : {}),
        ...(bg ? { background: bg } : {}),
      }}
    >
      {children}
    </td>
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
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-body rounded-full ${
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
