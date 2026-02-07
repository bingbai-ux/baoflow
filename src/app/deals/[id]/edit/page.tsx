'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { updateDeal } from '@/lib/actions/deals'

interface Client {
  id: string
  company_name: string
}

interface Factory {
  id: string
  name: string
}

interface Deal {
  id: string
  deal_number: string
  client_id: string | null
  factory_id: string | null
  product_name: string
  material: string | null
  size: string | null
  quantity: number | null
  notes: string | null
}

export default function EditDealPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [deal, setDeal] = useState<Deal | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [factories, setFactories] = useState<Factory[]>([])
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()

      const [dealRes, clientsRes, factoriesRes] = await Promise.all([
        supabase.from('deals').select('*').eq('id', id).single(),
        supabase.from('clients').select('id, company_name').order('company_name'),
        supabase.from('factories').select('id, name').order('name'),
      ])

      if (dealRes.data) setDeal(dealRes.data)
      if (clientsRes.data) setClients(clientsRes.data)
      if (factoriesRes.data) setFactories(factoriesRes.data)
      setFetching(false)
    }

    fetchData()
  }, [id])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const result = await updateDeal(id, formData)

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    router.push(`/deals/${id}`)
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

  if (fetching) {
    return (
      <div style={{ padding: '24px 26px' }}>
        <div
          style={{
            fontSize: '13px',
            color: '#888888',
            fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
          }}
        >
          読み込み中...
        </div>
      </div>
    )
  }

  if (!deal) {
    return (
      <div style={{ padding: '24px 26px' }}>
        <div
          style={{
            fontSize: '13px',
            color: '#888888',
            fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
          }}
        >
          案件が見つかりません
        </div>
      </div>
    )
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
          {deal.deal_number} を編集
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
              <select name="client_id" defaultValue={deal.client_id || ''} style={inputStyle}>
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
              <select name="factory_id" defaultValue={deal.factory_id || ''} style={inputStyle}>
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
                defaultValue={deal.product_name}
                style={inputStyle}
              />
            </div>

            {/* Material */}
            <div>
              <label style={labelStyle}>材質</label>
              <input
                type="text"
                name="material"
                defaultValue={deal.material || ''}
                style={inputStyle}
              />
            </div>

            {/* Size */}
            <div>
              <label style={labelStyle}>サイズ</label>
              <input
                type="text"
                name="size"
                defaultValue={deal.size || ''}
                style={inputStyle}
              />
            </div>

            {/* Quantity */}
            <div>
              <label style={labelStyle}>数量</label>
              <input
                type="number"
                name="quantity"
                defaultValue={deal.quantity || ''}
                style={inputStyle}
              />
            </div>

            {/* Notes */}
            <div>
              <label style={labelStyle}>備考</label>
              <textarea
                name="notes"
                rows={3}
                defaultValue={deal.notes || ''}
                style={{ ...inputStyle, resize: 'vertical' }}
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
                href={`/deals/${id}`}
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
