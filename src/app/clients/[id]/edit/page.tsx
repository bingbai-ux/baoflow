'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { updateClientAction, deleteClientAction } from '@/lib/actions/clients'
import type { Client } from '@/lib/types'

interface Props {
  params: Promise<{ id: string }>
}

export default function EditClientPage({ params }: Props) {
  const router = useRouter()
  const [id, setId] = useState<string | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    params.then(p => {
      setId(p.id)
      loadClient(p.id)
    })
  }, [params])

  const loadClient = async (clientId: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single()
    if (data) {
      setClient(data)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!id) return
    setIsSubmitting(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const result = await updateClientAction(id, formData)

    if (result.error) {
      setError(result.error)
      setIsSubmitting(false)
    } else {
      router.push(`/clients/${id}`)
      router.refresh()
    }
  }

  const handleDelete = async () => {
    if (!id || !confirm('この顧客を削除しますか？')) return
    setIsDeleting(true)

    const result = await deleteClientAction(id)

    if (result.error) {
      setError(result.error)
      setIsDeleting(false)
    } else {
      router.push('/clients')
      router.refresh()
    }
  }

  if (!client) {
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
          顧客編集
        </h1>
        <Link
          href={`/clients/${id}`}
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
              defaultValue={client.company_name}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>担当者名</label>
            <input
              type="text"
              name="contact_name"
              defaultValue={client.contact_name || ''}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>メールアドレス</label>
            <input
              type="email"
              name="email"
              defaultValue={client.email || ''}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>電話番号</label>
            <input
              type="tel"
              name="phone"
              defaultValue={client.phone || ''}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>住所</label>
            <input
              type="text"
              name="address"
              defaultValue={client.address || ''}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={labelStyle}>備考</label>
            <textarea
              name="notes"
              defaultValue={client.notes || ''}
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
