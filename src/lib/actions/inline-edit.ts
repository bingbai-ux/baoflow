'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { calculateFullQuote } from '@/lib/calc/quote-engine'

// Generic inline field update for deals/products/variants/quotes
// 必要最小限のフィールドのみ許可 (誤更新防止)

const ALLOWED_DEAL_FIELDS = new Set([
  'deal_name',
  'client_name_text',
  'desired_delivery_date',
  'memo',
])

const ALLOWED_PRODUCT_FIELDS = new Set([
  'description',
  'factory_staff_code',
  'production_process',
  'product_memo',
])

const ALLOWED_VARIANT_FIELDS = new Set([
  'variant_label',
  'material',
  'color_description',
  'pantone_colors',
  'processing',
  'print_color_count',
  'print_method',
  'width_mm',
  'height_mm',
  'depth_mm',
  'pcs_per_carton',
  'carton_width_cm',
  'carton_height_cm',
  'carton_depth_cm',
  'gross_weight_kg',
  'production_lead_days',
  'shipping_lead_days',
  'shipping_address',
])

// Quote の編集は再計算が必要なので別関数で
const QUOTE_RECALC_FIELDS = new Set([
  'quantity',
  'factory_unit_price_usd',
  'plate_fee_usd',
  'pantone_color_fee_usd',
  'domestic_china_freight_usd',
  'sample_cost_usd',
  'sample_shipping_usd',
  'other_fees_usd',
  'exchange_rate',
  'cost_ratio',
  'yuan_to_usd_rate',
  'china_freight_rate_yuan_per_kg',
  'moq',
])

