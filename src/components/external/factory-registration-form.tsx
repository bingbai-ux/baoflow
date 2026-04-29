'use client'

// Sprint 8-4: 工場自己登録フォーム (英文 + 中文 バイリンガル)。

import { useState, useTransition } from 'react'
import { submitFactoryRegistration } from '@/lib/actions/external-forms'
import {
  ExternalFormSuccess,
  ExternalFormError,
} from '@/components/external/external-form-error'
import type { FactorySelfRegistrationPayload } from '@/lib/actions/external-forms-types'

const SPECIALTY_OPTIONS = [
  { value: 'pouch', label_en: 'Pouches / Bags', label_cn: '袋类' },
  { value: 'cup', label_en: 'Cups', label_cn: '杯类' },
  { value: 'paper_box', label_en: 'Paper boxes', label_cn: '纸盒' },
  { value: 'tin', label_en: 'Tin / Metal cans', label_cn: '马口铁罐' },
  { value: 'film', label_en: 'Film rolls', label_cn: '卷材' },
  { value: 'shopper', label_en: 'Shoppers', label_cn: '手提袋' },
  { value: 'coffee_bag', label_en: 'Coffee bags', label_cn: '咖啡袋' },
  { value: 'other', label_en: 'Other', label_cn: '其他' },
]

