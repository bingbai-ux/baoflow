'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  calculateCost,
  calculateMultipleQuantities,
  comparePaymentMethods,
  type CostParams,
  type CostResult,
  type PaymentMethod,
  type ShippingMethod,
} from '@/lib/calc/cost-engine'
import { formatCurrency, formatPercent } from '@/lib/utils/format'
import type { Deal } from '@/lib/types'

interface Props {
  params: Promise<{ id: string }>
}

export default function QuoteCalculationPage({ params }: Props) {
  const router = useRouter()
  const [id, setId] = useState<string | null>(null)
  const [deal, setDeal] = useState<Deal | null>(null)

  // Form state
  const [unitPriceCny, setUnitPriceCny] = useState('10')
  const [exchangeRate, setExchangeRate] = useState('21.5')
  const [quantities, setQuantities] = useState<string[]>(['1000', '3000', '5000'])
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('sea_d2d')
  const [productWeightKg, setProductWeightKg] = useState('0.05')
  const [productVolumeCbm, setProductVolumeCbm] = useState('0.0005')
  const [tariffRate, setTariffRate] = useState('0')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('wise')
  const [markupRate, setMarkupRate] = useState('1.8')

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
      .select('*')
      .eq('id', dealId)
      .single()
    if (data) {
      setDeal(data)
      if (data.unit_price_cny) setUnitPriceCny(data.unit_price_cny.toString())
      if (data.exchange_rate) setExchangeRate(data.exchange_rate.toString())
      if (data.quantity) setQuantities([data.quantity.toString()])
    }
  }

  const baseParams: Omit<CostParams, 'quantity' | 'paymentMethod'> = useMemo(() => ({
    unitPriceCny: parseFloat(unitPriceCny) || 0,
    exchangeRate: parseFloat(exchangeRate) || 21.5,
    shippingMethod,
    productWeightKg: parseFloat(productWeightKg) || 0,
    productVolumeCbm: parseFloat(productVolumeCbm) || 0,
    tariffRate: parseFloat(tariffRate) || 0,
    markupRate: parseFloat(markupRate) || 1.8,
  }), [unitPriceCny, exchangeRate, shippingMethod, productWeightKg, productVolumeCbm, tariffRate, markupRate])

  // Calculate results for all quantities
  const quantityResults: CostResult[] = useMemo(() => {
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
            {deal.deal_number} - {deal.product_name}
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
            <label style={labelStyle}>工場単価 (CNY)</label>
            <input
              type="number"
              step="0.01"
              value={unitPriceCny}
              onChange={(e) => setUnitPriceCny(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>為替レート (CNY→JPY)</label>
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

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>配送方法</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setShippingMethod('sea_d2d')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: shippingMethod === 'sea_d2d' ? '#0a0a0a' : '#f2f2f0',
                  color: shippingMethod === 'sea_d2d' ? '#ffffff' : '#555555',
                }}
              >
                海上 (D2D)
              </button>
              <button
                type="button"
                onClick={() => setShippingMethod('air_ocs')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: shippingMethod === 'air_ocs' ? '#0a0a0a' : '#f2f2f0',
                  color: shippingMethod === 'air_ocs' ? '#ffffff' : '#555555',
                }}
              >
                航空 (OCS)
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>1個あたり重量 (kg)</label>
              <input
                type="number"
                step="0.001"
                value={productWeightKg}
                onChange={(e) => setProductWeightKg(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>1個あたり体積 (CBM)</label>
              <input
                type="number"
                step="0.0001"
                value={productVolumeCbm}
                onChange={(e) => setProductVolumeCbm(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>関税率 (%)</label>
            <input
              type="number"
              step="0.1"
              value={tariffRate}
              onChange={(e) => setTariffRate(e.target.value)}
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
                onClick={() => setPaymentMethod('alibaba')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: paymentMethod === 'alibaba' ? '#0a0a0a' : '#f2f2f0',
                  color: paymentMethod === 'alibaba' ? '#ffffff' : '#555555',
                }}
              >
                Alibaba
              </button>
            </div>
          </div>

          <div>
            <label style={labelStyle}>掛率</label>
            <input
              type="number"
              step="0.1"
              value={markupRate}
              onChange={(e) => setMarkupRate(e.target.value)}
              style={inputStyle}
            />
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
                    <th style={{ ...thStyle, textAlign: 'right' }}>商品代金</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>送料</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>関税</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>消費税</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>手数料</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>原価合計</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>1個原価</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>1個販売</th>
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
                        {formatCurrency(result.productCostJpy)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {formatCurrency(result.shippingCostJpy)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {formatCurrency(result.tariffJpy)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {formatCurrency(result.consumptionTaxJpy)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {formatCurrency(result.paymentFeeJpy)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 500 }}>
                        {formatCurrency(result.totalCostJpy)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {formatCurrency(result.unitCostJpy)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {formatCurrency(result.unitSellingPrice)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: '#22c55e' }}>
                        {formatCurrency(result.grossProfit)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: '#22c55e', fontWeight: 500 }}>
                        {formatPercent(result.grossProfitRate)}
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
                    {formatCurrency(paymentComparison.wise.paymentFeeJpy)}
                  </div>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#888888', marginBottom: '2px' }}>原価合計</div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: '14px', fontWeight: 500 }}>
                    {formatCurrency(paymentComparison.wise.totalCostJpy)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#888888', marginBottom: '2px' }}>粗利率</div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: '14px', color: '#22c55e' }}>
                    {formatPercent(paymentComparison.wise.grossProfitRate)}
                  </div>
                </div>
              </div>

              {/* Alibaba */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  border: paymentComparison.recommendation === 'alibaba' ? '2px solid #22c55e' : '1px solid rgba(0,0,0,0.06)',
                  backgroundColor: paymentComparison.recommendation === 'alibaba' ? 'rgba(34,197,94,0.05)' : '#f2f2f0',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#0a0a0a' }}>Alibaba</h3>
                  {paymentComparison.recommendation === 'alibaba' && (
                    <span style={{ fontSize: '11px', color: '#22c55e', fontWeight: 500 }}>推奨</span>
                  )}
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#888888', marginBottom: '2px' }}>手数料</div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: '14px' }}>
                    {formatCurrency(paymentComparison.alibaba.paymentFeeJpy)}
                  </div>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#888888', marginBottom: '2px' }}>原価合計</div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: '14px', fontWeight: 500 }}>
                    {formatCurrency(paymentComparison.alibaba.totalCostJpy)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#888888', marginBottom: '2px' }}>粗利率</div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: '14px', color: '#22c55e' }}>
                    {formatPercent(paymentComparison.alibaba.grossProfitRate)}
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
              {paymentComparison.recommendation === 'wise' ? 'Wise' : 'Alibaba'}を使うと
              <strong style={{ fontFamily: "'Fraunces', serif", margin: '0 4px' }}>
                {formatCurrency(paymentComparison.savingsJpy)}
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
