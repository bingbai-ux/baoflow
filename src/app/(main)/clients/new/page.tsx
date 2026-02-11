'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClientAction } from '@/lib/actions/clients'

export default function NewClientPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const result = await createClientAction(formData)

    if (result.error) {
      setError(result.error)
      setIsSubmitting(false)
    } else {
      router.push('/clients')
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
          新規顧客
        </h1>
        <Link
          href="/clients"
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
              会社名 <span style={{ color: '#e5a32e' }}>*</span>
            </label>
            <input
              type="text"
              name="company_name"
              required
              style={inputStyle}
              placeholder="株式会社サンプル"
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>担当者名</label>
            <input
              type="text"
              name="contact_name"
              style={inputStyle}
              placeholder="山田 太郎"
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>メールアドレス</label>
            <input
              type="email"
              name="email"
              style={inputStyle}
              placeholder="yamada@example.com"
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>電話番号</label>
            <input
              type="tel"
              name="phone"
              style={inputStyle}
              placeholder="03-1234-5678"
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>住所</label>
            <input
              type="text"
              name="address"
              style={inputStyle}
              placeholder="東京都渋谷区..."
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
