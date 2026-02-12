'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { SystemSettings } from '@/lib/types'
import { getExchangeRate, type ExchangeRateResult } from '@/lib/utils/exchange-rate'

export async function getSettings(): Promise<SystemSettings | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('system_settings')
    .select('*')
    .limit(1)
    .single()

  return data
}

export async function updateSettings(
  input: Partial<SystemSettings>
): Promise<{ data: SystemSettings | null; error: string | null }> {
  const supabase = await createClient()

  // Get existing settings
  const { data: existing } = await supabase
    .from('system_settings')
    .select('id')
    .limit(1)
    .single()

  if (!existing) {
    return { data: null, error: 'Settings not found' }
  }

  const { data, error } = await supabase
    .from('system_settings')
    .update(input)
    .eq('id', existing.id)
    .select()
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  revalidatePath('/settings')
  revalidatePath('/deals')
  revalidatePath('/')
  return { data, error: null }
}

export async function updateExchangeRate(
  rate: number
): Promise<{ data: SystemSettings | null; error: string | null }> {
  return updateSettings({ default_exchange_rate: rate })
}

/**
 * Fetch latest exchange rate from API and update system_settings
 * @returns Exchange rate result with update status
 */
export async function fetchAndUpdateExchangeRate(): Promise<{
  result: ExchangeRateResult
  updated: boolean
  error: string | null
}> {
  const result = await getExchangeRate('USD', 'JPY')

  if (!result.success || result.rate <= 0) {
    return {
      result,
      updated: false,
      error: result.error || 'Failed to fetch exchange rate',
    }
  }

  const updateResult = await updateSettings({
    default_exchange_rate: result.rate,
  })

  if (updateResult.error) {
    return {
      result,
      updated: false,
      error: updateResult.error,
    }
  }

  return {
    result,
    updated: true,
    error: null,
  }
}

export async function updateWiseFeeConfig(
  config: { conversion_fee_rate: number; swift_fee_usd: number }
): Promise<{ data: SystemSettings | null; error: string | null }> {
  return updateSettings({ wise_fee_config: config })
}

export async function updateCompanyInfo(
  info: Record<string, unknown>
): Promise<{ data: SystemSettings | null; error: string | null }> {
  return updateSettings({ company_info: info })
}

export async function updateBankAccounts(
  accounts: Record<string, unknown>[]
): Promise<{ data: SystemSettings | null; error: string | null }> {
  return updateSettings({ bank_accounts: accounts })
}
