import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function ShipmentsPage() {
  const supabase = await createClient()

  // Get all deals with shipping status
  const { data: deals } = await supabase
    .from('deals')
    .select(`
      id,
      deal_code,
      deal_name,
      master_status,
      specifications:deal_specifications(product_name),
      shipping:deal_shipping(
        tracking_number,
        tracking_url,
        shipped_at,
        estimated_arrival,
        logistics_agent_id
      ),
      client:clients(company_name)
    `)
    .in('master_status', ['M22', 'M23', 'M24', 'M25'])
    .order('updated_at', { ascending: false })

  const statusLabels: Record<string, string> = {
    M22: '発送済み',
    M23: '輸送中',
    M24: '到着・検品',
    M25: '納品完了',
  }

  return (
    <div className="px-[26px] py-5 space-y-5">
      <h1 className="text-[20px] font-display font-semibold text-[#0a0a0a]">
        Shipments
      </h1>

      <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)]">
        {deals && deals.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[rgba(0,0,0,0.06)]">
                <th className="text-left py-3 px-4 text-[11px] font-medium text-[#bbb] font-body">案件</th>
                <th className="text-left py-3 px-4 text-[11px] font-medium text-[#bbb] font-body">クライアント</th>
                <th className="text-left py-3 px-4 text-[11px] font-medium text-[#bbb] font-body">商品</th>
                <th className="text-left py-3 px-4 text-[11px] font-medium text-[#bbb] font-body">ステータス</th>
                <th className="text-left py-3 px-4 text-[11px] font-medium text-[#bbb] font-body">トラッキング</th>
                <th className="text-right py-3 px-4 text-[11px] font-medium text-[#bbb] font-body"></th>
              </tr>
            </thead>
            <tbody>
              {deals.map((deal) => {
                const spec = deal.specifications?.[0]
                const shipping = deal.shipping?.[0]
                const client = Array.isArray(deal.client) ? deal.client[0] : deal.client
                return (
                  <tr key={deal.id} className="border-b border-[rgba(0,0,0,0.06)] hover:bg-[#fcfcfb]">
                    <td className="py-3 px-4">
                      <span className="text-[12px] font-display tabular-nums text-[#888]">
                        {deal.deal_code}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[13px] text-[#0a0a0a] font-body">
                      {client?.company_name}
                    </td>
                    <td className="py-3 px-4 text-[13px] text-[#0a0a0a] font-body">
                      {spec?.product_name || deal.deal_name}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          deal.master_status === 'M25' ? 'bg-[#22c55e]' : 'bg-[#888]'
                        }`} />
                        <span className="text-[12px] text-[#555] font-body">
                          {statusLabels[deal.master_status] || deal.master_status}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {shipping?.tracking_number ? (
                        shipping.tracking_url ? (
                          <a
                            href={shipping.tracking_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[12px] font-display tabular-nums text-[#0a0a0a] underline"
                          >
                            {shipping.tracking_number}
                          </a>
                        ) : (
                          <span className="text-[12px] font-display tabular-nums text-[#0a0a0a]">
                            {shipping.tracking_number}
                          </span>
                        )
                      ) : (
                        <span className="text-[12px] text-[#888] font-body">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/deals/${deal.id}`}
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
              出荷中の案件はありません
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
