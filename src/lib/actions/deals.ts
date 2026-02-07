'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { deal_status } from '@/lib/types'

export async function createDeal(formData: FormData) {
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'ログインが必要です' }
  }

  // Generate deal number
  const { data: lastDeal } = await supabase
    .from('deals')
    .select('deal_number')
    .order('deal_number', { ascending: false })
    .limit(1)
    .single()

  let nextNumber = 1
  if (lastDeal?.deal_number) {
    const match = lastDeal.deal_number.match(/BAO-(\d+)/)
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1
    }
  }
  const dealNumber = `BAO-${String(nextNumber).padStart(4, '0')}`

  const clientId = formData.get('client_id') as string
  const factoryId = formData.get('factory_id') as string

  const { data, error } = await supabase
    .from('deals')
    .insert({
      deal_number: dealNumber,
      client_id: clientId || null,
      factory_id: factoryId || null,
      assignee_id: user.id,
      status: 'draft' as deal_status,
      product_name: formData.get('product_name') as string,
      material: formData.get('material') as string || null,
      size: formData.get('size') as string || null,
      quantity: formData.get('quantity') ? parseInt(formData.get('quantity') as string, 10) : null,
      notes: formData.get('notes') as string || null,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/deals')
  return { data }
}

export async function updateDeal(id: string, formData: FormData) {
  const supabase = await createClient()

  const clientId = formData.get('client_id') as string
  const factoryId = formData.get('factory_id') as string

  const { error } = await supabase
    .from('deals')
    .update({
      client_id: clientId || null,
      factory_id: factoryId || null,
      product_name: formData.get('product_name') as string,
      material: formData.get('material') as string || null,
      size: formData.get('size') as string || null,
      quantity: formData.get('quantity') ? parseInt(formData.get('quantity') as string, 10) : null,
      notes: formData.get('notes') as string || null,
    })
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/deals')
  revalidatePath(`/deals/${id}`)
  return { success: true }
}

export async function updateDealStatus(id: string, newStatus: deal_status, userId: string) {
  const supabase = await createClient()

  // Get current status
  const { data: deal } = await supabase
    .from('deals')
    .select('status')
    .eq('id', id)
    .single()

  if (!deal) {
    return { error: '案件が見つかりません' }
  }

  // Update deal status
  const { error: updateError } = await supabase
    .from('deals')
    .update({ status: newStatus })
    .eq('id', id)

  if (updateError) {
    return { error: updateError.message }
  }

  // Insert status history
  const { error: historyError } = await supabase
    .from('deal_status_history')
    .insert({
      deal_id: id,
      from_status: deal.status,
      to_status: newStatus,
      changed_by: userId,
    })

  if (historyError) {
    return { error: historyError.message }
  }

  revalidatePath('/deals')
  revalidatePath(`/deals/${id}`)
  return { success: true }
}

export async function deleteDeal(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('deals')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/deals')
  return { success: true }
}
