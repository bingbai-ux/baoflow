'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { DealProduct, FoodGradeStatus } from '@/lib/types'

export interface ProductInput {
  description: string
  product_no?: number | null
  factory_staff_code?: string | null
  production_process?: string | null
  food_grade_status?: FoodGradeStatus
  food_inspection_status?: FoodGradeStatus
  product_memo?: string | null
}

function parseFormData(input: ProductInput | FormData): ProductInput {
  if (!(input instanceof FormData)) return input
  const text = (key: string): string | null => {
    const v = (input.get(key) as string)?.trim()
    return v ? v : null
  }
  const food = (key: string): FoodGradeStatus => {
    const v = text(key)
    if (v === '*' || v === '●' || v === '同') return v
    return null
  }
  const num = (key: string): number | null => {
    const v = input.get(key) as string | null
    if (!v) return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return {
    description: text('description') || '',
    product_no: num('product_no'),
    factory_staff_code: text('factory_staff_code'),
    production_process: text('production_process'),
    food_grade_status: food('food_grade_status'),
    food_inspection_status: food('food_inspection_status'),
    product_memo: text('product_memo'),
  }
}

async function nextProductNo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dealId: string
): Promise<number> {
  const { data } = await supabase
    .from('deal_products')
    .select('product_no')
    .eq('deal_id', dealId)
    .order('product_no', { ascending: false })
    .limit(1)
  return data && data.length > 0 ? (data[0].product_no || 0) + 1 : 1
}

/**
 * Sprint 7-6: スプレッド「+ 商品を追加」用の軽量 INSERT。
 * 旧 createProduct は description を必須としていたが、Sprint 7 のスプレッド UX では
 * 「+ボタン → 行が出る → InlineCell で編集」のフローのため、description は「新規商品」の
 * プレースホルダーで作成する。
 */
export async function addBlankProduct(
  dealId: string
): Promise<{ data: DealProduct | null; error: string | null }> {
  const supabase = await createClient()
  const product_no = await nextProductNo(supabase, dealId)
  const { data: row, error } = await supabase
    .from('deal_products')
    .insert({
      deal_id: dealId,
      product_no,
      description: '新規商品',
      is_selected: false,
    })
    .select()
    .single()
  if (error) return { data: null, error: error.message }
  revalidatePath('/deals')
  revalidatePath(`/deals/${dealId}`)
  return { data: row as DealProduct, error: null }
}

export async function createProduct(
  dealId: string,
  input: ProductInput | FormData
): Promise<{ data: DealProduct | null; error: string | null }> {
  const supabase = await createClient()
  const data = parseFormData(input)
  if (!data.description?.trim()) return { data: null, error: 'Description は必須です' }

  const product_no = data.product_no || (await nextProductNo(supabase, dealId))

  const { data: row, error } = await supabase
    .from('deal_products')
    .insert({
      deal_id: dealId,
      product_no,
      description: data.description,
      factory_staff_code: data.factory_staff_code,
      production_process: data.production_process,
      food_grade_status: data.food_grade_status,
      food_inspection_status: data.food_inspection_status,
      product_memo: data.product_memo,
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  revalidatePath(`/deals/${dealId}`)
  return { data: row as DealProduct, error: null }
}

export async function updateProduct(
  productId: string,
  input: ProductInput | FormData
): Promise<{ data: DealProduct | null; error: string | null }> {
  const supabase = await createClient()
  const data = parseFormData(input)
  if (!data.description?.trim()) return { data: null, error: 'Description は必須です' }

  const patch: Record<string, unknown> = {
    description: data.description,
    factory_staff_code: data.factory_staff_code,
    production_process: data.production_process,
    food_grade_status: data.food_grade_status,
    food_inspection_status: data.food_inspection_status,
    product_memo: data.product_memo,
    updated_at: new Date().toISOString(),
  }
  if (data.product_no != null) patch.product_no = data.product_no

  const { data: row, error } = await supabase
    .from('deal_products')
    .update(patch)
    .eq('id', productId)
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  if (row?.deal_id) revalidatePath(`/deals/${row.deal_id}`)
  return { data: row as DealProduct, error: null }
}

export async function deleteProduct(
  productId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('deal_products')
    .select('deal_id')
    .eq('id', productId)
    .single()
  const { error } = await supabase.from('deal_products').delete().eq('id', productId)
  if (error) return { success: false, error: error.message }
  if (existing?.deal_id) revalidatePath(`/deals/${existing.deal_id}`)
  return { success: true }
}

export async function markProductSelected(
  productId: string,
  selected: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('deal_products')
    .select('deal_id')
    .eq('id', productId)
    .single()
  const { error } = await supabase
    .from('deal_products')
    .update({ is_selected: selected, updated_at: new Date().toISOString() })
    .eq('id', productId)
  if (error) return { success: false, error: error.message }
  if (existing?.deal_id) revalidatePath(`/deals/${existing.deal_id}`)
  return { success: true }
}

export async function getProductsForDeal(dealId: string): Promise<DealProduct[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('deal_products')
    .select('*')
    .eq('deal_id', dealId)
    .order('product_no', { ascending: true })
  return (data || []) as DealProduct[]
}
