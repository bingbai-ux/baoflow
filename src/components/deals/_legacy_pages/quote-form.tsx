'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { calculateQuote } from '@/lib/calc/cost-engine'
import { createQuote } from '@/lib/actions/quotes'
import { formatJPY, formatUSD } from '@/lib/utils/format'

interface SpecOption {
  id: string
  product_name: string | null
  size_label?: string | null
}

interface QuoteFormProps {
  dealId: string
  defaults: {
    exchange_rate: number
    cost_ratio: number
    tax_rate: number
  }
  specs: SpecOption[]
  defaultSpecId?: string | null
  cancelHref: string
}

export function QuoteForm({ dealId, defaults, specs, defaultSpecId, cancelHref }: QuoteFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [specId, setSpecId] = useState<string>(defaultSpecId || '')
  const [quantity, setQuantity] = useState<string>('1000')
  const [unitPrice, setUnitPrice] = useState<string>('1.00')
  const [plateFee, setPlateFee] = useState<string>('0')
  const [otherFees, setOtherFees] = useState<string>('0')
  const [exchangeRate, setExchangeRate] = useState<string>(String(defaults.exchange_rate))
  const [costRatio, setCostRatio] = useState<string>(String(defaults.cost_ratio))

  const num = (v: string): number => {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }

  const preview = useMemo(() => {
    const qty = num(quantity)
    const fup = num(unitPrice)
    const pf = num(plateFee)
    const of = num(otherFees)
    const er = num(exchangeRate)
    const cr = num(costRatio)
    if (qty <= 0 || fup <= 0 || er <= 0 || cr <= 0 || cr > 1) return null
    return calculateQuote({
      factoryUnitPriceUsd: fup,
      quantity: qty,
      shippingCostUsd: 0,
      plateFeeUsd: pf,
      otherFeesUsd: of,
      exchangeRate: er,
      costRatio: cr,
      taxRate: defaults.tax_rate,
    })
  }, [quantity, unitPrice, plateFee, otherFees, exchangeRate, costRatio, defaults.tax_rate])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    formData.set('deal_id', dealId)
    if (specId) formData.set('spec_id', specId)
    else formData.delete('spec_id')
    startTransition(async () => {
      const result = await createQuote(formData)
      if (result.error || !result.data) {
        setError(result.error || '保存に失敗しました')
        return
      }
      router.push(`/deals/${dealId}/quote`)
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Inputs */}
      <div className="space-y-4">
        {error && (
          <div className="bg-[#fef2f2] border border-[#fca5a5] rounded-[8px] px-3 py-2 text-[12px] text-[#b91c1c] font-body">
            {error}
          </div>
        )}

        <Field label="対応する商品仕様" hint={specs.length === 0 ? '先に商品仕様を追加してください' : '任意'}>
          <select
            value={specId}
            onChange={(e) => setSpecId(e.target.value)}
            className={inputClass}
          >
            <option value="">— 案件全体 (商品選択しない) —</option>
            {specs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.product_name || '(商品名未設定)'}
              </option>
            ))}
          </select>
        </Field>

        <Field label="数量" required>
          <input
            type="number"
            name="quantity"
            min="1"
            step="1"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="工場単価 (USD)" required>
          <input
            type="number"
            name="factory_unit_price_usd"
            min="0"
            step="0.0001"
            required
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="版代 (USD)">
            <input
              type="number"
              name="plate_fee_usd"
              min="0"
              step="0.01"
              value={plateFee}
              onChange={(e) => setPlateFee(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="その他費用 (USD)">
            <input
              type="number"
              name="other_fees_usd"
              min="0"
              step="0.01"
              value={otherFees}
              onChange={(e) => setOtherFees(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="為替レート (USD/JPY)" hint={`既定: ${defaults.exchange_rate}`}>
            <input
              type="number"
              name="exchange_rate"
              min="0"
              step="0.01"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="掛け率" hint={`既定: ${defaults.cost_ratio}`}>
            <input
              type="number"
              name="cost_ratio"
              min="0.01"
              max="1"
              step="0.01"
              value={costRatio}
              onChange={(e) => setCostRatio(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <p className="text-[11px] text-[#888] font-body">
          消費税率は設定値（{defaults.tax_rate}%）を使用します。送料は「その他費用」に含めてください。
        </p>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={isPending || !preview}
            className="bg-[#0a0a0a] text-white rounded-[8px] px-4 py-2 text-[13px] font-medium font-body disabled:opacity-50"
          >
            {isPending ? '保存中...' : '見積を確定'}
          </button>
          <Link
            href={cancelHref}
            className="bg-white text-[#555] border border-[#e8e8e6] rounded-[8px] px-4 py-2 text-[13px] font-medium font-body no-underline"
          >
            キャンセル
          </Link>
        </div>
      </div>

      {/* Live Preview */}
      <div className="bg-[#f5f5f4] rounded-[14px] border border-[#e8e8e6] p-5 self-start">
        <h3 className="text-[12px] font-body text-[#888] mb-3">計算結果プレビュー</h3>
        {!preview ? (
          <p className="text-[12px] font-body text-[#888]">
            入力値を確認してください（数量・工場単価・為替・掛け率は必須）。
          </p>
        ) : (
          <dl className="space-y-3 font-body">
            <Row label="原価合計 (USD)" value={formatUSD(preview.totalCostUsd)} />
            <Row label="1個あたり原価 (USD)" value={formatUSD(preview.unitCostUsd)} mono />
            <Row label="販売単価 (USD)" value={formatUSD(preview.sellingPriceUsd)} mono />
            <hr className="border-[#e8e8e6]" />
            <Row label="販売単価 (JPY)" value={formatJPY(preview.sellingPriceJpy)} mono large />
            <Row label="請求合計 税抜 (JPY)" value={formatJPY(preview.totalBillingJpy)} mono />
            <Row label="請求合計 税込 (JPY)" value={formatJPY(preview.totalBillingTaxJpy)} mono large highlight />
            <hr className="border-[#e8e8e6]" />
            <Row
              label="粗利 (USD)"
              value={`${formatUSD(preview.grossProfitUsd)} (${preview.grossProfitMargin.toFixed(1)}%)`}
            />
          </dl>
        )}
      </div>
    </form>
  )
}

const inputClass =
  'w-full px-3 py-2 text-[13px] font-body bg-white border border-[#e8e8e6] rounded-[8px] focus:outline-none focus:border-[#0a0a0a] tabular-nums'

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-[12px] font-body text-[#555] mb-1">
        <span>
          {label}
          {required && <span className="text-[#ef4444] ml-1">*</span>}
        </span>
        {hint && <span className="text-[11px] text-[#888]">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

function Row({
  label,
  value,
  mono,
  large,
  highlight,
}: {
  label: string
  value: string
  mono?: boolean
  large?: boolean
  highlight?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[11px] text-[#555]">{label}</dt>
      <dd
        className={`${mono ? 'tabular-nums' : ''} ${large ? 'text-[16px] font-semibold' : 'text-[13px]'} ${
          highlight ? 'text-[#22c55e]' : 'text-[#0a0a0a]'
        }`}
      >
        {value}
      </dd>
    </div>
  )
}
