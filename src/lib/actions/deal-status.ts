'use server'

import { createClient as createSupabase } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { SimpleStatus } from '@/lib/types'

export async function updateDealStatus(
  dealId: string,
  to: SimpleStatus,
  note?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabase()

  const { data: current } = await supabase
    .from('deals')
    .select('simple_status')
    .eq('id', dealId)
    .single()

  if (!current) return { success: false, error: 'deal not found' }

  const fromStatus = current.simple_status as SimpleStatus

  const { data: { user } } = await supabase.auth.getUser()

  // Update the deal
  const { error: updateError } = await supabase
    .from('deals')
    .update({
      simple_status: to,
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', dealId)

  if (updateError) return { success: false, error: updateError.message }

  // Append history
  await supabase.from('deal_status_history').insert({
    deal_id: dealId,
    from_simple_status: fromStatus,
    to_simple_status: to,
    changed_by: user?.id || null,
    note: note || null,
    kind: 'status',
  })

  revalidatePath('/deals')
  revalidatePath(`/deals/${dealId}`)
  return { success: true }
}
