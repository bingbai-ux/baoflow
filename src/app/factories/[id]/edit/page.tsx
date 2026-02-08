'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { updateFactoryAction, deleteFactoryAction } from '@/lib/actions/factories'
import type { Factory } from '@/lib/types'

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

interface Props {
  params: Promise<{ id: string }>
}

export default function EditFactoryPage({ params }: Props) {
  const router = useRouter()
  const [id, setId] = useState<string | null>(null)
  const [factory, setFactory] = useState<Factory | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([])

  useEffect(() => {
    params.then(p => {
      setId(p.id)
      loadFactory(p.id)
    })
  }, [params])

  const loadFactory = async (factoryId: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('factories')
      .select('*')
      .eq('id', factoryId)
      .single()
    if (data) {
      setFactory(data)
      setSelectedSpecialties(data.specialties || [])
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!id) return
    setIsSubmitting(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    formData.set('specialties', selectedSpecialties.join(','))

    const result = await updateFactoryAction(id, formData)

    if (result.error) {
      setError(result.error)
      setIsSubmitting(false)
    } else {
      router.push(`/factories/${id}`)
      router.refresh()
    }
  }

  const handleDelete = async () => {
    if (!id || !confirm('この工場を削除しますか？')) return
    setIsDeleting(true)

    const result = await deleteFactoryAction(id)

    if (result.error) {
      setError(result.error)
      setIsDeleting(false)
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

  if (!factory) {
    return (
      <div style={{ padding: '24px 26px' }}>
        <div style={{ color: '#888888', fontSize: '13px' }}>読み込み中...</div>
      </div>
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
          工場編集
        </h1>
        <Link
          href={`/factories/${id}`}
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
              name="factory_name"
              required
              defaultValue={factory.factory_name}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>住所</label>
            <input
              type="text"
              name="address"
              defaultValue={factory.address || ''}
              style={inputStyle}
              placeholder="例: 中国広東省深圳市"
            />
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
            <label style={labelStyle}>デフォルト支払い条件</label>
            <input
              type="text"
              name="default_payment_terms"
              defaultValue={factory.default_payment_terms || ''}
              style={inputStyle}
              placeholder="例: 前払い30%、出荷時70%"
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>デフォルト支払い方法</label>
            <select
              name="default_payment_method"
              defaultValue={factory.default_payment_method || ''}
              style={inputStyle}
            >
              <option value="">選択してください</option>
              <option value="wise">Wise</option>
              <option value="alibaba_cc">Alibaba CC</option>
              <option value="bank_transfer">銀行振込</option>
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>担当者名</label>
            <input
              type="text"
              name="contact_name"
              defaultValue={factory.contact_name || ''}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>連絡方法</label>
            <input
              type="text"
              name="contact_method"
              defaultValue={factory.contact_method || ''}
              style={inputStyle}
              placeholder="例: WeChat: xxx, メール: xxx@example.com"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>評価 (1-5)</label>
              <input
                type="number"
                name="rating"
                min="1"
                max="5"
                step="0.1"
                defaultValue={factory.rating || ''}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>品質</label>
              <input
                type="text"
                name="quality"
                defaultValue={factory.quality || ''}
                style={inputStyle}
                placeholder="A/B/C"
              />
            </div>
            <div>
              <label style={labelStyle}>価格帯</label>
              <input
                type="text"
                name="price_level"
                defaultValue={factory.price_level || ''}
                style={inputStyle}
                placeholder="高/中/低"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>レスポンス速度</label>
              <input
                type="text"
                name="response_speed"
                defaultValue={factory.response_speed || ''}
                style={inputStyle}
                placeholder="速い/普通/遅い"
              />
            </div>
            <div>
              <label style={labelStyle}>丁寧さ</label>
              <input
                type="text"
                name="politeness"
                defaultValue={factory.politeness || ''}
                style={inputStyle}
                placeholder="良い/普通/悪い"
              />
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={labelStyle}>備考</label>
            <textarea
              name="notes"
              defaultValue={factory.notes || ''}
              style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                flex: 1,
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
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              style={{
                backgroundColor: '#ffffff',
                color: '#e5a32e',
                border: '1px solid #e5a32e',
                borderRadius: '8px',
                padding: '10px 16px',
                fontSize: '13px',
                fontWeight: 500,
                fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                cursor: isDeleting ? 'not-allowed' : 'pointer',
                opacity: isDeleting ? 0.7 : 1,
              }}
            >
              {isDeleting ? '削除中...' : '削除'}
            </button>
          </div>
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
