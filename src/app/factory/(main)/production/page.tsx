import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { FactoryProgressBar } from '@/components/factory/progress-bar'

export default async function FactoryProductionPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('factory_id')
    .eq('id', user.id)
    .single()

  if (!profile?.factory_id) return null

  // Get all selected deals for this factory
  const { data: assignments } = await supabase
    .from('deal_factory_assignments')
    .select(`
      id,
      status,
      deal:deals(
        id,
        deal_code,
        deal_name,
        master_status,
        specifications:deal_specifications(product_name),
        quotes:deal_quotes(quantity),
        shipping:deal_shipping(tracking_number)
      )
    `)
    .eq('factory_id', profile.factory_id)
    .eq('status', 'selected')
    .order('created_at', { ascending: false })

  // Filter by production-related statuses
  const productionStatuses = ['M16', 'M17', 'M18', 'M19', 'M20', 'M21', 'M22', 'M23', 'M24', 'M25']
  const productionDeals = assignments?.filter((a) => {
    const deal = Array.isArray(a.deal) ? a.deal[0] : a.deal
    return deal?.master_status && productionStatuses.includes(deal.master_status)
  }) || []

  const inProgress = productionDeals.filter((a) => {
    const deal = Array.isArray(a.deal) ? a.deal[0] : a.deal
    return ['M16', 'M17', 'M18', 'M19', 'M20', 'M21'].includes(deal?.master_status || '')
  })

  const shipped = productionDeals.filter((a) => {
    const deal = Array.isArray(a.deal) ? a.deal[0] : a.deal
    return ['M22', 'M23', 'M24', 'M25'].includes(deal?.master_status || '')
  })

  return (
    <div className="space-y-5">
      <h1 className="text-[20px] font-display font-semibold text-[#0a0a0a]">
        製造中
      </h1>

      {/* In Progress */}
      <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)]">
        <div className="p-5 border-b border-[rgba(0,0,0,0.06)]">
          <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a]">
            製造・発送準備中 ({inProgress.length})
          </h2>
        </div>
        {inProgress.length > 0 ? (
          <div className="divide-y divide-[rgba(0,0,0,0.06)]">
            {inProgress.map((item) => {
              const deal = Array.isArray(item.deal) ? item.deal[0] : item.deal
              const spec = deal?.specifications?.[0]
              const quote = deal?.quotes?.[0]
              return (
                <Link
                  key={item.id}
                  href={`/factory/production/${deal?.id}`}
                  className="block p-4 hover:bg-[#fcfcfb] transition-colors no-underline"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="text-[12px] font-display tabular-nums text-[#888]">
                        {deal?.deal_code}
                      </span>
                      <p className="text-[13px] font-body text-[#0a0a0a]">
                        {spec?.product_name || deal?.deal_name}
                      </p>
                    </div>
                    {quote?.quantity && (
                      <span className="text-[12px] font-display tabular-nums text-[#555]">
                        {quote.quantity.toLocaleString()}個
                      </span>
                    )}
                  </div>
                  {deal?.master_status && (
                    <FactoryProgressBar status={deal.master_status} className="!p-3 !rounded-[12px]" />
                  )}
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-[13px] text-[#888] font-body">
              製造中の案件はありません
            </p>
          </div>
        )}
      </div>

      {/* Shipped */}
      <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)]">
        <div className="p-5 border-b border-[rgba(0,0,0,0.06)]">
          <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a]">
            発送済み ({shipped.length})
          </h2>
        </div>
        {shipped.length > 0 ? (
          <div className="divide-y divide-[rgba(0,0,0,0.06)]">
            {shipped.map((item) => {
              const deal = Array.isArray(item.deal) ? item.deal[0] : item.deal
              const spec = deal?.specifications?.[0]
              const shipping = deal?.shipping?.[0]
              return (
                <div key={item.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[12px] font-display tabular-nums text-[#888]">
                        {deal?.deal_code}
                      </span>
                      <p className="text-[13px] font-body text-[#0a0a0a]">
                        {spec?.product_name || deal?.deal_name}
                      </p>
                    </div>
                    {shipping?.tracking_number && (
                      <span className="text-[11px] font-display tabular-nums text-[#555]">
                        {shipping.tracking_number}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-[13px] text-[#888] font-body">
              発送済みの案件はありません
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
