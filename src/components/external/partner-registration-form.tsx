'use client'

// Sprint 11: 物流パートナー自己登録フォーム。
//   kind='shipping'  → 発送業者 (中国系フォワーダー想定、英文+中文)
//   kind='warehouse' → ロジスティック会社 (国内の在庫保管会社想定、日本語)

import { useState, useTransition } from 'react'
import { submitPartnerRegistration } from '@/lib/actions/external-forms'
import {
  ExternalFormSuccess,
  ExternalFormError,
} from '@/components/external/external-form-error'
import type { LogisticsPartnerPayload } from '@/lib/actions/external-forms-types'

export type PartnerKind = 'shipping' | 'warehouse'

const SERVICE_OPTIONS: Record<PartnerKind, Array<{ value: string; label: string }>> = {
  shipping: [
    { value: 'sea', label: 'Sea freight · 海运' },
    { value: 'air', label: 'Air freight · 空运' },
    { value: 'express', label: 'Express / Courier · 快递' },
    { value: 'customs', label: 'Customs clearance · 报关清关' },
    { value: 'pickup', label: 'Factory pickup · 上门提货' },
    { value: 'ddp', label: 'DDP door-to-door · 双清包税' },
  ],
  warehouse: [
    { value: 'storage', label: '在庫保管' },
    { value: 'inbound', label: '入庫・検品' },
    { value: 'picking', label: 'ピッキング・出荷' },
    { value: 'delivery', label: '配送手配' },
    { value: 'kitting', label: 'セット組み・加工' },
    { value: 'returns', label: '返品対応' },
  ],
}

const TEXT = {
  shipping: {
    services: 'Services / 服务范围',
    servicesHint: 'Select all that apply / 选择所有适用项',
    basic: 'Company Info / 公司信息',
    company: 'Company name (English) / 公司名称 (英文)',
    companyCn: 'Company name (Chinese) / 公司名称 (中文)',
    address: 'Address / 地址',
    contact: 'Contact / 联系方式',
    contactName: 'Contact name / 联系人',
    phone: 'Phone / 电话',
    wechatL: 'WeChat / 微信',
    email: 'Email / 邮箱',
    biz: 'Routes & Pricing / 航线与价格',
    coverage: 'Routes / coverage · 航线范围',
    coveragePh: 'e.g. China → Japan, sea & air / 中国→日本 海运空运',
    pricing: 'Pricing notes · 价格说明',
    pricingPh: 'e.g. Sea LCL ¥xx/kg, Air ¥xx/kg / 海运拼箱、空运价格等',
    payment: 'Payment terms / 付款条件',
    bank: 'Bank info (optional) / 银行账户 (可选)',
    notes: 'Notes / 备注',
    submit: 'Submit / 提交',
    success: 'Thank you. We will contact you soon. / 感谢您的填写，我们会尽快联系。',
    fail: 'Submission failed / 提交失败',
  },
  warehouse: {
    services: '対応サービス',
    servicesHint: '対応可能なものを全て選択してください',
    basic: '会社情報',
    company: '会社名',
    companyCn: '英文社名 (任意)',
    address: '住所(倉庫所在地)',
    contact: 'ご担当者',
    contactName: '氏名',
    phone: '電話番号',
    wechatL: 'WeChat (任意)',
    email: 'メールアドレス',
    biz: '対応範囲・料金',
    coverage: '対応エリア・倉庫拠点',
    coveragePh: '例: 関東一円 / 千葉倉庫',
    pricing: '料金の目安',
    pricingPh: '例: 保管 ¥xx/坪・月、入出庫 ¥xx/件',
    payment: '支払条件',
    bank: '銀行口座 (任意)',
    notes: '備考',
    submit: '送信する',
    success: 'ご記入ありがとうございました。担当者よりご連絡いたします。',
    fail: '送信に失敗しました',
  },
} as const

