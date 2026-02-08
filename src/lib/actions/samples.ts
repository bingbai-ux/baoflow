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
