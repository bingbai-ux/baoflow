import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { StatusDot } from '@/components/deals/status-dot'
import { StatusChanger } from './status-changer'
import { RepeatButton } from './repeat-button'
import { DealDetailTabs } from './deal-detail-tabs'
import { MASTER_STATUS_CONFIG, type MasterStatus } from '@/lib/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function DealDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  // Fetch deal with all relations
  const { data: deal } = await supabase
    .from('deals')
    .select(`
      *,
      client:clients(id, company_name, contact_name, email, phone),
      sales_user:profiles!deals_sales_user_id_fkey(id, display_name),
      specifications:deal_specifications(*),
      factory_assignments:deal_factory_assignments(*, factory:factories(*)),
      quotes:deal_quotes(*, factory:factories(*), shipping_options:deal_shipping_options(*)),
      samples:deal_samples(*),
      payments:deal_factory_payments(*),
      design_files:deal_design_files(*),
      shipping:deal_shipping(*)
    `)
    .eq('id', id)
    .single()

  if (!deal) {
    notFound()
  }

  const { data: statusHistory } = await supabase
    .from('deal_status_history')
    .select(`
      *,
      changer:profiles!deal_status_history_changed_by_fkey(id, display_name)
    `)
    .eq('deal_id', id)
    .order('changed_at', { ascending: false })

  const currentStatus = (deal.master_status || 'M01') as MasterStatus
  const statusConfig = MASTER_STATUS_CONFIG[currentStatus]
  const spec = deal.specifications?.[0]

  return (
    <div className="min-h-screen bg-[#f2f2f0]">
      <Header userName={profile?.display_name || user.email || undefined} />

      <main className="px-[26px] pb-10">
        {/* Page Header */}
        <div className="flex justify-between items-center py-[18px]">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-display text-[24px] font-semibold text-[#0a0a0a]">
                  {deal.deal_code}
                </h1>
                <StatusDot status={currentStatus} />
              </div>
              {deal.deal_name && (
                <p className="text-[13px] text-[#888] font-body mt-1">{deal.deal_name}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/deals/${id}/quotes/new`}
              className="bg-[#22c55e] text-white rounded-[8px] px-4 py-2 text-[13px] font-medium font-body no-underline"
            >
              見積もり作成
            </Link>
            <Link
              href={`/deals/${id}/excel-import`}
              className="bg-white text-[#0a0a0a] border border-[#e8e8e6] rounded-[8px] px-4 py-2 text-[13px] font-medium font-body no-underline"
            >
              Excel取込
            </Link>
            <Link
              href={`/deals/${id}/documents`}
              className="bg-white text-[#0a0a0a] border border-[#e8e8e6] rounded-[8px] px-4 py-2 text-[13px] font-medium font-body no-underline"
            >
              帳票出力
            </Link>
            <RepeatButton dealId={id} />
            <Link
              href={`/deals/${id}/edit`}
              className="bg-[#0a0a0a] text-white rounded-[8px] px-4 py-2 text-[13px] font-medium font-body no-underline"
            >
              編集
            </Link>
            <Link
              href="/deals"
              className="bg-white text-[#888] border border-[#e8e8e6] rounded-[8px] px-4 py-2 text-[13px] font-medium font-body no-underline"
            >
              戻る
            </Link>
          </div>
        </div>

        {/* Info Bar */}
        <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-4 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-[11px] text-[#888] font-body">クライアント</span>
              <p className="text-[13px] text-[#0a0a0a] font-body">{deal.client?.company_name || '-'}</p>
            </div>
            <div>
              <span className="text-[11px] text-[#888] font-body">担当営業</span>
              <p className="text-[13px] text-[#0a0a0a] font-body">{deal.sales_user?.display_name || '-'}</p>
            </div>
            {statusConfig?.nextAction && (
              <div>
                <span className="text-[11px] text-[#888] font-body">次のアクション</span>
                <p className="text-[13px] text-[#22c55e] font-body">{statusConfig.nextAction}</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <StatusChanger dealId={id} currentStatus={currentStatus} />
          </div>
        </div>

        {/* Tabbed Content */}
        <DealDetailTabs
          deal={deal}
          spec={spec}
          statusHistory={statusHistory || []}
        />
      </main>
    </div>
  )
}