export function PartnerRegistrationForm({
  token,
  kind,
}: {
  token: string
  kind: PartnerKind
}) {
  const t = TEXT[kind]
  const [pending, startSubmit] = useTransition()
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<LogisticsPartnerPayload>({
    company_name: '',
    name_cn: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    wechat: '',
    address: '',
    services: [],
    coverage: '',
    pricing_notes: '',
    payment_terms: '',
    bank_info_text: '',
    notes: '',
  })

  const update = <K extends keyof LogisticsPartnerPayload>(
    key: K,
    value: LogisticsPartnerPayload[K]
  ) => setForm((s) => ({ ...s, [key]: value }))

  const toggleService = (value: string) =>
    setForm((s) => {
      const cur = s.services || []
      return {
        ...s,
        services: cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value],
      }
    })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startSubmit(async () => {
      const r = await submitPartnerRegistration(token, form)
      if (r.success) setSubmitted(true)
      else setError(r.error || t.fail)
    })
  }

  if (submitted) return <ExternalFormSuccess message={t.success} />

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <ExternalFormError message={error} />}

      <Section title={t.basic}>
        <Field label={t.company} required>
          <input
            required
            value={form.company_name}
            onChange={(e) => update('company_name', e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label={t.companyCn}>
          <input
            value={form.name_cn || ''}
            onChange={(e) => update('name_cn', e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label={t.address}>
          <textarea
            value={form.address || ''}
            onChange={(e) => update('address', e.target.value)}
            rows={2}
            className={inputCls}
          />
        </Field>
      </Section>

      <Section title={t.contact}>
        <Field label={t.contactName}>
          <input
            value={form.contact_name || ''}
            onChange={(e) => update('contact_name', e.target.value)}
            className={inputCls}
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={t.phone}>
            <input
              value={form.contact_phone || ''}
              onChange={(e) => update('contact_phone', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label={t.wechatL}>
            <input
              value={form.wechat || ''}
              onChange={(e) => update('wechat', e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
        <Field label={t.email}>
          <input
            type="email"
            value={form.contact_email || ''}
            onChange={(e) => update('contact_email', e.target.value)}
            className={inputCls}
          />
        </Field>
      </Section>

      <Section title={t.services}>
        <p className="text-[11px] text-[#84787D] mb-2">{t.servicesHint}</p>
        <div className="flex flex-wrap gap-2">
          {SERVICE_OPTIONS[kind].map((opt) => {
            const on = (form.services || []).includes(opt.value)
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleService(opt.value)}
                className="rounded-full px-3 py-1.5 text-[12px] border transition-colors"
                style={
                  on
                    ? { background: '#351E28', color: '#C9A2B8', borderColor: '#351E28' }
                    : { background: '#FFFFFF', color: '#351E28', borderColor: '#E2E1DA' }
                }
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </Section>

      <Section title={t.biz}>
        <Field label={t.coverage}>
          <input
            value={form.coverage || ''}
            onChange={(e) => update('coverage', e.target.value)}
            placeholder={t.coveragePh}
            className={inputCls}
          />
        </Field>
        <Field label={t.pricing}>
          <textarea
            value={form.pricing_notes || ''}
            onChange={(e) => update('pricing_notes', e.target.value)}
            placeholder={t.pricingPh}
            rows={3}
            className={inputCls}
          />
        </Field>
        <Field label={t.payment}>
          <input
            value={form.payment_terms || ''}
            onChange={(e) => update('payment_terms', e.target.value)}
            className={inputCls}
          />
        </Field>
      </Section>

      <Section title={t.bank}>
        <textarea
          value={form.bank_info_text || ''}
          onChange={(e) => update('bank_info_text', e.target.value)}
          rows={3}
          className={inputCls}
        />
      </Section>

      <Section title={t.notes}>
        <textarea
          value={form.notes || ''}
          onChange={(e) => update('notes', e.target.value)}
          rows={2}
          className={inputCls}
        />
      </Section>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full py-3 text-[14px] font-bold disabled:opacity-50"
        style={{ background: '#E9F056', color: '#666C14' }}
      >
        {pending ? '…' : t.submit}
      </button>
    </form>
  )
}

const inputCls =
  'w-full bg-white border border-[#E2E1DA] rounded-[12px] px-3.5 py-2.5 text-[13px] outline-none focus:border-[#351E28]'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#FFFFFF] border rounded-[16px] p-5" style={{ borderColor: 'rgba(229,163,46,0.2)' }}>
      <h2 className="font-display text-[15px] font-bold mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-[12px] font-semibold mb-1">
        {label}
        {required && <span style={{ color: '#B03616' }}> *</span>}
      </label>
      {children}
    </div>
  )
}
