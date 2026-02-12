'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Assign multiple factories to a deal for competitive quoting
 */
export async function assignFactoriesToDeal(
  dealId: string,
  factoryIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // Create assignments for each factory
  const assignments = factoryIds.map(factoryId => ({
    deal_id: dealId,
    factory_id: factoryId,
    is_competitive_quote: factoryIds.length > 1,
    status: 'requesting' as const,
  }))

  const { error } = await supabase
    .from('deal_factory_assignments')
    .upsert(assignments, {
      onConflict: 'deal_id,factory_id',
    })

  if (error) {
    return { success: false, error: error.message }
  }

  // Update deal status to M03 (Quote Requested)
  await supabase
    .from('deals')
    .update({
      master_status: 'M03',
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', dealId)

  // Record status change
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('deal_status_history').insert({
    deal_id: dealId,
    from_status: 'M01',
    to_status: 'M03',
    changed_by: user?.id,
    note: `${factoryIds.length}社に見積もり依頼を送信`,
  })

  // Post system message to factory chat
  const { data: room } = await supabase
    .from('chat_rooms')
    .select('id')
    .eq('deal_id', dealId)
    .eq('room_type', 'sales_factory')
    .single()

  if (room) {
    await supabase.from('chat_messages').insert({
      room_id: room.id,
      user_id: null,
      content_original: `${factoryIds.length}社の工場に見積もり依頼を送信しました。`,
      is_system_message: true,
    })
  }

  revalidatePath(`/deals/${dealId}`)
  revalidatePath('/deals')
  revalidatePath('/factory/quotes')

  return { success: true }
}

/**
 * Select a winning factory from competitive quotes
 */
export async function selectWinningFactory(
  dealId: string,
  selectedFactoryId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // Update selected factory to 'selected'
  const { error: selectError } = await supabase
    .from('deal_factory_assignments')
    .update({ status: 'selected', updated_at: new Date().toISOString() })
    .eq('deal_id', dealId)
    .eq('factory_id', selectedFactoryId)

  if (selectError) {
    return { success: false, error: selectError.message }
  }

  // Update other factories to 'rejected'
  await supabase
    .from('deal_factory_assignments')
    .update({ status: 'rejected', updated_at: new Date().toISOString() })
    .eq('deal_id', dealId)
    .neq('factory_id', selectedFactoryId)

  // Update deal status to M06 (Quote Presented to Client)
  const { data: deal } = await supabase
    .from('deals')
    .select('master_status')
    .eq('id', dealId)
    .single()

  // Only advance status if not already past M06
  if (deal && parseInt(deal.master_status.replace('M', '')) < 6) {
    await supabase
      .from('deals')
      .update({
        master_status: 'M06',
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', dealId)

    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('deal_status_history').insert({
      deal_id: dealId,
      from_status: deal.master_status,
      to_status: 'M06',
      changed_by: user?.id,
      note: '工場を選定し、クライアントに見積もりを提示',
    })
  }

  revalidatePath(`/deals/${dealId}`)
  revalidatePath('/deals')

  return { success: true }
}

/**
 * Get all factories for selection
 */
export async function getFactoriesForSelection(): Promise<{
  data: Array<{
    id: string
    factory_name: string
    address: string | null
    specialties: string[] | null
    rating: number | null
  }>
  error?: string
}> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('factories')
    .select('id, factory_name, address, specialties, rating')
    .order('factory_name')

  if (error) {
    return { data: [], error: error.message }
  }

  return { data: data || [] }
}
