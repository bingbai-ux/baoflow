import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ShipmentOrderActions } from './shipment-order-actions'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ShipmentOrderDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: order } = await supabase
    .from('shipment_orders')
    .select(`
      *,
      client:clients(company_name),
      inventory_item:inventory_items(product_name, current_quantity)
    `)
    .eq('id', id)
    .single()

  if (!order) {
    notFound()
  }

  const client = Array.isArray(order.client) ? order.client[0] : order.client
  const item = Array.isArray(order.inventory_item) ? order.inventory_item[0] : order.inventory_item

  const statusLabels: Record<string, string> = {
    pending: '承認待ち',
    approved: '承認済み',
    shipped: '出荷済み',
    delivered: '配送完了',
  }

  return (
    <div className="px-[26px] py-5 space-y-5">
      <Link
        href="/inventory/shipment-orders"
        className="inline-flex items-center gap-1 text-[12px] text-[#888] font-body hover:text-[#0a0a0a] no-underline"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        出庫依頼一覧に戻る
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-display font-semibold text-[#0a0a0a]">
          出庫依頼詳細
        </h1>
        <span className="text-[12px] font-display tabular-nums text-[#888]">
          {order.order_code}
        </span>
      </div>

      {/* Status */}
      <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${order.status === 'pending' ? 'bg-[#e5a32e]' : order.status === 'approved' ? 'bg-[#22c55e]' : 'bg-[#888]'}`} />
          <span className="text-[13px] text-[#0a0a0a] font-body">{statusLabels[order.status]}</span>
        </div>
      </div>

      {/* Order Details */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
          <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a] mb-4">
            依頼内容
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-[11px] text-[#888] font-body mb-1">クライアント</p>
              <p className="text-[13px] text-[#0a0a0a] font-body">{client?.company_name}</p>
            </div>
            <div>
              <p className="text-[11px] text-[#888] font-body mb-1">商品名</p>
              <p className="text-[13px] text-[#0a0a0a] font-body">{item?.product_name}</p>
            </div>
            <div>
              <p className="text-[11px] text-[#888] font-body mb-1">出庫数量</p>
              <p className="text-[13px] text-[#0a0a0a] font-display tabular-nums">
                {order.quantity.toLocaleString()}個
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[#888] font-body mb-1">現在庫</p>
              <p className="text-[13px] text-[#0a0a0a] font-display tabular-nums">
                {(item?.current_quantity || 0).toLocaleString()}個
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
          <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a] mb-4">
            配送先
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-[11px] text-[#888] font-body mb-1">配送先住所</p>
              <p className="text-[13px] text-[#0a0a0a] font-body whitespace-pre-wrap">
                {order.delivery_address}
              </p>
            </div>
            {order.requested_date && (
              <div>
                <p className="text-[11px] text-[#888] font-body mb-1">希望出荷日</p>
                <p className="text-[13px] text-[#0a0a0a] font-display tabular-nums">
                  {new Date(order.requested_date).toLocaleDateString('ja-JP')}
                </p>
              </div>
            )}
            {order.notes && (
              <div>
                <p className="text-[11px] text-[#888] font-body mb-1">備考</p>
                <p className="text-[13px] text-[#0a0a0a] font-body">{order.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      {order.status === 'pending' && (
        <ShipmentOrderActions orderId={id} />
      )}
    </div>
  )
}
