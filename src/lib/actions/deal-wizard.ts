'use server'

// Sprint 14: 新規案件ウィザード + 仕様ウィザード。
// 案件名は「クライアント名 作るもの M/D」で自動生成 (後から編集可)。
// 仕様ウィザードは 大分類→中分類→小分類→詳細→数量 の選択結果から
// deal_products + deal_product_variants + deal_quotes(数量のみ) を一括作成する。

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSalesAccess } from './deal-access'
import { validateQuantities } from '@/lib/validation/deal-input'

export interface CreateDealWizardInput {
  request_id?: string
  client_id: string | null
  client_name_text: string // クライアント未登録でも作れるように名前は必須
  brand_text?: string | null
  items: string[] // 何を作るか (大分類名など)。1つ以上
  desired_delivery_date?: string | null
  sales_user_id?: string | null
}

export async function createDealFromWizard(
  input: CreateDealWizardInput
): Promise<{ dealId: string | null; dealCode?: string; error: string | null }> {
  const { request_id, ...payload } = input
  const result = await runWizard(request_id, 'deal', payload)
  if (result.error) return { dealId: null, error: result.error }
  revalidatePath('/deals')
  return { dealId: result.data.dealId, dealCode: result.data.dealCode, error: null }
}

// ----------------------------------------------------------------------------
// 仕様ウィザード: 分類 + 詳細 + 数量 → 商品一式を作成
// ----------------------------------------------------------------------------

export interface SpecWizardInput {
  request_id?: string
  product_id?: string | null // 既存商品(新規案件で作った枠)に仕様を入れる場合
  category_l1: string
  category_l2?: string | null
  category_l3?: string | null
  width_mm?: number | null
  height_mm?: number | null
  depth_mm?: number | null
  material?: string | null
  print_color_count?: string | null
  print_method?: string | null
  processing?: string | null
  color_description?: string | null
  other_notes?: string | null
  quantities: number[] // 1つ以上。数量ごとに見積行を作る
}

export async function createProductFromWizard(
  dealId: string,
  input: SpecWizardInput
): Promise<{ success: boolean; error?: string; productId?: string }> {
  const quantityError = validateQuantities(input.quantities || [])
  if (quantityError) return { success: false, error: quantityError }
  const { request_id, ...payload } = input
  const result = await runWizard(request_id, 'spec', { ...payload, deal_id: dealId })
  if (result.error) return { success: false, error: result.error }
  revalidatePath('/deals')
  revalidatePath(`/deals/${dealId}`)
  return { success: true, productId: result.data.productId }
}

/** 同じバリエーションに数量違いの見積枠を追加 */
export async function addQuantityToVariant(
  dealId: string,
  variantId: string,
  quantity: number,
  requestId?: string
): Promise<{ success: boolean; error?: string }> {
  const quantityError = validateQuantities([quantity])
  if (quantityError) return { success: false, error: quantityError }
  const result = await runWizard(requestId, 'quantity', { deal_id: dealId, variant_id: variantId, quantity })
  if (result.error) return { success: false, error: result.error }
  revalidatePath(`/deals/${dealId}`)
  revalidatePath('/deals')
  return { success: true }
}

async function runWizard(requestId: string | undefined, operation: string, payload: object) {
  if (!requestId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) return { data: null, error: '保存要求を作成できませんでした。画面を読み直してください' }
  const supabase = await createClient()
  const accessError = await requireSalesAccess(supabase)
  if (accessError) return { data: null, error: accessError }
  const { data, error } = await supabase.rpc('wizard_atomic', { p_request_id: requestId, p_operation: operation, p_payload: payload })
  if (error) return { data: null, error: error.code === 'PGRST202'
    ? '案件・仕様保存のDB準備が必要です。管理者に連絡してください (042)。変更は保存されていません。'
    : error.message }
  if (!data?.success) return { data: null, error: '保存を確認できませんでした。同じ内容で再試行してください' }
  return { data, error: null }
}
