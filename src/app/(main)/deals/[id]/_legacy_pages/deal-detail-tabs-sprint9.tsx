'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Check, ChevronDown, ChevronRight } from 'lucide-react'
import { formatJPY, formatDate } from '@/lib/utils/format'
import {
  type SimpleStatus,
  SIMPLE_STATUS_CONFIG,
  type FoodGradeStatus,
  type DealProduct,
  type DealProductVariant,
} from '@/lib/types'
import { markProductSelected } from '@/lib/actions/products'
import { markVariantSelected } from '@/lib/actions/variants'
import { updateDealField } from '@/lib/actions/inline-edit'
import { DealCommunicationTab } from '@/components/deals/deal-communication-tab'
import { InlineCell } from '@/components/deals/inline-cell'
import type { DealCommunication } from '@/lib/types'

type TabId = 'basic' | 'products' | 'quotes' | 'images' | 'comm' | 'history'

interface DealLite {
  id: string
  deal_code: string
  deal_name: string | null
  client_name_text: string | null
  desired_delivery_date: string | null
  memo: string | null
  simple_status: SimpleStatus
  created_at: string
  last_activity_at: string
  sales_user?: { display_name: string | null } | null
}

export interface QuoteLite {
  id: string
  spec_id: string | null
  variant_id: string | null
  version: number | null
  quantity: number | null
  selling_price_jpy: number | null
  total_billing_jpy: number | null
  total_billing_tax_jpy: number | null
  status: string | null
  created_at: string
}

export interface FeeLite {
  id: string
  spec_id: string | null
  variant_id: string | null
  fee_type: string
  amount_jpy: number | null
  is_initial_only: boolean
  note: string | null
}

interface DesignFileLite {
  id: string
  storage_url: string | null
  file_name: string | null
  created_at: string
}

interface StatusHistoryLite {
  id: string
  from_simple_status: SimpleStatus | null
  to_simple_status: SimpleStatus | null
  changed_at: string
  note: string | null
  kind: string | null
  changer?: { display_name: string | null } | null
}

interface DealDetailTabsProps {
  deal: DealLite
  products: DealProduct[]
  variants: DealProductVariant[]
  quotes: QuoteLite[]
  fees: FeeLite[]
  designFiles: DesignFileLite[]
  statusHistory: StatusHistoryLite[]
  communications: DealCommunication[]
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'basic', label: '基本情報' },
  { id: 'products', label: '商品 / バリエーション' },
  { id: 'quotes', label: '見積一覧' },
  { id: 'images', label: '画像' },
  { id: 'comm', label: '通信' },
  { id: 'history', label: '履歴' },
]

const FEE_LABELS: Record<string, string> = {
  plate: '型代/版代',
  pantone: 'パントン色指定料',
  sample_make: 'サンプル製作',
  sample_ship: 'サンプル取寄せ',
  food_inspection: '食品検査',
  other: 'その他費用',
}

