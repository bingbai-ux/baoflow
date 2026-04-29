'use server'

// Sprint 7-4-1: 商品納品先の 4 フィールド一括 update。
// 旧 inline-edit.ts (1フィールドずつ) ではなく、ポップオーバーから
// label / full / recipient_name / phone をまとめて保存できる専用 action。

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface ProductShippingInput {
  shipping_address_label: string | null
  shipping_address_full: string | null
  shipping_recipient_name: string | null
  shipping_phone: string | null
}

export async function updateProductShippingAddress(
  productId: string,
  input: ProductShippingInput
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // null/empty を綺麗に揃える
  const norm = (v: string | null) => {
    if (v == null) return null
    const t = v.trim()
    return t === '' ? null : t
  }

  const { data: existing } = await supabase
    .from('deal_products')
    .select('deal_id')
    .eq('id', productId)
    .single()

  const { error } = await supabase
    .from('deal_products')
    .update({
      shipping_address_label: norm(input.shipping_address_label),
      shipping_address_full: norm(input.shipping_address_full),
      shipping_recipient_name: norm(input.shipping_recipient_name),
      shipping_phone: norm(input.shipping_phone),
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/deals')
  if (existing?.deal_id) revalidatePath(`/deals/${existing.deal_id}`)
  return { success: true }
}
