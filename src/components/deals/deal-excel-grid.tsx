'use client'

// Excel-density inline-editable grid for one deal's variants × all 管理表たたき columns.
// Renders inside an expanded deal row (under DealsNestedTable). Each cell is
// directly editable via InlineCell — no need to navigate into a deal detail page.

import Link from 'next/link'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { InlineCell } from './inline-cell'
import {
  updateProductField,
  updateVariantField,
  updateQuoteField,
  updateQuoteSimpleField,
} from '@/lib/actions/inline-edit'
import { addBlankVariant } from '@/lib/actions/variants'
import { useUi } from '@/components/ui/ui-store'
import { VariantRowMenu } from './variant-row-menu'
import { ProductShippingPopover } from './product-shipping-popover'
import type { ProductRow, VariantRow, QuoteRow } from './deals-nested-table'

interface Props {
  dealId: string
  products: ProductRow[]
  variantsByProduct: Map<string, VariantRow[]>
  quotesByVariant: Map<string, QuoteRow[]>
  // Bug A (Sprint 7-2): expand 状態は親コンポーネント (DealsNestedTable) で一元管理。
  // 商品単位での展開/折り畳みをここで描画切り替えする。
  expandedProductIds: Set<string>
  onToggleProduct: (productId: string) => void
}

interface RowData {
  product: ProductRow
  variant: VariantRow
  // Pick the approved quote if any, otherwise the latest version, otherwise null
  quote: QuoteRow | null
  quotes: QuoteRow[]
}

const NUM = (v: number | string | null) => (v == null || v === '' ? '' : Number(v).toLocaleString())
const FIX = (n: number) => (v: number | string | null) =>
  v == null || v === '' ? '' : Number(v).toFixed(n)

// Per-product accent colors. Cycles by product_no so adjacent products are distinct.
// Light wash on the leftmost cell + a colored left border on the product header bar.
const PRODUCT_PALETTE = [
  { bar: '#22c55e', wash: '#f0fdf4' }, // green
  { bar: '#3b82f6', wash: '#eff6ff' }, // blue
  { bar: '#e5a32e', wash: '#fffbf2' }, // amber
  { bar: '#a855f7', wash: '#faf5ff' }, // purple
  { bar: '#ef4444', wash: '#fef2f2' }, // red
  { bar: '#06b6d4', wash: '#ecfeff' }, // cyan
]

// Sprint 7-3-2 仕様書 §2-2-2: food_grade / food_inspection_status の選択肢。
// 空文字 ('') を「未指定 (NULL に戻す)」として明示的に提供。
// '-' は Excel 原本の「明示的にナシ」マーク (NULL とは区別)。
const FOOD_FLAG_OPTIONS = [
  { value: '', label: '(未指定)' },
  { value: '-', label: '-' },
  { value: '*', label: '*' },
  { value: '●', label: '●' },
  { value: '同', label: '同' },
]

// Sprint 7-3-2 仕様書 §2-2-2: 工場担当者 code のサジェスト候補
const FACTORY_STAFF_CODES = ['AL', 'NA', 'JT', 'RI', 'RS', 'AS']

