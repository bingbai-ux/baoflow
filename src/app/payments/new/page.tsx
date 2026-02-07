'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { createPaymentAction } from '@/lib/actions/payments'
import type { Deal } from '@/lib/types'

export default function NewPaymentPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deals, setDeals] = useState<Deal[]>([])
  const [exchangeRate, setExchangeRate] = useState('21.5')
  const [amountCny, setAmountCny] = useState('')
  const [amountJpy, setAmountJpy] = useState('')

  useEffect(() => {
    loadDeals()
  }, [])

  const loadDeals = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('deals')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) {
      setDeals(data)
    }
  }

  const handleCnyChange = (value: string) => {
    setAmountCny(value)
    if (value && exchangeRate) {
      const jpy = parseFloat(value) * parseFloat(exchangeRate)
      setAmountJpy(jpy.toFixed(0))
    }
  }

  const handleJpyChange = (value: string) => {
    setAmountJpy(value)
    if (value && exchangeRate) {
      const cny = parseFloat(value) / parseFloat(exchangeRate)
      setAmountCny(cny.toFixed(2))
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    formData.set('amount_cny', amountCny)
    formData.set('amount_jpy', amountJpy)
    formData.set('exchange_rate', exchangeRate)

    const result = await createPaymentAction(formData)

    if (result.error) {
      setError(result.error)
      setIsSubmitting(false)
    } else {
      router.push('/payments')
      router.refresh()
    }
  }

  return (
    <div style={{ padding: '24px 26px', maxWidth: '600px' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
        }}
      >
        <h1
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: '24px',
            fontWeight: 600,
            color: '#0a0a0a',
          }}
        >
          新規支払い
        </h1>
        <Link
          href="/payments"
          style={{
            color: '#888888',
            fontSize: '13px',
            textDecoration: 'none',
            fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
          }}
        >
          キャンセル
        </Link>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            border: '1px solid rgba(0,0,0,0.06)',
            padding: '20px 22px',
          }}
        >
          {error && (
            <div
              style={{
                backgroundColor: 'rgba(229, 163, 46, 0.1)',
                color: '#e5a32e',
                padding: '10px 14px',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '13px',
                fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
              }}
            >
              {error}
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>
              案件 <span style={{ color: '#e5a32e' }}>*</span>
            </label>
            <select
              name="deal_id"
              required
              style={inputStyle}
            >
              <option value="">選択してください</option>
              {deals.map(deal => (
                <option key={deal.id} value={deal.id}>
                  {deal.deal_number} - {deal.product_name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>
                種別 <span style={{ color: '#e5a32e' }}>*</span>
              </label>
              <select
                name="payment_type"
                required
                style={inputStyle}
              >
                <option value="deposit">前払い</option>
                <option value="balance">残金</option>
                <option value="full">一括</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>
                方法 <span style={{ color: '#e5a32e' }}>*</span>
              </label>
              <select
                name="payment_method"
                required
                style={inputStyle}
              >
                <option value="wise">Wise</option>
                <option value="alibaba">Alibaba</option>
                <option value="bank_transfer">銀行振込</option>
              </select>
            </div>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>金額 (CNY)</label>
              <input
                type="number"
                step="0.01"
                value={amountCny}
                onChange={(e) => handleCnyChange(e.target.value)}
                style={inputStyle}
                placeholder="0.00"
              />
            </div>
            <div>
              <label style={labelStyle}>金額 (JPY)</label>
              <input
                type="number"
                value={amountJpy}
                onChange={(e) => handleJpyChange(e.target.value)}
                style={inputStyle}
                placeholder="0"
              />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>参照番号</label>
            <input
              type="text"
              name="reference_number"
              style={inputStyle}
              placeholder="Wise送金番号など"
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={labelStyle}>備考</label>
            <textarea
              name="notes"
              style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
              placeholder="備考があれば入力"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              backgroundColor: '#0a0a0a',
              color: '#ffffff',
              borderRadius: '8px',
              padding: '10px 16px',
              fontSize: '13px',
              fontWeight: 500,
              fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
              border: 'none',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? '保存中...' : '保存'}
          </button>
        </div>
      </form>
    </div>
  )
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
  fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
  outline: 'none',
  boxSizing: 'border-box',
}
