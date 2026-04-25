'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { calculateFullQuote, type FullQuoteResult } from '@/lib/calc/quote-engine'

export interface CreateSprint5QuoteInput {
  deal_id: string
  variant_id: string
  spec_id?: string | null  // 互換性のため残す
  quantity: number
  moq?: number | null
  factory_unit_price_usd: number

  // settings 由来 (上書き可)
  exchange_rate?: number | null
  cost_ratio?: number | null
  yuan_to_usd_rate?: number | null
  china_freight_rate_yuan_per_kg?: number | null

  // 追加費用
  plate_fee_usd?: number | null
  pantone_color_fee_usd?: number | null
  domestic_china_freight_usd?: number | null
  sample_cost_usd?: number | null
  sample_shipping_usd?: number | null
  food_inspection_fee_yuan?: number | null
  other_fees_usd?: number | null
}

export interface QuoteRow {
  id: string
  deal_id: string
  spec_id: string | null
  variant_id: string | null
  version: number | null
  quantity: number | null
  moq: number | null
  factory_unit_price_usd: number | null
  plate_fee_usd: number | null
  other_fees_usd: number | null
  pantone_color_fee_usd: number | null
  domestic_china_freight_usd: number | null
  sample_cost_usd: number | null
  sample_shipping_usd: number | null
  food_inspection_fee_yuan: number | null
  yuan_to_usd_rate: number | null
  china_freight_yuan: number | null
  china_freight_usd: number | null
  shipping_weight_kg: number | null
  volumetric_weight_kg: number | null
  actual_weight_total_kg: number | null
  total_cost_usd: number | null
  unit_cost_usd: number | null
  cost_ratio: number | null
  exchange_rate: number | null
  selling_price_usd: number | null
  selling_price_jpy: number | null
  total_billing_jpy: number | null
  total_billing_tax_jpy: number | null
  status: string | null
  created_at: string
}

export interface CalcDefaults {
  exchange_rate: number
  cost_ratio: number
  tax_rate: number
  yuan_to_usd_rate: number
  china_freight_rate_yuan_per_kg: number
  pantone_color_fee_yuan: number
}

async function loadDefaults(): Promise<CalcDefaults> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('system_settings')
    .select(
      'default_exchange_rate, default_tax_rate, default_cost_ratio, default_yuan_to_usd_rate, default_china_freight_rate_yuan_per_kg, default_pantone_color_fee_yuan'
    )
    .single()
  return {
    exchange_rate: Number(data?.default_exchange_rate) || 155,
    cost_ratio: Number(data?.default_cost_ratio) || 0.55,
    tax_rate: Number(data?.default_tax_rate) || 10,
    yuan_to_usd_rate: Number(data?.default_yuan_to_usd_rate) || 7.2,
    china_freight_rate_yuan_per_kg: Number(data?.default_china_freight_rate_yuan_per_kg) || 7.0,
    pantone_color_fee_yuan: Number(data?.default_pantone_color_fee_yuan) || 11775,
  }
}

