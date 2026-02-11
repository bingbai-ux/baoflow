import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function ShipmentOrdersPage() {
  const supabase = await createClient()

  const { data: orders } = await supabase
    .from('shipment_orders')
    .select(`
      *,
      client:clients(company_name),
      inventory_item:inventory_items(product_name)
    `)
    .order('created_at', { ascending: false })

  const pending = orders?.filter((o) => o.status === 'pending') || []
  const approved = orders?.filter((o) => o.status === 'approved') || []
  const shipped = orders?.filter((o) => ['shipped', 'delivered'].includes(o.status)) || []

  const statusLabels: Record<string, string> = {
    pending: '承認待ち',
    approved: '承認済み',
    shipped: '出荷済み',
    delivered: '配送完了',
  }

  return (
    <div className="px-[26px] py-5 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-display font-semibold text-[#0a0a0a]">
          出庫依頼
        </h1>
        <Link
          href="/inventory"
          className="text-[12px] text-[#888] font-body hover:text-[#0a0a0a] no-underline"
        >
          在庫一覧に戻る
        </Link>
      </div>

      {/* Pending Orders */}
      <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)]">
        <div className="p-5 border-b border-[rgba(0,0,0,0.06)]">
          <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a]">
            承認待ち ({pending.length})
          </h2>
        </div>
        {pending.length > 0 ? (
          <div className="divide-y divide-[rgba(0,0,0,0.06)]">
            {pending.map((order) => {
              const client = Array.isArray(order.client) ? order.client[0] : order.client
              const item = Array.isArray(order.inventory_item) ? order.inventory_item[0] : order.inventory_item
              return (
                <Link
                  key={order.id}
                  href={`/inventory/shipment-orders/${order.id}`}
                  className="flex items-center justify-between p-4 hover:bg-[#fcfcfb] no-underline"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[12px] font-display tabular-nums text-[#888]">
                        {order.order_code}
                      </span>
                      <span className="text-[10px] text-[#888] font-body">
                        {new Date(order.created_at).toLocaleDateString('ja-JP')}
                      </span>
                    </div>
                    <p className="text-[13px] text-[#0a0a0a] font-body">
                      {item?.product_name}
                    </p>
                    <p className="text-[11px] text-[#888] font-body">{client?.company_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] font-display tabular-nums text-[#0a0a0a]">
                      {order.quantity.toLocaleString()}個
                    </p>
                    <span className="text-[11px] text-white bg-[#0a0a0a] px-2 py-0.5 rounded font-body">
                      承認する
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-[13px] text-[#888] font-body">
              承認待ちの依頼はありません
            </p>
          </div>
        )}
      </div>

      {/* Approved & Shipped Orders */}
      <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)]">
        <div className="p-5 border-b border-[rgba(0,0,0,0.06)]">
          <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a]">
            処理中・完了 ({approved.length + shipped.length})
          </h2>
        </div>
        {(approved.length + shipped.length) > 0 ? (
          <div className="divide-y divide-[rgba(0,0,0,0.06)]">
            {[...approved, ...shipped].map((order) => {
              const client = Array.isArray(order.client) ? order.client[0] : order.client
              const item = Array.isArray(order.inventory_item) ? order.inventory_item[0] : order.inventory_item
              return (
                <Link
                  key={order.id}
                  href={`/inventory/shipment-orders/${order.id}`}
                  className="flex items-center justify-between p-4 hover:bg-[#fcfcfb] no-underline"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[12px] font-display tabular-nums text-[#888]">
                        {order.order_code}
                      </span>
                    </div>
                    <p className="text-[13px] text-[#0a0a0a] font-body">
                      {item?.product_name}
                    </p>
                    <p className="text-[11px] text-[#888] font-body">{client?.company_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] font-display tabular-nums text-[#0a0a0a]">
                      {order.quantity.toLocaleString()}個
                    </p>
                    <span className="text-[10px] text-[#888] font-body">
                      {statusLabels[order.status] || order.status}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-[13px] text-[#888] font-body">
              処理中の依頼はありません
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
