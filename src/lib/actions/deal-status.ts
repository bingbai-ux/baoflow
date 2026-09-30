'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { SIMPLE_STATUS_ORDER, type SimpleStatus } from '@/lib/types'
import { requireSalesAccess } from './deal-access'

export async function updateDealStatus(dealId: string, to: SimpleStatus, note?: string, expected?: SimpleStatus): Promise<{ success: boolean; error?: string }> {
  if (!SIMPLE_STATUS_ORDER.includes(to)) return { success: false, error: 'ステータスを選んでください' }
  const supabase = await createClient()
  const accessError = await requireSalesAccess(supabase)
  if (accessError) return { success: false, error: accessError }
  const { error } = await supabase.rpc('set_deal_simple_status', {
    p_deal_id: dealId, p_to: to, p_note: note || null, p_expected: expected || null,
  })
  if (error) return { success: false, error: error.code === 'PGRST202'
    ? 'ステータス更新のDB準備が必要です。管理者に連絡してください (039)。変更は保存されていません。'
    : error.message }
  revalidatePath('/deals')
  revalidatePath(`/deals/${dealId}`)
  revalidatePath('/')
  return { success: true }
}
