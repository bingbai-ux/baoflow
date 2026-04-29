'use client'

// Sprint 8-3: クライアント自己登録フォーム。
// 会社情報 + 配送先 (複数登録可) + 送信。

import { useState, useTransition } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { submitClientRegistration } from '@/lib/actions/external-forms'
import {
  ExternalFormSuccess,
  ExternalFormError,
} from '@/components/external/external-form-error'
import type {
  ClientSelfRegistrationPayload,
  ClientAddressInput,
} from '@/lib/actions/external-forms-types'

const NEW_ADDR = (): ClientAddressInput => ({
  label: '',
  recipient_name: '',
  postal_code: '',
  address_line1: '',
  address_line2: '',
  phone: '',
  email: '',
  is_default: false,
  notes: '',
})

export function ClientRegistrationForm({ token }: { token: string }) {
  const [pending, startSubmit] = useTransition()
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<ClientSelfRegistrationPayload>({
    company_name: '',
    short_name: '',
    industry: '',
    contact_name: '',
    contact_role: '',
    phone: '',
    email: '',
    tax_id: '',
    payment_terms: '月末締め翌月末払い',
    tax_rate: 10,
    addresses: [{ ...NEW_ADDR(), is_default: true }],
  })

  const updateField = <K extends keyof ClientSelfRegistrationPayload>(
    key: K,
    value: ClientSelfRegistrationPayload[K]
  ) => setForm((s) => ({ ...s, [key]: value }))

  const addAddress = () => {
    setForm((s) => ({ ...s, addresses: [...s.addresses, NEW_ADDR()] }))
  }

  const removeAddress = (idx: number) => {
    setForm((s) => ({
      ...s,
      addresses: s.addresses.filter((_, i) => i !== idx),
    }))
  }

  const updateAddress = <K extends keyof ClientAddressInput>(
    idx: number,
    key: K,
    value: ClientAddressInput[K]
  ) => {
    setForm((s) => ({
      ...s,
      addresses: s.addresses.map((a, i) => (i === idx ? { ...a, [key]: value } : a)),
    }))
  }

  const setDefault = (idx: number) => {
    setForm((s) => ({
      ...s,
      addresses: s.addresses.map((a, i) => ({ ...a, is_default: i === idx })),
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startSubmit(async () => {
      const r = await submitClientRegistration(token, form)
      if (r.success) setSubmitted(true)
      else setError(r.error || '送信に失敗しました')
    })
  }

  if (submitted) {
    return (
      <ExternalFormSuccess message="ご入力ありがとうございました。担当者から改めてご連絡いたします。" />
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <ExternalFormError message={error} />}

      {/* 会社基本情報 */}
      <Section title="会社情報">
        <Field label="会社名" required>
          <input
            type="text"
            value={form.company_name}
            onChange={(e) => updateField('company_name', e.target.value)}
            required
            className={inputCls}
          />
        </Field>
        <Row>
          <Field label="略称">
            <input
              type="text"
              value={form.short_name || ''}
              onChange={(e) => updateField('short_name', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="業種">
            <input
              type="text"
              value={form.industry || ''}
              onChange={(e) => updateField('industry', e.target.value)}
              placeholder="例: 食品メーカー / カフェ"
              className={inputCls}
            />
          </Field>
        </Row>
      </Section>

      {/* 担当者 */}
      <Section title="ご担当者">
        <Row>
          <Field label="氏名">
            <input
              type="text"
              value={form.contact_name || ''}
              onChange={(e) => updateField('contact_name', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="役職">
            <input
              type="text"
              value={form.contact_role || ''}
              onChange={(e) => updateField('contact_role', e.target.value)}
              placeholder="例: デザイナー / 代表"
              className={inputCls}
            />
          </Field>
        </Row>
        <Row>
          <Field label="電話番号">
            <input
              type="tel"
              value={form.phone || ''}
              onChange={(e) => updateField('phone', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="メールアドレス">
            <input
              type="email"
              value={form.email || ''}
              onChange={(e) => updateField('email', e.target.value)}
              className={inputCls}
            />
          </Field>
        </Row>
      </Section>

      {/* 請求情報 */}
      <Section title="請求情報">
        <Field label="インボイス登録番号">
          <input
            type="text"
            value={form.tax_id || ''}
            onChange={(e) => updateField('tax_id', e.target.value)}
            placeholder="T+13桁"
            className={inputCls}
          />
        </Field>
        <Row>
          <Field label="支払条件">
            <input
              type="text"
              value={form.payment_terms || ''}
              onChange={(e) => updateField('payment_terms', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="税率 (%)">
            <select
              value={String(form.tax_rate ?? 10)}
              onChange={(e) =>
                updateField('tax_rate', e.target.value ? Number(e.target.value) : null)
              }
              className={inputCls}
            >
              <option value="10">10%</option>
              <option value="8">8% (軽減税率)</option>
              <option value="0">0% (非課税)</option>
            </select>
          </Field>
        </Row>
      </Section>

      {/* 配送先 */}
      <Section
        title={`配送先 (${form.addresses.length})`}
        right={
          <button
            type="button"
            onClick={addAddress}
            className="inline-flex items-center gap-1 text-[12px]"
            style={{ color: '#e5a32e' }}
          >
            <Plus className="w-3.5 h-3.5" /> 配送先を追加
          </button>
        }
      >
        <p className="text-[11px] text-[#888] mb-2">複数の配送先がある場合は「+ 追加」してください。</p>
        <div className="space-y-3">
          {form.addresses.map((addr, idx) => (
            <div
              key={idx}
              className="bg-white border rounded-[10px] p-3"
              style={{ borderColor: 'rgba(229,163,46,0.2)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-[10px] font-display font-bold tracking-wider"
                  style={{ color: '#e5a32e' }}
                >
                  #{idx + 1}
                </span>
                <label className="text-[11px] inline-flex items-center gap-1">
                  <input
                    type="radio"
                    name="default-address"
                    checked={!!addr.is_default}
                    onChange={() => setDefault(idx)}
                  />
                  デフォルト
                </label>
                {form.addresses.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeAddress(idx)}
                    className="ml-auto text-[#c0392b] hover:bg-[#fef2f2] rounded p-1"
                    title="削除"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              <Field label="ラベル" required>
                <input
                  type="text"
                  value={addr.label}
                  onChange={(e) => updateAddress(idx, 'label', e.target.value)}
                  required
                  placeholder="例: 本社 / 渋谷店 / 石津様"
                  className={inputCls}
                />
              </Field>
              <Row>
                <Field label="〒">
                  <input
                    type="text"
                    value={addr.postal_code || ''}
                    onChange={(e) => updateAddress(idx, 'postal_code', e.target.value)}
                    placeholder="000-0000"
                    className={inputCls}
                  />
                </Field>
                <Field label="受取人">
                  <input
                    type="text"
                    value={addr.recipient_name || ''}
                    onChange={(e) => updateAddress(idx, 'recipient_name', e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </Row>
              <Field label="住所" required>
                <input
                  type="text"
                  value={addr.address_line1}
                  onChange={(e) => updateAddress(idx, 'address_line1', e.target.value)}
                  required
                  placeholder="都道府県＋市区町村"
                  className={inputCls}
                />
              </Field>
              <Field label="番地・建物名">
                <input
                  type="text"
                  value={addr.address_line2 || ''}
                  onChange={(e) => updateAddress(idx, 'address_line2', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="電話">
                <input
                  type="tel"
                  value={addr.phone || ''}
                  onChange={(e) => updateAddress(idx, 'phone', e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
          ))}
        </div>
      </Section>

      {/* Submit */}
      <button
        type="submit"
        disabled={pending}
        className="w-full py-3 rounded-[10px] text-white font-medium font-body text-[14px] disabled:opacity-50 transition-colors"
        style={{ background: pending ? '#888' : '#e5a32e' }}
      >
        {pending ? '送信中…' : '送信する'}
      </button>
    </form>
  )
}

// ---- styling helpers ----

const inputCls =
  'w-full px-3 py-2 text-[13px] border border-[#e8e8e6] rounded-[8px] bg-white focus:outline-none focus:border-[#e5a32e] focus:ring-1 focus:ring-[#e5a32e]'

function Section({
  title,
  right,
  children,
}: {
  title: string
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section
      className="bg-white border rounded-[12px] p-5"
      style={{ borderColor: 'rgba(229,163,46,0.15)' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <h2 className="font-display text-[14px] font-semibold text-[#1a1a1a]">{title}</h2>
        {right && <div className="ml-auto">{right}</div>}
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
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
    <label className="block">
      <span className="block text-[11px] text-[#555] mb-1 font-medium">
        {label}
        {required && <span className="text-[#c0392b] ml-1">*</span>}
      </span>
      {children}
    </label>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
}
