import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
import { DealsNestedTable } from '@/components/deals/deals-nested-table'
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
    production_process: string | null
    food_grade_status: string | null
    food_inspection_status: string | null
    product_memo: string | null
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
    color_description: string | null
    pantone_colors: string | null
    processing: string | null
    other_notes: string | null
    print_color_count: string | null
    print_method: string | null
    pcs_per_carton: number | null
    carton_width_cm: number | null
    carton_height_cm: number | null
    carton_depth_cm: number | null
    gross_weight_kg: number | null
    production_lead_days: number | null
    shipping_lead_days: number | null
    food_inspection_days: number | null
    shipping_address: string | null
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
    plate_fee_usd: number | null
    pantone_color_fee_usd: number | null
    sample_cost_usd: number | null
    sample_shipping_usd: number | null
    other_fees_usd: number | null
    domestic_china_freight_usd: number | null
    factory_calculated_freight_usd: number | null
    food_inspection_fee_yuan: number | null
    china_freight_yuan: number | null
    china_freight_usd: number | null
    exchange_rate: number | null
    cost_ratio: number | null
    selling_price_usd: number | null
    selling_price_jpy: number | null
    unit_cost_usd: number | null
    total_cost_usd: number | null
    total_billing_jpy: number | null
    total_billing_tax_jpy: number | null
    shipping_weight_kg: number | null
    incoterm: string | null
    packing_info_text: string | null
    sample_production_days: number | null
    sample_shipping_days: number | null
    status: string | null
  }> = []

  if (dealIds.length > 0) {
    const [{ data: prod }, { data: vars }, { data: qs }] = await Promise.all([
      supabase
        .from('deal_products')
        .select('id, deal_id, product_no, description, factory_staff_code, production_process, food_grade_status, food_inspection_status, product_memo, is_selected')
        .in('deal_id', dealIds)
        .order('product_no', { ascending: true }),
      supabase
        .from('deal_product_variants')
        .select(
          'id, product_id, variant_label, width_mm, height_mm, depth_mm, material, color_description, pantone_colors, processing, other_notes, print_color_count, print_method, pcs_per_carton, carton_width_cm, carton_height_cm, carton_depth_cm, gross_weight_kg, production_lead_days, shipping_lead_days, food_inspection_days, shipping_address, is_selected, deal_products!inner(deal_id)'
        )
        .in('deal_products.deal_id', dealIds)
        .order('variant_order', { ascending: true }),
      supabase
        .from('deal_quotes')
        .select(
          'id, deal_id, variant_id, spec_id, version, quantity, moq, factory_unit_price_usd, plate_fee_usd, pantone_color_fee_usd, sample_cost_usd, sample_shipping_usd, other_fees_usd, domestic_china_freight_usd, factory_calculated_freight_usd, food_inspection_fee_yuan, china_freight_yuan, china_freight_usd, exchange_rate, cost_ratio, selling_price_usd, selling_price_jpy, unit_cost_usd, total_cost_usd, total_billing_jpy, total_billing_tax_jpy, shipping_weight_kg, incoterm, packing_info_text, sample_production_days, sample_shipping_days, status'
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
            クライアントの ▼ をクリックで展開 · 各案件行クリックで詳細表示
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

      <DealsNestedTable
        deals={deals || []}
        products={products}
        variants={variants}
        quotes={quotes}
      />
    </>
  )
}