function castValue(v: string | null): string | number | null {
  if (v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && /^-?\d+(\.\d+)?$/.test(v) ? n : v
}

export async function updateDealField(
  dealId: string,
  field: string,
  value: string | null
): Promise<{ success: boolean; error?: string }> {
  if (!ALLOWED_DEAL_FIELDS.has(field)) return { success: false, error: 'forbidden field' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('deals')
    .update({ [field]: value, last_activity_at: new Date().toISOString() })
    .eq('id', dealId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/deals')
  revalidatePath(`/deals/${dealId}`)
  return { success: true }
}

export async function updateProductField(
  productId: string,
  field: string,
  value: string | null
): Promise<{ success: boolean; error?: string }> {
  if (!ALLOWED_PRODUCT_FIELDS.has(field)) return { success: false, error: 'forbidden field' }
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('deal_products')
    .select('deal_id')
    .eq('id', productId)
    .single()
  const { error } = await supabase
    .from('deal_products')
    .update({ [field]: value, updated_at: new Date().toISOString() })
    .eq('id', productId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/deals')
  if (existing?.deal_id) revalidatePath(`/deals/${existing.deal_id}`)
  return { success: true }
}

export async function updateVariantField(
  variantId: string,
  field: string,
  value: string | null
): Promise<{ success: boolean; error?: string }> {
  if (!ALLOWED_VARIANT_FIELDS.has(field)) return { success: false, error: 'forbidden field' }
  const supabase = await createClient()
  const cast = castValue(value)
  const { data: existing } = await supabase
    .from('deal_product_variants')
    .select('product_id')
    .eq('id', variantId)
    .single()
  const { error } = await supabase
    .from('deal_product_variants')
    .update({ [field]: cast, updated_at: new Date().toISOString() })
    .eq('id', variantId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/deals')
  if (existing?.product_id) {
    const { data: prod } = await supabase
      .from('deal_products')
      .select('deal_id')
      .eq('id', existing.product_id)
      .single()
    if (prod?.deal_id) revalidatePath(`/deals/${prod.deal_id}`)
  }
  return { success: true }
}

export async function updateQuoteField(
  quoteId: string,
  field: string,
  value: string | null
): Promise<{ success: boolean; error?: string }> {
  if (!QUOTE_RECALC_FIELDS.has(field)) return { success: false, error: 'forbidden field' }
  const supabase = await createClient()

  // Get current quote + variant physics for recalc
  const { data: quote } = await supabase
    .from('deal_quotes')
    .select('*')
    .eq('id', quoteId)
    .single()
  if (!quote) return { success: false, error: 'quote not found' }

  const cast = castValue(value)
  const newQuote = { ...quote, [field]: cast }

  // Get variant physics if variant_id present
  let physics = {
    pcsPerCarton: 0,
    cartonWidthCm: 0,
    cartonHeightCm: 0,
    cartonDepthCm: 0,
    grossWeightKg: 0,
  }
  if (quote.variant_id) {
    const { data: v } = await supabase
      .from('deal_product_variants')
      .select('pcs_per_carton, carton_width_cm, carton_height_cm, carton_depth_cm, gross_weight_kg')
      .eq('id', quote.variant_id)
      .single()
    physics = {
      pcsPerCarton: Number(v?.pcs_per_carton) || 0,
      cartonWidthCm: Number(v?.carton_width_cm) || 0,
      cartonHeightCm: Number(v?.carton_height_cm) || 0,
      cartonDepthCm: Number(v?.carton_depth_cm) || 0,
      grossWeightKg: Number(v?.gross_weight_kg) || 0,
    }
  }

  // Get settings for tax rate
  const { data: settings } = await supabase
    .from('system_settings')
    .select('default_tax_rate, default_china_freight_rate_yuan_per_kg, default_yuan_to_usd_rate')
    .single()
  const taxRate = Number(settings?.default_tax_rate) || 10
  const chinaFreightRate =
    Number(newQuote.china_freight_rate_yuan_per_kg) ||
    Number(settings?.default_china_freight_rate_yuan_per_kg) || 7.0
  const yuanRate =
    Number(newQuote.yuan_to_usd_rate) || Number(settings?.default_yuan_to_usd_rate) || 7.2

  const calc = calculateFullQuote({
    orderQty: Number(newQuote.quantity) || 0,
    factoryUnitPriceUsd: Number(newQuote.factory_unit_price_usd) || 0,
    physics,
    chinaFreightRateYuanPerKg: chinaFreightRate,
    yuanToUsdRate: yuanRate,
    exchangeRate: Number(newQuote.exchange_rate) || 155,
    costRatio: Number(newQuote.cost_ratio) || 0.55,
    taxRate,
    plateFeeUsd: Number(newQuote.plate_fee_usd) || 0,
    pantoneColorFeeUsd: Number(newQuote.pantone_color_fee_usd) || 0,
    domesticChinaFreightUsd: Number(newQuote.domestic_china_freight_usd) || 0,
    sampleCostUsd: Number(newQuote.sample_cost_usd) || 0,
    sampleShippingUsd: Number(newQuote.sample_shipping_usd) || 0,
    otherFeesUsd: Number(newQuote.other_fees_usd) || 0,
  })

  const { error } = await supabase
    .from('deal_quotes')
    .update({
      [field]: cast,
      yuan_to_usd_rate: yuanRate,
      china_freight_yuan: calc.chinaFreightYuan,
      china_freight_usd: calc.chinaFreightUsd,
      shipping_weight_kg: calc.shippingWeightKg,
      volumetric_weight_kg: calc.volumetricWeightKg,
      actual_weight_total_kg: calc.actualWeightTotalKg,
      total_cost_usd: calc.totalCostUsd,
      unit_cost_usd: calc.unitCostUsd,
      selling_price_usd: calc.sellingPriceUsd,
      selling_price_jpy: calc.sellingPriceJpy,
      total_billing_jpy: calc.totalBillingJpy,
      total_billing_tax_jpy: calc.totalBillingTaxJpy,
    })
    .eq('id', quoteId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/deals')
  if (quote.deal_id) revalidatePath(`/deals/${quote.deal_id}`)
  return { success: true }
}
