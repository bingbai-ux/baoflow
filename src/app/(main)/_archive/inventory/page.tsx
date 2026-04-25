import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function InventoryPage() {
  const supabase = await createClient()

  // Get all inventory items
  const { data: items } = await supabase
    .from('inventory_items')
    .select(`
      *,
      client:clients(company_name)
    `)
    .order('created_at', { ascending: false })

  // Calculate stats
  const totalItems = items?.length || 0
  const lowStockItems = items?.filter((i) => i.current_stock <= (i.safety_stock || 0)) || []

  return (
    <>
      <div className="flex items-center justify-between py-[18px]">
        <h1 className="font-display text-[22px] font-semibold text-[#0a0a0a]">
          在庫
        </h1>
        <Link
          href="/inventory/shipment-orders"
          className="text-[12px] text-[#888] font-body hover:text-[#0a0a0a] no-underline"
        >
          出庫依頼一覧
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5">
          <p className="text-[11px] text-[#888] font-body mb-1">在庫アイテム数</p>
          <p className="text-[28px] font-display font-semibold text-[#0a0a0a] tabular-nums">
            {totalItems}
          </p>
        </div>
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5">
          <p className="text-[11px] text-[#888] font-body mb-1">安全在庫以下</p>
          <p className="text-[28px] font-display font-semibold text-[#e5a32e] tabular-nums">
            {lowStockItems.length}
          </p>
        </div>
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5">
          <Link
            href="/inventory/billing"
            className="block no-underline"
          >
            <p className="text-[11px] text-[#888] font-body mb-1">保管料請求</p>
            <p className="text-[13px] font-body text-[#0a0a0a]">計算・請求書発行</p>
          </Link>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <div className="bg-[rgba(229,163,46,0.1)] rounded-[14px] border border-[rgba(229,163,46,0.2)] p-5 mb-4">
          <h2 className="text-[14px] font-body font-medium text-[#e5a32e] mb-3">
            安全在庫アラート
          </h2>
          <div className="space-y-2">
            {lowStockItems.slice(0, 5).map((item) => {
              const client = Array.isArray(item.client) ? item.client[0] : item.client
              return (
                <Link
                  key={item.id}
                  href={`/inventory/${item.id}`}
                  className="flex items-center justify-between p-3 bg-white rounded-[10px] no-underline hover:bg-[#fcfcfb] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-[6px] h-[6px] rounded-full bg-[#e5a32e]" />
                    <div>
                      <p className="text-[12px] text-[#888] font-body">{client?.company_name}</p>
                      <p className="text-[13px] text-[#0a0a0a] font-body">{item.product_name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[12px] text-[#e5a32e] font-display tabular-nums">
                      {item.current_stock.toLocaleString()}個
                    </p>
                    <p className="text-[10px] text-[#888] font-body">
                      安全在庫: {(item.safety_stock || 0).toLocaleString()}個
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Inventory List */}
      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] overflow-hidden">
        <div className="p-4 border-b border-[rgba(0,0,0,0.06)]">
          <h2 className="text-[14px] font-body font-medium text-[#0a0a0a]">
            在庫一覧
          </h2>
        </div>
        {items && items.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="bg-[#fafaf9] border-b border-[rgba(0,0,0,0.06)]">
                <th className="text-left py-3 px-4 text-[9px] font-medium text-[#b0b0b0] font-body uppercase tracking-wider">クライアント</th>
                <th className="text-left py-3 px-4 text-[9px] font-medium text-[#b0b0b0] font-body uppercase tracking-wider">商品名</th>
                <th className="text-right py-3 px-4 text-[9px] font-medium text-[#b0b0b0] font-body uppercase tracking-wider">現在庫</th>
                <th className="text-right py-3 px-4 text-[9px] font-medium text-[#b0b0b0] font-body uppercase tracking-wider">安全在庫</th>
                <th className="text-right py-3 px-4 text-[9px] font-medium text-[#b0b0b0] font-body uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const client = Array.isArray(item.client) ? item.client[0] : item.client
                const isLowStock = item.current_stock <= (item.safety_stock || 0)
                return (
                  <tr key={item.id} className={`${index < items.length - 1 ? 'border-b border-[rgba(0,0,0,0.06)]' : ''} hover:bg-[#fcfcfb]`}>
                    <td className="py-3 px-4 text-[12px] text-[#888] font-body">
                      {client?.company_name}
                    </td>
                    <td className="py-3 px-4 text-[13px] text-[#0a0a0a] font-body">
                      {item.product_name}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isLowStock && <span className="w-[6px] h-[6px] rounded-full bg-[#e5a32e]" />}
                        <span className={`font-display tabular-nums text-[13px] ${isLowStock ? 'text-[#e5a32e]' : 'text-[#0a0a0a]'}`}>
                          {item.current_stock.toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right text-[12px] text-[#888] font-display tabular-nums">
                      {(item.safety_stock || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/inventory/${item.id}`}
                        className="text-[11px] text-[#888] font-body hover:text-[#0a0a0a] no-underline"
                      >
                        詳細
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center">
            <p className="text-[13px] text-[#888] font-body">
              在庫データはありません
            </p>
          </div>
        )}
      </div>
    </>
  )
}
