import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ClientProgressBarCompact } from '@/components/portal/progress-bar'

export default async function PortalDashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Get client_id and company name from profile
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

  // Get client company name
  const { data: client } = await supabase
    .from('clients')
    .select('company_name')
    .eq('id', profile.client_id)
    .single()

  const companyName = client?.company_name || ''

  // Get active orders
  const { data: activeDeals } = await supabase
    .from('deals')
    .select(`
      *,
      specifications:deal_specifications(product_name, product_category),
      quotes:deal_quotes(quantity, total_billing_jpy)
    `)
    .eq('client_id', profile.client_id)
    .neq('master_status', 'M25')
    .order('created_at', { ascending: false })
    .limit(5)

  // Get recent quotes (M06-M10)
  const { data: pendingQuotes } = await supabase
    .from('deals')
    .select(`
      *,
      specifications:deal_specifications(product_name, product_category),
      quotes:deal_quotes(quantity, total_billing_jpy)
    `)
    .eq('client_id', profile.client_id)
    .in('master_status', ['M06', 'M07', 'M08', 'M09', 'M10'])
    .order('created_at', { ascending: false })
    .limit(3)

  // Get completed orders count
  const { count: completedCount } = await supabase
    .from('deals')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', profile.client_id)
    .eq('master_status', 'M25')

  return (
    <div className="space-y-5">
      {/* Page Title */}
      <div className="py-2">
        <h1 className="text-[22px] font-display font-semibold text-[#0a0a0a]">
          {companyName ? `${companyName}様` : 'ようこそ'}
        </h1>
        <p className="text-[13px] text-[#888] font-body mt-1">
          いつもご利用ありがとうございます
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5">
          <p className="text-[11px] text-[#888] font-body mb-1">進行中の注文</p>
          <p className="text-[28px] font-display tabular-nums font-semibold text-[#0a0a0a]">
            {activeDeals?.length || 0}
          </p>
        </div>
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5">
          <p className="text-[11px] text-[#888] font-body mb-1">確認待ち見積もり</p>
          <p className="text-[28px] font-display tabular-nums font-semibold text-[#0a0a0a]">
            {pendingQuotes?.length || 0}
          </p>
        </div>
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5">
          <p className="text-[11px] text-[#888] font-body mb-1">完了した注文</p>
          <p className="text-[28px] font-display tabular-nums font-semibold text-[#0a0a0a]">
            {completedCount || 0}
          </p>
        </div>
      </div>

      {/* Active Orders */}
      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a]">
            進行中の注文
          </h2>
          <Link
            href="/portal/orders"
            className="text-[12px] text-[#888] font-body hover:text-[#0a0a0a] no-underline"
          >
            すべて見る
          </Link>
        </div>

        {activeDeals && activeDeals.length > 0 ? (
          <div className="space-y-3">
            {activeDeals.map((deal) => {
              const spec = deal.specifications?.[0]
              const quote = deal.quotes?.[0]

              return (
                <Link
                  key={deal.id}
                  href={`/portal/orders/${deal.id}`}
                  className="block p-4 bg-[#f2f2f0] rounded-[12px] hover:bg-[#e8e8e6] transition-colors no-underline"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] font-display tabular-nums text-[#888]">
                      {deal.deal_code}
                    </span>
                    <ClientProgressBarCompact status={deal.master_status} />
                  </div>
                  <p className="text-[13px] font-body text-[#0a0a0a] mb-1">
                    {spec?.product_name || deal.deal_name || '商品名未設定'}
                  </p>
                  <div className="flex items-center gap-3 text-[11px] text-[#888] font-body">
                    {spec?.product_category && (
                      <span>{spec.product_category}</span>
                    )}
                    {quote?.quantity && (
                      <span>{quote.quantity.toLocaleString()}個</span>
                    )}
                  </div>
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

      {/* Pending Quotes */}
      {pendingQuotes && pendingQuotes.length > 0 && (
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5">
          <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a] mb-4">
            確認待ちの見積もり
          </h2>
          <div className="space-y-3">
            {pendingQuotes.map((deal) => {
              const spec = deal.specifications?.[0]
              const quote = deal.quotes?.[0]

              return (
                <Link
                  key={deal.id}
                  href={`/portal/orders/${deal.id}`}
                  className="flex items-center justify-between p-4 bg-[#f2f2f0] rounded-[12px] hover:bg-[#e8e8e6] transition-colors no-underline"
                >
                  <div>
                    <p className="text-[13px] font-body text-[#0a0a0a]">
                      {spec?.product_name || deal.deal_name || '商品名未設定'}
                    </p>
                    <p className="text-[11px] text-[#888] font-body">
                      {deal.deal_code}
                    </p>
                  </div>
                  <div className="text-right">
                    {quote?.total_billing_jpy && (
                      <p className="text-[14px] font-display tabular-nums font-semibold text-[#0a0a0a]">
                        {Math.round(quote.total_billing_jpy).toLocaleString()}円
                      </p>
                    )}
                    <span className="text-[11px] text-[#22c55e] font-body">
                      確認待ち
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/portal/request"
          className="flex items-center justify-center gap-2 bg-[#0a0a0a] text-white rounded-[12px] py-4 text-[13px] font-body font-medium no-underline hover:opacity-90 transition-opacity"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          新規見積もり依頼
        </Link>
        <Link
          href="/portal/catalog"
          className="flex items-center justify-center gap-2 bg-white text-[#0a0a0a] border border-[#e8e8e6] rounded-[12px] py-4 text-[13px] font-body font-medium no-underline hover:border-[#0a0a0a] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
          </svg>
          カタログを見る
        </Link>
      </div>

      {/* Inventory Summary - Placeholder for Phase 3 */}
      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5">
        <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a] mb-4">
          在庫状況
        </h2>
        <p className="text-[13px] text-[#888] font-body text-center py-6">
          在庫管理機能は準備中です
        </p>
      </div>
    </div>
  )
}
