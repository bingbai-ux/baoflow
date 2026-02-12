import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { StatusDot } from '@/components/status-dot'

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
        tracking_url
      ),
      client:clients(company_name)
    `)
    .in('master_status', ['M20', 'M21', 'M22', 'M23', 'M24', 'M25'])
    .order('updated_at', { ascending: false })

  return (
    <>
      <div className="py-[18px]">
        <h1 className="font-display text-[22px] font-semibold text-[#0a0a0a]">
          出荷
        </h1>
      </div>

      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] overflow-hidden">
        {deals && deals.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="bg-[#fafaf9] border-b border-[rgba(0,0,0,0.06)]">
                <th className="text-left py-3 px-4 text-[9px] font-medium text-[#b0b0b0] font-body uppercase tracking-wider">案件</th>
                <th className="text-left py-3 px-4 text-[9px] font-medium text-[#b0b0b0] font-body uppercase tracking-wider">クライアント</th>
                <th className="text-left py-3 px-4 text-[9px] font-medium text-[#b0b0b0] font-body uppercase tracking-wider">商品</th>
                <th className="text-left py-3 px-4 text-[9px] font-medium text-[#b0b0b0] font-body uppercase tracking-wider">ステータス</th>
                <th className="text-left py-3 px-4 text-[9px] font-medium text-[#b0b0b0] font-body uppercase tracking-wider">トラッキング</th>
                <th className="text-right py-3 px-4 text-[9px] font-medium text-[#b0b0b0] font-body uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody>
              {deals.map((deal, index) => {
                const spec = deal.specifications?.[0]
                const shipping = deal.shipping?.[0]
                const client = Array.isArray(deal.client) ? deal.client[0] : deal.client
                return (
                  <tr key={deal.id} className={`${index < deals.length - 1 ? 'border-b border-[rgba(0,0,0,0.06)]' : ''} hover:bg-[#fcfcfb]`}>
                    <td className="py-3 px-4">
                      <Link href={`/deals/${deal.id}`} className="text-[13px] font-display tabular-nums text-[#0a0a0a] no-underline hover:underline">
                        {deal.deal_code}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-[13px] text-[#0a0a0a] font-body">
                      {client?.company_name}
                    </td>
                    <td className="py-3 px-4 text-[13px] text-[#0a0a0a] font-body">
                      {spec?.product_name || deal.deal_name}
                    </td>
                    <td className="py-3 px-4">
                      <StatusDot status={deal.master_status} size={6} />
                    </td>
                    <td className="py-3 px-4">
                      {shipping?.tracking_number ? (
                        <a
                          href={
                            shipping.tracking_url ||
                            `https://t.17track.net/ja#nums=${encodeURIComponent(shipping.tracking_number)}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[12px] font-display tabular-nums text-[#0a0a0a] underline hover:text-[#22c55e]"
                        >
                          {shipping.tracking_number}
                        </a>
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
    </>
  )
}
