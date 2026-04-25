'use client'

import { formatJPY, formatDate } from '@/lib/utils/format'
import {
  type CompanyInfoPhase1,
  type BankAccountPhase1,
  type FeeType,
  FEE_TYPE_LABELS,
} from '@/lib/types'

export type DocumentType = 'quotation' | 'invoice' | 'delivery_note'

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

export interface QuoteLite {
  id: string
  spec_id: string | null
  version: number | null
  quantity: number | null
  selling_price_jpy: number | null
  total_billing_jpy: number | null
  total_billing_tax_jpy: number | null
  status: string | null
  cost_ratio: number | null
}

export interface FeeLite {
  id: string
  spec_id: string | null
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
}

export function DocumentTemplate(props: TemplateProps) {
  const { type, deal, specs, quotes, fees, company, banks, meta } = props
  const today = formatDate(new Date().toISOString())
  const approved = quotes.filter((q) => q.status === 'approved')
  const lineItems = approved.length > 0 ? approved : quotes

  const specMap = new Map(specs.map((s) => [s.id, s]))

  const subtotal = lineItems.reduce((sum, q) => sum + (Number(q.total_billing_jpy) || 0), 0)
  const feesTotal = fees.reduce((sum, f) => sum + (Number(f.amount_jpy) || 0), 0)
  const taxableSubtotal = subtotal + feesTotal
  const tax = Math.ceil(taxableSubtotal * 0.10)
  const grandTotal = taxableSubtotal + tax

  return (
    <article className="document-page bg-white text-[#0a0a0a] print:shadow-none shadow-md">
      <header className="flex items-start justify-between border-b-2 border-[#0a0a0a] pb-4 mb-6">
        <div>
          <h1 className="text-[32px] font-display font-semibold tracking-tight">{TYPE_TITLE[type]}</h1>
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
              const spec = q.spec_id ? specMap.get(q.spec_id) : null
              const specSummary = spec
                ? [
                    spec.product_category,
                    spec.material_category,
                    spec.height_mm && spec.width_mm
                      ? `${spec.height_mm}×${spec.width_mm}${spec.depth_mm ? `×${spec.depth_mm}` : ''}mm`
                      : null,
                    spec.printing_method && spec.print_colors
                      ? `印刷 ${spec.printing_method} ${spec.print_colors}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' / ')
                : '-'
              const productName = spec?.product_name || '案件全体'
              return (
                <tr key={q.id} className="border-b border-[#e8e8e6] align-top">
                  <td className="py-2 pr-2 tabular-nums text-[#888]">{idx + 1}</td>
                  <td className="py-2 pr-2">{productName}</td>
                  <td className="py-2 pr-2 text-[10px] text-[#555]">{specSummary}</td>
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
            {fees.map((f, idx) => (
              <tr key={f.id} className="border-b border-[#e8e8e6]">
                <td className="py-2 pr-2 tabular-nums text-[#888]">{lineItems.length + idx + 1}</td>
                <td className="py-2 pr-2">
                  {FEE_TYPE_LABELS[f.fee_type]}
                  {f.is_initial_only && <span className="text-[10px] text-[#888] ml-1">(初回のみ)</span>}
                </td>
                <td className="py-2 pr-2 text-[10px] text-[#555]">
                  {f.spec_id ? specMap.get(f.spec_id)?.product_name || '' : ''}
                  {f.note && <span className="text-[#888]"> / {f.note}</span>}
                </td>
                <td className="py-2 pr-2 text-right text-[#888]">-</td>
                <td className="py-2 pr-2 text-right text-[#888]">-</td>
                <td className="py-2 text-right tabular-nums font-semibold">
                  {f.amount_jpy != null ? formatJPY(f.amount_jpy) : '-'}
                </td>
              </tr>
            ))}
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
                <p className="tabular-nums">
                  {b.account_type ? `${b.account_type} ` : ''}
                  {b.account_number || ''}
                </p>
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
