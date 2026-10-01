import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { DealsNestedTable } from '@/components/deals/deals-nested-table'
import { DealPaneHost } from '@/components/deals/deal-pane-host'
import { getDealPaneData } from '@/lib/actions/deal-pane'
import { getUserPreferences } from '@/lib/actions/user-preferences'
import { type SimpleStatus, SIMPLE_STATUS_ORDER } from '@/lib/types'

// Sprint 15: 案件管理は「取引先カード → 中に入って案件リスト」の2段構成。
//   /deals                  … 取引先ごとのカード一覧
//   /deals?client=◯◯        … その取引先の案件リスト (ネスト表)
//   /deals?status= / ?q= / ?selected= … 従来どおり全件リスト (分析などからのリンク用)

const NO_CLIENT = '__none__'

interface Props {
  searchParams: Promise<{
    status?: string
    q?: string
    selected?: string
    client?: string
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

  const clientParam = params.client || null

  let dealsQuery = supabase
    .from('deals')
    .select(
      'id, deal_code, deal_name, client_name_text, desired_delivery_date, simple_status, waiting_on, last_activity_at, sales_user_id'
    )
    // Sprint 9: アーカイブ案件は /archive に分離 (§0.5-6)
    .is('archived_at', null)
    .order('last_activity_at', { ascending: false })

  if (clientParam === NO_CLIENT) {
    dealsQuery = dealsQuery.is('client_name_text', null)
  } else if (clientParam) {
    dealsQuery = dealsQuery.eq('client_name_text', clientParam)
  }
  if (params.status && isValidStatus(params.status)) {
    dealsQuery = dealsQuery.eq('simple_status', params.status)
  }
  if (params.q) {
    const escaped = params.q.replace(/[%_]/g, (m) => `\\${m}`)
    dealsQuery = dealsQuery.or(
      `deal_name.ilike.%${escaped}%,client_name_text.ilike.%${escaped}%,deal_code.ilike.%${escaped}%`
    )
  }

  const { data: deals, error: dealsError } = await dealsQuery
  if (dealsError) throw new Error('Deals could not be loaded')
  const dealIds = (deals || []).map((d) => d.id)

  // -------------------------------------------------------------------------
  // 案件リスト (取引先の中 / 検索・ステータスリンク経由)
  // -------------------------------------------------------------------------

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
    // Sprint 7-4-1 (migration 027)
    shipping_address_label: string | null
    shipping_address_full: string | null
    shipping_recipient_name: string | null
    shipping_phone: string | null
    shipping_address_id: string | null
    thumbnail_url: string | null
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
    factory_id: string | null
  }> = []

  if (dealIds.length > 0) {
    const [{ data: prod }, { data: vars }, { data: qs }] = await Promise.all([
      supabase
        .from('deal_products')
        .select('id, deal_id, product_no, description, factory_staff_code, production_process, food_grade_status, food_inspection_status, product_memo, is_selected, shipping_address_label, shipping_address_full, shipping_recipient_name, shipping_phone, shipping_address_id, thumbnail_url')
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
          'id, deal_id, variant_id, spec_id, version, quantity, moq, factory_unit_price_usd, plate_fee_usd, pantone_color_fee_usd, sample_cost_usd, sample_shipping_usd, other_fees_usd, domestic_china_freight_usd, factory_calculated_freight_usd, food_inspection_fee_yuan, china_freight_yuan, china_freight_usd, exchange_rate, cost_ratio, selling_price_usd, selling_price_jpy, unit_cost_usd, total_cost_usd, total_billing_jpy, total_billing_tax_jpy, shipping_weight_kg, incoterm, packing_info_text, sample_production_days, sample_shipping_days, status, factory_id'
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

  // Right pane data — fetched only when ?selected=X is present
  const paneData = params.selected ? await getDealPaneData(params.selected) : null

  // Sprint 7-3-3: 列幅をユーザーごとに DB 永続化
  const userPrefs = await getUserPreferences()

  const clientTitle =
    clientParam === NO_CLIENT ? 'クライアント未設定' : clientParam

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-100px)] -mx-3 sm:-mx-5">
      <div className="flex-1 flex flex-col min-w-0 overflow-auto px-5">
        <div className="flex items-center gap-2.5 flex-wrap pt-3 pb-2">
          <Link
            href="/deals"
            className="inline-flex items-center gap-1 text-[12px] text-[#84787D] font-bold no-underline hover:text-[#351E28]"
          >
            ← 案件一覧
          </Link>
          {clientTitle && (
            <>
              <span className="w-px h-5 bg-[#E2E1DA]" />
              <span className="w-6 h-6 rounded-full bg-[#D7EFFF] text-[#33566F] flex items-center justify-center text-[11px] font-bold">
                {(clientTitle || '?').charAt(0)}
              </span>
              <h2 className="text-[15px] font-extrabold text-[#351E28]">{clientTitle}</h2>
              <span className="fc-num text-[11.5px] text-[#84787D]">{(deals || []).length}件</span>
            </>
          )}
          <span className="flex-1" />
          <Link
            href={
              clientParam && clientParam !== NO_CLIENT
                ? `/deals/new?client=${encodeURIComponent(clientParam)}`
                : '/deals/new'
            }
            className="rounded-full bg-[#E9F056] text-[#666C14] text-[12px] font-extrabold px-3.5 py-1.5 no-underline hover:brightness-95"
          >
            + 新規案件
          </Link>
        </div>
        <DealsNestedTable
          deals={deals || []}
          products={products}
          variants={variants}
          quotes={quotes}
          selectedDealId={params.selected || null}
          serverColWidths={userPrefs?.deals_table_column_widths || null}
        />
      </div>
      <DealPaneHost data={paneData} />
    </div>
  )
}
