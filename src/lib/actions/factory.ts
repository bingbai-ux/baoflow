'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Helper to post system messages
async function postSystemMessage(
  dealId: string,
  roomType: 'client_sales' | 'sales_factory',
  content: string
) {
  const supabase = await createClient()

  const { data: room } = await supabase
    .from('chat_rooms')
    .select('id')
    .eq('deal_id', dealId)
    .eq('room_type', roomType)
    .single()

  if (!room) return

  await supabase.from('chat_messages').insert({
    room_id: room.id,
    sender_id: null,
    content,
    is_system_message: true,
  })
}

interface QuoteResponseData {
  dealId: string
  unitPriceUsd: number
  shippingCostUsd: number
  plateCostUsd?: number
  productionDays: number
  moq?: number
  deliveryOptions?: {
    method: string
    shippingUsd: number
    days: number
  }[]
  notes?: string
}

export async function submitQuoteResponse(data: QuoteResponseData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get factory_id from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('factory_id')
    .eq('id', user.id)
    .single()

  if (!profile?.factory_id) {
    return { error: 'Factory not found' }
  }

  try {
    // Create quote record
    const { error: quoteError } = await supabase.from('deal_quotes').insert({
      deal_id: data.dealId,
      factory_id: profile.factory_id,
      factory_unit_price_usd: data.unitPriceUsd,
      shipping_cost_usd: data.shippingCostUsd,
      plate_cost_usd: data.plateCostUsd || 0,
      production_days: data.productionDays,
      moq: data.moq,
      delivery_options: data.deliveryOptions,
      notes: data.notes,
      status: 'submitted',
    })

    if (quoteError) throw quoteError

    // Update assignment status
    const { error: assignmentError } = await supabase
      .from('deal_factory_assignments')
      .update({ status: 'responded' })
      .eq('deal_id', data.dealId)
      .eq('factory_id', profile.factory_id)

    if (assignmentError) throw assignmentError

    // Update deal status to M05 (工場回答受領)
    const { error: dealError } = await supabase
      .from('deals')
      .update({
        master_status: 'M05',
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', data.dealId)

    if (dealError) throw dealError

    // Record status history
    await supabase.from('deal_status_history').insert({
      deal_id: data.dealId,
      from_status: 'M04',
      to_status: 'M05',
      changed_by: user.id,
      note: '工場から見積もり回答',
    })

    // Post system messages
    await postSystemMessage(data.dealId, 'sales_factory', '見積もり回答を提出しました。')
    await postSystemMessage(data.dealId, 'client_sales', '工場から見積もりが届きました。')

    revalidatePath('/factory/quotes')
    revalidatePath('/factory')
    revalidatePath('/deals')
    revalidatePath(`/deals/${data.dealId}`)

    return { success: true }
  } catch (error) {
    console.error('Quote response error:', error)
    return { error: 'Failed to submit quote' }
  }
}

interface ProductionUpdateData {
  dealId: string
  status: 'started' | 'in_progress' | 'completed'
  progressPercent?: number
  notes?: string
}

export async function updateProductionStatus(data: ProductionUpdateData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  try {
    // Map status to master_status
    const statusMap: Record<string, string> = {
      started: 'M17',
      in_progress: 'M18',
      completed: 'M19',
    }

    const newStatus = statusMap[data.status]

    // Get current status
    const { data: currentDeal } = await supabase
      .from('deals')
      .select('master_status')
      .eq('id', data.dealId)
      .single()

    const { error } = await supabase
      .from('deals')
      .update({
        master_status: newStatus,
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', data.dealId)

    if (error) throw error

    // Record status history
    await supabase.from('deal_status_history').insert({
      deal_id: data.dealId,
      from_status: currentDeal?.master_status || null,
      to_status: newStatus,
      changed_by: user.id,
      note: data.status === 'started' ? '製造開始' : data.status === 'completed' ? '製造完了' : '製造進捗更新',
    })

    // Post system messages
    const messages: Record<string, { client: string; factory: string }> = {
      started: { client: '製造を開始しました。', factory: '製造開始を記録しました。' },
      in_progress: { client: '製造を進めています。', factory: '製造進捗を更新しました。' },
      completed: { client: '製造が完了しました。検品・発送準備を進めています。', factory: '製造完了を記録しました。' },
    }

    if (messages[data.status]) {
      await postSystemMessage(data.dealId, 'client_sales', messages[data.status].client)
      await postSystemMessage(data.dealId, 'sales_factory', messages[data.status].factory)
    }

    revalidatePath(`/factory/production/${data.dealId}`)
    revalidatePath('/factory/production')
    revalidatePath('/factory')
    revalidatePath('/deals')
    revalidatePath(`/deals/${data.dealId}`)
    revalidatePath('/portal/orders')
    revalidatePath(`/portal/orders/${data.dealId}`)

    return { success: true }
  } catch (error) {
    console.error('Production update error:', error)
    return { error: 'Failed to update status' }
  }
}

interface PackingInfoData {
  dealId: string
  cartonCount: number
  weightKg: number
  cbm: number
  cartonSize?: string
}

export async function submitPackingInfo(data: PackingInfoData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  try {
    // Update or create shipping record
    const { data: existing } = await supabase
      .from('deal_shipping')
      .select('id')
      .eq('deal_id', data.dealId)
      .single()

    const packingInfo = {
      carton_count: data.cartonCount,
      weight_kg: data.weightKg,
      cbm: data.cbm,
      carton_size: data.cartonSize,
    }

    if (existing) {
      await supabase
        .from('deal_shipping')
        .update({ packing_info: packingInfo })
        .eq('id', existing.id)
    } else {
      await supabase.from('deal_shipping').insert({
        deal_id: data.dealId,
        packing_info: packingInfo,
      })
    }

    // Update deal status to M21 (発送準備)
    await supabase
      .from('deals')
      .update({ master_status: 'M21' })
      .eq('id', data.dealId)

    revalidatePath(`/factory/production/${data.dealId}`)
    revalidatePath('/factory/production')

    return { success: true }
  } catch (error) {
    console.error('Packing info error:', error)
    return { error: 'Failed to submit packing info' }
  }
}

interface TrackingData {
  dealId: string
  trackingNumber: string
  trackingUrl?: string
}

export async function submitTrackingInfo(data: TrackingData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  try {
    // Update shipping record
    const { data: existing } = await supabase
      .from('deal_shipping')
      .select('id')
      .eq('deal_id', data.dealId)
      .single()

    if (existing) {
      await supabase
        .from('deal_shipping')
        .update({
          tracking_number: data.trackingNumber,
          tracking_url: data.trackingUrl,
          shipped_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    } else {
      await supabase.from('deal_shipping').insert({
        deal_id: data.dealId,
        tracking_number: data.trackingNumber,
        tracking_url: data.trackingUrl,
        shipped_at: new Date().toISOString(),
      })
    }

    // Get current status
    const { data: currentDeal } = await supabase
      .from('deals')
      .select('master_status')
      .eq('id', data.dealId)
      .single()

    // Update deal status to M22 (発送済み)
    await supabase
      .from('deals')
      .update({
        master_status: 'M22',
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', data.dealId)

    // Record status history
    await supabase.from('deal_status_history').insert({
      deal_id: data.dealId,
      from_status: currentDeal?.master_status || null,
      to_status: 'M22',
      changed_by: user.id,
      note: `発送完了 (トラッキング: ${data.trackingNumber})`,
    })

    // Post system messages
    await postSystemMessage(
      data.dealId,
      'client_sales',
      `発送が完了しました。トラッキング番号: ${data.trackingNumber}`
    )
    await postSystemMessage(data.dealId, 'sales_factory', '発送情報を記録しました。')

    revalidatePath(`/factory/production/${data.dealId}`)
    revalidatePath('/factory/production')
    revalidatePath('/deals')
    revalidatePath(`/deals/${data.dealId}`)
    revalidatePath('/portal/orders')
    revalidatePath(`/portal/orders/${data.dealId}`)
    revalidatePath('/shipments')

    return { success: true }
  } catch (error) {
    console.error('Tracking info error:', error)
    return { error: 'Failed to submit tracking info' }
  }
}
