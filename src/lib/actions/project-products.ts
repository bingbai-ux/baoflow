'use server'

// 再設計 工程2: 商品登録。保存・並べ替え・削除は DB 関数経由（まとめて成功するか、何も変わらないか）。

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSalesAccess } from './deal-access'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface ProjectProductInput {
  request_id: string
  deal_id: string
  product_id?: string | null
  category_l1: string | null; category_l2: string | null; category_l3: string | null; category_note: string | null
  size_mode: 'box' | 'round' | 'capacity' | 'undecided'
  width_mm: string | null; height_mm: string | null; depth_mm: string | null; diameter_mm: string | null
  capacity_text: string | null; size_note: string | null
  material: string | null; material_note: string | null
  print_color_count: string | null; print_note: string | null
  accessories: string[]; accessories_note: string | null
  quantities: number[]
  shipping_mode: 'sea' | 'air' | null; shipping_arranger: 'factory' | 'partner' | null
  sample_required: boolean; food_inspection_required: boolean
  memo: string | null
}

export async function saveProjectProduct(input: ProjectProductInput): Promise<{ productId: string | null; name?: string; error: string | null }> {
  const { request_id, ...payload } = input
  if (!UUID.test(request_id || '') || !UUID.test(payload.deal_id || '')) return { productId: null, error: '保存要求を作成できませんでした。画面を読み直してください' }
  if (!payload.quantities?.length) return { productId: null, error: '見積を取りたい数量を1つ以上選んでください' }
  const supabase = await createClient()
  const accessError = await requireSalesAccess(supabase)
  if (accessError) return { productId: null, error: accessError }
  const { data, error } = await supabase.rpc('save_project_product_v1', { p_request_id: request_id, p_payload: { ...payload, product_id: payload.product_id || null } })
  if (error) return { productId: null, error: error.code === 'PGRST202' ? '商品登録のDB準備ができていません。管理者に連絡してください。保存されていません。' : error.message }
  if (!data?.success || !data.productId) return { productId: null, error: '保存を確認できませんでした。同じ内容でもう一度お試しください' }
  revalidatePath(`/deals/${payload.deal_id}`)
  revalidatePath('/deals')
  return { productId: data.productId as string, name: data.name as string, error: null }
}

export async function reorderProjectProducts(dealId: string, ids: string[]): Promise<{ error: string | null }> {
  if (!UUID.test(dealId || '') || !ids.length || ids.some(id => !UUID.test(id))) return { error: '並べ替える商品を確認できませんでした' }
  const supabase = await createClient()
  const accessError = await requireSalesAccess(supabase)
  if (accessError) return { error: accessError }
  const { data, error } = await supabase.rpc('reorder_project_products', { p_deal_id: dealId, p_ids: ids })
  if (error || !data?.success) return { error: error?.message || '並べ替えを保存できませんでした' }
  revalidatePath(`/deals/${dealId}`)
  return { error: null }
}

export async function deleteProjectProduct(productId: string, dealId: string): Promise<{ error: string | null }> {
  if (!UUID.test(productId || '') || !UUID.test(dealId || '')) return { error: '商品が見つかりません' }
  const supabase = await createClient()
  const accessError = await requireSalesAccess(supabase)
  if (accessError) return { error: accessError }
  const { data, error } = await supabase.rpc('delete_project_product', { p_product_id: productId })
  if (error || !data?.success) return { error: error?.message || '商品を削除できませんでした' }
  revalidatePath(`/deals/${dealId}`)
  revalidatePath('/deals')
  return { error: null }
}
