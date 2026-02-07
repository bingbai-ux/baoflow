'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createFactoryAction } from '@/lib/actions/factories'

const specialtyOptions = [
  '紙パッケージ',
  'プラスチック容器',
  '金属缶',
  'ガラス瓶',
  '木製品',
  'ラベル・シール',
  '段ボール',
  'フィルム',
  '不織布',
]

export default function NewFactoryPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    formData.set('specialties', selectedSpecialties.join(','))

    const result = await createFactoryAction(formData)

    if (result.error) {
      setError(result.error)
      setIsSubmitting(false)
    } else {
      router.push('/factories')
      router.refresh()
    }
  }

  const toggleSpecialty = (specialty: string) => {
    setSelectedSpecialties(prev =>
      prev.includes(specialty)
        ? prev.filter(s => s !== specialty)
        : [...prev, specialty]
    )
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
          新規工場
        </h1>
        <Link
          href="/factories"
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
              工場名 <span style={{ color: '#e5a32e' }}>*</span>
            </label>
            <input
              type="text"
              name="name"
              required
              style={inputStyle}
              placeholder="XX包装有限公司"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>国</label>
              <input
                type="text"
                name="country"
                defaultValue="中国"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>都市</label>
              <input
                type="text"
                name="city"
                style={inputStyle}
                placeholder="深圳"
              />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>専門分野</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {specialtyOptions.map(specialty => (
                <button
                  key={specialty}
                  type="button"
                  onClick={() => toggleSpecialty(specialty)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '9999px',
                    fontSize: '12px',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                    backgroundColor: selectedSpecialties.includes(specialty) ? '#0a0a0a' : '#f2f2f0',
                    color: selectedSpecialties.includes(specialty) ? '#ffffff' : '#555555',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {specialty}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>支払い条件</label>
            <input
              type="text"
              name="payment_terms"
              style={inputStyle}
              placeholder="30% 前払い、70% 出荷前"
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>担当者名</label>
            <input
              type="text"
              name="contact_name"
              style={inputStyle}
              placeholder="王経理"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>メール</label>
              <input
                type="email"
                name="contact_email"
                style={inputStyle}
                placeholder="contact@factory.cn"
              />
            </div>
            <div>
              <label style={labelStyle}>WeChat</label>
              <input
                type="text"
                name="contact_wechat"
                style={inputStyle}
                placeholder="wechat_id"
              />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>評価 (1-5)</label>
            <input
              type="number"
              name="rating"
              min="1"
              max="5"
              step="0.1"
              style={inputStyle}
              placeholder="4.5"
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
