'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { DealQuote, DealQuoteWithShippingOptions, CreateQuoteInput, UpdateQuoteInput } from '@/lib/types'
import { calculateQuote } from '@/lib/calc/cost-engine'

export async function createQuote(
  input: CreateQuoteInput
): Promise<{ data: DealQuote | null; error: string | null }> {
  const supabase = await createClient()

  // Get system settings for defaults
  const { data: settings } = await supabase
    .from('system_settings')
    .select('default_exchange_rate, default_tax_rate')
    .single()

  const exchangeRate = input.exchange_rate || settings?.default_exchange_rate || 155
  const costRatio = input.cost_ratio || 0.55
  const taxRate = settings?.default_tax_rate || 10

  // Calculate prices
  const calculation = calculateQuote({
    factoryUnitPriceUsd: input.factory_unit_price_usd,
    quantity: input.quantity,
    shippingCostUsd: 0,
    plateFeeUsd: input.plate_fee_usd || 0,
    otherFeesUsd: input.other_fees_usd || 0,
    exchangeRate,
    costRatio,
    taxRate,
  })

  // Get max version for this deal
  const { data: existingQuotes } = await supabase
    .from('deal_quotes')
    .select('version')
    .eq('deal_id', input.deal_id)
    .order('version', { ascending: false })
    .limit(1)

  const nextVersion = existingQuotes && existingQuotes.length > 0
    ? existingQuotes[0].version + 1
    : 1

  const { data, error } = await supabase
    .from('deal_quotes')
    .insert({
      deal_id: input.deal_id,
      factory_id: input.factory_id,
      version: nextVersion,
      quantity: input.quantity,
      factory_unit_price_usd: input.factory_unit_price_usd,
      plate_fee_usd: input.plate_fee_usd || 0,
      other_fees_usd: input.other_fees_usd || 0,
      total_cost_usd: calculation.totalCostUsd,
      unit_cost_usd: calculation.unitCostUsd,
      cost_ratio: costRatio,
      exchange_rate: exchangeRate,
      selling_price_usd: calculation.sellingPriceUsd,
      selling_price_jpy: calculation.sellingPriceJpy,
      total_billing_jpy: calculation.totalBillingJpy,
      total_billing_tax_jpy: calculation.totalBillingTaxJpy,
      status: 'drafting',
      source_type: 'manual',
    })
    .select()
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  revalidatePath(`/deals/${input.deal_id}`)
  return { data, error: null }
}

export async function updateQuote(
  id: string,
  input: UpdateQuoteInput
): Promise<{ data: DealQuote | null; error: string | null }> {
  const supabase = await createClient()

  // Get current quote to merge values
  const { data: currentQuote } = await supabase
    .from('deal_quotes')
    .select('*')
    .eq('id', id)
    .single()

  if (!currentQuote) {
    return { data: null, error: 'Quote not found' }
  }

  // Recalculate if price-affecting fields changed
  let calculatedFields = {}
  if (
    input.factory_unit_price_usd !== undefined ||
    input.quantity !== undefined ||
    input.plate_fee_usd !== undefined ||
    input.other_fees_usd !== undefined ||
    input.cost_ratio !== undefined ||
    input.exchange_rate !== undefined
  ) {
    const { data: settings } = await supabase
      .from('system_settings')
      .select('default_tax_rate')
      .single()

    const calculation = calculateQuote({
      factoryUnitPriceUsd: input.factory_unit_price_usd ?? currentQuote.factory_unit_price_usd,
      quantity: input.quantity ?? currentQuote.quantity,
      shippingCostUsd: 0,
      plateFeeUsd: input.plate_fee_usd ?? currentQuote.plate_fee_usd,
      otherFeesUsd: input.other_fees_usd ?? currentQuote.other_fees_usd,
      exchangeRate: input.exchange_rate ?? currentQuote.exchange_rate,
      costRatio: input.cost_ratio ?? currentQuote.cost_ratio,
      taxRate: settings?.default_tax_rate || 10,
    })

    calculatedFields = {
      total_cost_usd: calculation.totalCostUsd,
      unit_cost_usd: calculation.unitCostUsd,
      selling_price_usd: calculation.sellingPriceUsd,
      selling_price_jpy: calculation.sellingPriceJpy,
      total_billing_jpy: calculation.totalBillingJpy,
      total_billing_tax_jpy: calculation.totalBillingTaxJpy,
    }
  }

  const { data, error } = await supabase
    .from('deal_quotes')
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

export async function approveQuote(id: string): Promise<{ data: DealQuote | null; error: string | null }> {
  return updateQuote(id, { status: 'approved' })
}

export async function getQuotesForDeal(dealId: string): Promise<DealQuoteWithShippingOptions[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('deal_quotes')
    .select(`
      *,
      factory:factories(*),
      shipping_options:deal_shipping_options(*)
    `)
    .eq('deal_id', dealId)
    .order('version', { ascending: false })

  return (data || []) as DealQuoteWithShippingOptions[]
}
