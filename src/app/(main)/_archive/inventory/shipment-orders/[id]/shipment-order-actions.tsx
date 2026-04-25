'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { approveShipmentOrder } from '@/lib/actions/inventory'

interface ShipmentOrderActionsProps {
  orderId: string
}

export function ShipmentOrderActions({ orderId }: ShipmentOrderActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleApprove = async () => {
    if (!confirm('この出庫依頼を承認しますか？在庫が減少し、ロジセンターへ出庫指示が送信されます。')) {
      return
    }

    setLoading(true)
    const result = await approveShipmentOrder(orderId)

    if (result.error) {
      alert(result.error)
      setLoading(false)
      return
    }

    router.push('/inventory/shipment-orders')
    router.refresh()
  }

  return (
    <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
      <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a] mb-4">
        アクション
      </h2>
      <button
        onClick={handleApprove}
        disabled={loading}
        className="w-full bg-[#0a0a0a] text-white rounded-[8px] px-4 py-[10px] text-[13px] font-medium font-body disabled:opacity-50"
      >
        {loading ? '処理中...' : '承認して出庫指示を送信'}
      </button>
    </div>
  )
}