export function DealExcelGrid({
  dealId,
  products,
  variantsByProduct,
  quotesByVariant,
  expandedProductIds,
  onToggleProduct,
}: Props) {
  const sortedProducts = [...products].sort((a, b) => a.product_no - b.product_no)

  if (sortedProducts.length === 0) {
    return (
      <div className="bg-[#fafaf9] px-3.5 py-4 text-[12px] text-[#888]">
        商品/バリエーションがまだありません ·{' '}
        <Link
          href={`/deals/${dealId}/products/new`}
          className="text-[#22c55e] no-underline hover:underline"
        >
          + 追加
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-[#fafaf9] border-t border-b border-[rgba(0,0,0,0.06)]">
      <div className="overflow-x-auto">
        <table
          className="border-collapse text-[11px] font-body"
          style={{
            fontVariantNumeric: 'tabular-nums',
            tableLayout: 'fixed',
            minWidth: 2900,
          }}
        >
          <colgroup>
            {COLS.map((c) => (
              <col key={c.k} style={{ width: c.w }} />
            ))}
          </colgroup>
          <thead>
            {/* Group header row */}
            <tr className="bg-[#e8e7e2] text-[#444]">
              {GROUPS.map((g) => (
                <th
                  key={g.label}
                  colSpan={g.span}
                  className="px-2 py-1.5 text-[10px] uppercase tracking-[0.06em] font-semibold border-b-2 border-r border-[rgba(0,0,0,0.08)] text-center"
                >
                  {g.label}
                </th>
              ))}
            </tr>
            {/* Field header row */}
            <tr className="bg-[#f5f4f0] text-[#666]">
              {COLS.map((c) => (
                <th
                  key={c.k}
                  className={`px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.03em] border-b border-r border-[rgba(0,0,0,0.06)] whitespace-nowrap ${
                    c.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedProducts.map((p, pi) => {
              const palette = PRODUCT_PALETTE[pi % PRODUCT_PALETTE.length]
              const variants = variantsByProduct.get(p.id) || []
              const variantRows: RowData[] = variants.length === 0
                ? [{ product: p, variant: emptyVariant(p.id), quote: null, quotes: [] }]
                : variants.map((v) => {
                    const vQuotes = quotesByVariant.get(v.id) || []
                    const approved = vQuotes.find((q) => q.status === 'approved')
                    const latest = [...vQuotes].sort((a, b) => (b.version || 0) - (a.version || 0))[0] || null
                    return { product: p, variant: v, quote: approved || latest, quotes: vQuotes }
                  })
              return (
                <ProductBlock
                  key={p.id}
                  product={p}
                  rows={variantRows}
                  palette={palette}
                  isExpanded={expandedProductIds.has(p.id)}
                  onToggle={() => onToggleProduct(p.id)}
                />
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="px-3.5 py-2 border-t border-[rgba(0,0,0,0.06)] flex items-center gap-3 text-[11px]">
        <Link
          href={`/deals/${dealId}/products/new`}
          className="text-[#22c55e] no-underline hover:underline"
        >
          + 商品を追加
        </Link>
        <Link
          href={`/deals/${dealId}`}
          className="text-[#888] no-underline hover:text-[#0a0a0a] ml-auto"
        >
          詳細ページを開く →
        </Link>
      </div>
    </div>
  )
}

function ProductBlock({
  product,
  rows,
  palette,
  isExpanded,
  onToggle,
}: {
  product: ProductRow
  rows: RowData[]
  palette: { bar: string; wash: string }
  isExpanded: boolean
  onToggle: () => void
}) {
  const router = useRouter()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const variantCount = rows.filter((r) => r.variant.id).length

  // Bug B (Sprint 7-2): バリエーション追加ボタン。商品 ID を渡して空バリエ INSERT。
  // ラベルは "新規バリエ" のプレースホルダーで作成し、その場で InlineCell から編集可能。
  const handleAddVariant = () => {
    if (pending) return
    startTransition(async () => {
      const r = await addBlankVariant(product.id)
      if (r.error) {
        toast(r.error || 'バリエ追加に失敗しました', 'warn')
      } else {
        toast('新規バリエを追加しました')
        router.refresh()
      }
    })
  }

  return (
    <>
      {/* Product header banner — クリックで該当商品のバリエ行を toggle */}
      <tr style={{ background: palette.wash }}>
        <td
          colSpan={COLS.length}
          className="border-b-2 border-t border-[rgba(0,0,0,0.08)] px-3 py-2 cursor-pointer hover:brightness-95"
          style={{ borderLeft: `3px solid ${palette.bar}` }}
          onClick={onToggle}
        >
          <div className="flex items-center gap-3">
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-[#555]" />
            ) : (
              <ChevronRight className="w-3 h-3 text-[#555]" />
            )}
            <span
              className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-display font-bold text-white"
              style={{ background: palette.bar }}
            >
              {product.product_no}
            </span>
            <span className="text-[13px] font-body font-semibold text-[#0a0a0a]">
              {product.description || '(商品名未設定)'}
            </span>
            {product.factory_staff_code && (
              <span className="text-[10px] bg-[#0a0a0a] text-white px-1.5 py-0.5 rounded-[4px] font-display tracking-wider">
                {product.factory_staff_code}
              </span>
            )}
            <span className="text-[11px] text-[#888]">
              バリエ {variantCount} 件
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleAddVariant()
              }}
              disabled={pending}
              className="ml-auto inline-flex items-center gap-0.5 text-[10px] text-[#22c55e] hover:underline disabled:opacity-50"
              title="新しいバリエを追加 (Bug B: 旧 /products/.../variants/new ページの代替)"
            >
              <Plus className="w-2.5 h-2.5" />
              {pending ? '追加中…' : 'バリエ追加'}
            </button>
          </div>
        </td>
      </tr>
      {/* Variant rows — isExpanded=false の場合は隠す (バナーのみ残る) */}
      {isExpanded &&
        rows.map((r, idx) => (
          <tr
            key={r.variant.id || `empty-${product.id}-${idx}`}
            className={`hover:bg-[#fafaf9] ${idx % 2 === 0 ? 'bg-white' : 'bg-[#fdfcfa]'}`}
          >
            {COLS.map((c, ci) => (
              <td
                key={c.k}
                className="border-b border-r border-[rgba(0,0,0,0.05)] p-0 align-middle"
                style={ci === 0 ? { borderLeft: `3px solid ${palette.bar}` } : undefined}
              >
                <Cell col={c.k} row={r} />
              </td>
            ))}
          </tr>
        ))}
    </>
  )
}

function emptyVariant(productId: string): VariantRow {
  return {
    id: '',
    product_id: productId,
    variant_label: '',
    width_mm: null,
    height_mm: null,
    depth_mm: null,
    material: null,
    color_description: null,
    pantone_colors: null,
    processing: null,
    other_notes: null,
    print_color_count: null,
    print_method: null,
    pcs_per_carton: null,
    carton_width_cm: null,
    carton_height_cm: null,
    carton_depth_cm: null,
    gross_weight_kg: null,
    production_lead_days: null,
    shipping_lead_days: null,
    food_inspection_days: null,
    shipping_address: null,
    is_selected: false,
  }
}

function Cell({ col, row }: { col: ColKey; row: RowData }) {
  const { product: p, variant: v, quote: q } = row

  const productEdit = (field: string) => async (val: string) =>
    updateProductField(p.id, field, val || null)
  const variantEdit = (field: string) => async (val: string) =>
    v.id
      ? updateVariantField(v.id, field, val || null)
      : { success: false, error: 'バリエ未作成' }
  const quoteEdit = (field: string) => async (val: string) =>
    q ? updateQuoteField(q.id, field, val || null) : { success: false, error: '見積未作成' }
  const quoteSimpleEdit = (field: string) => async (val: string) =>
    q ? updateQuoteSimpleField(q.id, field, val || null) : { success: false, error: '見積未作成' }

  // Sprint 7-3-4: 全 InlineCell に dataCol を自動注入する thin wrapper。
  // これにより Enter で「次の行の同じ列」へフォーカス移動可能になる。
  const IC = (props: React.ComponentProps<typeof InlineCell>) => (
    <InlineCell {...props} dataCol={col} />
  )

  switch (col) {
    case 'product_no':
      return <Display>{`#${p.product_no}`}</Display>
    case 'product_code':
      return (
        <IC
          value={p.factory_staff_code}
          onSave={productEdit('factory_staff_code')}
          suggestions={FACTORY_STAFF_CODES}
        />
      )
    case 'process':
      return <IC value={p.production_process} onSave={productEdit('production_process')} />
    case 'food_grade':
      return (
        <IC
          type="select"
          value={p.food_grade_status}
          onSave={productEdit('food_grade_status')}
          options={FOOD_FLAG_OPTIONS}
        />
      )
    case 'food_check':
      return (
        <IC
          type="select"
          value={p.food_inspection_status}
          onSave={productEdit('food_inspection_status')}
          options={FOOD_FLAG_OPTIONS}
        />
      )
    case 'description':
      return <IC value={p.description} onSave={productEdit('description')} />
    case 'variant_label':
      return (
        <div className="group/vlabel flex items-center gap-1">
          <span className="flex-1 min-w-0">
            <IC value={v.variant_label} onSave={variantEdit('variant_label')} />
          </span>
          {v.id && (
            <span className="opacity-0 group-hover/vlabel:opacity-100 transition-opacity flex-shrink-0 pr-1">
              <VariantRowMenu
                variantId={v.id}
                isSelected={v.is_selected}
                variantLabel={v.variant_label || '(無名)'}
              />
            </span>
          )}
        </div>
      )
    case 'w':
      return <IC type="number" align="right" value={v.width_mm} onSave={variantEdit('width_mm')} />
    case 'h':
      return <IC type="number" align="right" value={v.height_mm} onSave={variantEdit('height_mm')} />
    case 'd':
      return <IC type="number" align="right" value={v.depth_mm} onSave={variantEdit('depth_mm')} />
    case 'material':
      return <IC value={v.material} onSave={variantEdit('material')} />
    case 'color':
      return <IC value={v.color_description} onSave={variantEdit('color_description')} />
    case 'pantone':
      return <IC value={v.pantone_colors} onSave={variantEdit('pantone_colors')} />
    case 'processing':
      return <IC value={v.processing} onSave={variantEdit('processing')} />
    case 'other':
      return <IC value={v.other_notes} onSave={variantEdit('other_notes')} />
    case 'print_colors':
      return <IC value={v.print_color_count} onSave={variantEdit('print_color_count')} />
    case 'print_method':
      return <IC value={v.print_method} onSave={variantEdit('print_method')} />
    case 'moq':
      return <IC type="number" align="right" value={q?.moq ?? null} onSave={quoteEdit('moq')} format={NUM} />
    case 'qty':
      return <IC type="number" align="right" value={q?.quantity ?? null} onSave={quoteEdit('quantity')} format={NUM} />
    case 'unit_usd':
      return <IC type="number" align="right" value={q?.factory_unit_price_usd ?? null} onSave={quoteEdit('factory_unit_price_usd')} format={FIX(3)} />
    case 'factory_freight':
      return <IC type="number" align="right" value={q?.factory_calculated_freight_usd ?? null} onSave={quoteSimpleEdit('factory_calculated_freight_usd')} format={FIX(2)} />
    case 'pcs_ctn':
      return <IC type="number" align="right" value={v.pcs_per_carton} onSave={variantEdit('pcs_per_carton')} format={NUM} />
    case 'ctns':
      // derived: qty / pcs_per_carton
      return <Display align="right">{q?.quantity && v.pcs_per_carton ? Math.ceil(q.quantity / v.pcs_per_carton).toLocaleString() : ''}</Display>
    case 'cw':
      return <IC type="number" align="right" value={v.carton_width_cm} onSave={variantEdit('carton_width_cm')} format={FIX(0)} />
    case 'ch':
      return <IC type="number" align="right" value={v.carton_height_cm} onSave={variantEdit('carton_height_cm')} format={FIX(0)} />
    case 'cd':
      return <IC type="number" align="right" value={v.carton_depth_cm} onSave={variantEdit('carton_depth_cm')} format={FIX(0)} />
    case 'gw':
      return <IC type="number" align="right" value={v.gross_weight_kg} onSave={variantEdit('gross_weight_kg')} format={FIX(2)} />
    case 'volumetric':
      return <Display align="right">{q?.china_freight_yuan && q.shipping_weight_kg ? FIX(2)(q.shipping_weight_kg) : ''}</Display>
    case 'china_yuan':
      return <Display align="right">{FIX(0)(q?.china_freight_yuan ?? null)}</Display>
    case 'china_usd':
      return <Display align="right">{FIX(2)(q?.china_freight_usd ?? null)}</Display>
    case 'domestic_usd':
      return <IC type="number" align="right" value={q?.domestic_china_freight_usd ?? null} onSave={quoteEdit('domestic_china_freight_usd')} format={FIX(2)} />
    case 'cost_ratio':
      return <IC type="number" align="right" value={q?.cost_ratio ?? null} onSave={quoteEdit('cost_ratio')} format={FIX(2)} />
    case 'unit_cost':
      return <Display align="right">{q?.unit_cost_usd ? `$${Number(q.unit_cost_usd).toFixed(3)}` : ''}</Display>
    case 'total_pretax':
      return <Display align="right">{q?.total_billing_jpy ? `¥${Number(q.total_billing_jpy).toLocaleString()}` : ''}</Display>
    case 'total_tax':
      return <Display align="right" green>{q?.total_billing_tax_jpy ? `¥${Number(q.total_billing_tax_jpy).toLocaleString()}` : ''}</Display>
    case 'plate_fee':
      return <IC type="number" align="right" value={q?.plate_fee_usd ?? null} onSave={quoteEdit('plate_fee_usd')} format={FIX(2)} />
    case 'pantone_fee':
      return <IC type="number" align="right" value={q?.pantone_color_fee_usd ?? null} onSave={quoteEdit('pantone_color_fee_usd')} format={FIX(2)} />
    case 'sample_make':
      return <IC type="number" align="right" value={q?.sample_cost_usd ?? null} onSave={quoteEdit('sample_cost_usd')} format={FIX(2)} />
    case 'sample_ship':
      return <IC type="number" align="right" value={q?.sample_shipping_usd ?? null} onSave={quoteEdit('sample_shipping_usd')} format={FIX(2)} />
    case 'food_fee':
      return <IC type="number" align="right" value={q?.food_inspection_fee_yuan ?? null} onSave={quoteSimpleEdit('food_inspection_fee_yuan')} format={FIX(0)} />
    case 'sample_make_days':
      return <IC type="number" align="right" value={q?.sample_production_days ?? null} onSave={quoteSimpleEdit('sample_production_days')} />
    case 'sample_ship_days':
      return <IC type="number" align="right" value={q?.sample_shipping_days ?? null} onSave={quoteSimpleEdit('sample_shipping_days')} />
    case 'prod_days':
      return <IC type="number" align="right" value={v.production_lead_days} onSave={variantEdit('production_lead_days')} />
    case 'ship_days':
      return <IC type="number" align="right" value={v.shipping_lead_days} onSave={variantEdit('shipping_lead_days')} />
    case 'food_days':
      return <IC type="number" align="right" value={v.food_inspection_days} onSave={variantEdit('food_inspection_days')} />
    case 'lead_total': {
      const n = (v.production_lead_days || 0) + (v.shipping_lead_days || 0) + (v.food_inspection_days || 0)
      return <Display align="right">{n > 0 ? n : ''}</Display>
    }
    case 'incoterm':
      return <IC value={q?.incoterm ?? null} onSave={quoteSimpleEdit('incoterm')} />
    case 'packing':
      return <IC value={q?.packing_info_text ?? null} onSave={quoteSimpleEdit('packing_info_text')} />
    case 'address':
      // Sprint 7-4-1: 商品レベルの納品先 (deal_products.shipping_address_*) に切替。
      // バリエ行ごとに表示すると同じ商品の中で何度も同じセルが出てしまうため、
      // 「最初のバリエ行のみ表示」「他のバリエ行は空欄 (継承)」とする視覚処理は将来検討。
      // Sprint 7-4-1 では各バリエ行で同じ product の納品先を表示・編集 (どこから開いても同じ結果)。
      return <ProductShippingPopover product={p} />
    default:
      return <Display>—</Display>
  }
}

function Display({
  children,
  align = 'left',
  green = false,
}: {
  children?: React.ReactNode
  align?: 'left' | 'right'
  green?: boolean
}) {
  return (
    <span
      className={`block px-1.5 py-1 text-[11px] ${align === 'right' ? 'text-right' : 'text-left'} ${
        green ? 'text-[#22c55e] font-display tabular-nums font-semibold' : 'text-[#0a0a0a]'
      }`}
    >
      {children || <span className="text-[#ccc]">—</span>}
    </span>
  )
}

type ColKey =
  | 'product_no'
  | 'product_code'
  | 'process'
  | 'food_grade'
  | 'food_check'
  | 'description'
  | 'variant_label'
  | 'w'
  | 'h'
  | 'd'
  | 'material'
  | 'color'
  | 'pantone'
  | 'processing'
  | 'other'
  | 'print_colors'
  | 'print_method'
  | 'moq'
  | 'qty'
  | 'unit_usd'
  | 'factory_freight'
  | 'pcs_ctn'
  | 'ctns'
  | 'cw'
  | 'ch'
  | 'cd'
  | 'gw'
  | 'volumetric'
  | 'china_yuan'
  | 'china_usd'
  | 'domestic_usd'
  | 'cost_ratio'
  | 'unit_cost'
  | 'total_pretax'
  | 'total_tax'
  | 'plate_fee'
  | 'pantone_fee'
  | 'sample_make'
  | 'sample_ship'
  | 'food_fee'
  | 'sample_make_days'
  | 'sample_ship_days'
  | 'prod_days'
  | 'ship_days'
  | 'food_days'
  | 'lead_total'
  | 'incoterm'
  | 'packing'
  | 'address'

interface ColumnDef {
  k: ColKey
  label: string
  w: number
  align?: 'left' | 'right'
}

const COLS: ColumnDef[] = [
  { k: 'product_no', label: '#', w: 36, align: 'right' },
  { k: 'product_code', label: 'code', w: 56 },
  { k: 'process', label: '製作プロセス', w: 110 },
  { k: 'food_grade', label: 'food grade', w: 70 },
  { k: 'food_check', label: '食品検査', w: 70 },
  { k: 'description', label: '商品名', w: 160 },
  { k: 'variant_label', label: 'バリエ', w: 80 },
  { k: 'w', label: 'W', w: 50, align: 'right' },
  { k: 'h', label: 'H', w: 50, align: 'right' },
  { k: 'd', label: 'D', w: 50, align: 'right' },
  { k: 'material', label: '素材', w: 120 },
  { k: 'color', label: '色', w: 100 },
  { k: 'pantone', label: 'パントン', w: 90 },
  { k: 'processing', label: '加工', w: 110 },
  { k: 'other', label: 'その他', w: 80 },
  { k: 'print_colors', label: '色数', w: 50, align: 'right' },
  { k: 'print_method', label: '印刷方法', w: 100 },
  { k: 'moq', label: 'MOQ', w: 70, align: 'right' },
  { k: 'qty', label: '数量', w: 80, align: 'right' },
  { k: 'unit_usd', label: '工場単価$', w: 80, align: 'right' },
  { k: 'factory_freight', label: '工場送料$', w: 80, align: 'right' },
  { k: 'pcs_ctn', label: 'PCS/CTN', w: 70, align: 'right' },
  { k: 'ctns', label: 'CTNS', w: 60, align: 'right' },
  { k: 'cw', label: 'CW', w: 50, align: 'right' },
  { k: 'ch', label: 'CH', w: 50, align: 'right' },
  { k: 'cd', label: 'CD', w: 50, align: 'right' },
  { k: 'gw', label: 'G.W', w: 60, align: 'right' },
  { k: 'volumetric', label: '容積重量', w: 70, align: 'right' },
  { k: 'china_yuan', label: 'いーうー元', w: 80, align: 'right' },
  { k: 'china_usd', label: 'いーうー$', w: 80, align: 'right' },
  { k: 'domestic_usd', label: '中国国内$', w: 80, align: 'right' },
  { k: 'cost_ratio', label: '掛率', w: 50, align: 'right' },
  { k: 'unit_cost', label: '単価', w: 70, align: 'right' },
  { k: 'total_pretax', label: '税抜合計', w: 100, align: 'right' },
  { k: 'total_tax', label: '税込合計', w: 100, align: 'right' },
  { k: 'plate_fee', label: '型代$', w: 70, align: 'right' },
  { k: 'pantone_fee', label: 'パン代$', w: 70, align: 'right' },
  { k: 'sample_make', label: 'サン製作$', w: 80, align: 'right' },
  { k: 'sample_ship', label: 'サン取寄$', w: 80, align: 'right' },
  { k: 'food_fee', label: '食検元', w: 70, align: 'right' },
  { k: 'sample_make_days', label: 'サン日', w: 60, align: 'right' },
  { k: 'sample_ship_days', label: '発送日', w: 60, align: 'right' },
  { k: 'prod_days', label: '製造日', w: 60, align: 'right' },
  { k: 'ship_days', label: '配送日', w: 60, align: 'right' },
  { k: 'food_days', label: '検査日', w: 60, align: 'right' },
  { k: 'lead_total', label: 'LT合計', w: 60, align: 'right' },
  { k: 'incoterm', label: 'Incoterm', w: 70 },
  { k: 'packing', label: '梱包メモ', w: 140 },
  { k: 'address', label: '納品先', w: 200 },
]

const GROUPS: Array<{ label: string; span: number }> = [
  { label: '商品', span: 6 },
  { label: 'バリエ・サイズ', span: 4 },
  { label: '素材・色・印刷', span: 7 },
  { label: '数量・単価', span: 4 },
  { label: 'カートン・物流', span: 11 },
  { label: '価格', span: 4 },
  { label: '別途費用', span: 5 },
  { label: 'リードタイム', span: 6 },
  { label: '配送', span: 3 },
]