export function FactoryRegistrationForm({ token }: { token: string }) {
  const [pending, startSubmit] = useTransition()
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<FactorySelfRegistrationPayload>({
    factory_name: '',
    name_cn: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    wechat: '',
    address: '',
    specialties: [],
    payment_terms: '',
    incoterm: 'FOB',
    lead_time_range: '',
    bank_info_text: '',
    notes: '',
  })

  const updateField = <K extends keyof FactorySelfRegistrationPayload>(
    key: K,
    value: FactorySelfRegistrationPayload[K]
  ) => setForm((s) => ({ ...s, [key]: value }))

  const toggleSpecialty = (value: string) => {
    setForm((s) => {
      const cur = s.specialties || []
      const next = cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value]
      return { ...s, specialties: next }
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startSubmit(async () => {
      const r = await submitFactoryRegistration(token, form)
      if (r.success) setSubmitted(true)
      else setError(r.error || 'Submission failed / 提交失败')
    })
  }

  if (submitted) {
    return (
      <ExternalFormSuccess message="Thank you. We will contact you for the next steps. / 感谢您的填写。我们会尽快联系。" />
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <ExternalFormError message={error} />}

      {/* Basic Info / 基本信息 */}
      <Section titleEn="Basic Info" titleCn="基本信息">
        <Field labelEn="Factory name (English)" labelCn="工厂名称 (英文)" required>
          <input
            type="text"
            value={form.factory_name}
            onChange={(e) => updateField('factory_name', e.target.value)}
            required
            className={inputCls}
          />
        </Field>
        <Field labelEn="Factory name (Chinese)" labelCn="工厂名称 (中文)">
          <input
            type="text"
            value={form.name_cn || ''}
            onChange={(e) => updateField('name_cn', e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field labelEn="Address" labelCn="地址">
          <textarea
            value={form.address || ''}
            onChange={(e) => updateField('address', e.target.value)}
            rows={2}
            className={inputCls}
          />
        </Field>
      </Section>

      {/* Contact / 联系方式 */}
      <Section titleEn="Contact" titleCn="联系方式">
        <Field labelEn="Contact name" labelCn="联系人姓名">
          <input
            type="text"
            value={form.contact_name || ''}
            onChange={(e) => updateField('contact_name', e.target.value)}
            className={inputCls}
          />
        </Field>
        <Row>
          <Field labelEn="Phone" labelCn="电话">
            <input
              type="tel"
              value={form.contact_phone || ''}
              onChange={(e) => updateField('contact_phone', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field labelEn="WeChat" labelCn="微信">
            <input
              type="text"
              value={form.wechat || ''}
              onChange={(e) => updateField('wechat', e.target.value)}
              className={inputCls}
            />
          </Field>
        </Row>
        <Field labelEn="Email" labelCn="邮箱">
          <input
            type="email"
            value={form.contact_email || ''}
            onChange={(e) => updateField('contact_email', e.target.value)}
            className={inputCls}
          />
        </Field>
      </Section>

      {/* Specialties / 主营产品 */}
      <Section titleEn="Specialties" titleCn="主营产品">
        <p className="text-[11px] text-[#888] mb-2">
          Select all that apply / 选择所有适用项
        </p>
        <div className="flex flex-wrap gap-2">
          {SPECIALTY_OPTIONS.map((s) => {
            const on = form.specialties?.includes(s.value)
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => toggleSpecialty(s.value)}
                className="px-3 py-1.5 text-[11px] rounded-full border transition-colors"
                style={{
                  background: on ? '#e5a32e' : '#fff',
                  color: on ? '#fff' : '#555',
                  borderColor: on ? '#e5a32e' : '#e8e8e6',
                }}
              >
                {s.label_en} · {s.label_cn}
              </button>
            )
          })}
        </div>
      </Section>

      {/* Trade terms / 贸易条款 */}
      <Section titleEn="Trade terms" titleCn="贸易条款">
        <Row>
          <Field labelEn="Payment terms" labelCn="付款条件">
            <input
              type="text"
              value={form.payment_terms || ''}
              onChange={(e) => updateField('payment_terms', e.target.value)}
              placeholder="e.g. 30% T/T deposit, 70% before shipment"
              className={inputCls}
            />
          </Field>
          <Field labelEn="Incoterm" labelCn="贸易条款">
            <select
              value={form.incoterm || 'FOB'}
              onChange={(e) => updateField('incoterm', e.target.value)}
              className={inputCls}
            >
              {['EXW', 'FOB', 'CIF', 'DDP', 'DPU'].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
        </Row>
        <Field labelEn="Lead time (range)" labelCn="生产周期 (范围)">
          <input
            type="text"
            value={form.lead_time_range || ''}
            onChange={(e) => updateField('lead_time_range', e.target.value)}
            placeholder="e.g. 25-35 days / 25-35天"
            className={inputCls}
          />
        </Field>
      </Section>

      {/* Bank / 银行账户 */}
      <Section titleEn="Bank info (optional)" titleCn="银行账户 (可选)">
        <Field
          labelEn="Bank name, account number, beneficiary name, SWIFT, etc."
          labelCn="银行名称、账号、受益人、SWIFT 等"
        >
          <textarea
            value={form.bank_info_text || ''}
            onChange={(e) => updateField('bank_info_text', e.target.value)}
            rows={3}
            className={inputCls}
          />
        </Field>
      </Section>

      {/* Notes / 备注 */}
      <Section titleEn="Notes" titleCn="备注">
        <textarea
          value={form.notes || ''}
          onChange={(e) => updateField('notes', e.target.value)}
          rows={2}
          className={inputCls}
          placeholder="Any other information you want to share / 其他需要说明的信息"
        />
      </Section>

      <button
        type="submit"
        disabled={pending}
        className="w-full py-3 rounded-[10px] text-white font-medium text-[14px] disabled:opacity-50"
        style={{ background: pending ? '#888' : '#e5a32e' }}
      >
        {pending ? 'Submitting… / 提交中…' : 'Submit / 提交'}
      </button>
    </form>
  )
}

const inputCls =
  'w-full px-3 py-2 text-[13px] border border-[#e8e8e6] rounded-[8px] bg-white focus:outline-none focus:border-[#e5a32e] focus:ring-1 focus:ring-[#e5a32e]'

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
      <h2 className="font-display text-[14px] font-semibold text-[#1a1a1a] mb-3">
        {titleEn} <span className="text-[#888] font-body font-normal">· {titleCn}</span>
      </h2>
      <div className="space-y-2.5">{children}</div>
    </section>
  )
}

function Field({
  labelEn,
  labelCn,
  required,
  children,
}: {
  labelEn: string
  labelCn: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-[11px] text-[#555] mb-1 font-medium">
        {labelEn} <span className="text-[#888]">/ {labelCn}</span>
        {required && <span className="text-[#c0392b] ml-1">*</span>}
      </span>
      {children}
    </label>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
}
