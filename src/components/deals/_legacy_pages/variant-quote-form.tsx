'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { calculateFullQuote } from '@/lib/calc/quote-engine'
import { createQuote } from '@/lib/actions/quotes'
import { formatJPY, formatUSD } from '@/lib/utils/format'
import type { DealProductVariant } from '@/lib/types'

interface CalcDefaults {
  exchange_rate: number
  cost_ratio: number
  tax_rate: number
  yuan_to_usd_rate: number
  china_freight_rate_yuan_per_kg: number
  pantone_color_fee_yuan: number
}

interface Props {
  dealId: string
  variant: DealProductVariant
  defaults: CalcDefaults
  cancelHref: string
}

export function VariantQuoteForm({ dealId, variant, defaults, cancelHref }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [quantity, setQuantity] = useState('1000')
  const [moq, setMoq] = useState('')
  const [unitPrice, setUnitPrice] = useState('1.00')

  const [exchangeRate, setExchangeRate] = useState(String(defaults.exchange_rate))
  const [costRatio, setCostRatio] = useState(String(defaults.cost_ratio))
  const [yuanRate, setYuanRate] = useState(String(defaults.yuan_to_usd_rate))
  const [freightRate, setFreightRate] = useState(String(defaults.china_freight_rate_yuan_per_kg))

  const [plateFee, setPlateFee] = useState('0')
  const [pantoneFee, setPantoneFee] = useState('0')
  const [domesticFreight, setDomesticFreight] = useState('0')
  const [sampleCost, setSampleCost] = useState('0')
  const [sampleShip, setSampleShip] = useState('0')
  const [otherFees, setOtherFees] = useState('0')

  const num = (v: string): number => {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }

  const physics = {
    pcsPerCarton: variant.pcs_per_carton ?? 0,
    cartonWidthCm: variant.carton_width_cm ?? 0,
    cartonHeightCm: variant.carton_height_cm ?? 0,
    cartonDepthCm: variant.carton_depth_cm ?? 0,
    grossWeightKg: variant.gross_weight_kg ?? 0,
  }

  const physicsReady =
    physics.pcsPerCarton > 0 &&
    physics.cartonWidthCm > 0 &&
    physics.cartonHeightCm > 0 &&
    physics.cartonDepthCm > 0 &&
    physics.grossWeightKg > 0

  const preview = useMemo(() => {
    const qty = num(quantity)
    const fup = num(unitPrice)
    const er = num(exchangeRate)
    const cr = num(costRatio)
    const yr = num(yuanRate)
    const fr = num(freightRate)
    if (qty <= 0 || fup <= 0 || er <= 0 || cr <= 0 || cr > 1 || yr <= 0 || fr < 0) return null
    return calculateFullQuote({
      orderQty: qty,
      factoryUnitPriceUsd: fup,
      physics,
      chinaFreightRateYuanPerKg: fr,
      yuanToUsdRate: yr,
      exchangeRate: er,
      costRatio: cr,
      taxRate: defaults.tax_rate,
      plateFeeUsd: num(plateFee),
      pantoneColorFeeUsd: num(pantoneFee),
      domesticChinaFreightUsd: num(domesticFreight),
      sampleCostUsd: num(sampleCost),
      sampleShippingUsd: num(sampleShip),
      otherFeesUsd: num(otherFees),
    })
  }, [
    quantity,
    unitPrice,
    exchangeRate,
    costRatio,
    yuanRate,
    freightRate,
    plateFee,
    pantoneFee,
    domesticFreight,
    sampleCost,
    sampleShip,
    otherFees,
    defaults.tax_rate,
    physics.pcsPerCarton,
    physics.cartonWidthCm,
    physics.cartonHeightCm,
    physics.cartonDepthCm,
    physics.grossWeightKg,
  ])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    fd.set('deal_id', dealId)
    fd.set('variant_id', variant.id)
    startTransition(async () => {
      const r = await createQuote(fd)
      if (r.error || !r.data) {
        setError(r.error || '保存に失敗しました')
        return
      }
      router.push(`/deals/${dealId}/quote`)
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="space-y-3">
        {error && (
          <div className="bg-[#fef2f2] border border-[#fca5a5] rounded-[8px] px-3 py-2 text-[12px] text-[#b91c1c] font-body">
            {error}
          </div>
        )}

        {!physicsReady && (
          <div className="bg-[#fffbeb] border border-[#fde68a] rounded-[8px] px-3 py-2 text-[12px] text-[#b45309] font-body">
            このバリエーションのカートン情報 (PCS/CTN, CARTONMEAS, G.W) が未入力です。物流計算ができません。
            <Link
              href={`/deals/${dealId}/products/${variant.product_id}/variants/${variant.id}/edit`}
              className="ml-1 underline"
            >
              バリエーションを編集
            </Link>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Field label="数量" required>
            <input
              type="number"
              name="quantity"
              required
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="MOQ" hint="任意">
            <input
              type="number"
              name="moq"
              min="0"
              step="1"
              value={moq}
              onChange={(e) => setMoq(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="工場単価 (USD)" required>
          <input
            type="number"
            name="factory_unit_price_usd"
            required
            min="0"
            step="0.0001"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Group title="レート">
          <div className="grid grid-cols-2 gap-2">
            <Field label="USD/JPY" hint={`既定 ${defaults.exchange_rate}`}>
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
            <Field label="掛け率" hint={`既定 ${defaults.cost_ratio}`}>
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
            <Field label="元/USD" hint={`既定 ${defaults.yuan_to_usd_rate}`}>
              <input
                type="number"
                name="yuan_to_usd_rate"
                min="0"
                step="0.01"
                value={yuanRate}
                onChange={(e) => setYuanRate(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="中国運賃 (元/kg)" hint={`既定 ${defaults.china_freight_rate_yuan_per_kg}`}>
              <input
                type="number"
                name="china_freight_rate_yuan_per_kg"
                min="0"
                step="0.1"
                value={freightRate}
                onChange={(e) => setFreightRate(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </Group>

        <Group title="追加費用 (USD)">
          <div className="grid grid-cols-2 gap-2">
            <Field label="型代/版代">
              <input type="number" name="plate_fee_usd" min="0" step="0.01" value={plateFee} onChange={(e) => setPlateFee(e.target.value)} className={inputClass} />
            </Field>
            <Field label="パントン指定料">
              <input type="number" name="pantone_color_fee_usd" min="0" step="0.01" value={pantoneFee} onChange={(e) => setPantoneFee(e.target.value)} className={inputClass} />
            </Field>
            <Field label="中国国内送料">
              <input type="number" name="domestic_china_freight_usd" min="0" step="0.01" value={domesticFreight} onChange={(e) => setDomesticFreight(e.target.value)} className={inputClass} />
            </Field>
            <Field label="サンプル製作">
              <input type="number" name="sample_cost_usd" min="0" step="0.01" value={sampleCost} onChange={(e) => setSampleCost(e.target.value)} className={inputClass} />
            </Field>
            <Field label="サンプル取寄">
              <input type="number" name="sample_shipping_usd" min="0" step="0.01" value={sampleShip} onChange={(e) => setSampleShip(e.target.value)} className={inputClass} />
            </Field>
            <Field label="その他">
              <input type="number" name="other_fees_usd" min="0" step="0.01" value={otherFees} onChange={(e) => setOtherFees(e.target.value)} className={inputClass} />
            </Field>
          </div>
        </Group>

        <p className="text-[11px] text-[#888] font-body">
          消費税率は設定値 ({defaults.tax_rate}%) を使用します。
        </p>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={pending || !preview || !physicsReady}
            className="bg-[#0a0a0a] text-white rounded-[8px] px-4 py-2 text-[13px] font-medium font-body disabled:opacity-50"
          >
            {pending ? '保存中...' : '見積を確定'}
          </button>
          <Link
            href={cancelHref}
            className="bg-white text-[#555] border border-[#e8e8e6] rounded-[8px] px-4 py-2 text-[13px] font-medium font-body no-underline"
          >
            キャンセル
          </Link>
        </div>
      </div>

      <div className="bg-[#f5f5f4] rounded-[14px] border border-[#e8e8e6] p-5 self-start">
        <h3 className="text-[12px] font-body text-[#888] mb-3">計算結果プレビュー</h3>
        {!preview || !physicsReady ? (
          <p className="text-[12px] font-body text-[#888]">
            入力値とバリエーションの物理情報を確認してください。
          </p>
        ) : (
          <dl className="space-y-2 font-body">
            <Row label="カートン数 (CTNS)" value={`${preview.cartonCount}`} />
            <Row label="容積重量/CTN" value={`${preview.volumetricWeightPerCarton} kg`} />
            <Row label="容積重量 合計" value={`${preview.volumetricWeightKg} kg`} />
            <Row label="実重量 合計" value={`${preview.actualWeightTotalKg} kg`} />
            <Row label="送料計算重量" value={`${preview.shippingWeightKg} kg`} bold />
            <hr className="border-[#e8e8e6]" />
            <Row label="中国送料 (元)" value={`¥CN ${preview.chinaFreightYuan.toFixed(2)}`} />
            <Row label="中国送料 (USD)" value={formatUSD(preview.chinaFreightUsd)} />
            <Row label="送料合計 (USD)" value={formatUSD(preview.totalShippingUsd)} bold />
            <hr className="border-[#e8e8e6]" />
            <Row label="原価合計 (USD)" value={formatUSD(preview.totalCostUsd)} />
            <Row label="1個原価 (USD)" value={formatUSD(preview.unitCostUsd)} />
            <Row label="販売単価 (USD)" value={formatUSD(preview.sellingPriceUsd)} />
            <Row label="販売単価 (JPY)" value={formatJPY(preview.sellingPriceJpy)} large />
            <Row label="請求合計 税抜" value={formatJPY(preview.totalBillingJpy)} />
            <Row label="請求合計 税込" value={formatJPY(preview.totalBillingTaxJpy)} large highlight />
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
  'w-full px-2 py-1.5 text-[12px] font-body bg-white border border-[#e8e8e6] rounded-[6px] focus:outline-none focus:border-[#0a0a0a] tabular-nums'

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
      <span className="flex items-baseline justify-between text-[10px] font-body text-[#555] mb-0.5">
        <span>
          {label}
          {required && <span className="text-[#ef4444] ml-1">*</span>}
        </span>
        {hint && <span className="text-[9px] text-[#888]">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border border-[#e8e8e6] rounded-[8px] p-2.5">
      <legend className="px-1 text-[11px] font-body text-[#888]">{title}</legend>
      <div className="mt-1">{children}</div>
    </fieldset>
  )
}

function Row({
  label,
  value,
  bold,
  large,
  highlight,
}: {
  label: string
  value: string
  bold?: boolean
  large?: boolean
  highlight?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[11px]">
      <dt className="text-[#555]">{label}</dt>
      <dd
        className={`tabular-nums ${large ? 'text-[16px] font-semibold' : bold ? 'text-[12px] font-semibold' : ''} ${
          highlight ? 'text-[#22c55e]' : 'text-[#0a0a0a]'
        }`}
      >
        {value}
      </dd>
    </div>
  )
}