function parseFormData(input: CreateSprint5QuoteInput | FormData): CreateSprint5QuoteInput {
  if (!(input instanceof FormData)) return input
  const num = (key: string): number | null => {
    const v = input.get(key) as string | null
    if (!v) return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return {
    deal_id: (input.get('deal_id') as string) || '',
    variant_id: (input.get('variant_id') as string) || '',
    spec_id: (input.get('spec_id') as string) || null,
    quantity: num('quantity') || 0,
    moq: num('moq'),
    factory_unit_price_usd: num('factory_unit_price_usd') || 0,
    exchange_rate: num('exchange_rate'),
    cost_ratio: num('cost_ratio'),
    yuan_to_usd_rate: num('yuan_to_usd_rate'),
    china_freight_rate_yuan_per_kg: num('china_freight_rate_yuan_per_kg'),
    plate_fee_usd: num('plate_fee_usd'),
    pantone_color_fee_usd: num('pantone_color_fee_usd'),
    domestic_china_freight_usd: num('domestic_china_freight_usd'),
    sample_cost_usd: num('sample_cost_usd'),
    sample_shipping_usd: num('sample_shipping_usd'),
    food_inspection_fee_yuan: num('food_inspection_fee_yuan'),
    other_fees_usd: num('other_fees_usd'),
  }
}

interface VariantPhysicsRow {
  pcs_per_carton: number | null
  carton_width_cm: number | null
  carton_height_cm: number | null
  carton_depth_cm: number | null
  gross_weight_kg: number | null
}

export async function createQuote(
  input: CreateSprint5QuoteInput | FormData
): Promise<{ data: QuoteRow | null; error: string | null }> {
  const supabase = await createClient()
  const data = parseFormData(input)

  if (!data.deal_id) return { data: null, error: 'deal_id が必要です' }
  if (!data.variant_id) return { data: null, error: 'variant_id が必要です' }
  if (!data.quantity || data.quantity <= 0)
    return { data: null, error: '数量は 1 以上で指定してください' }
  if (data.factory_unit_price_usd <= 0)
    return { data: null, error: '工場単価は 0 より大きい値を指定してください' }

  const defaults = await loadDefaults()
  const exchange_rate = data.exchange_rate || defaults.exchange_rate
  const cost_ratio = data.cost_ratio || defaults.cost_ratio
  const tax_rate = defaults.tax_rate
  const yuan_to_usd_rate = data.yuan_to_usd_rate || defaults.yuan_to_usd_rate
  const china_freight_rate =
    data.china_freight_rate_yuan_per_kg || defaults.china_freight_rate_yuan_per_kg

  if (cost_ratio <= 0 || cost_ratio > 1)
    return { data: null, error: '掛け率は 0 < x ≦ 1 で指定してください' }

  // バリエーションの物理情報を取得
  const { data: variant } = await supabase
    .from('deal_product_variants')
    .select('pcs_per_carton, carton_width_cm, carton_height_cm, carton_depth_cm, gross_weight_kg')
    .eq('id', data.variant_id)
    .single<VariantPhysicsRow>()

  const physics = {
    pcsPerCarton: Number(variant?.pcs_per_carton) || 0,
    cartonWidthCm: Number(variant?.carton_width_cm) || 0,
    cartonHeightCm: Number(variant?.carton_height_cm) || 0,
    cartonDepthCm: Number(variant?.carton_depth_cm) || 0,
    grossWeightKg: Number(variant?.gross_weight_kg) || 0,
  }

  const calc: FullQuoteResult = calculateFullQuote({
    orderQty: data.quantity,
    factoryUnitPriceUsd: data.factory_unit_price_usd,
    physics,
    chinaFreightRateYuanPerKg: china_freight_rate,
    yuanToUsdRate: yuan_to_usd_rate,
    exchangeRate: exchange_rate,
    costRatio: cost_ratio,
    taxRate: tax_rate,
    plateFeeUsd: data.plate_fee_usd || 0,
    pantoneColorFeeUsd: data.pantone_color_fee_usd || 0,
    domesticChinaFreightUsd: data.domestic_china_freight_usd || 0,
    sampleCostUsd: data.sample_cost_usd || 0,
    sampleShippingUsd: data.sample_shipping_usd || 0,
    otherFeesUsd: data.other_fees_usd || 0,
  })

  const { data: existing } = await supabase
    .from('deal_quotes')
    .select('version')
    .eq('deal_id', data.deal_id)
    .order('version', { ascending: false })
    .limit(1)
  const nextVersion = existing && existing.length > 0 ? (existing[0].version || 0) + 1 : 1

  const { data: row, error } = await supabase
    .from('deal_quotes')
    .insert({
      deal_id: data.deal_id,
      variant_id: data.variant_id,
      spec_id: data.spec_id || null,
      factory_id: null,
      version: nextVersion,
      quantity: data.quantity,
      moq: data.moq || null,
      factory_unit_price_usd: data.factory_unit_price_usd,
      plate_fee_usd: data.plate_fee_usd || 0,
      other_fees_usd: data.other_fees_usd || 0,
      pantone_color_fee_usd: data.pantone_color_fee_usd || 0,
      domestic_china_freight_usd: data.domestic_china_freight_usd || 0,
      sample_cost_usd: data.sample_cost_usd || 0,
      sample_shipping_usd: data.sample_shipping_usd || 0,
      food_inspection_fee_yuan: data.food_inspection_fee_yuan || 0,
      yuan_to_usd_rate,
      china_freight_yuan: calc.chinaFreightYuan,
      china_freight_usd: calc.chinaFreightUsd,
      shipping_weight_kg: calc.shippingWeightKg,
      volumetric_weight_kg: calc.volumetricWeightKg,
      actual_weight_total_kg: calc.actualWeightTotalKg,
      total_cost_usd: calc.totalCostUsd,
      unit_cost_usd: calc.unitCostUsd,
      cost_ratio,
      exchange_rate,
      selling_price_usd: calc.sellingPriceUsd,
      selling_price_jpy: calc.sellingPriceJpy,
      total_billing_jpy: calc.totalBillingJpy,
      total_billing_tax_jpy: calc.totalBillingTaxJpy,
      status: 'drafting',
      source_type: 'manual',
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }

  revalidatePath(`/deals/${data.deal_id}`)
  revalidatePath(`/deals/${data.deal_id}/quote`)
  return { data: row as QuoteRow, error: null }
}

export async function deleteQuote(
  quoteId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('deal_quotes')
    .select('deal_id')
    .eq('id', quoteId)
    .single()
  const { error } = await supabase.from('deal_quotes').delete().eq('id', quoteId)
  if (error) return { success: false, error: error.message }
  if (existing?.deal_id) {
    revalidatePath(`/deals/${existing.deal_id}`)
    revalidatePath(`/deals/${existing.deal_id}/quote`)
  }
  return { success: true }
}

export async function getQuotesForDeal(dealId: string): Promise<QuoteRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('deal_quotes')
    .select('*')
    .eq('deal_id', dealId)
    .order('version', { ascending: false })
  return (data || []) as QuoteRow[]
}

export async function getQuotesForVariant(variantId: string): Promise<QuoteRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('deal_quotes')
    .select('*')
    .eq('variant_id', variantId)
    .order('quantity', { ascending: true })
  return (data || []) as QuoteRow[]
}