export function DealDetailTabs({
  deal,
  products,
  variants,
  quotes,
  fees,
  designFiles,
  statusHistory,
  communications,
}: DealDetailTabsProps) {
  const [active, setActive] = useState<TabId>('basic')
  const unreadComm = communications.filter((c) => !c.is_read).length

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-3 border-b border-[rgba(53,30,40,0.06)]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={`px-4 py-2 text-[13px] font-body transition-colors border-b-2 -mb-px ${
              active === tab.id
                ? 'border-[#351E28] text-[#351E28] font-semibold'
                : 'border-transparent text-[#84787D] hover:text-[#351E28]'
            }`}
          >
            {tab.label}
            {tab.id === 'products' && products.length > 0 && (
              <span className="ml-1.5 text-[10px] text-[#84787D]">{products.length}</span>
            )}
            {tab.id === 'quotes' && quotes.length > 0 && (
              <span className="ml-1.5 text-[10px] text-[#84787D]">{quotes.length}</span>
            )}
            {tab.id === 'images' && designFiles.length > 0 && (
              <span className="ml-1.5 text-[10px] text-[#84787D]">{designFiles.length}</span>
            )}
            {tab.id === 'comm' && communications.length > 0 && (
              <span className={`ml-1.5 text-[10px] ${unreadComm > 0 ? 'text-[#666C14] font-semibold' : 'text-[#84787D]'}`}>
                {communications.length}{unreadComm > 0 ? ` · ${unreadComm} 未読` : ''}
              </span>
            )}
          </button>
        ))}
      </div>

      {active === 'basic' && <BasicTab deal={deal} />}
      {active === 'products' && (
        <ProductsTab
          dealId={deal.id}
          products={products}
          variants={variants}
          quotes={quotes}
          fees={fees}
        />
      )}
      {active === 'quotes' && (
        <QuotesSummaryTab dealId={deal.id} products={products} variants={variants} quotes={quotes} />
      )}
      {active === 'images' && <ImagesTab dealId={deal.id} designFiles={designFiles} />}
      {active === 'comm' && (
        <DealCommunicationTab dealId={deal.id} initial={communications} />
      )}
      {active === 'history' && <HistoryTab statusHistory={statusHistory} />}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-[16px] border border-[rgba(53,30,40,0.06)] p-5">
      <h2 className="text-[13px] font-body font-semibold text-[#351E28] mb-3">{title}</h2>
      {children}
    </div>
  )
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 py-1.5">
      <span className="text-[11px] text-[#84787D] font-body w-28 flex-shrink-0">{label}</span>
      <span className="text-[13px] text-[#351E28] font-body">{value || '-'}</span>
    </div>
  )
}

function BasicTab({ deal }: { deal: DealLite }) {
  const editDeal = (field: string) => async (val: string) =>
    updateDealField(deal.id, field, val || null)
  return (
    <div className="space-y-3">
      <Section title="案件情報">
        <EditableRow label="案件名">
          <InlineCell value={deal.deal_name} onSave={editDeal('deal_name')} placeholder="案件名を入力" />
        </EditableRow>
        <EditableRow label="クライアント名">
          <InlineCell value={deal.client_name_text} onSave={editDeal('client_name_text')} placeholder="クライアント名を入力" />
        </EditableRow>
        <EditableRow label="希望納期">
          <InlineCell type="date" value={deal.desired_delivery_date} onSave={editDeal('desired_delivery_date')} />
        </EditableRow>
        <FieldRow label="担当スタッフ" value={deal.sales_user?.display_name} />
        <FieldRow label="作成日" value={formatDate(deal.created_at)} />
        <FieldRow label="最終更新" value={formatDate(deal.last_activity_at)} />
      </Section>
      <Section title="メモ">
        <InlineCell
          value={deal.memo}
          onSave={editDeal('memo')}
          placeholder="メモを入力 — クリックで編集"
        />
      </Section>
    </div>
  )
}

function EditableRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-2 py-1 border-b border-[rgba(53,30,40,0.03)] items-center">
      <span className="text-[10px] text-[#84787D] font-body">{label}</span>
      <div className="text-[12px]">{children}</div>
    </div>
  )
}

