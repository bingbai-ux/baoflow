'use client'

import { formatJPY, formatDate } from '@/lib/utils/format'
import {
  type CompanyInfoPhase1,
  type BankAccountPhase1,
  type FeeType,
  FEE_TYPE_LABELS,
} from '@/lib/types'

export type DocumentType = 'quotation' | 'invoice' | 'delivery_note' | 'rfq'

// Sprint 5/6: variant 経由でも動くよう拡張 (spec/variant 両対応)

export interface SpecLite {
  id: string
  product_name: string | null
  product_category: string | null
  height_mm: number | null
  width_mm: number | null
  depth_mm: number | null
  material_category: string | null
  print_colors: string | null
  printing_method: string | null
  processing_list: string[] | null
  specification_memo: string | null
}

export interface ProductLite {
  id: string
  product_no: number
  description: string
}

export interface VariantLite {
  id: string
  product_id: string
  variant_label: string
  width_mm: number | null
  height_mm: number | null
  depth_mm: number | null
  material: string | null
  pantone_colors: string | null
  print_color_count: string | null
  print_method: string | null
  processing: string | null
  pcs_per_carton: number | null
  carton_width_cm: number | null
  carton_height_cm: number | null
  carton_depth_cm: number | null
  gross_weight_kg: number | null
  production_lead_days: number | null
  shipping_lead_days: number | null
  food_inspection_days: number | null
  shipping_address: string | null
}

export interface QuoteLite {
  id: string
  spec_id: string | null
  variant_id: string | null
  version: number | null
  quantity: number | null
  moq: number | null
  selling_price_jpy: number | null
  total_billing_jpy: number | null
  total_billing_tax_jpy: number | null
  status: string | null
  cost_ratio: number | null
}

export interface FeeLite {
  id: string
  spec_id: string | null
  variant_id: string | null
  fee_type: FeeType
  amount_jpy: number | null
  is_initial_only: boolean
  note: string | null
}

interface DealLite {
  id: string
  deal_code: string
  deal_name: string | null
  client_name_text: string | null
  desired_delivery_date: string | null
}

export interface DocumentMeta {
  documentNumber: string
  paymentDueDate?: string | null
  notes?: string | null
  shippingDate?: string | null
  shippingAddress?: string | null
}

interface TemplateProps {
  type: DocumentType
  deal: DealLite
  specs: SpecLite[]
  products: ProductLite[]
  variants: VariantLite[]
  quotes: QuoteLite[]
  fees: FeeLite[]
  company: CompanyInfoPhase1 | null
  banks: BankAccountPhase1[] | null
  meta: DocumentMeta
}

const TYPE_TITLE: Record<DocumentType, string> = {
  quotation: '見積書',
  invoice: '請求書',
  delivery_note: '納品書',
  rfq: 'Request for Quotation',
}

const TYPE_TITLE_SUB: Record<DocumentType, string> = {
  quotation: 'Quotation',
  invoice: 'Invoice',
  delivery_note: 'Delivery Note',
  rfq: '见积询价书',
}

export function DocumentTemplate(props: TemplateProps) {
  if (props.type === 'rfq') return <RfqTemplate {...props} />
  return <PricedTemplate {...props} />
}

