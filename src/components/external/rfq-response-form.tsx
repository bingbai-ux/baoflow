'use client'

// Sprint 8-7: 工場が見る RFQ 回答フォーム (anonymous)。
// §0.5-5 通り、案件名は表示しない。商品仕様+入力欄のみ。

import { useEffect, useState, useTransition } from 'react'
import { submitRfqResponse } from '@/lib/actions/external-forms'
import {
  ExternalFormSuccess,
  ExternalFormError,
} from '@/components/external/external-form-error'
import type {
  RfqResponsePayload,
  RfqResponseProductLine,
  RfqResponseExtras,
  RfqDayRange,
} from '@/lib/actions/external-forms-types'

// 再設計 工程3: 追加費用・送料・日数（任意）と、途中保存（この端末のブラウザに保存）
const emptyRange = (): RfqDayRange => ({ min: null, max: null })
const emptyExtras = (): RfqResponseExtras => ({
  fees: [{ label: 'Plate / 版费', usd: null }, { label: 'Extra per color / 每色加价', usd: null }],
  shipping: { sea_usd: null, air_usd: null, domestic_usd: null },
  lead_days: { plate: emptyRange(), sample: emptyRange(), production: emptyRange(), domestic: emptyRange(), sea: emptyRange(), air: emptyRange() },
})
const LEAD_LABELS: Array<[keyof RfqResponseExtras['lead_days'], string]> = [['plate', 'Plate making / 制版'], ['sample', 'Sample / 打样'], ['production', 'Mass production / 大货'], ['domestic', 'Domestic delivery / 国内运输'], ['sea', 'Sea freight / 海运'], ['air', 'Air freight / 空运']]
const extrasFilled = (x: RfqResponseExtras) => x.fees.some(f => f.usd != null) || Object.values(x.shipping).some(v => v != null) || Object.values(x.lead_days).some(r => r.min != null || r.max != null)
const numOrNull = (v: string) => v.trim() === '' || !Number.isFinite(Number(v)) || Number(v) < 0 ? null : Number(v)

interface MaskedVariant {
  id: string
  label: string
  width_mm: number | null
  height_mm: number | null
  depth_mm: number | null
  material: string | null
  print_color_count: string | null
  pcs_per_carton: number | null
  requested_quantities?: number[]
  print_method?: string | null
  processing?: string | null
  color_description?: string | null
  pantone_colors?: string | null
}

interface MaskedProduct {
  id: string
  description: string
  variants: MaskedVariant[]
}

