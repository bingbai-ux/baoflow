import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
import { DealsExcelTable } from '@/components/deals/deals-excel-table'
import { type SimpleStatus, SIMPLE_STATUS_ORDER } from '@/lib/types'

interface Props {
  searchParams: Promise<{
    status?: string
    q?: string
  }>
}

function isValidStatus(value: string): value is SimpleStatus {
  return (SIMPLE_STATUS_ORDER as string[]).includes(value)
}

export default async function DealsPage({ searchParams }: Props) {
  const params = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let dealsQuery = supabase
    .from('deals')
    .select(
      'id, deal_code, deal_name, client_name_text, desired_delivery_date, simple_status, last_activity_at, sales_user_id'
    )
    .order('last_activity_at', { ascending: false })

  if (params.status && isValidStatus(params.status)) {
    dealsQuery = dealsQuery.eq('simple_status', params.status)
  }
  if (params.q) {
    const escaped = params.q.replace(/[%_]/g, (m) => `\\${m}`)
    dealsQuery = dealsQuery.or(
      `deal_name.ilike.%${escaped}%,client_name_text.ilike.%${escaped}%,deal_code.ilike.%${escaped}%`
    )
  }

  const { data: deals } = await dealsQuery
  const dealIds = (deals || []).map((d) => d.id)

  let products: Array<{
    id: string
    deal_id: string
    product_no: number
    description: string
    factory_staff_code: string | null
    is_selected: boolean
  }> = []
  let variants: Array<{
    id: string
    product_id: string
    variant_label: string
    width_mm: number | null
    height_mm: number | null
    depth_mm: number | null
    material: string | null
    print_color_count: string | null
    pcs_per_carton: number | null
    gross_weight_kg: number | null
    is_selected: boolean
  }> = []
  let quotes: Array<{
    id: string
    deal_id: string
    variant_id: string | null
    spec_id: string | null
    version: number | null
    quantity: number | null
    moq: number | null
    factory_unit_price_usd: number | null
    exchange_rate: number | null
    cost_ratio: number | null
    selling_price_jpy: number | null
    total_billing_jpy: number | null
    total_billing_tax_jpy: number | null
    shipping_weight_kg: number | null
    status: string | null
  }> = []

  if (dealIds.length > 0) {
    const [{ data: prod }, { data: vars }, { data: qs }] = await Promise.all([
      supabase
        .from('deal_products')
        .select('id, deal_id, product_no, description, factory_staff_code, is_selected')
        .in('deal_id', dealIds)
        .order('product_no', { ascending: true }),
      supabase
        .from('deal_product_variants')
        .select(
          'id, product_id, variant_label, width_mm, height_mm, depth_mm, material, print_color_count, pcs_per_carton, gross_weight_kg, is_selected, deal_products!inner(deal_id)'
        )
        .in('deal_products.deal_id', dealIds)
        .order('variant_order', { ascending: true }),
      supabase
        .from('deal_quotes')
        .select(
          'id, deal_id, variant_id, spec_id, version, quantity, moq, factory_unit_price_usd, exchange_rate, cost_ratio, selling_price_jpy, total_billing_jpy, total_billing_tax_jpy, shipping_weight_kg, status'
        )
        .in('deal_id', dealIds)
        .order('version', { ascending: false }),
    ])
    products = (prod || []) as never
    variants = (vars || []).map((v) => {
      const { deal_products: _omit, ...rest } = v as Record<string, unknown>
      return rest as never
    })
    quotes = (qs || []) as never
  }

  return (
    <>
      <div className="flex justify-between items-center py-[18px]">
        <div>
          <h1 className="font-display text-[22px] font-semibold text-[#0a0a0a] tracking-tight">案件</h1>
          <p className="text-[11px] text-[#888] font-body mt-0.5">
            Excel 風一覧 — セルをクリックして直接編集 · 横スクロールで全項目表示
          </p>
        </div>
        <Link
          href="/deals/new"
          className="bg-[#0a0a0a] text-white rounded-[8px] px-4 py-2 text-[13px] font-medium font-body no-underline inline-flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          新規案件
        </Link>
      </div>

      <DealsExcelTable
        deals={deals || []}
        products={products}
        variants={variants}
        quotes={quotes}
      />
    </>
  )
}
