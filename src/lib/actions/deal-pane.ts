'use server'

import { createClient as createSupabase } from '@/lib/supabase/server'
import type { DealPaneData } from './deal-pane-types'

export async function getDealPaneData(dealId: string): Promise<DealPaneData | null> {
  const supabase = await createSupabase()

  const { data: deal } = await supabase
    .from('deals')
    .select(
      `id, deal_code, deal_name, client_name_text, desired_delivery_date, memo, simple_status, created_at, last_activity_at,
       sales_user:profiles!deals_sales_user_id_fkey(display_name)`
    )
    .eq('id', dealId)
    .single()

  if (!deal) return null

  const [
    { data: products },
    { data: variantsRaw },
    { data: quotes },
    { data: fees },
    { data: designFiles },
    { data: statusHistory },
    { data: communications },
  ] = await Promise.all([
    supabase
      .from('deal_products')
      .select('*')
      .eq('deal_id', dealId)
      .order('product_no', { ascending: true }),
    supabase
      .from('deal_product_variants')
      .select('*, deal_products!inner(deal_id)')
      .eq('deal_products.deal_id', dealId)
      .order('variant_order', { ascending: true }),
    supabase
      .from('deal_quotes')
      .select(
        'id, deal_id, spec_id, variant_id, version, quantity, moq, factory_unit_price_usd, exchange_rate, cost_ratio, selling_price_jpy, total_billing_jpy, total_billing_tax_jpy, status, created_at'
      )
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false }),
    supabase
      .from('deal_fees')
      .select('id, spec_id, variant_id, fee_type, amount_jpy, is_initial_only, note')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: true }),
    supabase
      .from('deal_design_files')
      .select('id, storage_url, file_name, created_at')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false }),
    supabase
      .from('deal_status_history')
      .select(
        'id, from_simple_status, to_simple_status, changed_at, note, kind, changer:profiles!deal_status_history_changed_by_fkey(display_name)'
      )
      .eq('deal_id', dealId)
      .order('changed_at', { ascending: false })
      .limit(50),
    supabase
      .from('deal_communications')
      .select('*')
      .eq('deal_id', dealId)
      .order('occurred_at', { ascending: false }),
  ])

  // strip the joined deal_products from variants
  const variants = (variantsRaw || []).map((v) => {
    const { deal_products: _omit, ...rest } = v as Record<string, unknown>
    return rest
  })

  return {
    deal: {
      ...(deal as Record<string, unknown>),
      sales_user: Array.isArray((deal as Record<string, unknown>).sales_user)
        ? ((deal as Record<string, unknown>).sales_user as unknown[])[0]
        : (deal as Record<string, unknown>).sales_user,
    },
    products: products || [],
    variants,
    quotes: quotes || [],
    fees: fees || [],
    designFiles: designFiles || [],
    statusHistory: (statusHistory || []).map((h) => ({
      ...h,
      changer: Array.isArray((h as Record<string, unknown>).changer)
        ? ((h as Record<string, unknown>).changer as unknown[])[0]
        : (h as Record<string, unknown>).changer,
    })),
    communications: communications || [],
  } as DealPaneData
}
