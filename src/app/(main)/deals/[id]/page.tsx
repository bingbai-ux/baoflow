import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, FileText } from 'lucide-react'
import { DealProgressBar } from '@/components/deal-progress-bar'
import { WaitingOnBadge } from '@/components/deals/waiting-on-badge'
import { RepeatDealButton } from '@/components/deals/repeat-deal-button'
import { NextStepGuide, buildGuideCounts } from '@/components/deals/next-step-guide'
import { DealDetailTabs } from './deal-detail-tabs'
import { type SimpleStatus } from '@/lib/types'
import { formatJPY } from '@/lib/utils/format'

interface Props {
  params: Promise<{ id: string }>
}

export default async function DealDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: deal } = await supabase
    .from('deals')
    .select(
      `
      id,
      deal_code,
      deal_name,
      client_name_text,
      desired_delivery_date,
      memo,
      simple_status,
      waiting_on,
      created_at,
      last_activity_at,
      sales_user:profiles!deals_sales_user_id_fkey(display_name)
    `
    )
    .eq('id', id)
    .single()

  if (!deal) notFound()

  const [
    { data: products },
    { data: variantsRaw },
    { data: quotes },
    { data: fees },
    { data: designFiles },
    { data: statusHistory },
    { data: communications },
    { data: documents },
  ] = await Promise.all([
    supabase
      .from('deal_products')
      .select('*')
      .eq('deal_id', id)
      .order('product_no', { ascending: true }),
    supabase
      .from('deal_product_variants')
      .select('*, deal_products!inner(deal_id)')
      .eq('deal_products.deal_id', id)
      .order('variant_order', { ascending: true }),
    supabase
      .from('deal_quotes')
      .select(
        'id, spec_id, variant_id, version, quantity, factory_unit_price_usd, selling_price_jpy, total_billing_jpy, total_billing_tax_jpy, status, created_at'
      )
      .eq('deal_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('deal_fees')
      .select('id, spec_id, variant_id, fee_type, amount_jpy, is_initial_only, note')
      .eq('deal_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('deal_design_files')
      .select('id, storage_url, file_name, created_at')
      .eq('deal_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('deal_status_history')
      .select(
        'id, from_simple_status, to_simple_status, changed_at, note, kind, changer:profiles!deal_status_history_changed_by_fkey(display_name)'
      )
      .eq('deal_id', id)
      .order('changed_at', { ascending: false }),
    supabase
      .from('deal_communications')
      .select('*')
      .eq('deal_id', id)
      .order('occurred_at', { ascending: false }),
    supabase
      .from('documents')
      .select('id, document_type')
      .eq('deal_id', id),
  ])

  // strip the joined deal_products from variants
  const variants = (variantsRaw || []).map((v) => {
    const { deal_products: _omit, ...rest } = v as Record<string, unknown>
    return rest
  })

  const dealLite = {
    ...deal,
    sales_user: Array.isArray(deal.sales_user) ? deal.sales_user[0] : deal.sales_user,
  }

  const historyLite = (statusHistory || []).map((h) => ({
    ...h,
    changer: Array.isArray(h.changer) ? h.changer[0] : h.changer,
  }))

  const approvedQuotes = (quotes || []).filter((q) => q.status === 'approved')
  const approvedTotalTax = approvedQuotes.reduce(
    (sum, q) => sum + (Number(q.total_billing_tax_jpy) || 0),
    0
  )
  const feesTotal = (fees || []).reduce((sum, f) => sum + (Number(f.amount_jpy) || 0), 0)

  return (
    <>
      <Link
        href="/deals"
        className="inline-flex items-center gap-1 text-[13px] text-[#84787D] font-body no-underline hover:text-[#351E28] mt-4 mb-2"
      >
        <ChevronLeft className="w-4 h-4" />
        案件一覧
      </Link>

      <div className="flex justify-between items-start py-3 gap-4">
        <div className="min-w-0">
          <p className="text-[11px] text-[#84787D] font-body tabular-nums">{deal.deal_code}</p>
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="font-display text-[21px] font-extrabold text-[#351E28] truncate">
              {deal.deal_name || '(案件名未設定)'}
            </h1>
            <WaitingOnBadge dealId={deal.id} value={deal.waiting_on} />
          </div>
          <p className="text-[13px] text-[#351E28] font-body mt-1 truncate">
            {deal.client_name_text || '(クライアント未設定)'}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0 items-start">
          <Link
            href={`/deals/${id}/quote-builder`}
            className="bg-white text-[#351E28] border border-[#E2E1DA] rounded-full px-3.5 py-2 text-[12px] font-medium font-body no-underline inline-flex items-center gap-1 hover:bg-[#FBFAF6]"
          >
            見積を組み立てる
          </Link>
          <RepeatDealButton dealId={deal.id} dealName={deal.deal_name} />
          <Link
            href={`/deals/${id}/documents`}
            className="bg-white text-[#351E28] border border-[#E2E1DA] rounded-[12px] px-3 py-2 text-[12px] font-medium font-body no-underline inline-flex items-center gap-1"
          >
            <FileText className="w-3.5 h-3.5" />
            帳票発行
          </Link>
          <Link
            href={`/deals/${id}/edit`}
            className="bg-[#351E28] text-[#C9A2B8] rounded-full px-3 py-2 text-[12px] font-medium font-body no-underline whitespace-nowrap"
          >
            編集
          </Link>
        </div>
      </div>

      {(approvedQuotes.length > 0 || feesTotal > 0) && (
        <div className="mb-4 bg-white rounded-[16px] border border-[#E9F056] p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="text-[12px] font-body text-[#351E28]">
            採用見積 <span className="text-[#351E28] font-semibold">{approvedQuotes.length}</span> 件 · 別途費用{' '}
            <span className="text-[#351E28] font-semibold tabular-nums">{formatJPY(feesTotal)}</span>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-[#84787D] font-body">採用合計 (税込) + 別途費用</p>
            <p className="text-[20px] font-display font-semibold text-[#666C14] tabular-nums">
              {formatJPY(approvedTotalTax + feesTotal)}
            </p>
          </div>
        </div>
      )}

      <div className="mb-3">
        <NextStepGuide
          dealId={id}
          status={(deal.simple_status || 'quoting') as SimpleStatus}
          waitingOn={deal.waiting_on}
          counts={buildGuideCounts({
            products: products || [],
            variants,
            quotes: (quotes || []) as never,
            documents: (documents || []) as never,
          })}
        />
      </div>

      <div className="mb-4">
        <DealProgressBar
          dealId={id}
          currentStatus={(deal.simple_status || 'quoting') as SimpleStatus}
        />
      </div>

      <DealDetailTabs
        deal={dealLite as never}
        products={(products || []) as never}
        variants={variants as never}
        quotes={(quotes || []) as never}
        fees={(fees || []) as never}
        designFiles={designFiles || []}
        statusHistory={historyLite as never}
        communications={(communications || []) as never}
      />
    </>
  )
}
