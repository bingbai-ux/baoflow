'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { duplicateDeal } from '@/lib/actions/deals'

interface RepeatButtonProps {
  dealId: string
}

export function RepeatButton({ dealId }: RepeatButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    if (!confirm('この案件をリピート注文として複製しますか？')) {
      return
    }

    setLoading(true)
    try {
      const result = await duplicateDeal(dealId)
      if (result.error) {
        alert(`エラー: ${result.error}`)
      } else if (result.data) {
        router.push(`/deals/${result.data.id}`)
        router.refresh()
      }
    } catch {
      alert('複製に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        backgroundColor: '#ffffff',
        color: '#0a0a0a',
        border: '1px solid #e8e8e6',
        borderRadius: 8,
        padding: '8px 16px',
        fontSize: 13,
        fontWeight: 500,
        fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? '処理中...' : 'リピート注文'}
    </button>
  )
}
