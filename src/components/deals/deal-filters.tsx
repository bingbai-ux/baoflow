'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface ClientOption {
  id: string
  company_name: string
}

interface DealFiltersProps {
  clients: ClientOption[]
}

const phaseOptions = [
  { value: 'all', label: '全て' },
  { value: 'quote', label: '見積もり' },
  { value: 'order', label: '発注・支払い' },
  { value: 'production', label: '製造' },
  { value: 'shipping', label: '出荷・納品' },
]

export function DealFilters({ clients }: DealFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [phase, setPhase] = useState(searchParams.get('phase') || 'all')
  const [clientId, setClientId] = useState(searchParams.get('client') || '')
  const [search, setSearch] = useState(searchParams.get('search') || '')

  const applyFilters = () => {
    const params = new URLSearchParams()
    if (phase !== 'all') params.set('phase', phase)
    if (clientId) params.set('client', clientId)
    if (search) params.set('search', search)
    router.push(`/deals?${params.toString()}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      applyFilters()
    }
  }

  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
      {/* Phase Filter Pills */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {phaseOptions.map(option => (
          <button
            key={option.value}
            onClick={() => {
              setPhase(option.value)
              const params = new URLSearchParams(searchParams.toString())
              if (option.value === 'all') {
                params.delete('phase')
              } else {
                params.set('phase', option.value)
              }
              router.push(`/deals?${params.toString()}`)
            }}
            style={{
              padding: '7px 18px',
              borderRadius: '9999px',
              fontSize: '13px',
              border: 'none',
              cursor: 'pointer',
              fontFamily: phase === option.value
                ? "'Fraunces', serif"
                : "'Zen Kaku Gothic New', system-ui, sans-serif",
              fontWeight: phase === option.value ? 600 : 400,
              backgroundColor: phase === option.value ? '#0a0a0a' : 'transparent',
              color: phase === option.value ? '#ffffff' : '#888888',
              transition: 'all 0.15s ease',
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Client Filter */}
      <select
        value={clientId}
        onChange={(e) => {
          setClientId(e.target.value)
          const params = new URLSearchParams(searchParams.toString())
          if (e.target.value) {
            params.set('client', e.target.value)
          } else {
            params.delete('client')
          }
          router.push(`/deals?${params.toString()}`)
        }}
        style={{
          backgroundColor: '#f2f2f0',
          borderRadius: '10px',
          padding: '7px 14px',
          fontSize: '12px',
          border: 'none',
          fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
          color: '#0a0a0a',
          outline: 'none',
          minWidth: '150px',
        }}
      >
        <option value="">全クライアント</option>
        {clients.map(client => (
          <option key={client.id} value={client.id}>
            {client.company_name}
          </option>
        ))}
      </select>

      {/* Search Input */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={applyFilters}
        placeholder="案件コード・案件名で検索"
        style={{
          backgroundColor: '#f2f2f0',
          borderRadius: '10px',
          padding: '7px 14px',
          fontSize: '12px',
          border: 'none',
          fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
          color: '#0a0a0a',
          outline: 'none',
          minWidth: '200px',
        }}
      />
    </div>
  )
}
