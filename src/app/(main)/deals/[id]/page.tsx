import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { WaitingOnBadge } from '@/components/deals/waiting-on-badge'
import { DealFlow, type FlowDocument, type FlowHistoryRow } from '@/components/deals/deal-flow'
import { listDesignFiles } from '@/lib/actions/designs'
import { listCatalog } from '@/lib/actions/catalog'
import { type SimpleStatus, SIMPLE_STATUS_CONFIG } from '@/lib/types'
import { formatJPY } from '@/lib/utils/format'

// Sprint 10 (#18): 案件詳細 =「一本の線」。
// 問い合わせ→仕様→RFQ→工場回答→原価→売値→見積書→入金→入稿→製作→輸送→到着→完了 の
// 13ステップを縦1本に並べ、各ステップをその場で開いて入力する。

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
      brand_text,
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
    designFiles,
    catalog,
    { data: statusHistory },
    { data: communications },
    { data: documents },
    { count: rfqCount },
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
      .select('*')
      .eq('deal_id', id)
      .order('quantity', { ascending: true }),
    listDesignFiles(id),
    listCatalog(),
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
      .select('id, document_type, document_number, file_url, created_at')
      .eq('deal_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('rfq_requests')
      .select('id', { count: 'exact', head: true })
      .eq('deal_id', id),
  ])

  // strip the joined deal_products from variants
  const variants = (variantsRaw || []).map((v) => {
    const { deal_products: _omit, ...rest } = v as Record<string, unknown>
    return rest
  })

  const flowDeal = {
    ...deal,
    sales_user: Array.isArray(deal.sales_user) ? deal.sales_user[0] : deal.sales_user,
  }

  const historyLite: FlowHistoryRow[] = (statusHistory || []).map((h) => ({
    ...h,
    changer: Array.isArray(h.changer) ? h.changer[0] : h.changer,
  }))

  const approvedQuotes = (quotes || []).filter((q) => q.status === 'approved')
  const approvedTotalTax = approvedQuotes.reduce(
    (sum, q) => sum + (Number(q.total_billing_tax_jpy) || 0),
    0
  )
  const statusCfg = SIMPLE_STATUS_CONFIG[(deal.simple_status || 'quoting') as SimpleStatus]

  return (
    <>
      <Link
        href="/deals"
        className="inline-flex items-center gap-1 text-[13px] text-[#84787D] font-body no-underline hover:text-[#351E28] mt-4 mb-2"
      >
        <ChevronLeft className="w-4 h-4" />
        案件一覧
      </Link>

      <div className="flex justify-between items-start py-3 gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-[11px] text-[#84787D] font-body tabular-nums">{deal.deal_code}</p>
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <h1 className="font-display text-[21px] font-extrabold text-[#351E28] truncate">
              {deal.deal_name || '(案件名未設定)'}
            </h1>
            <span className="rounded-full bg-[#D7EFFF] text-[#33566F] text-[11px] font-bold px-2.5 py-[3px] whitespace-nowrap">
              {statusCfg.label}
            </span>
            <WaitingOnBadge dealId={deal.id} value={deal.waiting_on} />
          </div>
          <p className="text-[13px] text-[#351E28] font-body mt-1 truncate">
            {deal.client_name_text || '(クライアント未設定)'}
            {deal.brand_text && <span className="text-[#84787D]"> · {deal.brand_text}</span>}
          </p>
        </div>
        <div className="flex gap-3 flex-shrink-0 items-center">
          {approvedQuotes.length > 0 && (
            <div className="text-right">
              <p className="text-[10px] text-[#84787D] font-body">
                採用見積 {approvedQuotes.length}件 (税込)
              </p>
              <p className="text-[18px] font-display font-extrabold text-[#33566F] tabular-nums">
                {formatJPY(approvedTotalTax)}
              </p>
            </div>
          )}
          <Link
            href={`/deals/${id}/edit`}
            className="bg-white text-[#351E28] border border-[#E2E1DA] rounded-full px-3.5 py-2 text-[12px] font-medium font-body no-underline whitespace-nowrap hover:bg-[#FBFAF6]"
          >
            編集
          </Link>
        </div>
      </div>

      <DealFlow
        deal={flowDeal as never}
        products={(products || []) as never}
        catalog={catalog}
        variants={variants as never}
        quotes={(quotes || []) as never}
        designFiles={designFiles}
        documents={(documents || []) as FlowDocument[]}
        rfqCount={rfqCount || 0}
        statusHistory={historyLite}
        communications={(communications || []) as never}
      />
    </>
  )
}