export function RfqResponseForm({
  token,
  products,
  schemaVersion = 1,
}: {
  token: string
  products: MaskedProduct[]
  schemaVersion?: number
}) {
  const [pending, startSubmit] = useTransition()
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
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
        if (schemaVersion === 2) for (const quantity of v.requested_quantities || []) initLines.push({ product_id: p.id, variant_id: v.id, quantity })
        else initLines.push({ product_id: p.id, variant_id: v.id })
      }
    }
  }
  const [lines, setLines] = useState<RfqResponseProductLine[]>(initLines)
  const [extras, setExtras] = useState<RfqResponseExtras>(emptyExtras)
  const draftKey = `bao-rfq-draft:${token}`
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null)
  // 途中保存の読み込み（依頼の行数が同じときだけ戻す）
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftKey)
      if (!raw) return
      const d = JSON.parse(raw)
      if (!Array.isArray(d.lines) || d.lines.length !== initLines.length || d.lines.some((l: RfqResponseProductLine, i: number) => l.product_id !== initLines[i].product_id || (l.variant_id || null) !== (initLines[i].variant_id || null) || (l.quantity ?? null) !== (initLines[i].quantity ?? null))) return
      setLines(d.lines); setFactoryEmail(d.factoryEmail || ''); setPaymentTerms(d.paymentTerms || ''); setGeneralNotes(d.generalNotes || '')
      if (d.extras) setExtras(d.extras)
      setDraftSavedAt(d.savedAt || null)
    } catch { /* 途中保存が読めないときは空のフォームから始める */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey])
  const saveDraft = () => {
    try {
      const savedAt = new Date().toLocaleString()
      window.localStorage.setItem(draftKey, JSON.stringify({ lines, factoryEmail, paymentTerms, generalNotes, extras, savedAt }))
      setDraftSavedAt(savedAt); setError(null)
    } catch { setError('Could not save the draft on this device. / 无法在此设备保存草稿。') }
  }

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
      ...(extrasFilled(extras) ? { extras } : {}),
    }
    startSubmit(async () => {
      const r = await submitRfqResponse(token, payload)
      if (r.success) { try { window.localStorage.removeItem(draftKey) } catch { /* 送信は完了している */ } setSubmitted(true) }
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
      {!ready && <p role="status" className="text-[12px] text-[#84787D]">Preparing the reply form… / 正在准备报价表…</p>}
      <fieldset disabled={!ready || pending} className="space-y-5">

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
        <p className="text-[11px] text-[#84787D] mb-3">
          Please fill in your unit price (USD), MOQ, lead time, and packaging info per item.<br />
          请按每个产品填写单价 (美金)、起订量、交期和包装信息。
        </p>

        <div className="space-y-3">
          {products.map((p) => {
            const lineCount = Math.max(1, schemaVersion === 2 ? p.variants.reduce((n, v) => n + (v.requested_quantities?.length || 0), 0) : p.variants.length)
            const startIdx = cursor
            cursor += lineCount

            return (
              <div
                key={p.id}
                className="bg-white border rounded-[12px] p-3"
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
                    {(schemaVersion === 2 ? p.variants.flatMap(v => (v.requested_quantities || []).map(quantity => ({ ...v, requested_quantities: [quantity] }))) : p.variants).map((v, vi) => {
                      const idx = startIdx + vi
                      return (
                        <div key={`${v.id}/${schemaVersion === 2 ? v.requested_quantities?.[0] : ''}`} className="bg-[#FBFAF6] rounded-[12px] p-2.5">
                          <div className="flex flex-wrap gap-2 text-[10.5px] text-[#351E28] mb-2">
                            <span className="font-semibold">{v.label || '(variant)'}</span>
                            {v.width_mm && (
                              <span>
                                {v.width_mm}×{v.height_mm}
                                {v.depth_mm ? `×${v.depth_mm}` : ''} mm
                              </span>
                            )}
                            {!!v.requested_quantities?.length && <span>Quantity / 数量: {v.requested_quantities.map(q => q.toLocaleString()).join(' / ')} pcs</span>}
                            {v.material && <span>· {v.material}</span>}
                            {v.print_color_count && <span>· print {v.print_color_count}</span>}
                            {[v.print_method, v.processing, v.color_description, v.pantone_colors].filter(Boolean).map((value, i) => <span key={i}>{value}</span>)}
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
      <Section titleEn="Extra costs, freight and lead time (optional)" titleCn="其他费用、运费和交期（选填）">
        <div className="space-y-4">
          <div>
            <p className="mb-1 text-[11px] font-bold">Extra costs USD / 其他费用（美金）</p>
            <div className="space-y-2">
              {extras.fees.map((fee, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <input aria-label={`Cost item ${i + 1}`} value={fee.label} onChange={e => setExtras(x => ({ ...x, fees: x.fees.map((f, n) => n === i ? { ...f, label: e.target.value } : f) }))} className={smallInputCls + ' !w-[220px] max-w-full'} />
                  <input aria-label={`${fee.label || 'Cost'} USD`} type="number" min="0" step="any" value={fee.usd ?? ''} onChange={e => setExtras(x => ({ ...x, fees: x.fees.map((f, n) => n === i ? { ...f, usd: numOrNull(e.target.value) } : f) }))} className={smallInputCls + ' !w-[120px]'} placeholder="USD" />
                  {i > 1 && <button type="button" onClick={() => setExtras(x => ({ ...x, fees: x.fees.filter((_, n) => n !== i) }))} className="min-h-[36px] px-2 text-[11px] underline">Remove / 删除</button>}
                </div>
              ))}
              <button type="button" onClick={() => setExtras(x => ({ ...x, fees: [...x.fees, { label: 'Special finishing (emboss, deboss…) / 特殊工艺', usd: null }] }))} className="min-h-[36px] rounded-full border border-[#E2E1DA] bg-white px-3 text-[11px] font-bold">+ Add cost / 添加费用</button>
            </div>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-bold">Freight USD (total) / 运费合计（美金）</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {([['sea_usd', 'Sea to Japan / 海运到日本'], ['air_usd', 'Air to Japan / 空运到日本'], ['domestic_usd', 'Domestic to our forwarder / 国内送到指定货代']] as const).map(([k, t]) => (
                <SmallField key={k} label={t}><input type="number" min="0" step="any" value={extras.shipping[k] ?? ''} onChange={e => setExtras(x => ({ ...x, shipping: { ...x.shipping, [k]: numOrNull(e.target.value) } }))} className={smallInputCls} /></SmallField>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-bold">Lead time in days (e.g. 15 – 20) / 交期天数（例如 15 – 20）</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {LEAD_LABELS.map(([k, t]) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="w-[170px] flex-shrink-0 text-[11px] text-[#84787D]">{t}</span>
                  <input aria-label={`${t} min days`} type="number" min="0" step="1" value={extras.lead_days[k].min ?? ''} onChange={e => setExtras(x => ({ ...x, lead_days: { ...x.lead_days, [k]: { ...x.lead_days[k], min: numOrNull(e.target.value) } } }))} className={smallInputCls + ' !w-[72px]'} />
                  <span className="text-[11px]">–</span>
                  <input aria-label={`${t} max days`} type="number" min="0" step="1" value={extras.lead_days[k].max ?? ''} onChange={e => setExtras(x => ({ ...x, lead_days: { ...x.lead_days, [k]: { ...x.lead_days[k], max: numOrNull(e.target.value) } } }))} className={smallInputCls + ' !w-[72px]'} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

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

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={saveDraft} className="min-h-[44px] rounded-full border border-[#E2E1DA] bg-white px-4 text-[13px] font-bold">Save draft / 保存草稿</button>
        {draftSavedAt && <span role="status" className="text-[11px] text-[#84787D]">Draft saved on this device / 草稿已保存在此设备: {draftSavedAt}</span>}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full py-3 rounded-full font-medium text-[14px] disabled:opacity-50"
        style={{ background: pending ? '#EFEFEA' : '#E9F056', color: pending ? '#AEB8A0' : '#666C14' }}
      >
        {pending ? 'Submitting… / 提交中…' : 'Submit quotation / 提交报价'}
      </button>
      </fieldset>
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
          required
          min="0.001"
          step="0.001"
          value={line.unit_price_usd ?? ''}
          onChange={(e) => onChange('unit_price_usd', num(e.target.value))}
          className={smallInputCls}
        />
      </SmallField>
      <SmallField label="MOQ">
        <input
          type="number"
          required
          min="1"
          step="1"
          value={line.moq ?? ''}
          onChange={(e) => onChange('moq', num(e.target.value))}
          className={smallInputCls}
        />
      </SmallField>
      <SmallField label="PCS/CTN">
        <input
          type="number"
          required
          min="1"
          step="1"
          value={line.pcs_per_carton ?? ''}
          onChange={(e) => onChange('pcs_per_carton', num(e.target.value))}
          className={smallInputCls}
        />
      </SmallField>
      <SmallField label="Lead days / 交期">
        <input
          type="number"
          required
          min="0"
          value={line.production_lead_days ?? ''}
          onChange={(e) => onChange('production_lead_days', num(e.target.value))}
          className={smallInputCls}
        />
      </SmallField>
      <SmallField label="Carton W cm">
        <input
          type="number"
          required
          min="0.001"
          step="any"
          value={line.carton_w_cm ?? ''}
          onChange={(e) => onChange('carton_w_cm', num(e.target.value))}
          className={smallInputCls}
        />
      </SmallField>
      <SmallField label="Carton H cm">
        <input
          type="number"
          required
          min="0.001"
          step="any"
          value={line.carton_h_cm ?? ''}
          onChange={(e) => onChange('carton_h_cm', num(e.target.value))}
          className={smallInputCls}
        />
      </SmallField>
      <SmallField label="Carton D cm">
        <input
          type="number"
          required
          min="0.001"
          step="any"
          value={line.carton_d_cm ?? ''}
          onChange={(e) => onChange('carton_d_cm', num(e.target.value))}
          className={smallInputCls}
        />
      </SmallField>
      <SmallField label="G.W kg">
        <input
          type="number"
          required
          min="0.001"
          step="any"
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
  'w-full px-3 py-2 text-[13px] border border-[#E2E1DA] rounded-[12px] bg-white focus:outline-none focus:border-[#FF5C34] focus:ring-1 focus:ring-[#FF5C34]'
const smallInputCls =
  'w-full px-2 py-1 text-[11px] border border-[#E2E1DA] rounded-[8px] bg-white focus:outline-none focus:border-[#FF5C34]'

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
        {titleEn} <span className="text-[#84787D] font-body font-normal">· {titleCn}</span>
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
      <span className="block text-[11px] text-[#351E28] mb-1 font-medium">
        {labelEn} <span className="text-[#84787D]">/ {labelCn}</span>
      </span>
      {children}
    </label>
  )
}

function SmallField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[9.5px] text-[#84787D] mb-0.5">{label}</span>
      {children}
    </label>
  )
}
