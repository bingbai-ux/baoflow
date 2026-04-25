'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  calculateQuote,
  calculateMultipleQuantities,
  comparePaymentMethods,
  type QuoteCalculationParams,
  type QuoteCalculationResult,
  type PaymentMethod,
} from '@/lib/calc/cost-engine'
import { formatJPY, formatUSD, formatPercent } from '@/lib/utils/format'
import type { Deal, DealSpecification } from '@/lib/types'

interface Props {
  params: Promise<{ id: string }>
}

interface DealWithSpec extends Deal {
  deal_specifications?: DealSpecification[]
}

export default function QuoteCalculationPage({ params }: Props) {
  const [id, setId] = useState<string | null>(null)
  const [deal, setDeal] = useState<DealWithSpec | null>(null)

  // Form state (USD-based)
  const [factoryUnitPriceUsd, setFactoryUnitPriceUsd] = useState('0.50')
  const [exchangeRate, setExchangeRate] = useState('155')
  const [quantities, setQuantities] = useState<string[]>(['1000', '3000', '5000'])
  const [shippingCostUsd, setShippingCostUsd] = useState('200')
  const [plateFeeUsd, setPlateFeeUsd] = useState('100')
  const [otherFeesUsd, setOtherFeesUsd] = useState('0')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('wise')
  const [costRatio, setCostRatio] = useState('0.55')
  const [taxRate, setTaxRate] = useState('10')

  useEffect(() => {
    params.then(p => {
      setId(p.id)
      loadDeal(p.id)
    })
  }, [params])

  const loadDeal = async (dealId: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('deals')
      .select('*, deal_specifications(*)')
      .eq('id', dealId)
      .single()
    if (data) {
      setDeal(data)
    }
  }

  const baseParams: Omit<QuoteCalculationParams, 'quantity' | 'paymentMethod'> = useMemo(() => ({
    factoryUnitPriceUsd: parseFloat(factoryUnitPriceUsd) || 0,
    shippingCostUsd: parseFloat(shippingCostUsd) || 0,
    plateFeeUsd: parseFloat(plateFeeUsd) || 0,
    otherFeesUsd: parseFloat(otherFeesUsd) || 0,
    exchangeRate: parseFloat(exchangeRate) || 155,
    costRatio: parseFloat(costRatio) || 0.55,
    taxRate: parseFloat(taxRate) || 10,
  }), [factoryUnitPriceUsd, shippingCostUsd, plateFeeUsd, otherFeesUsd, exchangeRate, costRatio, taxRate])

  // Calculate results for all quantities
  const quantityResults: QuoteCalculationResult[] = useMemo(() => {
    const validQuantities = quantities
      .map(q => parseInt(q))
      .filter(q => q > 0)

    if (validQuantities.length === 0) return []

    return calculateMultipleQuantities(
      { ...baseParams, paymentMethod },
      validQuantities
    )
  }, [baseParams, paymentMethod, quantities])

  // Compare payment methods for the first quantity
  const paymentComparison = useMemo(() => {
    const firstQty = parseInt(quantities[0]) || 1000
    return comparePaymentMethods({ ...baseParams, quantity: firstQty })
  }, [baseParams, quantities])

  const addQuantity = () => {
    setQuantities([...quantities, ''])
  }

  const removeQuantity = (index: number) => {
    setQuantities(quantities.filter((_, i) => i !== index))
  }

  const updateQuantity = (index: number, value: string) => {
    const newQuantities = [...quantities]
    newQuantities[index] = value
    setQuantities(newQuantities)
  }

  const spec = deal?.deal_specifications?.[0]
  const productName = spec?.product_name || deal?.deal_name || '商品名未設定'

  if (!deal) {
    return (
      <div style={{ padding: '24px 26px' }}>
        <div style={{ color: '#888888', fontSize: '13px' }}>読み込み中...</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 26px' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: '24px',
              fontWeight: 600,
              color: '#0a0a0a',
              marginBottom: '4px',
            }}
          >
            見積もり計算
          </h1>
          <div style={{ fontSize: '13px', color: '#888888' }}>
            {deal.deal_code} - {productName}
          </div>
        </div>
        <Link
          href={`/deals/${id}`}
          style={{
            backgroundColor: '#ffffff',
            color: '#888888',
            border: '1px solid #e8e8e6',
            borderRadius: '8px',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 500,
            fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
            textDecoration: 'none',
          }}
        >
          戻る
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '8px' }}>
        {/* Input Form */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            border: '1px solid rgba(0,0,0,0.06)',
            padding: '20px 22px',
          }}
        >
          <h2 style={sectionTitleStyle}>入力パラメータ</h2>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>工場単価 (USD)</label>
            <input
              type="number"
              step="0.01"
              value={factoryUnitPriceUsd}
              onChange={(e) => setFactoryUnitPriceUsd(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>為替レート (USD→JPY)</label>
            <input
              type="number"
              step="0.01"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>数量</label>
            {quantities.map((qty, index) => (
              <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                <input
                  type="number"
                  value={qty}
                  onChange={(e) => updateQuantity(index, e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder="1000"
                />
                {quantities.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeQuantity(index)}
                    style={{
                      backgroundColor: '#f2f2f0',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0 12px',
                      color: '#888888',
                      cursor: 'pointer',
                      fontSize: '16px',
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addQuantity}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: '#0a0a0a',
                fontSize: '12px',
                cursor: 'pointer',
                padding: '4px 0',
              }}
            >
              + 数量を追加
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>配送費 (USD)</label>
              <input
                type="number"
                step="1"
                value={shippingCostUsd}
                onChange={(e) => setShippingCostUsd(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>版代 (USD)</label>
              <input
                type="number"
                step="1"
                value={plateFeeUsd}
                onChange={(e) => setPlateFeeUsd(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>その他費用 (USD)</label>
            <input
              type="number"
              step="1"
              value={otherFeesUsd}
              onChange={(e) => setOtherFeesUsd(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>支払い方法</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setPaymentMethod('wise')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: paymentMethod === 'wise' ? '#0a0a0a' : '#f2f2f0',
                  color: paymentMethod === 'wise' ? '#ffffff' : '#555555',
                }}
              >
                Wise
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('alibaba_cc')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: paymentMethod === 'alibaba_cc' ? '#0a0a0a' : '#f2f2f0',
                  color: paymentMethod === 'alibaba_cc' ? '#ffffff' : '#555555',
                }}
              >
                Alibaba CC
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>掛率 (原価率)</label>
              <input
                type="number"
                step="0.05"
                value={costRatio}
                onChange={(e) => setCostRatio(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>消費税率 (%)</label>
              <input
                type="number"
                step="1"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Quantity Comparison Table */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              border: '1px solid rgba(0,0,0,0.06)',
              padding: '20px 22px',
            }}
          >
            <h2 style={sectionTitleStyle}>複数数量比較</h2>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                    <th style={thStyle}>数量</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>原価合計</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>1個原価</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>販売単価</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>請求合計</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>粗利</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>粗利率</th>
                  </tr>
                </thead>
                <tbody>
                  {quantityResults.map((result, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                      <td style={tdStyle}>
                        <span style={{ fontFamily: "'Fraunces', serif", fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                          {result.params.quantity.toLocaleString()}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {formatUSD(result.totalCostUsd)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {formatUSD(result.unitCostUsd)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {formatJPY(result.sellingPriceJpy)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 500 }}>
                        {formatJPY(result.totalBillingTaxJpy)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: '#22c55e' }}>
                        {formatUSD(result.grossProfitUsd)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: '#22c55e', fontWeight: 500 }}>
                        {formatPercent(result.grossProfitMargin)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment Method Comparison */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              border: '1px solid rgba(0,0,0,0.06)',
              padding: '20px 22px',
            }}
          >
            <h2 style={sectionTitleStyle}>支払い方法比較</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              {/* Wise */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  border: paymentComparison.recommendation === 'wise' ? '2px solid #22c55e' : '1px solid rgba(0,0,0,0.06)',
                  backgroundColor: paymentComparison.recommendation === 'wise' ? 'rgba(34,197,94,0.05)' : '#f2f2f0',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#0a0a0a' }}>Wise</h3>
                  {paymentComparison.recommendation === 'wise' && (
                    <span style={{ fontSize: '11px', color: '#22c55e', fontWeight: 500 }}>推奨</span>
                  )}
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#888888', marginBottom: '2px' }}>手数料</div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: '14px' }}>
                    {formatUSD(paymentComparison.wise.paymentFeeUsd)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#888888', marginBottom: '2px' }}>粗利率</div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: '14px', color: '#22c55e' }}>
                    {formatPercent(paymentComparison.wise.grossProfitMargin)}
                  </div>
                </div>
              </div>

              {/* Alibaba CC */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  border: paymentComparison.recommendation === 'alibaba_cc' ? '2px solid #22c55e' : '1px solid rgba(0,0,0,0.06)',
                  backgroundColor: paymentComparison.recommendation === 'alibaba_cc' ? 'rgba(34,197,94,0.05)' : '#f2f2f0',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#0a0a0a' }}>Alibaba CC</h3>
                  {paymentComparison.recommendation === 'alibaba_cc' && (
                    <span style={{ fontSize: '11px', color: '#22c55e', fontWeight: 500 }}>推奨</span>
                  )}
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#888888', marginBottom: '2px' }}>手数料</div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: '14px' }}>
                    {formatUSD(paymentComparison.alibabaCc.paymentFeeUsd)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#888888', marginBottom: '2px' }}>粗利率</div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: '14px', color: '#22c55e' }}>
                    {formatPercent(paymentComparison.alibabaCc.grossProfitMargin)}
                  </div>
                </div>
              </div>

              {/* Bank Transfer */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  border: paymentComparison.recommendation === 'bank_transfer' ? '2px solid #22c55e' : '1px solid rgba(0,0,0,0.06)',
                  backgroundColor: paymentComparison.recommendation === 'bank_transfer' ? 'rgba(34,197,94,0.05)' : '#f2f2f0',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#0a0a0a' }}>銀行振込</h3>
                  {paymentComparison.recommendation === 'bank_transfer' && (
                    <span style={{ fontSize: '11px', color: '#22c55e', fontWeight: 500 }}>推奨</span>
                  )}
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#888888', marginBottom: '2px' }}>手数料</div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: '14px' }}>
                    {formatUSD(paymentComparison.bankTransfer.paymentFeeUsd)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#888888', marginBottom: '2px' }}>粗利率</div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: '14px', color: '#22c55e' }}>
                    {formatPercent(paymentComparison.bankTransfer.grossProfitMargin)}
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: '16px',
                padding: '12px 16px',
                backgroundColor: 'rgba(34,197,94,0.1)',
                borderRadius: '10px',
                fontSize: '13px',
                color: '#15803d',
              }}
            >
              {paymentComparison.recommendation === 'wise' ? 'Wise' : paymentComparison.recommendation === 'alibaba_cc' ? 'Alibaba CC' : '銀行振込'}を使うと最大
              <strong style={{ fontFamily: "'Fraunces', serif", margin: '0 4px' }}>
                {formatUSD(paymentComparison.savingsUsd)}
              </strong>
              節約できます
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 500,
  color: '#0a0a0a',
  marginBottom: '16px',
  fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 500,
  color: '#555555',
  marginBottom: '6px',
  fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: '#f2f2f0',
  borderRadius: '10px',
  padding: '10px 14px',
  fontSize: '13px',
  border: 'none',
  fontFamily: "'Fraunces', serif",
  fontVariantNumeric: 'tabular-nums',
  outline: 'none',
  boxSizing: 'border-box',
}

const thStyle: React.CSSProperties = {
  padding: '10px 8px',
  fontSize: '11px',
  fontWeight: 500,
  color: '#bbbbbb',
  fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
  textAlign: 'left',
}

const tdStyle: React.CSSProperties = {
  padding: '12px 8px',
  fontSize: '12px',
  color: '#0a0a0a',
  fontFamily: "'Fraunces', serif",
  fontVariantNumeric: 'tabular-nums',
}
