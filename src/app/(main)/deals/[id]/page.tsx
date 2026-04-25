import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { DealProgressBar } from '@/components/deal-progress-bar'
import { DealDetailTabs } from './deal-detail-tabs'
import { type SimpleStatus } from '@/lib/types'

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
      created_at,
      last_activity_at,
      sales_user:profiles!deals_sales_user_id_fkey(display_name)
    `
    )
    .eq('id', id)
    .single()

  if (!deal) notFound()

  const [{ data: specifications }, { data: quotes }, { data: designFiles }, { data: statusHistory }] =
    await Promise.all([
      supabase
        .from('deal_specifications')
        .select(
          'id, product_name, product_category, height_mm, width_mm, depth_mm, material_category, print_colors, printing_method, processing_list, specification_memo'
        )
        .eq('deal_id', id)
        .order('created_at', { ascending: true }),
      supabase
        .from('deal_quotes')
        .select('id, version, quantity, total_billing_tax_jpy, status, created_at')
        .eq('deal_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('deal_design_files')
        .select('id, storage_url, file_name, created_at')
        .eq('deal_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('deal_status_history')
        .select(
          'id, from_simple_status, to_simple_status, changed_at, note, changer:profiles!deal_status_history_changed_by_fkey(display_name)'
        )
        .eq('deal_id', id)
        .order('changed_at', { ascending: false }),
    ])

  const dealLite = {
    ...deal,
    sales_user: Array.isArray(deal.sales_user) ? deal.sales_user[0] : deal.sales_user,
  }

  const historyLite = (statusHistory || []).map((h) => ({
    ...h,
    changer: Array.isArray(h.changer) ? h.changer[0] : h.changer,
  }))

  return (
    <>
      <Link
        href="/deals"
        className="inline-flex items-center gap-1 text-[13px] text-[#888] font-body no-underline hover:text-[#555] mt-4 mb-2"
      >
        <ChevronLeft className="w-4 h-4" />
        案件一覧
      </Link>

      <div className="flex justify-between items-start py-3 gap-4">
        <div className="min-w-0">
          <p className="text-[11px] text-[#888] font-body tabular-nums">{deal.deal_code}</p>
          <h1 className="font-display text-[24px] font-semibold text-[#0a0a0a] truncate">
            {deal.deal_name || '(案件名未設定)'}
          </h1>
          <p className="text-[13px] text-[#555] font-body mt-1 truncate">
            {deal.client_name_text || '(クライアント未設定)'}
          </p>
        </div>
        <Link
          href={`/deals/${id}/edit`}
          className="bg-[#0a0a0a] text-white rounded-[8px] px-4 py-2 text-[13px] font-medium font-body no-underline whitespace-nowrap"
        >
          編集
        </Link>
      </div>

      <div className="mb-4">
        <DealProgressBar dealId={id} currentStatus={(deal.simple_status || 'quoting') as SimpleStatus} />
      </div>

      <DealDetailTabs
        deal={dealLite as never}
        specifications={specifications || []}
        quotes={quotes || []}
        designFiles={designFiles || []}
        statusHistory={historyLite as never}
      />
    </>
  )
}