function HistoryTab({ statusHistory }: { statusHistory: StatusHistoryLite[] }) {
  const [kindFilter, setKindFilter] = useState<string>('all')
  const HISTORY_KINDS: Array<{ id: string; label: string; color: string }> = [
    { id: 'status', label: 'ステータス', color: '#351E28' },
    { id: 'edit', label: '編集', color: '#84787D' },
    { id: 'variant', label: 'バリエーション', color: '#666C14' },
    { id: 'attachment', label: '添付', color: '#B03616' },
    { id: 'comm', label: '通信', color: '#33566F' },
    { id: 'fee', label: '費用', color: '#84787D' },
  ]
  const counts: Record<string, number> = {}
  for (const h of statusHistory) {
    const k = h.kind || 'status'
    counts[k] = (counts[k] || 0) + 1
  }
  const filtered = kindFilter === 'all' ? statusHistory : statusHistory.filter((h) => (h.kind || 'status') === kindFilter)

  // group by date
  const byDate = new Map<string, StatusHistoryLite[]>()
  for (const h of filtered) {
    const date = formatDate(h.changed_at)
    const arr = byDate.get(date) || []
    arr.push(h)
    byDate.set(date, arr)
  }

  return (
    <Section title="履歴タイムライン">
      {/* Filter chips */}
      <div className="flex flex-wrap gap-1 mb-3">
        <button
          type="button"
          onClick={() => setKindFilter('all')}
          className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-body rounded-full ${
            kindFilter === 'all' ? 'bg-[#351E28] text-[#C9A2B8]' : 'bg-white text-[#351E28] border border-[#E2E1DA]'
          }`}
        >
          すべて <span className="tabular-nums opacity-70">{statusHistory.length}</span>
        </button>
        {HISTORY_KINDS.map((k) => {
          if ((counts[k.id] || 0) === 0) return null
          return (
            <button
              key={k.id}
              type="button"
              onClick={() => setKindFilter(k.id)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-body rounded-full ${
                kindFilter === k.id ? 'bg-[#351E28] text-[#C9A2B8]' : 'bg-white text-[#351E28] border border-[#E2E1DA]'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: k.color }} />
              {k.label}
              <span className="tabular-nums opacity-70">{counts[k.id]}</span>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-[12px] text-[#84787D] font-body text-center py-6">まだ履歴がありません</p>
      ) : (
        <div className="space-y-3">
          {Array.from(byDate.entries()).map(([date, items]) => (
            <div key={date}>
              <p className="text-[10px] font-body text-[#84787D] uppercase tracking-[0.06em] mb-1.5 tabular-nums">
                {date}
              </p>
              <ul className="space-y-1.5 border-l-2 border-[#EFEFEA] pl-3">
                {items.map((h) => {
                  const k = h.kind || 'status'
                  const kCfg = HISTORY_KINDS.find((x) => x.id === k)
                  const from = h.from_simple_status
                    ? SIMPLE_STATUS_CONFIG[h.from_simple_status]?.label
                    : null
                  const to = h.to_simple_status ? SIMPLE_STATUS_CONFIG[h.to_simple_status]?.label : null
                  return (
                    <li key={h.id} className="text-[11px] font-body relative -ml-[14px] pl-[14px]">
                      <span
                        className="absolute left-0 top-1.5 w-2 h-2 rounded-full ring-2 ring-white"
                        style={{ backgroundColor: kCfg?.color || '#84787D' }}
                      />
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-[9px] uppercase tracking-wider text-[#84787D]">
                          {kCfg?.label || k}
                        </span>
                        <span className="text-[#351E28]">
                          {from && to ? `${from} → ${to}` : to ? to : h.note || '-'}
                        </span>
                        {h.changer?.display_name && (
                          <span className="text-[10px] text-[#84787D]">by {h.changer.display_name}</span>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

function FoodBadge({ value }: { value: FoodGradeStatus | null | string }) {
  if (!value || value === '*') return null
  const cls = value === '●' ? 'bg-[#E9F056] text-[#666C14]' : 'bg-[#EFEFEA] text-[#84787D]'
  return (
    <span className={`${cls} text-[10px] px-1.5 py-0.5 rounded-full ml-1`}>{value}</span>
  )
}

function ProductsTab({
  dealId,
  products,
  variants,
  quotes,
  fees,
}: {
  dealId: string
  products: DealProduct[]
  variants: DealProductVariant[]
  quotes: QuoteLite[]
  fees: FeeLite[]
}) {
  if (products.length === 0) {
    return (
      <Section title="商品 / バリエーション">
        <div className="text-center py-8">
          <p className="text-[13px] text-[#84787D] font-body">まだ商品が登録されていません。</p>
          <Link
            href={`/deals?selected=${dealId}`}
            className="mt-3 inline-flex items-center gap-1 text-[12px] font-body text-[#666C14] no-underline hover:underline"
          >
            <Plus className="w-3 h-3" /> 商品を追加
          </Link>
        </div>
      </Section>
    )
  }

  return (
    <Section title="商品 / バリエーション">
      <ul className="space-y-3">
        {products.map((p) => {
          const productVariants = variants.filter((v) => v.product_id === p.id)
          const productFees = fees.filter((f) => f.spec_id == null && f.variant_id == null)
            // fee tied to no spec/variant; rare
          return (
            <ProductRow
              key={p.id}
              dealId={dealId}
              product={p}
              variants={productVariants}
              quotes={quotes}
              fees={fees.filter((f) => productVariants.some((v) => v.id === f.variant_id))}
              productLevelFees={productFees}
            />
          )
        })}
      </ul>
      <Link
        href={`/deals?selected=${dealId}`}
        className="mt-3 inline-flex items-center gap-1 text-[12px] font-body text-[#666C14] no-underline hover:underline"
      >
        <Plus className="w-3 h-3" /> 別の商品を追加
      </Link>
    </Section>
  )
}

function ProductRow({
  dealId,
  product,
  variants,
  quotes,
  fees,
  productLevelFees: _productLevelFees,
}: {
  dealId: string
  product: DealProduct
  variants: DealProductVariant[]
  quotes: QuoteLite[]
  fees: FeeLite[]
  productLevelFees: FeeLite[]
}) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(true)
  const [, startTransition] = useTransition()

  const toggleSelected = () => {
    startTransition(async () => {
      await markProductSelected(product.id, !product.is_selected)
      router.refresh()
    })
  }

  return (
    <li className={`border rounded-[12px] ${product.is_selected ? 'border-[#E9F056] bg-[rgba(233,240,86,0.28)]' : 'border-[#E2E1DA]'}`}>
      <div className="flex items-start justify-between gap-3 p-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-[#351E28] hover:text-[#351E28]"
            >
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            <span className="text-[10px] tabular-nums text-[#84787D]">#{product.product_no}</span>
            {product.factory_staff_code && (
              <span className="text-[10px] bg-[#351E28] text-[#C9A2B8] px-1.5 py-0.5 rounded-full">
                {product.factory_staff_code}
              </span>
            )}
            <span className="text-[14px] font-body font-semibold text-[#351E28]">
              {product.description}
            </span>
            {product.food_grade_status && (
              <span className="text-[10px] text-[#84787D]">food: <FoodBadge value={product.food_grade_status} /></span>
            )}
            {product.food_inspection_status && (
              <span className="text-[10px] text-[#84787D]">検査: <FoodBadge value={product.food_inspection_status} /></span>
            )}
            {product.is_selected && (
              <span className="text-[10px] bg-[#E9F056] text-[#666C14] px-1.5 py-0.5 rounded-full">採用</span>
            )}
          </div>
          {product.product_memo && (
            <p className="text-[11px] text-[#351E28] mt-1 ml-6 whitespace-pre-line">{product.product_memo}</p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={toggleSelected}
            className={`text-[11px] font-body px-2 py-1 rounded-[8px] inline-flex items-center gap-1 ${
              product.is_selected
                ? 'bg-white text-[#351E28] border border-[#E2E1DA]'
                : 'bg-[#E9F056] text-[#666C14]'
            }`}
          >
            {product.is_selected ? '採用解除' : <><Check className="w-3 h-3" /> 採用</>}
          </button>
          <Link
            href={`/deals?selected=${dealId}`}
            className="text-[11px] font-body text-[#666C14] no-underline hover:underline px-2 py-1"
          >
            編集
          </Link>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[#E2E1DA] p-3 space-y-2">
          {variants.length === 0 ? (
            <div className="text-center py-3">
              <p className="text-[12px] text-[#84787D] font-body">バリエーションがありません</p>
              <Link
                href={`/deals?selected=${dealId}`}
                className="mt-1 inline-flex items-center gap-1 text-[11px] font-body text-[#666C14] no-underline hover:underline"
              >
                <Plus className="w-3 h-3" /> バリエーションを追加
              </Link>
            </div>
          ) : (
            <>
              {variants.map((v) => (
                <VariantRow
                  key={v.id}
                  dealId={dealId}
                  productId={product.id}
                  variant={v}
                  quotes={quotes.filter((q) => q.variant_id === v.id)}
                  fees={fees.filter((f) => f.variant_id === v.id)}
                />
              ))}
              <Link
                href={`/deals?selected=${dealId}`}
                className="inline-flex items-center gap-1 text-[11px] font-body text-[#666C14] no-underline hover:underline pt-1"
              >
                <Plus className="w-3 h-3" /> バリエーションを追加
              </Link>
            </>
          )}
        </div>
      )}
    </li>
  )
}

function VariantRow({
  dealId,
  productId,
  variant,
  quotes,
  fees,
}: {
  dealId: string
  productId: string
  variant: DealProductVariant
  quotes: QuoteLite[]
  fees: FeeLite[]
}) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [, startTransition] = useTransition()

  const sizeStr =
    variant.width_mm && variant.height_mm
      ? `${variant.width_mm}×${variant.height_mm}${variant.depth_mm ? `×${variant.depth_mm}` : ''}mm`
      : null
  const summary = [variant.material, sizeStr, variant.print_color_count].filter(Boolean).join(' / ')
  const approvedQuote = quotes.find((q) => q.status === 'approved')

  const toggleSelected = () => {
    startTransition(async () => {
      await markVariantSelected(variant.id, !variant.is_selected)
      router.refresh()
    })
  }

  return (
    <div
      className={`rounded-[12px] border ${
        variant.is_selected ? 'border-[#E9F056] bg-[rgba(233,240,86,0.28)]' : 'border-[#EFEFEA] bg-[#FBFAF6]'
      }`}
    >
      <div className="flex items-start justify-between gap-3 p-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-[#351E28] hover:text-[#351E28]"
            >
              {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            <span className="text-[12px] font-body font-semibold text-[#351E28]">
              {variant.variant_label}
            </span>
            <span className="text-[10px] text-[#84787D]">{quotes.length} 見積</span>
            {variant.is_selected && (
              <span className="text-[10px] bg-[#E9F056] text-[#666C14] px-1.5 py-0.5 rounded-full">採用</span>
            )}
            {approvedQuote && (
              <span className="text-[10px] text-[#666C14]">
                ★ {approvedQuote.quantity?.toLocaleString()}個 / {formatJPY(approvedQuote.total_billing_tax_jpy ?? 0)}
              </span>
            )}
          </div>
          {summary && <p className="text-[11px] text-[#351E28] mt-0.5 ml-5">{summary}</p>}
          {variant.pcs_per_carton != null && (
            <p className="text-[10px] text-[#84787D] mt-0.5 ml-5">
              CTN: {variant.pcs_per_carton} pcs · {variant.carton_width_cm}×{variant.carton_height_cm}×{variant.carton_depth_cm}cm · G.W {variant.gross_weight_kg}kg
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={toggleSelected}
            className={`text-[10px] font-body px-1.5 py-0.5 rounded-[4px] ${
              variant.is_selected
                ? 'bg-white text-[#351E28] border border-[#E2E1DA]'
                : 'bg-[#E9F056] text-[#666C14]'
            }`}
          >
            {variant.is_selected ? '解除' : '採用'}
          </button>
          <Link
            href={`/deals?selected=${dealId}`}
            className="text-[10px] font-body text-[#666C14] hover:underline px-1"
          >
            編集
          </Link>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[#EFEFEA] p-2.5 ml-5 space-y-1">
          {fees.length > 0 && (
            <ul className="text-[11px] font-body text-[#351E28] space-y-0.5 mb-2">
              {fees.map((f) => (
                <li key={f.id}>
                  <span className="text-[#84787D]">{FEE_LABELS[f.fee_type] || f.fee_type}: </span>
                  <span className="tabular-nums text-[#351E28]">
                    {f.amount_jpy != null ? formatJPY(f.amount_jpy) : '-'}
                  </span>
                  {f.note && <span className="text-[#AEB8A0] ml-1">{f.note}</span>}
                </li>
              ))}
            </ul>
          )}
          {quotes.length === 0 ? (
            <p className="text-[11px] text-[#84787D]">見積なし</p>
          ) : (
            <ul className="space-y-1">
              {quotes.map((q) => (
                <li key={q.id} className={`text-[11px] font-body flex items-center justify-between gap-2 px-2 py-1 rounded ${q.status === 'approved' ? 'bg-[rgba(233,240,86,0.28)]' : 'bg-white'}`}>
                  <span className="tabular-nums">
                    v{q.version || 1} · {q.quantity?.toLocaleString() || '-'}個 · {q.selling_price_jpy != null ? formatJPY(q.selling_price_jpy) + '/個' : '-'}
                  </span>
                  <span className="tabular-nums font-semibold">
                    {q.total_billing_tax_jpy != null ? formatJPY(q.total_billing_tax_jpy) : '-'}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href={`/deals?selected=${dealId}`}
            className="inline-flex items-center gap-1 text-[11px] font-body text-[#666C14] no-underline hover:underline pt-1"
          >
            <Plus className="w-3 h-3" /> 数量別見積を追加
          </Link>
        </div>
      )}
    </div>
  )
}

function QuotesSummaryTab({
  dealId,
  products,
  variants,
  quotes,
}: {
  dealId: string
  products: DealProduct[]
  variants: DealProductVariant[]
  quotes: QuoteLite[]
}) {
  const productMap = new Map(products.map((p) => [p.id, p]))
  const variantMap = new Map(variants.map((v) => [v.id, v]))
  const approved = quotes.filter((q) => q.status === 'approved')

  return (
    <Section title="見積一覧">
      {quotes.length === 0 ? (
        <p className="text-[13px] text-[#84787D] font-body">まだ見積がありません。</p>
      ) : (
        <>
          {approved.length > 0 && (
            <div className="mb-4">
              <p className="text-[11px] text-[#84787D] font-body mb-2">採用済み ({approved.length})</p>
              <ul className="space-y-1.5">
                {approved.map((q) => {
                  const v = q.variant_id ? variantMap.get(q.variant_id) : null
                  const p = v ? productMap.get(v.product_id) : null
                  return (
                    <li
                      key={q.id}
                      className="flex items-center justify-between text-[12px] font-body bg-[rgba(233,240,86,0.28)] border border-[#E9F056] rounded-[12px] px-3 py-2"
                    >
                      <span>
                        <span className="text-[#666C14] bg-[#E9F056] text-[10px] px-1.5 py-0.5 rounded-full mr-2">採用</span>
                        {p?.description || '商品未設定'} · {v?.variant_label || '-'} · {q.quantity?.toLocaleString()}個
                      </span>
                      <span className="tabular-nums font-semibold">
                        {q.total_billing_tax_jpy != null ? formatJPY(q.total_billing_tax_jpy) : '-'}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
          <Link
            href={`/deals/${dealId}/quote`}
            className="text-[12px] font-body text-[#351E28] no-underline hover:underline"
          >
            すべての見積を見る ({quotes.length}) →
          </Link>
        </>
      )}
    </Section>
  )
}

function ImagesTab({
  dealId,
  designFiles,
}: {
  dealId: string
  designFiles: DesignFileLite[]
}) {
  return (
    <Section title="画像">
      {designFiles.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-[13px] text-[#84787D] font-body">まだ画像が登録されていません。</p>
          <Link
            href={`/deals?selected=${dealId}`}
            className="mt-2 inline-block text-[12px] font-body text-[#666C14] no-underline hover:underline"
          >
            画像をアップロード →
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {designFiles.map((f) =>
              f.storage_url ? (
                <a
                  key={f.id}
                  href={f.storage_url}
                  target="_blank"
                  rel="noreferrer"
                  className="block aspect-square bg-[#EFEFEA] rounded-[12px] overflow-hidden border border-[#E2E1DA]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.storage_url}
                    alt={f.file_name || ''}
                    className="w-full h-full object-cover"
                  />
                </a>
              ) : null
            )}
          </div>
          <Link
            href={`/deals?selected=${dealId}`}
            className="mt-3 inline-block text-[12px] font-body text-[#666C14] no-underline hover:underline"
          >
            画像を管理 →
          </Link>
        </>
      )}
    </Section>
  )
}
