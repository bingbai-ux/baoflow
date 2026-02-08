'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { SystemSettings } from '@/lib/types'

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
