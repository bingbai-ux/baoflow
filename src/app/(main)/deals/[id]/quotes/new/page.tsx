'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { calculateQuote, calculateMultipleQuantities, comparePaymentMethods } from '@/lib/calc/cost-engine'
import { formatJPY, formatUSD } from '@/lib/utils/format'

interface Factory {
  id: string
  factory_name: string
}

interface ShippingOption {
  method: 'sea' | 'air' | 'partial_air'
  incoterms: string
  costUsd: number
  days: number
}

const shippingMethodLabels: Record<string, string> = {
  sea: '船便',
  air: '航空便',
  partial_air: '航空+船便',
}

export default function NewQuotePage() {
  const router = useRouter()
  const params = useParams()
  const dealId = params.id as string

  const [factories, setFactories] = useState<Factory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [factoryId, setFactoryId] = useState('')
  const [quantities, setQuantities] = useState<number[]>([5000])
  const [factoryUnitPriceUsd, setFactoryUnitPriceUsd] = useState('')
  const [plateFeeUsd, setPlateFeeUsd] = useState('')
  const [otherFeesUsd, setOtherFeesUsd] = useState('')
  const [costRatio, setCostRatio] = useState(0.5)
  const [exchangeRate, setExchangeRate] = useState(150)
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([
    { method: 'sea', incoterms: 'ddp', costUsd: 0, days: 45 }
  ])

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()

      // Get factories
      const { data: factoriesData } = await supabase
        .from('factories')
        .select('id, factory_name')
        .order('factory_name')

      if (factoriesData) setFactories(factoriesData)

      // Get default exchange rate from settings
      const { data: settings } = await supabase
        .from('system_settings')
        .select('default_exchange_rate')
        .limit(1)
        .single()

      if (settings?.default_exchange_rate) {
        setExchangeRate(parseFloat(String(settings.default_exchange_rate)))
      }
    }

    fetchData()
  }, [])

  // Calculate results
  const calculationResults = useMemo(() => {
    if (!factoryUnitPriceUsd || quantities.length === 0) return null

    const selectedShipping = shippingOptions[0]
    const shippingCostUsd = selectedShipping?.costUsd || 0

    return calculateMultipleQuantities(
      {
        factoryUnitPriceUsd: parseFloat(factoryUnitPriceUsd),
        plateFeeUsd: plateFeeUsd ? parseFloat(plateFeeUsd) : 0,
        otherFeesUsd: otherFeesUsd ? parseFloat(otherFeesUsd) : 0,
        shippingCostUsd,
        costRatio,
        exchangeRate,
        taxRate: 10,
      },
      quantities
    )
  }, [factoryUnitPriceUsd, quantities, plateFeeUsd, otherFeesUsd, costRatio, exchangeRate, shippingOptions])

  // Compare payment methods
  const paymentComparison = useMemo(() => {
    if (!factoryUnitPriceUsd || quantities.length === 0) return null

    const selectedShipping = shippingOptions[0]
    const shippingCostUsd = selectedShipping?.costUsd || 0

    return comparePaymentMethods({
      quantity: quantities[0],
      factoryUnitPriceUsd: parseFloat(factoryUnitPriceUsd),
      plateFeeUsd: plateFeeUsd ? parseFloat(plateFeeUsd) : 0,
      otherFeesUsd: otherFeesUsd ? parseFloat(otherFeesUsd) : 0,
      shippingCostUsd,
      costRatio,
      exchangeRate,
      taxRate: 10,
    })
  }, [factoryUnitPriceUsd, quantities, plateFeeUsd, otherFeesUsd, costRatio, exchangeRate, shippingOptions])

  const addQuantity = () => {
    setQuantities([...quantities, 10000])
  }

  const updateQuantity = (index: number, value: number) => {
    const newQuantities = [...quantities]
    newQuantities[index] = value
    setQuantities(newQuantities)
  }

  const removeQuantity = (index: number) => {
    if (quantities.length > 1) {
      setQuantities(quantities.filter((_, i) => i !== index))
    }
  }

  const addShippingOption = () => {
    setShippingOptions([...shippingOptions, { method: 'air', incoterms: 'ddp', costUsd: 0, days: 14 }])
  }

  const updateShippingOption = (index: number, field: keyof ShippingOption, value: string | number) => {
    const newOptions = [...shippingOptions]
    newOptions[index] = { ...newOptions[index], [field]: value }
    setShippingOptions(newOptions)
  }

  const removeShippingOption = (index: number) => {
    if (shippingOptions.length > 1) {
      setShippingOptions(shippingOptions.filter((_, i) => i !== index))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!factoryId || !factoryUnitPriceUsd || quantities.length === 0) {
      setError('必須項目を入力してください')
      return
    }

    setLoading(true)
    setError(null)

    const supabase = createClient()

    // Get version number
    const { data: existingQuotes } = await supabase
      .from('deal_quotes')
      .select('version')
      .eq('deal_id', dealId)
      .order('version', { ascending: false })
      .limit(1)

    const version = existingQuotes && existingQuotes.length > 0 ? existingQuotes[0].version + 1 : 1

    // Create quotes for each quantity
    for (const qty of quantities) {
      const result = calculateQuote({
        quantity: qty,
        factoryUnitPriceUsd: parseFloat(factoryUnitPriceUsd),
        plateFeeUsd: plateFeeUsd ? parseFloat(plateFeeUsd) : 0,
        otherFeesUsd: otherFeesUsd ? parseFloat(otherFeesUsd) : 0,
        shippingCostUsd: shippingOptions[0]?.costUsd || 0,
        costRatio,
        exchangeRate,
        taxRate: 10,
      })

      const { data: quote, error: quoteError } = await supabase
        .from('deal_quotes')
        .insert({
          deal_id: dealId,
          factory_id: factoryId,
          version,
          quantity: qty,
          factory_unit_price_usd: parseFloat(factoryUnitPriceUsd),
          plate_fee_usd: plateFeeUsd ? parseFloat(plateFeeUsd) : null,
          other_fees_usd: otherFeesUsd ? parseFloat(otherFeesUsd) : null,
          cost_ratio: costRatio,
          exchange_rate: exchangeRate,
          total_cost_usd: result.totalCostUsd,
          unit_cost_usd: result.unitCostUsd,
          selling_price_usd: result.sellingPriceUsd,
          selling_price_jpy: result.sellingPriceJpy,
          total_billing_jpy: result.totalBillingJpy,
          total_billing_tax_jpy: result.totalBillingTaxJpy,
          status: 'drafting',
        })
        .select()
        .single()

      if (quoteError) {
        setError(quoteError.message)
        setLoading(false)
        return
      }

      // Create shipping options for this quote
      for (const opt of shippingOptions) {
        await supabase.from('deal_shipping_options').insert({
          deal_quote_id: quote.id,
          shipping_method: opt.method,
          incoterm: opt.incoterms,
          shipping_cost_usd: opt.costUsd,
          shipping_days: opt.days,
        })
      }
    }

    router.push(`/deals/${dealId}`)
  }

  return (
    <>
      <div className="max-w-[1000px]">
        {/* Page Header */}
        <div className="flex justify-between items-center py-[18px]">
          <h1 className="font-display text-[22px] font-semibold text-[#0a0a0a]">
            見積もり作成
          </h1>
          <Link
            href={`/deals/${dealId}`}
            className="text-[#888] text-[13px] font-body no-underline hover:text-[#555]"
          >
            キャンセル
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5 mb-4">
              <h2 className="text-[14px] font-medium text-[#0a0a0a] mb-4 font-body">基本情報</h2>

              {/* Factory */}
              <div className="mb-4">
                <label style={labelStyle}>工場 *</label>
                <select
                  value={factoryId}
                  onChange={(e) => setFactoryId(e.target.value)}
                  style={inputStyle}
                  required
                >
                  <option value="">選択してください</option>
                  {factories.map(f => (
                    <option key={f.id} value={f.id}>{f.factory_name}</option>
                  ))}
                </select>
              </div>

              {/* Quantities */}
              <div className="mb-4">
                <label style={labelStyle}>数量</label>
                {quantities.map((qty, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="number"
                      value={qty}
                      onChange={(e) => updateQuantity(index, parseInt(e.target.value) || 0)}
                      style={{ ...inputStyle, flex: 1 }}
                      placeholder="数量"
                    />
                    {quantities.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeQuantity(index)}
                        className="text-[#888] text-[12px] px-2"
                      >
                        削除
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addQuantity}
                  className="text-[#22c55e] text-[12px] font-body"
                >
                  + 数量パターン追加
                </button>
              </div>

              {/* Unit Price */}
              <div className="mb-4">
                <label style={labelStyle}>工場単価 (USD) *</label>
                <input
                  type="number"
                  step="0.001"
                  value={factoryUnitPriceUsd}
                  onChange={(e) => setFactoryUnitPriceUsd(e.target.value)}
                  style={inputStyle}
                  placeholder="0.000"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label style={labelStyle}>版代 (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={plateFeeUsd}
                    onChange={(e) => setPlateFeeUsd(e.target.value)}
                    style={inputStyle}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label style={labelStyle}>その他費用 (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={otherFeesUsd}
                    onChange={(e) => setOtherFeesUsd(e.target.value)}
                    style={inputStyle}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Cost Ratio Slider */}
              <div className="mb-4">
                <label style={labelStyle}>掛率: {(costRatio * 100).toFixed(0)}%</label>
                <input
                  type="range"
                  min="0.4"
                  max="0.7"
                  step="0.01"
                  value={costRatio}
                  onChange={(e) => setCostRatio(parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
                <div className="flex justify-between text-[10px] text-[#888] font-body">
                  <span>40%</span>
                  <span>70%</span>
                </div>
              </div>

              {/* Exchange Rate */}
              <div className="mb-4">
                <label style={labelStyle}>為替レート (USD/JPY)</label>
                <input
                  type="number"
                  step="0.01"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 150)}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Shipping Options */}
            <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5 mb-4">
              <h2 className="text-[14px] font-medium text-[#0a0a0a] mb-4 font-body">配送オプション</h2>

              {shippingOptions.map((opt, index) => (
                <div key={index} className="border border-[rgba(0,0,0,0.06)] rounded-[12px] p-3 mb-3">
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label style={labelStyle}>配送方法</label>
                      <select
                        value={opt.method}
                        onChange={(e) => updateShippingOption(index, 'method', e.target.value)}
                        style={inputStyle}
                      >
                        <option value="sea">船便</option>
                        <option value="air">航空便</option>
                        <option value="partial_air">航空+船便</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Incoterms</label>
                      <select
                        value={opt.incoterms}
                        onChange={(e) => updateShippingOption(index, 'incoterms', e.target.value)}
                        style={inputStyle}
                      >
                        <option value="ddp">DDP</option>
                        <option value="dpu">DPU</option>
                        <option value="exw">EXW</option>
                        <option value="fob">FOB</option>
                        <option value="cif">CIF</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>送料 (USD)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={opt.costUsd}
                        onChange={(e) => updateShippingOption(index, 'costUsd', parseFloat(e.target.value) || 0)}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>日数</label>
                      <input
                        type="number"
                        value={opt.days}
                        onChange={(e) => updateShippingOption(index, 'days', parseInt(e.target.value) || 0)}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                  {shippingOptions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeShippingOption(index)}
                      className="text-[#888] text-[11px] mt-2 font-body"
                    >
                      削除
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addShippingOption}
                className="text-[#22c55e] text-[12px] font-body"
              >
                + 配送オプション追加
              </button>
            </div>

            {error && (
              <div className="py-3 px-4 rounded-[8px] bg-[rgba(229,163,46,0.1)] text-[#e5a32e] text-[13px] font-body mb-4">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                backgroundColor: '#0a0a0a',
                color: '#ffffff',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '13px',
                fontWeight: 500,
                fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? '保存中...' : '保存'}
            </button>
          </form>

          {/* Calculation Results */}
          <div>
            <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5 mb-4">
              <h2 className="text-[14px] font-medium text-[#0a0a0a] mb-4 font-body">計算結果</h2>

              {calculationResults && calculationResults.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                      <th style={thStyle}>数量</th>
                      <th style={thStyle}>原価合計</th>
                      <th style={thStyle}>商品単価</th>
                      <th style={thStyle}>販売単価</th>
                      <th style={thStyle}>請求合計(税込)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calculationResults.map((result, index) => (
                      <tr key={index} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                        <td style={tdStyle}>
                          <span className="font-display tabular-nums">{result.params.quantity.toLocaleString()}</span>
                        </td>
                        <td style={tdStyle}>
                          <span className="font-display tabular-nums">{formatUSD(result.totalCostUsd)}</span>
                        </td>
                        <td style={tdStyle}>
                          <span className="font-display tabular-nums">{formatUSD(result.unitCostUsd)}</span>
                        </td>
                        <td style={tdStyle}>
                          <span className="font-display tabular-nums">{formatJPY(result.sellingPriceJpy)}</span>
                        </td>
                        <td style={tdStyle}>
                          <span className="font-display tabular-nums font-semibold">{formatJPY(result.totalBillingTaxJpy)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-[12px] text-[#888] font-body">
                  単価と数量を入力すると計算結果が表示されます
                </p>
              )}
            </div>

            {/* Payment Method Comparison */}
            {paymentComparison && (
              <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5">
                <h2 className="text-[14px] font-medium text-[#0a0a0a] mb-4 font-body">支払い方法比較</h2>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                      <th style={thStyle}>方法</th>
                      <th style={thStyle}>手数料</th>
                      <th style={thStyle}>合計JPY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { key: 'wise', label: 'Wise', result: paymentComparison.wise },
                      { key: 'alibaba_cc', label: 'Alibaba CC', result: paymentComparison.alibabaCc },
                      { key: 'bank_transfer', label: '銀行振込', result: paymentComparison.bankTransfer },
                    ].map((method) => {
                      const isRecommended = paymentComparison.recommendation === method.key
                      const feeJpy = Math.round((method.result.paymentFeeUsd ?? 0) * exchangeRate)
                      return (
                        <tr key={method.key} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                          <td style={tdStyle}>
                            <span className="font-body text-[12px]">{method.label}</span>
                          </td>
                          <td style={tdStyle}>
                            <span className="font-display tabular-nums text-[12px]">{formatJPY(feeJpy)}</span>
                          </td>
                          <td style={tdStyle}>
                            <span className={`font-display tabular-nums text-[12px] ${isRecommended ? 'text-[#22c55e] font-semibold' : ''}`}>
                              {formatJPY(method.result.totalBillingTaxJpy)}
                              {isRecommended && ' (推奨)'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {paymentComparison.savingsUsd > 0 && (
                  <p className="text-[11px] text-[#888] font-body mt-3">
                    推奨の方法で {formatUSD(paymentComparison.savingsUsd)} (約{formatJPY(Math.round(paymentComparison.savingsUsd * exchangeRate))}) 節約可能
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 500,
  color: '#888888',
  marginBottom: '4px',
  fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: '#f2f2f0',
  borderRadius: '8px',
  padding: '8px 12px',
  fontSize: '13px',
  border: 'none',
  fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
  outline: 'none',
  boxSizing: 'border-box',
}

const thStyle: React.CSSProperties = {
  padding: '8px',
  textAlign: 'left',
  fontSize: '10px',
  fontWeight: 500,
  color: '#888888',
  fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
}

const tdStyle: React.CSSProperties = {
  padding: '8px',
  fontSize: '12px',
}
