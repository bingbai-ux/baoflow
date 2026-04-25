'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { DealProductVariant } from '@/lib/types'

export interface VariantInput {
  variant_label: string
  variant_order?: number | null
  width_mm?: number | null
  height_mm?: number | null
  depth_mm?: number | null
  material?: string | null
  color_description?: string | null
  pantone_colors?: string | null
  processing?: string | null
  other_notes?: string | null
  print_color_count?: string | null
  print_method?: string | null
  pcs_per_carton?: number | null
  carton_width_cm?: number | null
  carton_height_cm?: number | null
  carton_depth_cm?: number | null
  gross_weight_kg?: number | null
  production_lead_days?: number | null
  shipping_lead_days?: number | null
  food_inspection_days?: number | null
  shipping_address?: string | null
}

function parseFormData(input: VariantInput | FormData): VariantInput {
  if (!(input instanceof FormData)) return input
  const text = (key: string): string | null => {
    const v = (input.get(key) as string)?.trim()
    return v ? v : null
  }
  const num = (key: string): number | null => {
    const v = input.get(key) as string | null
    if (!v) return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return {
    variant_label: text('variant_label') || '',
    variant_order: num('variant_order'),
    width_mm: num('width_mm'),
    height_mm: num('height_mm'),
    depth_mm: num('depth_mm'),
    material: text('material'),
    color_description: text('color_description'),
    pantone_colors: text('pantone_colors'),
    processing: text('processing'),
    other_notes: text('other_notes'),
    print_color_count: text('print_color_count'),
    print_method: text('print_method'),
    pcs_per_carton: num('pcs_per_carton'),
    carton_width_cm: num('carton_width_cm'),
    carton_height_cm: num('carton_height_cm'),
    carton_depth_cm: num('carton_depth_cm'),
    gross_weight_kg: num('gross_weight_kg'),
    production_lead_days: num('production_lead_days'),
    shipping_lead_days: num('shipping_lead_days'),
    food_inspection_days: num('food_inspection_days'),
    shipping_address: text('shipping_address'),
  }
}

async function findDealId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('deal_products')
    .select('deal_id')
    .eq('id', productId)
    .single()
  return data?.deal_id || null
}

export async function createVariant(
  productId: string,
  input: VariantInput | FormData
): Promise<{ data: DealProductVariant | null; error: string | null }> {
  const supabase = await createClient()
  const data = parseFormData(input)
  if (!data.variant_label?.trim()) return { data: null, error: 'バリエーションラベルは必須です' }

  // Compute next variant_order
  let order = data.variant_order ?? null
  if (order == null) {
    const { data: existing } = await supabase
      .from('deal_product_variants')
      .select('variant_order')
      .eq('product_id', productId)
      .order('variant_order', { ascending: false })
      .limit(1)
    order = existing && existing.length > 0 ? (existing[0].variant_order || 0) + 1 : 0
  }

  const { data: row, error } = await supabase
    .from('deal_product_variants')
    .insert({ product_id: productId, ...data, variant_order: order })
    .select()
    .single()

  if (error) return { data: null, error: error.message }

  const dealId = await findDealId(supabase, productId)
  if (dealId) revalidatePath(`/deals/${dealId}`)
  return { data: row as DealProductVariant, error: null }
}

export async function updateVariant(
  variantId: string,
  input: VariantInput | FormData
): Promise<{ data: DealProductVariant | null; error: string | null }> {
  const supabase = await createClient()
  const data = parseFormData(input)
  if (!data.variant_label?.trim()) return { data: null, error: 'バリエーションラベルは必須です' }

  const { data: row, error } = await supabase
    .from('deal_product_variants')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', variantId)
    .select()
    .single()

  if (error) return { data: null, error: error.message }

  if (row?.product_id) {
    const dealId = await findDealId(supabase, row.product_id)
    if (dealId) revalidatePath(`/deals/${dealId}`)
  }
  return { data: row as DealProductVariant, error: null }
}

export async function deleteVariant(
  variantId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('deal_product_variants')
    .select('product_id')
    .eq('id', variantId)
    .single()
  const { error } = await supabase.from('deal_product_variants').delete().eq('id', variantId)
  if (error) return { success: false, error: error.message }
  if (existing?.product_id) {
    const dealId = await findDealId(supabase, existing.product_id)
    if (dealId) revalidatePath(`/deals/${dealId}`)
  }
  return { success: true }
}

export async function markVariantSelected(
  variantId: string,
  selected: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('deal_product_variants')
    .select('product_id')
    .eq('id', variantId)
    .single()
  const { error } = await supabase
    .from('deal_product_variants')
    .update({ is_selected: selected, updated_at: new Date().toISOString() })
    .eq('id', variantId)
  if (error) return { success: false, error: error.message }
  if (existing?.product_id) {
    const dealId = await findDealId(supabase, existing.product_id)
    if (dealId) revalidatePath(`/deals/${dealId}`)
  }
  return { success: true }
}

export async function getVariantsForProduct(productId: string): Promise<DealProductVariant[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('deal_product_variants')
    .select('*')
    .eq('product_id', productId)
    .order('variant_order', { ascending: true })
  return (data || []) as DealProductVariant[]
}

export async function getVariantById(variantId: string): Promise<DealProductVariant | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('deal_product_variants')
    .select('*')
    .eq('id', variantId)
    .single()
  return (data as DealProductVariant) || null
}
