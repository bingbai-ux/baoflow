'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { approveQuote, createRepeatOrder } from '@/lib/actions/portal'

interface OrderActionsProps {
  dealId: string
  masterStatus: string
  isQuoteStage: boolean
  isCompleted: boolean
  chatRoomId?: string
}

export function OrderActions({
  dealId,
  masterStatus,
  isQuoteStage,
  isCompleted,
  chatRoomId,
}: OrderActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleApprove = async () => {
    if (!confirm('この見積もりを承認しますか？')) return

    setLoading(true)
    setError(null)

    const result = await approveQuote(dealId)

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    router.refresh()
    setLoading(false)
  }

  const handleRepeatOrder = async () => {
    if (!confirm('同じ仕様でリピート注文を作成しますか？')) return

    setLoading(true)
    setError(null)

    const result = await createRepeatOrder(dealId)

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    if (result.data?.id) {
      router.push(`/portal/orders/${result.data.id}`)
    }
    setLoading(false)
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="text-[12px] py-2 px-3 rounded-[8px] bg-[rgba(229,163,46,0.1)] text-[#e5a32e] font-body">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        {/* Quote Stage Actions */}
        {isQuoteStage && (
          <>
            <button
              onClick={handleApprove}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 bg-[#22c55e] text-white rounded-[8px] py-3 text-[13px] font-body font-medium disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {loading ? '処理中...' : '見積もりを承認'}
            </button>
            {chatRoomId && (
              <Link
                href={`/portal/chat/${chatRoomId}`}
                className="flex-1 flex items-center justify-center gap-2 bg-white text-[#0a0a0a] border border-[#e8e8e6] rounded-[8px] py-3 text-[13px] font-body font-medium no-underline hover:border-[#0a0a0a]"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                修正依頼（チャット）
              </Link>
            )}
          </>
        )}

        {/* Completed Actions */}
        {isCompleted && (
          <button
            onClick={handleRepeatOrder}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 bg-[#0a0a0a] text-white rounded-[8px] py-3 text-[13px] font-body font-medium disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loading ? '処理中...' : 'リピート注文'}
          </button>
        )}

        {/* Chat Link - always show if chat room exists */}
        {!isQuoteStage && chatRoomId && (
          <Link
            href={`/portal/chat/${chatRoomId}`}
            className="flex items-center justify-center gap-2 bg-white text-[#0a0a0a] border border-[#e8e8e6] rounded-[8px] px-4 py-3 text-[13px] font-body font-medium no-underline hover:border-[#0a0a0a]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            チャット
          </Link>
        )}
      </div>
    </div>
  )
}
