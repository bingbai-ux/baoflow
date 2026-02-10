import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ClientProgressBarCompact } from '@/components/portal/progress-bar'

export default async function PortalOrdersPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
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

  // Get all orders
  const { data: deals } = await supabase
    .from('deals')
    .select(`
      *,
      specifications:deal_specifications(product_name, product_category),
      quotes:deal_quotes(quantity, total_billing_jpy)
    `)
    .eq('client_id', profile.client_id)
    .order('created_at', { ascending: false })

  // Separate active and completed
  const activeDeals = deals?.filter((d) => d.master_status !== 'M25') || []
  const completedDeals = deals?.filter((d) => d.master_status === 'M25') || []

  return (
    <div className="space-y-5">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-display font-semibold text-[#0a0a0a]">
          Orders
        </h1>
        <Link
          href="/portal/request"
          className="flex items-center gap-2 bg-[#0a0a0a] text-white rounded-[8px] px-[13px] py-[7px] text-[12px] font-body font-medium no-underline"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          新規見積もり依頼
        </Link>
      </div>

      {/* Active Orders */}
      <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
        <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a] mb-4">
          進行中の注文 ({activeDeals.length})
        </h2>

        {activeDeals.length > 0 ? (
          <div className="space-y-2">
            {activeDeals.map((deal) => {
              const spec = deal.specifications?.[0]
              const quote = deal.quotes?.[0]

              return (
                <Link
                  key={deal.id}
                  href={`/portal/orders/${deal.id}`}
                  className="flex items-center justify-between p-4 bg-[#f2f2f0] rounded-[12px] hover:bg-[#e8e8e6] transition-colors no-underline"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-[12px] font-display tabular-nums text-[#888]">
                        {deal.deal_code}
                      </span>
                      <ClientProgressBarCompact status={deal.master_status} />
                    </div>
                    <p className="text-[13px] font-body text-[#0a0a0a] truncate">
                      {spec?.product_name || deal.deal_name || '商品名未設定'}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-[#888] font-body mt-1">
                      {spec?.product_category && <span>{spec.product_category}</span>}
                      {quote?.quantity && <span>{quote.quantity.toLocaleString()}個</span>}
                      <span>{new Date(deal.created_at).toLocaleDateString('ja-JP')}</span>
                    </div>
                  </div>
                  {quote?.total_billing_jpy && (
                    <p className="text-[14px] font-display tabular-nums font-semibold text-[#0a0a0a] ml-4">
                      {Math.round(quote.total_billing_jpy).toLocaleString()}円
                    </p>
                  )}
                </Link>
              )
            })}
          </div>
        ) : (
          <p className="text-[13px] text-[#888] font-body text-center py-6">
            進行中の注文はありません
          </p>
        )}
      </div>

      {/* Completed Orders */}
      <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
        <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a] mb-4">
          完了した注文 ({completedDeals.length})
        </h2>

        {completedDeals.length > 0 ? (
          <div className="space-y-2">
            {completedDeals.map((deal) => {
              const spec = deal.specifications?.[0]
              const quote = deal.quotes?.[0]

              return (
                <Link
                  key={deal.id}
                  href={`/portal/orders/${deal.id}`}
                  className="flex items-center justify-between p-4 bg-[#f2f2f0] rounded-[12px] hover:bg-[#e8e8e6] transition-colors no-underline"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-[12px] font-display tabular-nums text-[#888]">
                        {deal.deal_code}
                      </span>
                      <span className="text-[11px] text-[#22c55e] font-body flex items-center gap-1">
                        <span className="w-[5px] h-[5px] rounded-full bg-[#22c55e]" />
                        納品完了
                      </span>
                    </div>
                    <p className="text-[13px] font-body text-[#0a0a0a] truncate">
                      {spec?.product_name || deal.deal_name || '商品名未設定'}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-[#888] font-body mt-1">
                      {spec?.product_category && <span>{spec.product_category}</span>}
                      {quote?.quantity && <span>{quote.quantity.toLocaleString()}個</span>}
                      <span>{new Date(deal.created_at).toLocaleDateString('ja-JP')}</span>
                    </div>
                  </div>
                  {quote?.total_billing_jpy && (
                    <p className="text-[14px] font-display tabular-nums font-semibold text-[#0a0a0a] ml-4">
                      {Math.round(quote.total_billing_jpy).toLocaleString()}円
                    </p>
                  )}
                </Link>
              )
            })}
          </div>
        ) : (
          <p className="text-[13px] text-[#888] font-body text-center py-6">
            完了した注文はありません
          </p>
        )}
      </div>
    </div>
  )
}
