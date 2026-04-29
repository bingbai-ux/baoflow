'use client'

// Sprint 8-7: 工場が見る RFQ 回答フォーム (anonymous)。
// §0.5-5 通り、案件名は表示しない。商品仕様+入力欄のみ。

import { useState, useTransition } from 'react'
import { submitRfqResponse } from '@/lib/actions/external-forms'
import {
  ExternalFormSuccess,
  ExternalFormError,
} from '@/components/external/external-form-error'
import type {
  RfqResponsePayload,
  RfqResponseProductLine,
} from '@/lib/actions/external-forms-types'

interface MaskedVariant {
  id: string
  label: string
  width_mm: number | null
  height_mm: number | null
  depth_mm: number | null
  material: string | null
  print_color_count: string | null
  pcs_per_carton: number | null
}

interface MaskedProduct {
  id: string
  description: string
  variants: MaskedVariant[]
}

export function RfqResponseForm({
  token,
  products,
}: {
  token: string
  products: MaskedProduct[]
}) {
  const [pending, startSubmit] = useTransition()
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [factoryEmail, setFactoryEmail] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [generalNotes, setGeneralNotes] = useState('')

  // 各 product (variant が無い場合) または各 variant ごとに 1 line
  const initLines: RfqResponseProductLine[] = []
  for (const p of products) {
    if (p.variants.length === 0) {
      initLines.push({ product_id: p.id })
    } else {
      for (const v of p.variants) {
        initLines.push({ product_id: p.id, variant_id: v.id })
      }
    }
  }
  const [lines, setLines] = useState<RfqResponseProductLine[]>(initLines)

  const updateLine = <K extends keyof RfqResponseProductLine>(
    idx: number,
    key: K,
    value: RfqResponseProductLine[K]
  ) => {
    setLines((s) => s.map((l, i) => (i === idx ? { ...l, [key]: value } : l)))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const payload: RfqResponsePayload = {
      factory_email: factoryEmail || null,
      payment_terms: paymentTerms || null,
      general_notes: generalNotes || null,
      products: lines,
    }
    startSubmit(async () => {
      const r = await submitRfqResponse(token, payload)
      if (r.success) setSubmitted(true)
      else setError(r.error || 'Submission failed / 提交失败')
    })
  }

  if (submitted) {
    return (
      <ExternalFormSuccess message="Thank you for your quotation. / 感谢您的报价。" />
    )
  }

  // line index ヘルパー: 商品 idx → line range
  let cursor = 0

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <ExternalFormError message={error} />}

      {/* 工場連絡先 (任意、回答者の確認用) */}
      <Section titleEn="Your contact" titleCn="您的联系方式">
        <Field labelEn="Email (optional)" labelCn="邮箱 (可选)">
          <input
            type="email"
            value={factoryEmail}
            onChange={(e) => setFactoryEmail(e.target.value)}
            className={inputCls}
          />
        </Field>
      </Section>

      {/* Per-product / per-variant 入力 */}
      <Section titleEn="Quotation by product" titleCn="按产品报价">
        <p className="text-[11px] text-[#888] mb-3">
          Please fill in your unit price (USD), MOQ, lead time, and packaging info per item.<br />
          请按每个产品填写单价 (美金)、起订量、交期和包装信息。
        </p>

        <div className="space-y-3">
          {products.map((p) => {
            const lineCount = Math.max(1, p.variants.length)
            const startIdx = cursor
            cursor += lineCount

            return (
              <div
                key={p.id}
                className="bg-white border rounded-[10px] p-3"
                style={{ borderColor: 'rgba(229,163,46,0.2)' }}
              >
                <p className="font-display text-[13px] font-semibold mb-2">{p.description}</p>

                {p.variants.length === 0 ? (
                  <ProductLineInputs
                    line={lines[startIdx]}
                    onChange={(k, v) => updateLine(startIdx, k, v)}
                  />
                ) : (
                  <div className="space-y-2.5">
                    {p.variants.map((v, vi) => {
                      const idx = startIdx + vi
                      return (
                        <div key={v.id} className="bg-[#fafaf9] rounded-[8px] p-2.5">
                          <div className="flex flex-wrap gap-2 text-[10.5px] text-[#555] mb-2">
                            <span className="font-semibold">{v.label || '(variant)'}</span>
                            {v.width_mm && (
                              <span>
                                {v.width_mm}×{v.height_mm}
                                {v.depth_mm ? `×${v.depth_mm}` : ''} mm
                              </span>
                            )}
                            {v.material && <span>· {v.material}</span>}
                            {v.print_color_count && <span>· print {v.print_color_count}</span>}
                          </div>
                          <ProductLineInputs
                            line={lines[idx]}
                            onChange={(k, val) => updateLine(idx, k, val)}
                          />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Section>

      {/* 全体補足 */}
      <Section titleEn="General terms" titleCn="整体条款">
        <Field labelEn="Payment terms" labelCn="付款条件">
          <input
            type="text"
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            placeholder="e.g. 30% T/T deposit, 70% before shipment"
            className={inputCls}
          />
        </Field>
        <Field labelEn="Notes" labelCn="备注">
          <textarea
            value={generalNotes}
            onChange={(e) => setGeneralNotes(e.target.value)}
            rows={3}
            className={inputCls}
          />
        </Field>
      </Section>

      <button
        type="submit"
        disabled={pending}
        className="w-full py-3 rounded-[10px] text-white font-medium text-[14px] disabled:opacity-50"
        style={{ background: pending ? '#888' : '#e5a32e' }}
      >
        {pending ? 'Submitting… / 提交中…' : 'Submit quotation / 提交报价'}
      </button>
    </form>
  )
}

function ProductLineInputs({
  line,
  onChange,
}: {
  line: RfqResponseProductLine
  onChange: <K extends keyof RfqResponseProductLine>(
    key: K,
    value: RfqResponseProductLine[K]
  ) => void
}) {
  const num = (v: string): number | null => (v.trim() === '' ? null : Number(v))
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <SmallField label="Unit USD / 单价">
        <input
          type="number"
          step="0.001"
          value={line.unit_price_usd ?? ''}
          onChange={(e) => onChange('unit_price_usd', num(e.target.value))}
          className={smallInputCls}
        />
      </SmallField>
      <SmallField label="MOQ">
        <input
          type="number"
          value={line.moq ?? ''}
          onChange={(e) => onChange('moq', num(e.target.value))}
          className={smallInputCls}
        />
      </SmallField>
      <SmallField label="PCS/CTN">
        <input
          type="number"
          value={line.pcs_per_carton ?? ''}
          onChange={(e) => onChange('pcs_per_carton', num(e.target.value))}
          className={smallInputCls}
        />
      </SmallField>
      <SmallField label="Lead days / 交期">
        <input
          type="number"
          value={line.production_lead_days ?? ''}
          onChange={(e) => onChange('production_lead_days', num(e.target.value))}
          className={smallInputCls}
        />
      </SmallField>
      <SmallField label="Carton W cm">
        <input
          type="number"
          value={line.carton_w_cm ?? ''}
          onChange={(e) => onChange('carton_w_cm', num(e.target.value))}
          className={smallInputCls}
        />
      </SmallField>
      <SmallField label="Carton H cm">
        <input
          type="number"
          value={line.carton_h_cm ?? ''}
          onChange={(e) => onChange('carton_h_cm', num(e.target.value))}
          className={smallInputCls}
        />
      </SmallField>
      <SmallField label="Carton D cm">
        <input
          type="number"
          value={line.carton_d_cm ?? ''}
          onChange={(e) => onChange('carton_d_cm', num(e.target.value))}
          className={smallInputCls}
        />
      </SmallField>
      <SmallField label="G.W kg">
        <input
          type="number"
          step="0.1"
          value={line.gross_weight_kg ?? ''}
          onChange={(e) => onChange('gross_weight_kg', num(e.target.value))}
          className={smallInputCls}
        />
      </SmallField>
      <div className="col-span-2 sm:col-span-4">
        <SmallField label="Notes / 备注">
          <input
            type="text"
            value={line.notes ?? ''}
            onChange={(e) => onChange('notes', e.target.value)}
            className={smallInputCls}
          />
        </SmallField>
      </div>
    </div>
  )
}

const inputCls =
  'w-full px-3 py-2 text-[13px] border border-[#e8e8e6] rounded-[8px] bg-white focus:outline-none focus:border-[#e5a32e] focus:ring-1 focus:ring-[#e5a32e]'
const smallInputCls =
  'w-full px-2 py-1 text-[11px] border border-[#e8e8e6] rounded-[6px] bg-white focus:outline-none focus:border-[#e5a32e]'

function Section({
  titleEn,
  titleCn,
  children,
}: {
  titleEn: string
  titleCn: string
  children: React.ReactNode
}) {
  return (
    <section
      className="bg-white border rounded-[12px] p-5"
      style={{ borderColor: 'rgba(229,163,46,0.15)' }}
    >
      <h2 className="font-display text-[14px] font-semibold mb-3">
        {titleEn} <span className="text-[#888] font-body font-normal">· {titleCn}</span>
      </h2>
      <div className="space-y-2.5">{children}</div>
    </section>
  )
}

function Field({
  labelEn,
  labelCn,
  children,
}: {
  labelEn: string
  labelCn: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-[11px] text-[#555] mb-1 font-medium">
        {labelEn} <span className="text-[#888]">/ {labelCn}</span>
      </span>
      {children}
    </label>
  )
}

function SmallField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[9.5px] text-[#888] mb-0.5">{label}</span>
      {children}
    </label>
  )
}
