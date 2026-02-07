'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { createDeal } from '@/lib/actions/deals'

interface Client {
  id: string
  company_name: string
}

interface Factory {
  id: string
  name: string
}

export default function NewDealPage() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [factories, setFactories] = useState<Factory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()

      const [clientsRes, factoriesRes] = await Promise.all([
        supabase.from('clients').select('id, company_name').order('company_name'),
        supabase.from('factories').select('id, name').order('name'),
      ])

      if (clientsRes.data) setClients(clientsRes.data)
      if (factoriesRes.data) setFactories(factoriesRes.data)
    }

    fetchData()
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const result = await createDeal(formData)

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    if (result.data) {
      router.push(`/deals/${result.data.id}`)
    }
  }

  const inputStyle = {
    width: '100%',
    backgroundColor: '#f2f2f0',
    borderRadius: '10px',
    padding: '10px 14px',
    fontSize: '13px',
    fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
    color: '#0a0a0a',
    border: '1px solid transparent',
    outline: 'none',
  }

  const labelStyle = {
    display: 'block',
    fontSize: '12px',
    color: '#888888',
    marginBottom: '6px',
    fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
  }

  return (
    <div style={{ padding: '24px 26px', maxWidth: '600px' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: '24px',
            fontWeight: 600,
            color: '#0a0a0a',
          }}
        >
          新規案件
        </h1>
      </div>

      {/* Form Card */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          border: '1px solid rgba(0,0,0,0.06)',
          padding: '24px',
        }}
      >
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Client */}
            <div>
              <label style={labelStyle}>クライアント</label>
              <select name="client_id" style={inputStyle}>
                <option value="">選択してください</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.company_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Factory */}
            <div>
              <label style={labelStyle}>工場</label>
              <select name="factory_id" style={inputStyle}>
                <option value="">選択してください</option>
                {factories.map((factory) => (
                  <option key={factory.id} value={factory.id}>
                    {factory.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Product Name */}
            <div>
              <label style={labelStyle}>商品名 *</label>
              <input
                type="text"
                name="product_name"
                required
                style={inputStyle}
                placeholder="例: コーヒー豆パッケージ 200g"
              />
            </div>

            {/* Material */}
            <div>
              <label style={labelStyle}>材質</label>
              <input
                type="text"
                name="material"
                style={inputStyle}
                placeholder="例: クラフト紙 + アルミ蒸着"
              />
            </div>

            {/* Size */}
            <div>
              <label style={labelStyle}>サイズ</label>
              <input
                type="text"
                name="size"
                style={inputStyle}
                placeholder="例: 150mm x 250mm"
              />
            </div>

            {/* Quantity */}
            <div>
              <label style={labelStyle}>数量</label>
              <input
                type="number"
                name="quantity"
                style={inputStyle}
                placeholder="例: 10000"
              />
            </div>

            {/* Notes */}
            <div>
              <label style={labelStyle}>備考</label>
              <textarea
                name="notes"
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
                placeholder="その他の情報"
              />
            </div>

            {/* Error */}
            {error && (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'rgba(229, 163, 46, 0.1)',
                  borderRadius: '8px',
                  color: '#e5a32e',
                  fontSize: '12px',
                  fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                }}
              >
                {error}
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  backgroundColor: '#0a0a0a',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontSize: '13px',
                  fontWeight: 500,
                  fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.5 : 1,
                }}
              >
                {loading ? '保存中...' : '保存'}
              </button>
              <Link
                href="/deals"
                style={{
                  backgroundColor: '#ffffff',
                  color: '#888888',
                  border: '1px solid #e8e8e6',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontSize: '13px',
                  fontWeight: 500,
                  fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                  textDecoration: 'none',
                }}
              >
                キャンセル
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
