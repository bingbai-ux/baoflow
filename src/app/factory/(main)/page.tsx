import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { FactoryProgressBar } from '@/components/factory/progress-bar'

export default async function FactoryDashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Get factory_id from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('factory_id')
    .eq('id', user.id)
    .single()

  if (!profile?.factory_id) {
    return (
      <div className="text-center py-10">
        <p className="text-[#888] font-body">工場情報が設定されていません。</p>
      </div>
    )
  }

  const factoryId = profile.factory_id

  // Get pending quote requests (status = 'requesting')
  const { data: pendingQuotes } = await supabase
    .from('deal_factory_assignments')
    .select(`
      id,
      status,
      created_at,
      deal:deals(
        id,
        deal_code,
        deal_name,
        master_status,
        specifications:deal_specifications(product_name, product_category)
      )
    `)
    .eq('factory_id', factoryId)
    .eq('status', 'requesting')
    .order('created_at', { ascending: false })
    .limit(10)

  // Get in-production deals
  const { data: productionDeals } = await supabase
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
        quotes:deal_quotes(quantity)
      )
    `)
    .eq('factory_id', factoryId)
    .eq('status', 'selected')
    .order('created_at', { ascending: false })
    .limit(10)

  // Filter production deals by status
  const inProduction = productionDeals?.filter((d) => {
    const deal = Array.isArray(d.deal) ? d.deal[0] : d.deal
    const status = deal?.master_status
    return status && ['M16', 'M17', 'M18', 'M19', 'M20', 'M21'].includes(status)
  }) || []

  return (
    <div className="space-y-5">
      {/* Page Title */}
      <h1 className="text-[20px] font-display font-semibold text-[#0a0a0a]">
        Dashboard
      </h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
          <p className="text-[11px] text-[#888] font-body mb-1">未回答の見積もり依頼</p>
          <p className="text-[28px] font-display font-semibold text-[#0a0a0a] tabular-nums">
            {pendingQuotes?.length || 0}
          </p>
        </div>
        <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
          <p className="text-[11px] text-[#888] font-body mb-1">製造中の案件</p>
          <p className="text-[28px] font-display font-semibold text-[#0a0a0a] tabular-nums">
            {inProduction.length}
          </p>
        </div>
        <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
          <p className="text-[11px] text-[#888] font-body mb-1">今月の成約</p>
          <p className="text-[28px] font-display font-semibold text-[#0a0a0a] tabular-nums">
            {productionDeals?.length || 0}
          </p>
        </div>
      </div>

      {/* Pending Quote Requests */}
      <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between p-5 border-b border-[rgba(0,0,0,0.06)]">
          <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a]">
            見積もり依頼（未回答）
          </h2>
          <Link
            href="/factory/quotes"
            className="text-[12px] text-[#888] font-body hover:text-[#0a0a0a] no-underline"
          >
            すべて見る
          </Link>
        </div>
        {pendingQuotes && pendingQuotes.length > 0 ? (
          <div className="divide-y divide-[rgba(0,0,0,0.06)]">
            {pendingQuotes.map((item) => {
              const deal = Array.isArray(item.deal) ? item.deal[0] : item.deal
              const spec = deal?.specifications?.[0]
              return (
                <Link
                  key={item.id}
                  href={`/factory/quotes/${deal?.id}`}
                  className="flex items-center justify-between p-4 hover:bg-[#fcfcfb] transition-colors no-underline"
                >
                  <div>
                    <span className="text-[12px] font-display tabular-nums text-[#888]">
                      {deal?.deal_code}
                    </span>
                    <p className="text-[13px] font-body text-[#0a0a0a]">
                      {spec?.product_name || deal?.deal_name}
                    </p>
                  </div>
                  <span className="text-[12px] text-white bg-[#0a0a0a] px-3 py-1 rounded-[8px] font-body">
                    回答する
                  </span>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-[13px] text-[#888] font-body">
              未回答の見積もり依頼はありません
            </p>
          </div>
        )}
      </div>

      {/* In Production */}
      <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between p-5 border-b border-[rgba(0,0,0,0.06)]">
          <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a]">
            製造中の案件
          </h2>
          <Link
            href="/factory/production"
            className="text-[12px] text-[#888] font-body hover:text-[#0a0a0a] no-underline"
          >
            すべて見る
          </Link>
        </div>
        {inProduction.length > 0 ? (
          <div className="divide-y divide-[rgba(0,0,0,0.06)]">
            {inProduction.slice(0, 5).map((item) => {
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
    </div>
  )
}
