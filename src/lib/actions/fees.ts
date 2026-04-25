'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { DealFee, FeeType } from '@/lib/types'

export interface FeeInput {
  fee_type: FeeType
  label?: string | null
  amount_jpy?: number | null
  amount_usd?: number | null
  amount_cny?: number | null
  is_initial_only?: boolean
  note?: string | null
}

export async function listFeesForDeal(dealId: string): Promise<DealFee[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('deal_fees')
    .select('*')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: true })
  return (data || []) as DealFee[]
}

export async function listFeesForSpec(specId: string): Promise<DealFee[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('deal_fees')
    .select('*')
    .eq('spec_id', specId)
    .order('created_at', { ascending: true })
  return (data || []) as DealFee[]
}

export async function upsertSpecFees(
  dealId: string,
  specId: string,
  fees: FeeInput[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // 既存の spec 紐付き fees を全削除して入れ直す (シンプルさ優先)
  await supabase.from('deal_fees').delete().eq('spec_id', specId)

  const rows = fees
    .filter((f) => (f.amount_jpy ?? 0) > 0 || (f.amount_usd ?? 0) > 0 || (f.amount_cny ?? 0) > 0 || f.note?.trim())
    .map((f) => ({
      deal_id: dealId,
      spec_id: specId,
      fee_type: f.fee_type,
      label: f.label?.trim() || null,
      amount_jpy: f.amount_jpy || null,
      amount_usd: f.amount_usd || null,
      amount_cny: f.amount_cny || null,
      is_initial_only: f.is_initial_only ?? false,
      note: f.note?.trim() || null,
    }))

  if (rows.length === 0) {
    revalidatePath(`/deals/${dealId}`)
    return { success: true }
  }

  const { error } = await supabase.from('deal_fees').insert(rows)
  if (error) return { success: false, error: error.message }

  revalidatePath(`/deals/${dealId}`)
  return { success: true }
}

export async function deleteFee(
  feeId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('deal_fees')
    .select('deal_id')
    .eq('id', feeId)
    .single()

  const { error } = await supabase.from('deal_fees').delete().eq('id', feeId)
  if (error) return { success: false, error: error.message }
  if (existing?.deal_id) revalidatePath(`/deals/${existing.deal_id}`)
  return { success: true }
}
