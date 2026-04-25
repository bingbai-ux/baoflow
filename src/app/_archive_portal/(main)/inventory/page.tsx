import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function PortalInventoryPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/portal/login')
  }

  // Get client_id from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('client_id')
    .eq('id', user.id)
    .single()

  if (!profile?.client_id) {
    return (
      <div className="text-center py-10">
        <p className="text-[#888] font-body">クライアント情報が設定されていません。</p>
      </div>
    )
  }

  // Get inventory items for this client
  const { data: items } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('client_id', profile.client_id)
    .order('created_at', { ascending: false })

  // Get shipment orders for this client
  const { data: orders } = await supabase
    .from('shipment_orders')
    .select(`
      *,
      inventory_item:inventory_items(product_name)
    `)
    .eq('client_id', profile.client_id)
    .order('created_at', { ascending: false })
    .limit(10)

  const statusLabels: Record<string, string> = {
    pending: '承認待ち',
    approved: '承認済み',
    shipped: '出荷済み',
    delivered: '配送完了',
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-display font-semibold text-[#0a0a0a]">
          在庫状況
        </h1>
        <Link
          href="/portal/inventory/shipment-request"
          className="flex items-center gap-2 bg-[#0a0a0a] text-white rounded-[8px] px-[13px] py-[7px] text-[12px] font-body font-medium no-underline"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          出庫依頼
        </Link>
      </div>

      {/* Current Inventory */}
      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)]">
        <div className="p-5 border-b border-[rgba(0,0,0,0.06)]">
          <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a]">
            現在庫
          </h2>
        </div>
        {items && items.length > 0 ? (
          <div className="divide-y divide-[rgba(0,0,0,0.06)]">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-[13px] text-[#0a0a0a] font-body font-medium">{item.product_name}</p>
                  {item.storage_location && (
                    <p className="text-[11px] text-[#888] font-body">保管場所: {item.storage_location}</p>
                  )}
                </div>
                <p className="text-[16px] font-display tabular-nums text-[#0a0a0a]">
                  {item.current_stock.toLocaleString()}個
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-[13px] text-[#888] font-body">
              保管中の在庫はありません
            </p>
          </div>
        )}
      </div>

      {/* Shipment Order History */}
      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)]">
        <div className="p-5 border-b border-[rgba(0,0,0,0.06)]">
          <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a]">
            出庫依頼履歴
          </h2>
        </div>
        {orders && orders.length > 0 ? (
          <div className="divide-y divide-[rgba(0,0,0,0.06)]">
            {orders.map((order) => {
              const item = Array.isArray(order.inventory_item) ? order.inventory_item[0] : order.inventory_item
              return (
                <div key={order.id} className="flex items-center justify-between p-4">
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
                      {item?.product_name} - {order.quantity.toLocaleString()}個
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      order.status === 'delivered' ? 'bg-[#22c55e]' :
                      order.status === 'pending' ? 'bg-[#e5a32e]' : 'bg-[#888]'
                    }`} />
                    <span className="text-[11px] text-[#555] font-body">
                      {statusLabels[order.status] || order.status}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-[13px] text-[#888] font-body">
              出庫依頼履歴はありません
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
