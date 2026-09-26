'use server'

// Sprint 14: 新規案件ウィザード + 仕様ウィザード。
// 案件名は「クライアント名 作るもの M/D」で自動生成 (後から編集可)。
// 仕様ウィザードは 大分類→中分類→小分類→詳細→数量 の選択結果から
// deal_products + deal_product_variants + deal_quotes(数量のみ) を一括作成する。

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function nextDealCode(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const now = new Date()
  const prefix = `PF-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-`
  const { data } = await supabase
    .from('deals')
    .select('deal_code')
    .like('deal_code', `${prefix}%`)
    .order('deal_code', { ascending: false })
    .limit(1)
  let next = 1
  if (data && data.length > 0) {
    const tail = Number(data[0].deal_code.split('-').pop())
    if (Number.isFinite(tail)) next = tail + 1
  }
  return `${prefix}${String(next).padStart(3, '0')}`
}

export interface CreateDealWizardInput {
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
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { dealId: null, error: 'ログインしてください' }

  const clientName = input.client_name_text?.trim()
  if (!clientName) return { dealId: null, error: 'クライアントを選んでください' }
  const items = (input.items || []).map((x) => x.trim()).filter(Boolean)
  if (items.length === 0) return { dealId: null, error: '「何を作るか」を1つ以上選んでください' }

  // 案件名の自動生成: クライアント 作るもの M/D
  const now = new Date()
  const dealName = `${clientName} ${items.join('・')} ${now.getMonth() + 1}/${now.getDate()}`

  const dealCode = await nextDealCode(supabase)
  const { data: deal, error } = await supabase
    .from('deals')
    .insert({
      deal_code: dealCode,
      deal_name: dealName,
      client_id: input.client_id || null,
      client_name_text: clientName,
      brand_text: input.brand_text?.trim() || null,
      desired_delivery_date: input.desired_delivery_date || null,
      sales_user_id: input.sales_user_id || user.id,
      simple_status: 'quoting',
      visibility: 'internal',
      waiting_on: 'us',
    })
    .select('id')
    .single()
  if (error || !deal) return { dealId: null, error: error?.message || '作成に失敗しました' }

  // 作るもの1つ = 商品1行 (仕様は次のステップの仕様ウィザードで固める)
  const { error: prodErr } = await supabase.from('deal_products').insert(
    items.map((name, i) => ({
      deal_id: deal.id,
      product_no: i + 1,
      description: name,
      category_l1: name,
      is_selected: false,
    }))
  )
  if (prodErr) return { dealId: null, error: prodErr.message }

  await supabase.from('deal_status_history').insert({
    deal_id: deal.id,
    to_simple_status: 'quoting',
    changed_by: user.id,
    kind: 'status',
    note: `案件作成 (${items.join('・')})`,
  })

  revalidatePath('/deals')
  return { dealId: deal.id, dealCode, error: null }
}

// ----------------------------------------------------------------------------
// 仕様ウィザード: 分類 + 詳細 + 数量 → 商品一式を作成
// ----------------------------------------------------------------------------

export interface SpecWizardInput {
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
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'ログインしてください' }

  const quantities = (input.quantities || [])
    .map((q) => Math.floor(Number(q)))
    .filter((q) => Number.isFinite(q) && q > 0)
  if (!input.category_l1?.trim()) return { success: false, error: '分類を選んでください' }
  if (quantities.length === 0) return { success: false, error: '数量を1つ以上入力してください' }

  const description = [input.category_l1, input.category_l2, input.category_l3]
    .filter(Boolean)
    .join(' / ')

  let productId = input.product_id || null
  if (productId) {
    // 既存枠に分類を反映
    const { error } = await supabase
      .from('deal_products')
      .update({
        description,
        category_l1: input.category_l1,
        category_l2: input.category_l2 || null,
        category_l3: input.category_l3 || null,
      })
      .eq('id', productId)
    if (error) return { success: false, error: error.message }
  } else {
    const { data: existing } = await supabase
      .from('deal_products')
      .select('product_no')
      .eq('deal_id', dealId)
      .order('product_no', { ascending: false })
      .limit(1)
    const productNo = existing && existing.length > 0 ? existing[0].product_no + 1 : 1
    const { data: prod, error } = await supabase
      .from('deal_products')
      .insert({
        deal_id: dealId,
        product_no: productNo,
        description,
        category_l1: input.category_l1,
        category_l2: input.category_l2 || null,
        category_l3: input.category_l3 || null,
        is_selected: false,
      })
      .select('id')
      .single()
    if (error || !prod) return { success: false, error: error?.message || '商品作成に失敗' }
    productId = prod.id
  }

  // バリエーション (サイズ・素材・印刷)
  const { data: vOrder } = await supabase
    .from('deal_product_variants')
    .select('variant_order')
    .eq('product_id', productId)
    .order('variant_order', { ascending: false })
    .limit(1)
  const nextOrder = vOrder && vOrder.length > 0 ? (vOrder[0].variant_order || 0) + 1 : 0
  const label = String.fromCharCode(65 + Math.min(nextOrder, 25)) // A, B, C...

  const { data: variant, error: vErr } = await supabase
    .from('deal_product_variants')
    .insert({
      product_id: productId,
      variant_label: label,
      variant_order: nextOrder,
      width_mm: input.width_mm ?? null,
      height_mm: input.height_mm ?? null,
      depth_mm: input.depth_mm ?? null,
      material: input.material?.trim() || null,
      print_color_count: input.print_color_count?.trim() || null,
      print_method: input.print_method?.trim() || null,
      processing: input.processing?.trim() || null,
      color_description: input.color_description?.trim() || null,
      other_notes: input.other_notes?.trim() || null,
      is_selected: false,
    })
    .select('id')
    .single()
  if (vErr || !variant) return { success: false, error: vErr?.message || 'バリエ作成に失敗' }

  // 数量ごとの見積枠 (単価は工場回答ステップで入れる)
  const { error: qErr } = await supabase.from('deal_quotes').insert(
    quantities.map((q, i) => ({
      deal_id: dealId,
      variant_id: variant.id,
      quantity: q,
      version: i + 1,
      status: 'drafting',
    }))
  )
  if (qErr) return { success: false, error: qErr.message }

  await supabase
    .from('deals')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', dealId)

  revalidatePath('/deals')
  revalidatePath(`/deals/${dealId}`)
  return { success: true, productId: productId || undefined }
}

/** 同じバリエーションに数量違いの見積枠を追加 */
export async function addQuantityToVariant(
  dealId: string,
  variantId: string,
  quantity: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const q = Math.floor(Number(quantity))
  if (!Number.isFinite(q) || q <= 0)
    return { success: false, error: '数量は1以上で入力してください' }

  const { count } = await supabase
    .from('deal_quotes')
    .select('id', { count: 'exact', head: true })
    .eq('variant_id', variantId)

  const { error } = await supabase.from('deal_quotes').insert({
    deal_id: dealId,
    variant_id: variantId,
    quantity: q,
    version: (count || 0) + 1,
    status: 'drafting',
  })
  if (error) return { success: false, error: error.message }
  revalidatePath(`/deals/${dealId}`)
  revalidatePath('/deals')
  return { success: true }
}
