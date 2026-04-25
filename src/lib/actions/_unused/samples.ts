'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { DealSample, CreateSampleInput, UpdateSampleInput } from '@/lib/types'

export async function createSample(
  input: CreateSampleInput
): Promise<{ data: DealSample | null; error: string | null }> {
  const supabase = await createClient()

  // Get max round number for this deal
  const { data: existingSamples } = await supabase
    .from('deal_samples')
    .select('round_number')
    .eq('deal_id', input.deal_id)
    .order('round_number', { ascending: false })
    .limit(1)

  const nextRound = existingSamples && existingSamples.length > 0
    ? existingSamples[0].round_number + 1
    : 1

  // Calculate subtotals
  const productionFee = input.sample_production_fee_usd || 0
  const shippingFee = input.sample_shipping_fee_usd || 0
  const plateFee = nextRound === 1 ? (input.plate_fee_usd || 0) : 0
  const subtotalUsd = productionFee + shippingFee + plateFee

  // Get exchange rate for JPY conversion
  const { data: settings } = await supabase
    .from('system_settings')
    .select('default_exchange_rate')
    .single()

  const exchangeRate = settings?.default_exchange_rate || 155
  const subtotalJpy = Math.ceil(subtotalUsd * exchangeRate)

  const { data, error } = await supabase
    .from('deal_samples')
    .insert({
      deal_id: input.deal_id,
      round_number: nextRound,
      sample_production_fee_usd: productionFee,
      sample_shipping_fee_usd: shippingFee,
      plate_fee_usd: plateFee,
      subtotal_usd: subtotalUsd,
      subtotal_jpy: subtotalJpy,
      sample_status: 'requested',
    })
    .select()
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  revalidatePath(`/deals/${input.deal_id}`)
  return { data, error: null }
}

export async function updateSample(
  id: string,
  input: UpdateSampleInput
): Promise<{ data: DealSample | null; error: string | null }> {
  const supabase = await createClient()

  // Get current sample
  const { data: currentSample } = await supabase
    .from('deal_samples')
    .select('*')
    .eq('id', id)
    .single()

  if (!currentSample) {
    return { data: null, error: 'Sample not found' }
  }

  // Recalculate subtotals if fees changed
  let calculatedFields = {}
  if (
    input.sample_production_fee_usd !== undefined ||
    input.sample_shipping_fee_usd !== undefined ||
    input.plate_fee_usd !== undefined
  ) {
    const productionFee = input.sample_production_fee_usd ?? currentSample.sample_production_fee_usd ?? 0
    const shippingFee = input.sample_shipping_fee_usd ?? currentSample.sample_shipping_fee_usd ?? 0
    const plateFee = input.plate_fee_usd ?? currentSample.plate_fee_usd ?? 0
    const subtotalUsd = productionFee + shippingFee + plateFee

    const { data: settings } = await supabase
      .from('system_settings')
      .select('default_exchange_rate')
      .single()

    const exchangeRate = settings?.default_exchange_rate || 155
    const subtotalJpy = Math.ceil(subtotalUsd * exchangeRate)

    calculatedFields = {
      subtotal_usd: subtotalUsd,
      subtotal_jpy: subtotalJpy,
    }
  }

  const { data, error } = await supabase
    .from('deal_samples')
    .update({
      ...input,
      ...calculatedFields,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  revalidatePath(`/deals/${data.deal_id}`)
  return { data, error: null }
}

export async function getSamplesForDeal(dealId: string): Promise<DealSample[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('deal_samples')
    .select('*')
    .eq('deal_id', dealId)
    .order('round_number', { ascending: true })

  return data || []
}

/**
 * Mark sample as shipped by factory
 */
export async function shipSample(sampleId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('deal_samples')
    .update({
      sample_status: 'shipping',
      updated_at: new Date().toISOString(),
    })
    .eq('id', sampleId)
    .select('deal_id, round_number')
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Post system message to client chat
  if (data) {
    const { data: room } = await supabase
      .from('chat_rooms')
      .select('id')
      .eq('deal_id', data.deal_id)
      .eq('room_type', 'client_sales')
      .single()

    if (room) {
      await supabase.from('chat_messages').insert({
        room_id: room.id,
        user_id: null,
        content_original: `サンプル (ラウンド${data.round_number}) を発送しました。`,
        is_system_message: true,
      })
    }

    revalidatePath(`/deals/${data.deal_id}`)
  }

  return { success: true }
}

/**
 * Mark sample as received/arrived
 */
export async function receiveSample(sampleId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('deal_samples')
    .update({
      sample_status: 'arrived',
      updated_at: new Date().toISOString(),
    })
    .eq('id', sampleId)
    .select('deal_id, round_number')
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  if (data) {
    revalidatePath(`/deals/${data.deal_id}`)
  }

  return { success: true }
}

/**
 * Approve sample (mark as OK)
 */
export async function approveSample(sampleId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('deal_samples')
    .update({
      sample_status: 'ok',
      updated_at: new Date().toISOString(),
    })
    .eq('id', sampleId)
    .select('deal_id, round_number')
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Post system message to factory chat
  if (data) {
    const { data: room } = await supabase
      .from('chat_rooms')
      .select('id')
      .eq('deal_id', data.deal_id)
      .eq('room_type', 'sales_factory')
      .single()

    if (room) {
      await supabase.from('chat_messages').insert({
        room_id: room.id,
        user_id: null,
        content_original: `サンプル (ラウンド${data.round_number}) が承認されました。`,
        is_system_message: true,
      })
    }

    revalidatePath(`/deals/${data.deal_id}`)
  }

  return { success: true }
}

/**
 * Request revision for sample
 */
export async function requestSampleRevision(
  sampleId: string,
  feedbackMemo: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('deal_samples')
    .update({
      sample_status: 'revision_needed',
      feedback_memo: feedbackMemo,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sampleId)
    .select('deal_id, round_number')
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Post system message to factory chat with feedback
  if (data) {
    const { data: room } = await supabase
      .from('chat_rooms')
      .select('id')
      .eq('deal_id', data.deal_id)
      .eq('room_type', 'sales_factory')
      .single()

    if (room) {
      await supabase.from('chat_messages').insert({
        room_id: room.id,
        user_id: null,
        content_original: `サンプル (ラウンド${data.round_number}) の修正が必要です。\n修正内容: ${feedbackMemo}`,
        is_system_message: true,
      })
    }

    revalidatePath(`/deals/${data.deal_id}`)
  }

  return { success: true }
}
