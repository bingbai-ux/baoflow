'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { calculateQuote } from '@/lib/calc/cost-engine'

export interface CreatePhase1QuoteInput {
  deal_id: string
  spec_id?: string | null
  quantity: number
  factory_unit_price_usd: number
  plate_fee_usd?: number | null
  other_fees_usd?: number | null
  exchange_rate?: number | null
  cost_ratio?: number | null
}

export interface QuoteRow {
  id: string
  deal_id: string
  spec_id: string | null
  version: number | null
  quantity: number | null
  factory_unit_price_usd: number | null
  plate_fee_usd: number | null
  other_fees_usd: number | null
  total_cost_usd: number | null
  unit_cost_usd: number | null
  cost_ratio: number | null
  exchange_rate: number | null
  selling_price_usd: number | null
  selling_price_jpy: number | null
  total_billing_jpy: number | null
  total_billing_tax_jpy: number | null
  status: string | null
  created_at: string
}

interface CalcDefaults {
  exchange_rate: number
  cost_ratio: number
  tax_rate: number
}

async function loadDefaults(): Promise<CalcDefaults> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('system_settings')
    .select('default_exchange_rate, default_tax_rate, default_cost_ratio')
    .single()
  return {
    exchange_rate: Number(data?.default_exchange_rate) || 155,
    cost_ratio: Number(data?.default_cost_ratio) || 0.55,
    tax_rate: Number(data?.default_tax_rate) || 10,
  }
}

function parseFormData(input: CreatePhase1QuoteInput | FormData): CreatePhase1QuoteInput {
  if (!(input instanceof FormData)) return input
  const num = (key: string): number | null => {
    const v = input.get(key) as string | null
    if (!v) return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return {
    deal_id: (input.get('deal_id') as string) || '',
    spec_id: (input.get('spec_id') as string) || null,
    quantity: num('quantity') || 0,
    factory_unit_price_usd: num('factory_unit_price_usd') || 0,
    plate_fee_usd: num('plate_fee_usd'),
    other_fees_usd: num('other_fees_usd'),
    exchange_rate: num('exchange_rate'),
    cost_ratio: num('cost_ratio'),
  }
}

export async function createQuote(
  input: CreatePhase1QuoteInput | FormData
): Promise<{ data: QuoteRow | null; error: string | null }> {
  const supabase = await createClient()
  const data = parseFormData(input)

  if (!data.deal_id) return { data: null, error: 'deal_id が必要です' }
  if (!data.quantity || data.quantity <= 0) return { data: null, error: '数量は 1 以上で指定してください' }
  if (data.factory_unit_price_usd <= 0)
    return { data: null, error: '工場単価は 0 より大きい値を指定してください' }

  const defaults = await loadDefaults()
  const exchange_rate = data.exchange_rate || defaults.exchange_rate
  const cost_ratio = data.cost_ratio || defaults.cost_ratio
  const tax_rate = defaults.tax_rate

  if (cost_ratio <= 0 || cost_ratio > 1)
    return { data: null, error: '掛け率は 0 < x ≦ 1 で指定してください' }

  const calc = calculateQuote({
    factoryUnitPriceUsd: data.factory_unit_price_usd,
    quantity: data.quantity,
    shippingCostUsd: 0,
    plateFeeUsd: data.plate_fee_usd || 0,
    otherFeesUsd: data.other_fees_usd || 0,
    exchangeRate: exchange_rate,
    costRatio: cost_ratio,
    taxRate: tax_rate,
  })

  const { data: existing } = await supabase
    .from('deal_quotes')
    .select('version')
    .eq('deal_id', data.deal_id)
    .order('version', { ascending: false })
    .limit(1)

  const nextVersion = existing && existing.length > 0 ? (existing[0].version || 0) + 1 : 1

  const { data: row, error } = await supabase
    .from('deal_quotes')
    .insert({
      deal_id: data.deal_id,
      spec_id: data.spec_id || null,
      factory_id: null,
      version: nextVersion,
      quantity: data.quantity,
      factory_unit_price_usd: data.factory_unit_price_usd,
      plate_fee_usd: data.plate_fee_usd || 0,
      other_fees_usd: data.other_fees_usd || 0,
      total_cost_usd: calc.totalCostUsd,
      unit_cost_usd: calc.unitCostUsd,
      cost_ratio,
      exchange_rate,
      selling_price_usd: calc.sellingPriceUsd,
      selling_price_jpy: calc.sellingPriceJpy,
      total_billing_jpy: calc.totalBillingJpy,
      total_billing_tax_jpy: calc.totalBillingTaxJpy,
      status: 'drafting',
      source_type: 'manual',
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }

  revalidatePath(`/deals/${data.deal_id}`)
  revalidatePath(`/deals/${data.deal_id}/quote`)
  return { data: row as QuoteRow, error: null }
}

export async function deleteQuote(
  quoteId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('deal_quotes')
    .select('deal_id')
    .eq('id', quoteId)
    .single()

  const { error } = await supabase.from('deal_quotes').delete().eq('id', quoteId)
  if (error) return { success: false, error: error.message }

  if (existing?.deal_id) {
    revalidatePath(`/deals/${existing.deal_id}`)
    revalidatePath(`/deals/${existing.deal_id}/quote`)
  }
  return { success: true }
}

export async function getQuotesForDeal(dealId: string): Promise<QuoteRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('deal_quotes')
    .select(
      'id, deal_id, spec_id, version, quantity, factory_unit_price_usd, plate_fee_usd, other_fees_usd, total_cost_usd, unit_cost_usd, cost_ratio, exchange_rate, selling_price_usd, selling_price_jpy, total_billing_jpy, total_billing_tax_jpy, status, created_at'
    )
    .eq('deal_id', dealId)
    .order('version', { ascending: false })
  return (data || []) as QuoteRow[]
}

export async function selectQuote(
  quoteId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('deal_quotes')
    .select('deal_id, spec_id')
    .eq('id', quoteId)
    .single()
  if (!existing) return { success: false, error: '見積が見つかりません' }

  // 同 spec_id (NULL 含む) の他の quote を 'rejected' に戻し、本人を 'approved' に
  if (existing.spec_id) {
    await supabase
      .from('deal_quotes')
      .update({ status: 'rejected' })
      .eq('deal_id', existing.deal_id)
      .eq('spec_id', existing.spec_id)
      .eq('status', 'approved')
  } else {
    await supabase
      .from('deal_quotes')
      .update({ status: 'rejected' })
      .eq('deal_id', existing.deal_id)
      .is('spec_id', null)
      .eq('status', 'approved')
  }

  const { error } = await supabase
    .from('deal_quotes')
    .update({ status: 'approved' })
    .eq('id', quoteId)
  if (error) return { success: false, error: error.message }

  revalidatePath(`/deals/${existing.deal_id}`)
  revalidatePath(`/deals/${existing.deal_id}/quote`)
  return { success: true }
}

export async function unselectQuote(
  quoteId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('deal_quotes')
    .select('deal_id')
    .eq('id', quoteId)
    .single()
  if (!existing) return { success: false, error: '見積が見つかりません' }

  const { error } = await supabase
    .from('deal_quotes')
    .update({ status: 'drafting' })
    .eq('id', quoteId)
  if (error) return { success: false, error: error.message }

  revalidatePath(`/deals/${existing.deal_id}`)
  revalidatePath(`/deals/${existing.deal_id}/quote`)
  return { success: true }
}

export async function getQuoteCalculationDefaults(): Promise<CalcDefaults> {
  return loadDefaults()
}
