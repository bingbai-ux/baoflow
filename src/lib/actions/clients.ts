'use server'

import { createClient as createSupabase } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Client } from '@/lib/types'

export interface ClientInput {
  company_name: string
  short_name?: string | null
  brand_name?: string | null
  contact_name?: string | null
  industry?: string | null
  phone?: string | null
  contact_phone?: string | null
  email?: string | null
  address?: string | null
  default_delivery_address?: string | null
  billing_to?: string | null
  tax_id?: string | null
  payment_terms?: string | null
  tax_rate?: number | null
  since?: string | null
  notes?: string | null
}

function parseFormData(input: ClientInput | FormData): ClientInput {
  if (!(input instanceof FormData)) return input
  const text = (key: string): string | null => {
    const v = (input.get(key) as string)?.trim()
    return v ? v : null
  }
  const num = (key: string): number | null => {
    const v = input.get(key) as string | null
    if (!v) return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return {
    company_name: text('company_name') || '',
    short_name: text('short_name'),
    brand_name: text('brand_name'),
    contact_name: text('contact_name'),
    industry: text('industry'),
    phone: text('phone'),
    contact_phone: text('contact_phone'),
    email: text('email'),
    address: text('address'),
    default_delivery_address: text('default_delivery_address'),
    billing_to: text('billing_to'),
    tax_id: text('tax_id'),
    payment_terms: text('payment_terms'),
    tax_rate: num('tax_rate'),
    since: text('since'),
    notes: text('notes'),
  }
}

export async function listClients(): Promise<Client[]> {
  const supabase = await createSupabase()
  const { data } = await supabase
    .from('clients')
    .select('*')
    .order('company_name', { ascending: true })
  return (data || []) as Client[]
}

export async function getClient(id: string): Promise<Client | null> {
  const supabase = await createSupabase()
  const { data } = await supabase.from('clients').select('*').eq('id', id).single()
  return (data as Client) || null
}

export async function createClientRecord(
  input: ClientInput | FormData
): Promise<{ data: Client | null; error: string | null }> {
  const supabase = await createSupabase()
  const data = parseFormData(input)
  if (!data.company_name?.trim()) return { data: null, error: '会社名は必須です' }

  const { data: row, error } = await supabase.from('clients').insert(data).select().single()
  if (error) return { data: null, error: error.message }
  revalidatePath('/master')
  revalidatePath('/deals')
  return { data: row as Client, error: null }
}

export async function updateClientRecord(
  id: string,
  input: ClientInput | FormData
): Promise<{ data: Client | null; error: string | null }> {
  const supabase = await createSupabase()
  const data = parseFormData(input)
  if (!data.company_name?.trim()) return { data: null, error: '会社名は必須です' }

  const { data: row, error } = await supabase
    .from('clients')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) return { data: null, error: error.message }
  revalidatePath('/master')
  revalidatePath('/deals')
  return { data: row as Client, error: null }
}

export async function deleteClientRecord(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabase()
  // Check if any deals reference this client
  const { count } = await supabase
    .from('deals')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', id)
  if ((count || 0) > 0) {
    return { success: false, error: `案件 ${count} 件が参照中のため削除できません` }
  }
  const { error } = await supabase.from('clients').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/master')
  return { success: true }
}

export interface ClientRollup {
  client_id: string
  deal_count: number
  in_progress_count: number
  approved_total_jpy: number
  recent_deals: Array<{
    id: string
    deal_code: string
    deal_name: string | null
    simple_status: string
    last_activity_at: string
    approved_total_jpy: number
  }>
}

export async function getClientRollup(clientId: string): Promise<ClientRollup> {
  const supabase = await createSupabase()
  const { data: deals } = await supabase
    .from('deals')
    .select('id, deal_code, deal_name, simple_status, last_activity_at')
    .eq('client_id', clientId)
    .order('last_activity_at', { ascending: false })

  const dealList = deals || []
  const dealIds = dealList.map((d) => d.id)

  let approvedByDeal = new Map<string, number>()
  let approvedTotalAll = 0
  if (dealIds.length > 0) {
    const { data: quotes } = await supabase
      .from('deal_quotes')
      .select('deal_id, total_billing_tax_jpy, status')
      .in('deal_id', dealIds)
      .eq('status', 'approved')
    for (const q of quotes || []) {
      const v = Number(q.total_billing_tax_jpy) || 0
      approvedByDeal.set(q.deal_id, (approvedByDeal.get(q.deal_id) || 0) + v)
      approvedTotalAll += v
    }
  }

  const recent = dealList.slice(0, 10).map((d) => ({
    id: d.id,
    deal_code: d.deal_code,
    deal_name: d.deal_name,
    simple_status: d.simple_status,
    last_activity_at: d.last_activity_at,
    approved_total_jpy: approvedByDeal.get(d.id) || 0,
  }))

  return {
    client_id: clientId,
    deal_count: dealList.length,
    in_progress_count: dealList.filter((d) => d.simple_status !== 'delivered').length,
    approved_total_jpy: approvedTotalAll,
    recent_deals: recent,
  }
}