export async function selectQuote(
  quoteId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('deal_quotes')
    .select('deal_id, variant_id, spec_id')
    .eq('id', quoteId)
    .single()
  if (!existing) return { success: false, error: '見積が見つかりません' }

  if (existing.variant_id) {
    await supabase
      .from('deal_quotes')
      .update({ status: 'rejected' })
      .eq('variant_id', existing.variant_id)
      .eq('status', 'approved')
  } else if (existing.spec_id) {
    await supabase
      .from('deal_quotes')
      .update({ status: 'rejected' })
      .eq('deal_id', existing.deal_id)
      .eq('spec_id', existing.spec_id)
      .eq('status', 'approved')
  }

  const { error } = await supabase
    .from('deal_quotes')
    .update({ status: 'approved' })
    .eq('id', quoteId)
  if (error) return { success: false, error: error.message }

  revalidatePath(`/deals/${existing.deal_id}`)
  revalidatePath(`/deals/${existing.deal_id}/quote`)
  return { success: true }
}

export async function unselectQuote(
  quoteId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('deal_quotes')
    .select('deal_id')
    .eq('id', quoteId)
    .single()
  if (!existing) return { success: false, error: '見積が見つかりません' }
  const { error } = await supabase
    .from('deal_quotes')
    .update({ status: 'drafting' })
    .eq('id', quoteId)
  if (error) return { success: false, error: error.message }
  revalidatePath(`/deals/${existing.deal_id}`)
  revalidatePath(`/deals/${existing.deal_id}/quote`)
  return { success: true }
}

export async function getQuoteCalculationDefaults(): Promise<CalcDefaults> {
  return loadDefaults()
}
