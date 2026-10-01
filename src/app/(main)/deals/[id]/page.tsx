import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { WaitingOnBadge } from '@/components/deals/waiting-on-badge'
import { DealFlow, type FlowDocument, type FlowHistoryRow } from '@/components/deals/deal-flow'
import { listDesignFiles } from '@/lib/actions/designs'
import { listFactoryOrders } from '@/lib/actions/factory-orders'
import { listFactoriesForRfq } from '@/lib/actions/rfq'
import { listCatalog } from '@/lib/actions/catalog'
import { type SimpleStatus, SIMPLE_STATUS_CONFIG } from '@/lib/types'
import { approvedAmount, waitingLabel } from '@/lib/deals/case-workspace'
import { CaseReturnLink } from '@/components/deals/case-return-link'
import { formatJPY, formatDate } from '@/lib/utils/format'

// Sprint 10 (#18): 案件詳細 =「一本の線」。
// 問い合わせ→仕様→RFQ→工場回答→原価→売値→見積書→入金→入稿→製作→輸送→到着→完了 の
// 13ステップから1工程を選び、その場で開いて入力する。

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

  const { data: deal, error: dealError } = await supabase
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

  if (dealError && dealError.code !== 'PGRST116') throw new Error('Deal could not be loaded')
  if (!deal) notFound()

  const [factoryOrderResult, factories] = await Promise.all([listFactoryOrders(id), listFactoriesForRfq()])
  if (factoryOrderResult.error) throw new Error('Factory orders could not be loaded')

  const [
    { data: products, error: productsError },
    { data: variantsRaw, error: variantsError },
    { data: quotes, error: quotesError },
    designFiles,
    catalog,
    { data: statusHistory, error: historyError },
    { data: communications, error: communicationsError },
    { data: documents, error: documentsError },
    { count: rfqCount, error: rfqError },
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
      .select('*,factory:factories(factory_name)')
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

  if ([productsError, variantsError, quotesError, historyError, communicationsError, documentsError, rfqError].some(Boolean)) throw new Error('Deal workflow data could not be loaded')

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

  const amount = approvedAmount(quotes || [])
  const statusCfg = SIMPLE_STATUS_CONFIG[(deal.simple_status || 'quoting') as SimpleStatus]

  return (
    <>
      <CaseReturnLink />

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

          </div>
          <p className="text-[13px] text-[#351E28] font-body mt-1 truncate">
            {deal.client_name_text || '(クライアント未設定)'}
            {deal.brand_text && <span className="text-[#84787D]"> · {deal.brand_text}</span>}
          </p>
        </div>
        <div className="flex gap-3 flex-shrink-0 items-center">
          <div className="text-right">
            <p className="text-[11px] text-[#84787D]">採用額（税込）</p>
            <p className="text-[18px] font-extrabold tabular-nums">{amount.label || formatJPY(amount.total)}</p>
            {amount.missing > 0 && <p className="text-[11px] text-[#84787D]">金額未登録 {amount.missing}件 · 登録済み分 {formatJPY(amount.total)}</p>}
          </div>
          <Link
            href={`/deals/${id}/edit`}
            className="bg-white text-[#351E28] border border-[#E2E1DA] rounded-full px-3.5 py-2 min-h-[44px] inline-flex items-center text-[12px] font-medium font-body no-underline whitespace-nowrap hover:bg-[#FBFAF6]"
          >
            編集
          </Link>
        </div>
      </div>

      <dl aria-label="案件の状況" className="flex flex-wrap gap-x-5 gap-y-2 border-b border-[#E2E1DA] pb-3 mb-3 text-[12px]">
        <div className="flex items-center gap-2"><dt className="text-[#84787D]">待ち先</dt><dd className="font-bold">{waitingLabel(deal.waiting_on)}</dd><dd><details><summary className="cursor-pointer text-[11px] underline">変更</summary><WaitingOnBadge dealId={deal.id} value={deal.waiting_on} /></details></dd></div>
        <div className="flex items-center gap-2"><dt className="text-[#84787D]">希望納期</dt><dd className="font-bold tabular-nums">{deal.desired_delivery_date ? formatDate(deal.desired_delivery_date) : <Link href={`/deals/${id}/edit`} className="underline">未設定 · 設定する</Link>}</dd></div>
        <div className="flex items-center gap-2"><dt className="text-[#84787D]">担当</dt><dd className="font-bold">{flowDeal.sales_user?.display_name || <Link href={`/deals/${id}/edit`} className="underline">未設定 · 設定する</Link>}</dd></div>
      </dl>

      <Link href={`/deals/${id}/samples`} className="inline-flex min-h-11 items-center underline text-[13px] mb-3">サンプル手配・未請求費用を確認</Link>
      <Link href={`/deals/${id}/settlement`} className="inline-flex min-h-11 items-center underline text-[13px] mb-3 ml-4">顧客承認・実着金を確認</Link>
      <Link href={`/deals/${id}/shipping`} className="inline-flex min-h-11 items-center underline text-[13px] mb-3 ml-4">発送・物流・顧客受領を確認</Link>
      <Link href={`/deals/${id}/production`} className="inline-flex min-h-11 items-center underline text-[13px] mb-3 ml-4">工場条件・支払・製造開始を確認</Link>
      <DealFlow
        deal={flowDeal as never}
        products={(products || []) as never}
        catalog={catalog}
        variants={variants as never}
        quotes={(quotes || []) as never}
        designFiles={designFiles}
        documents={(documents || []) as FlowDocument[]}
        rfqCount={rfqCount || 0}
        factoryOrders={factoryOrderResult.orders}
        factories={factories}
        statusHistory={historyLite}
        communications={(communications || []) as never}
      />
    </>
  )
}
