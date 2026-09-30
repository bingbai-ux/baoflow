import { createClient } from '@/lib/supabase/server'

type Client = Awaited<ReturnType<typeof createClient>>

/** Server actions must authorize independently of page middleware. RLS remains enabled. */
export async function requireSalesAccess(supabase: Client): Promise<string | null> {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return 'ログインしてください'
  const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profileError || !profile || !['admin', 'sales'].includes(profile.role)) return 'この操作は営業・管理者のみ利用できます'
  return null
}

export async function validateVariantDeal(supabase: Client, variantId: string, dealId: string): Promise<string | null> {
  const { data: variant, error } = await supabase.from('deal_product_variants').select('product_id').eq('id', variantId).single()
  if (error || !variant) return '仕様が見つかりません'
  const { data: product, error: productError } = await supabase.from('deal_products').select('id').eq('id', variant.product_id).eq('deal_id', dealId).single()
  return productError || !product ? '仕様がこの案件に属していません' : null
}
