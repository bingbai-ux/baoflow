'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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
      .update({ master_status: 'M05' })
      .eq('id', data.dealId)

    if (dealError) throw dealError

    revalidatePath('/factory/quotes')
    revalidatePath('/factory')

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

    const { error } = await supabase
      .from('deals')
      .update({
        master_status: statusMap[data.status],
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.dealId)

    if (error) throw error

    revalidatePath(`/factory/production/${data.dealId}`)
    revalidatePath('/factory/production')
    revalidatePath('/factory')

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

    // Update deal status to M22 (発送済み)
    await supabase
      .from('deals')
      .update({ master_status: 'M22' })
      .eq('id', data.dealId)

    revalidatePath(`/factory/production/${data.dealId}`)
    revalidatePath('/factory/production')

    return { success: true }
  } catch (error) {
    console.error('Tracking info error:', error)
    return { error: 'Failed to submit tracking info' }
  }
}