function PricedTemplate({ type, deal, specs, products, variants, quotes, fees, company, banks, meta }: TemplateProps) {
  const today = formatDate(new Date().toISOString())
  const approved = quotes.filter((q) => q.status === 'approved')
  const lineItems = approved.length > 0 ? approved : quotes

  const specMap = new Map(specs.map((s) => [s.id, s]))
  const productMap = new Map(products.map((p) => [p.id, p]))
  const variantMap = new Map(variants.map((v) => [v.id, v]))

  const subtotal = lineItems.reduce((sum, q) => sum + (Number(q.total_billing_jpy) || 0), 0)
  const feesTotal = fees.reduce((sum, f) => sum + (Number(f.amount_jpy) || 0), 0)
  const taxableSubtotal = subtotal + feesTotal
  const tax = Math.ceil(taxableSubtotal * 0.10)
  const grandTotal = taxableSubtotal + tax

  // 同じ fee_type は1行にまとめる (型代・食品検査などが variant ごとに重複表示されないように)
  // is_initial_only も同じ key で集約 (どれか1つでも初回限定なら表示)
  type FeeGroup = {
    fee_type: FeeType
    total: number
    targets: string[] // バリエ/spec 名のリスト
    notes: string[]
    initialOnly: boolean
  }
  const feeGroups = (() => {
    const map = new Map<FeeType, FeeGroup>()
    for (const f of fees) {
      const key = f.fee_type
      if (!map.has(key)) {
        map.set(key, {
          fee_type: f.fee_type,
          total: 0,
          targets: [],
          notes: [],
          initialOnly: false,
        })
      }
      const g = map.get(key)!
      g.total += Number(f.amount_jpy) || 0
      const target = f.variant_id
        ? variantMap.get(f.variant_id)?.variant_label
        : f.spec_id
          ? specMap.get(f.spec_id)?.product_name
          : null
      if (target && !g.targets.includes(target)) g.targets.push(target)
      if (f.note && !g.notes.includes(f.note)) g.notes.push(f.note)
      if (f.is_initial_only) g.initialOnly = true
    }
    return Array.from(map.values())
  })()

  const describeQuote = (q: QuoteLite): { name: string; spec: string } => {
    if (q.variant_id) {
      const v = variantMap.get(q.variant_id)
      const p = v ? productMap.get(v.product_id) : null
      const sizeStr = v && v.width_mm && v.height_mm
        ? `${v.width_mm}×${v.height_mm}${v.depth_mm ? `×${v.depth_mm}` : ''}mm`
        : null
      return {
        name: `${p?.description || '商品'} (${v?.variant_label || ''})`,
        spec: [v?.material, sizeStr, v?.print_color_count].filter(Boolean).join(' / ') || '-',
      }
    }
    if (q.spec_id) {
      const s = specMap.get(q.spec_id)
      const sizeStr = s && s.height_mm && s.width_mm
        ? `${s.height_mm}×${s.width_mm}${s.depth_mm ? `×${s.depth_mm}` : ''}mm`
        : null
      return {
        name: s?.product_name || '商品',
        spec: [s?.product_category, s?.material_category, sizeStr].filter(Boolean).join(' / ') || '-',
      }
    }
    return { name: '案件全体', spec: '-' }
  }

  return (
    <article className="document-page bg-white text-[#0a0a0a] print:shadow-none shadow-md">
      <header className="flex items-start justify-between border-b-2 border-[#0a0a0a] pb-4 mb-6">
        <div>
          <h1 className="text-[32px] font-display font-semibold tracking-tight">{TYPE_TITLE[type]}</h1>
          <p className="text-[10px] text-[#888] font-body uppercase tracking-[0.08em] mt-1">{TYPE_TITLE_SUB[type]}</p>
          <p className="text-[11px] text-[#555] mt-2 tabular-nums">No. {meta.documentNumber}</p>
        </div>
        <div className="text-right text-[11px] text-[#555]">
          <p>発行日: <span className="tabular-nums text-[#0a0a0a]">{today}</span></p>
          {type === 'invoice' && meta.paymentDueDate && (
            <p className="mt-1">お支払期日: <span className="tabular-nums text-[#0a0a0a]">{formatDate(meta.paymentDueDate)}</span></p>
          )}
          {type === 'delivery_note' && meta.shippingDate && (
            <p className="mt-1">出荷日: <span className="tabular-nums text-[#0a0a0a]">{formatDate(meta.shippingDate)}</span></p>
          )}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-8 mb-6">
        <div>
          <p className="text-[14px] font-body font-semibold border-b border-[#e8e8e6] pb-1 mb-2">
            {deal.client_name_text || '(クライアント未設定)'} 御中
          </p>
          <p className="text-[12px] text-[#555]">案件: {deal.deal_name || '(案件名未設定)'}</p>
          <p className="text-[11px] text-[#888] tabular-nums">案件番号: {deal.deal_code}</p>
          {deal.desired_delivery_date && (
            <p className="text-[11px] text-[#888]">希望納期: {formatDate(deal.desired_delivery_date)}</p>
          )}
          {type === 'delivery_note' && (meta.shippingAddress || '') && (
            <div className="mt-3 pt-2 border-t border-[#f0f0ed]">
              <p className="text-[11px] text-[#888]">納品先</p>
              <p className="text-[12px] whitespace-pre-line">{meta.shippingAddress}</p>
            </div>
          )}
        </div>
        <div className="text-right">
          {company?.name && <p className="text-[13px] font-body font-semibold">{company.name}</p>}
          {company?.name_en && <p className="text-[11px] text-[#555]">{company.name_en}</p>}
          {company?.address && <p className="text-[11px] text-[#555] whitespace-pre-line mt-1">{company.address}</p>}
          {company?.phone && <p className="text-[11px] text-[#555] mt-1">TEL: {company.phone}</p>}
          {company?.email && <p className="text-[11px] text-[#555]">{company.email}</p>}
          {company?.registration_number && (
            <p className="text-[10px] text-[#888] mt-1">登録番号: {company.registration_number}</p>
          )}
          {company?.representative && <p className="text-[11px] text-[#555] mt-1">代表者: {company.representative}</p>}
        </div>
      </section>

      <section className="mb-6">
        <p className="text-[10px] uppercase tracking-wider text-[#888] mb-2">明細</p>
        <table className="w-full text-[11px] font-body border-collapse">
          <thead>
            <tr className="border-b-2 border-[#0a0a0a] text-[#555]">
              <th className="text-left py-1.5 pr-2">No.</th>
              <th className="text-left py-1.5 pr-2">品目</th>
              <th className="text-left py-1.5 pr-2">仕様</th>
              <th className="text-right py-1.5 pr-2">数量</th>
              <th className="text-right py-1.5 pr-2">単価</th>
              <th className="text-right py-1.5">金額 (税抜)</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((q, idx) => {
              const desc = describeQuote(q)
              return (
                <tr key={q.id} className="border-b border-[#e8e8e6] align-top">
                  <td className="py-2 pr-2 tabular-nums text-[#888]">{idx + 1}</td>
                  <td className="py-2 pr-2">{desc.name}</td>
                  <td className="py-2 pr-2 text-[10px] text-[#555]">{desc.spec}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{q.quantity?.toLocaleString() || '-'}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">
                    {q.selling_price_jpy != null ? formatJPY(q.selling_price_jpy) : '-'}
                  </td>
                  <td className="py-2 text-right tabular-nums font-semibold">
                    {q.total_billing_jpy != null ? formatJPY(q.total_billing_jpy) : '-'}
                  </td>
                </tr>
              )
            })}
            {feeGroups.map((g, idx) => {
              const targetSummary =
                g.targets.length === 0
                  ? null
                  : g.targets.length <= 3
                    ? g.targets.join(' / ')
                    : `${g.targets.slice(0, 3).join(' / ')} ほか ${g.targets.length - 3}件`
              return (
                <tr key={g.fee_type} className="border-b border-[#e8e8e6]">
                  <td className="py-2 pr-2 tabular-nums text-[#888]">{lineItems.length + idx + 1}</td>
                  <td className="py-2 pr-2">
                    {FEE_TYPE_LABELS[g.fee_type]}
                    {g.initialOnly && <span className="text-[10px] text-[#888] ml-1">(初回のみ)</span>}
                  </td>
                  <td className="py-2 pr-2 text-[10px] text-[#555]">
                    {targetSummary && <span>{targetSummary}</span>}
                    {g.notes.length > 0 && (
                      <span className="text-[#888]">
                        {targetSummary ? ' / ' : ''}{g.notes.join(' / ')}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-2 text-right text-[#888]">-</td>
                  <td className="py-2 pr-2 text-right text-[#888]">-</td>
                  <td className="py-2 text-right tabular-nums font-semibold">
                    {formatJPY(g.total)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section className="grid grid-cols-2 gap-6 mb-6">
        <div className="text-[10px] text-[#888]">
          {meta.notes && (
            <>
              <p className="uppercase tracking-wider mb-1">備考</p>
              <p className="text-[#555] whitespace-pre-line text-[11px]">{meta.notes}</p>
            </>
          )}
        </div>
        <div className="text-[12px] font-body">
          <div className="space-y-1">
            <Row label="商品小計 (税抜)" value={formatJPY(subtotal)} />
            {feesTotal > 0 && <Row label="別途費用" value={formatJPY(feesTotal)} />}
            <Row label="課税対象 (税抜)" value={formatJPY(taxableSubtotal)} />
            <Row label="消費税 (10%)" value={formatJPY(tax)} />
          </div>
          <div className="border-t-2 border-[#0a0a0a] mt-2 pt-2">
            <Row
              label={type === 'invoice' ? 'お支払金額 (税込)' : '合計 (税込)'}
              value={formatJPY(grandTotal)}
              large
              accent
            />
          </div>
        </div>
      </section>

      {type === 'invoice' && banks && banks.length > 0 && (
        <section className="border border-[#e8e8e6] rounded-[8px] p-3 mb-4">
          <p className="text-[11px] font-body font-semibold text-[#0a0a0a] mb-2">お振込先</p>
          <div className="grid grid-cols-2 gap-3 text-[11px] text-[#555]">
            {banks.map((b, i) => (
              <div key={i}>
                <p className="font-semibold text-[#0a0a0a]">{b.bank_name} {b.branch_name || ''}</p>
                <p className="tabular-nums">{b.account_type ? `${b.account_type} ` : ''}{b.account_number || ''}</p>
                {b.account_holder && <p>{b.account_holder}</p>}
                {b.swift_code && <p className="text-[10px] text-[#888]">SWIFT: {b.swift_code}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="text-center text-[9px] text-[#bbb] mt-8 pt-4 border-t border-[#f0f0ed]">
        Issued via BAO Flow · {today}
      </footer>
    </article>
  )
}

function RfqTemplate({ deal, products, variants, meta, company }: TemplateProps) {
  const today = formatDate(new Date().toISOString())
  // Group variants by product
  const byProduct = new Map<string, VariantLite[]>()
  for (const v of variants) {
    const arr = byProduct.get(v.product_id) || []
    arr.push(v)
    byProduct.set(v.product_id, arr)
  }

  return (
    <article className="document-page bg-white text-[#0a0a0a] print:shadow-none shadow-md">
      <header className="border-b-2 border-[#0a0a0a] pb-4 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[28px] font-display font-semibold tracking-tight">Request for Quotation</h1>
            <p className="text-[12px] text-[#555] font-body mt-0.5">见积询价书</p>
            <p className="text-[11px] text-[#555] mt-2 tabular-nums">No. {meta.documentNumber}</p>
          </div>
          <div className="text-right text-[11px] text-[#555]">
            <p>Date / 发出日: <span className="tabular-nums text-[#0a0a0a]">{today}</span></p>
            {deal.desired_delivery_date && (
              <p className="mt-1">Required Delivery / 期望交期: <span className="tabular-nums text-[#0a0a0a]">{formatDate(deal.desired_delivery_date)}</span></p>
            )}
          </div>
        </div>
      </header>

      <section className="mb-5 text-[11px] text-[#0a0a0a] font-body">
        <p className="font-semibold mb-1">Dear Supplier / 致供应商各位</p>
        <p className="text-[#555] leading-relaxed">
          Please review the product specifications below and provide your quotation including unit price (USD/FOB),
          MOQ, lead time, packaging, and payment terms.
        </p>
        <p className="text-[#555] leading-relaxed mt-1">
          请确认以下产品规格，并提供报价（单价 USD/FOB、起订量、交期、包装、付款条件）。
        </p>
      </section>

      <section className="mb-5 grid grid-cols-2 gap-6 text-[11px]">
        <div>
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#888] mb-1">From / 委托方</p>
          {company?.name ? (
            <>
              <p className="font-body font-semibold">{company.name}</p>
              {company.name_en && <p className="text-[#555]">{company.name_en}</p>}
              {company.email && <p className="text-[#555] mt-0.5">{company.email}</p>}
              {company.phone && <p className="text-[#555]">TEL: {company.phone}</p>}
            </>
          ) : (
            <p className="text-[#888]">(Please set company info)</p>
          )}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#888] mb-1">Project / 项目</p>
          <p className="font-body font-semibold">{deal.deal_name || '(Untitled project)'}</p>
          <p className="text-[#888] tabular-nums mt-0.5">Code: {deal.deal_code}</p>
        </div>
      </section>

      <section className="mb-5">
        <p className="text-[10px] uppercase tracking-wider text-[#888] mb-2">Items / 产品规格</p>
        {products.length === 0 ? (
          <p className="text-[11px] text-[#888]">No products registered.</p>
        ) : (
          <div className="space-y-3">
            {products.map((p) => {
              const vs = byProduct.get(p.id) || []
              return (
                <div key={p.id} className="border border-[#e8e8e6] rounded-[8px] p-3">
                  <p className="text-[12px] font-body font-semibold text-[#0a0a0a]">
                    #{p.product_no} {p.description}
                  </p>
                  {vs.length === 0 ? (
                    <p className="text-[11px] text-[#888] mt-1">No variants / 无规格</p>
                  ) : (
                    <table className="w-full text-[10px] font-body mt-2">
                      <thead>
                        <tr className="border-b border-[#e8e8e6] text-[#555]">
                          <th className="text-left py-1 pr-2">Variant / 规格</th>
                          <th className="text-left py-1 pr-2">Size (mm) / 尺寸</th>
                          <th className="text-left py-1 pr-2">Material / 材质</th>
                          <th className="text-left py-1 pr-2">Print / 印刷</th>
                          <th className="text-left py-1">Carton (cm) / 外箱 / G.W</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vs.map((v) => (
                          <tr key={v.id} className="border-b border-[#f0f0ed] align-top">
                            <td className="py-1.5 pr-2 font-semibold tabular-nums">{v.variant_label}</td>
                            <td className="py-1.5 pr-2 tabular-nums text-[#555]">
                              {v.width_mm && v.height_mm ? `${v.width_mm}×${v.height_mm}${v.depth_mm ? `×${v.depth_mm}` : ''}` : '-'}
                            </td>
                            <td className="py-1.5 pr-2 text-[#555]">{v.material || '-'}</td>
                            <td className="py-1.5 pr-2 text-[#555]">
                              {[v.print_method, v.print_color_count].filter(Boolean).join(' ') || '-'}
                            </td>
                            <td className="py-1.5 text-[#555] tabular-nums">
                              {v.carton_width_cm && v.carton_height_cm && v.carton_depth_cm
                                ? `${v.carton_width_cm}×${v.carton_height_cm}×${v.carton_depth_cm}`
                                : '-'}
                              {v.gross_weight_kg && ` / ${v.gross_weight_kg}kg`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="mb-5 border border-[#0a0a0a] rounded-[8px] p-3 text-[11px]">
        <p className="font-body font-semibold text-[#0a0a0a] mb-2">Please provide / 请提供</p>
        <ol className="list-decimal list-inside space-y-1 text-[#555]">
          <li>Unit price (USD, FOB Shanghai or other Incoterm) / 单价 (USD, FOB 上海等)</li>
          <li>MOQ / 最小起订量</li>
          <li>Lead time after PO / 下单后交期</li>
          <li>Packaging method (PCS/CTN, CARTONMEAS, G.W) / 包装规格</li>
          <li>Payment terms / 付款条件</li>
          <li>Sample lead time and cost / 样品制作周期和费用</li>
        </ol>
      </section>

      {meta.notes && (
        <section className="mb-5 text-[11px]">
          <p className="text-[10px] uppercase tracking-wider text-[#888] mb-1">Notes / 备注</p>
          <p className="text-[#555] whitespace-pre-line">{meta.notes}</p>
        </section>
      )}

      <section className="mb-5 text-[11px] text-[#555]">
        <p>We appreciate your prompt response. / 期待您的回复。</p>
      </section>

      <footer className="text-center text-[9px] text-[#bbb] mt-8 pt-4 border-t border-[#f0f0ed]">
        Issued via BAO Flow · {today}
      </footer>
    </article>
  )
}

function Row({
  label,
  value,
  large,
  accent,
}: {
  label: string
  value: string
  large?: boolean
  accent?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[#555]">{label}</dt>
      <dd
        className={`tabular-nums ${large ? 'text-[18px] font-semibold' : 'text-[12px]'} ${
          accent ? 'text-[#22c55e]' : 'text-[#0a0a0a]'
        }`}
      >
        {value}
      </dd>
    </div>
  )
}
