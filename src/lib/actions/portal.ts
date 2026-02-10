'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Approve quote - move deal from M06-M10 to M11
export async function approveQuote(dealId: string): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get user's client_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('client_id')
    .eq('id', user.id)
    .single()

  if (!profile?.client_id) {
    return { error: 'Client not found' }
  }

  // Check deal belongs to client
  const { data: deal } = await supabase
    .from('deals')
    .select('master_status')
    .eq('id', dealId)
    .eq('client_id', profile.client_id)
    .single()

  if (!deal) {
    return { error: 'Deal not found' }
  }

  // Check deal is in quote stage
  if (!['M06', 'M07', 'M08', 'M09', 'M10'].includes(deal.master_status)) {
    return { error: 'This deal is not in quote confirmation stage' }
  }

  // Update deal status to M11
  const { error } = await supabase
    .from('deals')
    .update({
      master_status: 'M11',
      win_probability: 'won',
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', dealId)

  if (error) {
    return { error: error.message }
  }

  // Record status change
  await supabase.from('deal_status_history').insert({
    deal_id: dealId,
    from_status: deal.master_status,
    to_status: 'M11',
    changed_by: user.id,
    note: 'クライアント承認',
  })

  revalidatePath('/portal')
  revalidatePath('/portal/orders')
  revalidatePath(`/portal/orders/${dealId}`)

  return { error: null }
}

// Create repeat order
export async function createRepeatOrder(
  dealId: string
): Promise<{ data: { id: string } | null; error: string | null }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: 'Unauthorized' }
  }

  // Get user's client_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('client_id')
    .eq('id', user.id)
    .single()

  if (!profile?.client_id) {
    return { data: null, error: 'Client not found' }
  }

  // Get original deal
  const { data: original } = await supabase
    .from('deals')
    .select('*, deal_specifications(*)')
    .eq('id', dealId)
    .eq('client_id', profile.client_id)
    .single()

  if (!original) {
    return { data: null, error: 'Deal not found' }
  }

  // Generate new deal code
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const prefix = `PF-${year}${month}-`

  const { data: lastDeal } = await supabase
    .from('deals')
    .select('deal_code')
    .like('deal_code', `${prefix}%`)
    .order('deal_code', { ascending: false })
    .limit(1)

  let nextNumber = 1
  if (lastDeal && lastDeal.length > 0) {
    const lastCode = lastDeal[0].deal_code
    const lastNumber = parseInt(lastCode.split('-')[2], 10)
    nextNumber = lastNumber + 1
  }
  const dealCode = `${prefix}${String(nextNumber).padStart(3, '0')}`

  // Create new deal
  const { data: newDeal, error } = await supabase
    .from('deals')
    .insert({
      deal_code: dealCode,
      deal_name: original.deal_name ? `${original.deal_name} (リピート)` : null,
      client_id: original.client_id,
      sales_user_id: original.sales_user_id,
      master_status: 'M01',
      win_probability: 'high',
      parent_deal_id: dealId,
      delivery_type: original.delivery_type,
      ai_mode: original.ai_mode,
      last_activity_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  // Copy specifications
  if (original.deal_specifications && original.deal_specifications.length > 0) {
    const spec = original.deal_specifications[0]
    await supabase.from('deal_specifications').insert({
      deal_id: newDeal.id,
      product_category: spec.product_category,
      product_name: spec.product_name,
      height_mm: spec.height_mm,
      width_mm: spec.width_mm,
      depth_mm: spec.depth_mm,
      diameter_mm: spec.diameter_mm,
      capacity_ml: spec.capacity_ml,
      material_category: spec.material_category,
      material_thickness: spec.material_thickness,
      processing_list: spec.processing_list,
      attachments_list: spec.attachments_list,
      specification_memo: spec.specification_memo,
    })
  }

  // Create chat room
  await supabase.from('chat_rooms').insert({
    deal_id: newDeal.id,
    room_type: 'client_sales',
  })

  // Record status history
  await supabase.from('deal_status_history').insert({
    deal_id: newDeal.id,
    from_status: null,
    to_status: 'M01',
    changed_by: user.id,
    note: `リピート注文 (元案件: ${original.deal_code})`,
  })

  revalidatePath('/portal')
  revalidatePath('/portal/orders')

  return { data: { id: newDeal.id }, error: null }
}

// Create quote request (multiple products)
export interface QuoteRequestItem {
  product_name: string
  category?: string
  quantity?: string
  size_notes?: string
  material_notes?: string
  reference_image_url?: string
  existing_quote_url?: string
  memo?: string
}

export async function createQuoteRequest(
  items: QuoteRequestItem[]
): Promise<{ data: { dealGroupId: string; dealIds: string[] } | null; error: string | null }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: 'Unauthorized' }
  }

  // Get user's client_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('client_id')
    .eq('id', user.id)
    .single()

  if (!profile?.client_id) {
    return { data: null, error: 'Client not found' }
  }

  // Get client info
  const { data: client } = await supabase
    .from('clients')
    .select('assigned_sales_ids')
    .eq('id', profile.client_id)
    .single()

  const salesUserId = client?.assigned_sales_ids?.[0] || null

  // Create deal group
  const { data: dealGroup, error: groupError } = await supabase
    .from('deal_groups')
    .insert({
      client_id: profile.client_id,
      sales_user_id: salesUserId,
      notes: `クライアントポータルからの一括見積もり依頼 (${items.length}件)`,
    })
    .select()
    .single()

  if (groupError) {
    return { data: null, error: groupError.message }
  }

  const dealIds: string[] = []

  // Create deals for each item
  for (let i = 0; i < items.length; i++) {
    const item = items[i]

    // Generate deal code
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const prefix = `PF-${year}${month}-`

    const { data: lastDeal } = await supabase
      .from('deals')
      .select('deal_code')
      .like('deal_code', `${prefix}%`)
      .order('deal_code', { ascending: false })
      .limit(1)

    let nextNumber = 1
    if (lastDeal && lastDeal.length > 0) {
      const lastCode = lastDeal[0].deal_code
      const lastNumber = parseInt(lastCode.split('-')[2], 10)
      nextNumber = lastNumber + 1
    }
    const dealCode = `${prefix}${String(nextNumber).padStart(3, '0')}`

    // Create deal
    const { data: newDeal, error: dealError } = await supabase
      .from('deals')
      .insert({
        deal_code: dealCode,
        deal_name: item.product_name,
        client_id: profile.client_id,
        sales_user_id: salesUserId,
        deal_group_id: dealGroup.id,
        master_status: 'M01',
        win_probability: 'medium',
        delivery_type: 'direct',
        ai_mode: 'assist',
        last_activity_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (dealError) {
      continue
    }

    dealIds.push(newDeal.id)

    // Create specification
    await supabase.from('deal_specifications').insert({
      deal_id: newDeal.id,
      product_category: item.category || null,
      product_name: item.product_name,
      size_notes: item.size_notes || null,
      material_notes: item.material_notes || null,
      reference_images: item.reference_image_url ? [item.reference_image_url] : null,
      existing_quote_file: item.existing_quote_url || null,
      specification_memo: [
        item.quantity ? `希望数量: ${item.quantity}` : null,
        item.memo,
      ].filter(Boolean).join('\n') || null,
    })

    // Create chat room
    await supabase.from('chat_rooms').insert({
      deal_id: newDeal.id,
      room_type: 'client_sales',
    })

    // Record status history
    await supabase.from('deal_status_history').insert({
      deal_id: newDeal.id,
      from_status: null,
      to_status: 'M01',
      changed_by: user.id,
      note: 'クライアントポータルから見積もり依頼',
    })
  }

  revalidatePath('/portal')
  revalidatePath('/portal/orders')
  revalidatePath('/deals')

  return { data: { dealGroupId: dealGroup.id, dealIds }, error: null }
}
