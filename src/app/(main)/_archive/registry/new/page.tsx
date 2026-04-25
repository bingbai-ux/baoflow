'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Factory {
  id: string
  name: string
}

export default function NewProductPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [factories, setFactories] = useState<Factory[]>([])
  const supabase = createClient()

  useEffect(() => {
    async function fetchFactories() {
      const { data } = await supabase
        .from('factories')
        .select('id, name')
        .order('name')
      setFactories(data || [])
    }
    fetchFactories()
  }, [supabase])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)

    try {
      const { error } = await supabase
        .from('product_registry')
        .insert({
          product_code: formData.get('product_code') as string,
          product_name: formData.get('product_name') as string,
          category: formData.get('category') as string || null,
          material: formData.get('material') as string || null,
          typical_size: formData.get('typical_size') as string || null,
          typical_quantity: formData.get('typical_quantity')
            ? parseInt(formData.get('typical_quantity') as string, 10)
            : null,
          min_order_quantity: formData.get('min_order_quantity')
            ? parseInt(formData.get('min_order_quantity') as string, 10)
            : null,
          factory_id: formData.get('factory_id') as string || null,
          lead_time_days: formData.get('lead_time_days')
            ? parseInt(formData.get('lead_time_days') as string, 10)
            : null,
          notes: formData.get('notes') as string || null,
        })

      if (error) {
        throw error
      }

      router.push('/registry')
      router.refresh()
    } catch (error) {
      console.error('Create error:', error)
      alert('登録に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f2f2f0', padding: '24px 26px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 600 }}>
          品目新規登録
        </h1>
        <Link
          href="/registry"
          style={{
            backgroundColor: '#ffffff',
            color: '#888888',
            border: '1px solid #e8e8e6',
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          戻る
        </Link>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {/* Basic Info */}
          <div style={cardStyle}>
            <h2 style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>
              基本情報
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>品目コード *</label>
                <input
                  type="text"
                  name="product_code"
                  required
                  placeholder="例: PKG-001"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>品目名 *</label>
                <input
                  type="text"
                  name="product_name"
                  required
                  placeholder="例: コーヒー豆袋 クラフト"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>カテゴリー</label>
                <select name="category" style={inputStyle}>
                  <option value="">選択してください</option>
                  <option value="bag">袋・パウチ</option>
                  <option value="box">箱・カートン</option>
                  <option value="label">ラベル・シール</option>
                  <option value="bottle">ボトル・容器</option>
                  <option value="other">その他</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>材質</label>
                <input
                  type="text"
                  name="material"
                  placeholder="例: クラフト紙 + PE"
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Specs */}
          <div style={cardStyle}>
            <h2 style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>
              仕様・発注情報
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>標準サイズ</label>
                <input
                  type="text"
                  name="typical_size"
                  placeholder="例: 150mm x 250mm"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>標準数量</label>
                <input
                  type="number"
                  name="typical_quantity"
                  placeholder="例: 10000"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>最小ロット</label>
                <input
                  type="number"
                  name="min_order_quantity"
                  placeholder="例: 3000"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>推奨工場</label>
                <select name="factory_id" style={inputStyle}>
                  <option value="">選択してください</option>
                  {factories.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>リードタイム（日）</label>
                <input
                  type="number"
                  name="lead_time_days"
                  placeholder="例: 30"
                  style={inputStyle}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div style={{ ...cardStyle, marginTop: 8 }}>
          <h2 style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>
            備考
          </h2>
          <textarea
            name="notes"
            rows={4}
            placeholder="特記事項があれば入力してください"
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        {/* Submit */}
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Link
            href="/registry"
            style={{
              padding: '10px 20px',
              backgroundColor: '#ffffff',
              color: '#888888',
              border: '1px solid #e8e8e6',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            キャンセル
          </Link>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '10px 20px',
              backgroundColor: loading ? '#e8e8e6' : '#0a0a0a',
              color: loading ? '#888888' : '#ffffff',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '登録中...' : '登録する'}
          </button>
        </div>
      </form>
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: 20,
  border: '1px solid rgba(0,0,0,0.06)',
  padding: '20px 22px',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: '#555555',
  marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  fontSize: 13,
  border: '1px solid #e8e8e6',
  borderRadius: 10,
  backgroundColor: '#f2f2f0',
  fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
}
