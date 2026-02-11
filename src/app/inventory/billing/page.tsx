import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function InventoryBillingPage() {
  const supabase = await createClient()

  // Get all inventory items with client info
  const { data: items } = await supabase
    .from('inventory_items')
    .select(`
      *,
      client:clients(id, company_name)
    `)
    .order('client_id')

  // Group by client and calculate storage fees
  const clientBillings: Record<string, {
    clientId: string
    clientName: string
    items: typeof items
    totalQuantity: number
    storageDays: number
    estimatedFee: number
  }> = {}

  const today = new Date()
  const DAILY_RATE_PER_UNIT = 0.5 // $0.50 per unit per day

  items?.forEach((item) => {
    const client = Array.isArray(item.client) ? item.client[0] : item.client
    if (!client) return

    if (!clientBillings[client.id]) {
      clientBillings[client.id] = {
        clientId: client.id,
        clientName: client.company_name,
        items: [],
        totalQuantity: 0,
        storageDays: 0,
        estimatedFee: 0,
      }
    }

    const storageDays = Math.ceil(
      (today.getTime() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24)
    )

    clientBillings[client.id].items!.push(item)
    clientBillings[client.id].totalQuantity += item.current_stock
    clientBillings[client.id].storageDays = Math.max(clientBillings[client.id].storageDays, storageDays)
    clientBillings[client.id].estimatedFee += item.current_stock * storageDays * DAILY_RATE_PER_UNIT
  })

  const billings = Object.values(clientBillings)
  const totalEstimatedRevenue = billings.reduce((sum, b) => sum + b.estimatedFee, 0)

  return (
    <div className="px-[26px] py-5 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-display font-semibold text-[#0a0a0a]">
          Storage Billing
        </h1>
        <Link
          href="/inventory"
          className="text-[12px] text-[#888] font-body hover:text-[#0a0a0a] no-underline"
        >
          在庫一覧に戻る
        </Link>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
          <p className="text-[11px] text-[#888] font-body mb-1">クライアント数</p>
          <p className="text-[24px] font-display tabular-nums font-semibold text-[#0a0a0a]">
            {billings.length}
          </p>
        </div>
        <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
          <p className="text-[11px] text-[#888] font-body mb-1">総保管数量</p>
          <p className="text-[24px] font-display tabular-nums font-semibold text-[#0a0a0a]">
            {billings.reduce((sum, b) => sum + b.totalQuantity, 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
          <p className="text-[11px] text-[#888] font-body mb-1">月間推定収益</p>
          <p className="text-[24px] font-display tabular-nums font-semibold text-[#22c55e]">
            ${totalEstimatedRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Billing Table */}
      <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)]">
        <div className="p-5 border-b border-[rgba(0,0,0,0.06)]">
          <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a]">
            クライアント別保管料
          </h2>
        </div>
        {billings.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[rgba(0,0,0,0.06)]">
                <th className="text-left py-3 px-4 text-[11px] font-medium text-[#bbb] font-body">クライアント</th>
                <th className="text-right py-3 px-4 text-[11px] font-medium text-[#bbb] font-body">アイテム数</th>
                <th className="text-right py-3 px-4 text-[11px] font-medium text-[#bbb] font-body">総数量</th>
                <th className="text-right py-3 px-4 text-[11px] font-medium text-[#bbb] font-body">最長保管日数</th>
                <th className="text-right py-3 px-4 text-[11px] font-medium text-[#bbb] font-body">推定保管料</th>
                <th className="text-right py-3 px-4 text-[11px] font-medium text-[#bbb] font-body"></th>
              </tr>
            </thead>
            <tbody>
              {billings.map((billing) => (
                <tr key={billing.clientId} className="border-b border-[rgba(0,0,0,0.06)] hover:bg-[#fcfcfb]">
                  <td className="py-3 px-4 text-[13px] text-[#0a0a0a] font-body font-medium">
                    {billing.clientName}
                  </td>
                  <td className="py-3 px-4 text-right font-display tabular-nums text-[13px] text-[#888]">
                    {billing.items?.length || 0}
                  </td>
                  <td className="py-3 px-4 text-right font-display tabular-nums text-[13px] text-[#0a0a0a]">
                    {billing.totalQuantity.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right font-display tabular-nums text-[13px] text-[#888]">
                    {billing.storageDays}日
                  </td>
                  <td className="py-3 px-4 text-right font-display tabular-nums text-[14px] font-semibold text-[#0a0a0a]">
                    ${billing.estimatedFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button className="text-[11px] text-white bg-[#0a0a0a] px-3 py-1.5 rounded-[6px] font-body">
                      請求書発行
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center">
            <p className="text-[13px] text-[#888] font-body">
              保管中の在庫はありません
            </p>
          </div>
        )}
      </div>

      {/* Rate Info */}
      <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
        <h3 className="text-[14px] font-display font-semibold text-[#0a0a0a] mb-3">
          保管料金表
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between py-2 border-b border-[rgba(0,0,0,0.06)]">
            <span className="text-[12px] text-[#555] font-body">基本保管料（1個/日）</span>
            <span className="text-[12px] font-display tabular-nums text-[#0a0a0a]">$0.50</span>
          </div>
          <div className="flex justify-between py-2 border-b border-[rgba(0,0,0,0.06)]">
            <span className="text-[12px] text-[#555] font-body">長期保管割引（30日以上）</span>
            <span className="text-[12px] font-display tabular-nums text-[#22c55e]">-10%</span>
          </div>
          <div className="flex justify-between py-2 border-b border-[rgba(0,0,0,0.06)]">
            <span className="text-[12px] text-[#555] font-body">大量保管割引（1000個以上）</span>
            <span className="text-[12px] font-display tabular-nums text-[#22c55e]">-15%</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-[12px] text-[#555] font-body">出庫手数料（1件）</span>
            <span className="text-[12px] font-display tabular-nums text-[#0a0a0a]">$5.00</span>
          </div>
        </div>
      </div>
    </div>
  )
}
