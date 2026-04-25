'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface SpecInput {
  product_name: string
  product_category?: string | null
  height_mm?: number | null
  width_mm?: number | null
  depth_mm?: number | null
  material_category?: string | null
  print_colors?: string | null
  printing_method?: string | null
  processing_list?: string[] | null
  specification_memo?: string | null
}

interface SpecRow {
  id: string
  deal_id: string
  product_name: string | null
  product_category: string | null
  height_mm: number | null
  width_mm: number | null
  depth_mm: number | null
  material_category: string | null
  print_colors: string | null
  printing_method: string | null
  processing_list: string[] | null
  specification_memo: string | null
}

function parseFormData(input: SpecInput | FormData): SpecInput {
  if (!(input instanceof FormData)) return input

  const product_name = (input.get('product_name') as string)?.trim() || ''
  const num = (key: string): number | null => {
    const v = input.get(key) as string | null
    if (!v) return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  const text = (key: string): string | null => {
    const v = (input.get(key) as string)?.trim()
    return v ? v : null
  }
  return {
    product_name,
    product_category: text('product_category'),
    height_mm: num('height_mm'),
    width_mm: num('width_mm'),
    depth_mm: num('depth_mm'),
    material_category: text('material_category'),
    print_colors: text('print_colors'),
    printing_method: text('printing_method'),
    processing_list: input.getAll('processing_list').map(String).filter(Boolean),
    specification_memo: text('specification_memo'),
  }
}

export async function createSpec(
  dealId: string,
  input: SpecInput | FormData
): Promise<{ data: SpecRow | null; error: string | null }> {
  const supabase = await createClient()
  const data = parseFormData(input)
  if (!data.product_name?.trim()) return { data: null, error: '商品名は必須です' }

  const { data: row, error } = await supabase
    .from('deal_specifications')
    .insert({
      deal_id: dealId,
      ...data,
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }

  revalidatePath(`/deals/${dealId}`)
  return { data: row as SpecRow, error: null }
}

export async function updateSpec(
  specId: string,
  input: SpecInput | FormData
): Promise<{ data: SpecRow | null; error: string | null }> {
  const supabase = await createClient()
  const data = parseFormData(input)
  if (!data.product_name?.trim()) return { data: null, error: '商品名は必須です' }

  const { data: row, error } = await supabase
    .from('deal_specifications')
    .update(data)
    .eq('id', specId)
    .select()
    .single()

  if (error) return { data: null, error: error.message }

  if (row?.deal_id) revalidatePath(`/deals/${row.deal_id}`)
  return { data: row as SpecRow, error: null }
}

export async function deleteSpec(
  specId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('deal_specifications')
    .select('deal_id')
    .eq('id', specId)
    .single()

  const { error } = await supabase
    .from('deal_specifications')
    .delete()
    .eq('id', specId)

  if (error) return { success: false, error: error.message }

  if (existing?.deal_id) revalidatePath(`/deals/${existing.deal_id}`)
  return { success: true }
}

export async function getSpecsForDeal(dealId: string): Promise<SpecRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('deal_specifications')
    .select(
      'id, deal_id, product_name, product_category, height_mm, width_mm, depth_mm, material_category, print_colors, printing_method, processing_list, specification_memo'
    )
    .eq('deal_id', dealId)
    .order('created_at', { ascending: true })
  return (data || []) as SpecRow[]
}
