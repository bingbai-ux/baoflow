'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface LogisticsAgent {
  id: string
  name: string
  name_en: string | null
  agent_type: 'forwarder' | 'customs_broker' | 'all_in_one'
  services: string[] | null
  rate_table: Record<string, unknown> | null
  contact_name: string | null
  contact_info: string | null
  is_primary: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export async function createLogisticsAgent(
  formData: FormData
): Promise<{ data: LogisticsAgent | null; error: string | null }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: 'Unauthorized' }
  }

  const name = formData.get('name') as string
  const name_en = (formData.get('name_en') as string) || null
  const agent_type = formData.get('agent_type') as string
  const servicesJson = formData.get('services') as string
  const contact_name = (formData.get('contact_name') as string) || null
  const contact_info = (formData.get('contact_info') as string) || null
  const is_primary = formData.get('is_primary') === 'on'
  const notes = (formData.get('notes') as string) || null

  let services: string[] = []
  try {
    services = JSON.parse(servicesJson || '[]')
  } catch {
    services = []
  }

  const { data, error } = await supabase
    .from('logistics_agents')
    .insert({
      name,
      name_en,
      agent_type,
      services,
      contact_name,
      contact_info,
      is_primary,
      notes,
    })
    .select()
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  revalidatePath('/logistics')
  return { data: data as LogisticsAgent, error: null }
}

export async function updateLogisticsAgent(
  id: string,
  formData: FormData
): Promise<{ data: LogisticsAgent | null; error: string | null }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: 'Unauthorized' }
  }

  const name = formData.get('name') as string
  const name_en = (formData.get('name_en') as string) || null
  const agent_type = formData.get('agent_type') as string
  const servicesJson = formData.get('services') as string
  const contact_name = (formData.get('contact_name') as string) || null
  const contact_info = (formData.get('contact_info') as string) || null
  const is_primary = formData.get('is_primary') === 'on'
  const notes = (formData.get('notes') as string) || null

  let services: string[] = []
  try {
    services = JSON.parse(servicesJson || '[]')
  } catch {
    services = []
  }

  const { data, error } = await supabase
    .from('logistics_agents')
    .update({
      name,
      name_en,
      agent_type,
      services,
      contact_name,
      contact_info,
      is_primary,
      notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  revalidatePath('/logistics')
  revalidatePath(`/logistics/${id}`)
  return { data: data as LogisticsAgent, error: null }
}

export async function deleteLogisticsAgent(
  id: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('logistics_agents')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/logistics')
  return { error: null }
}

export async function getLogisticsAgents(): Promise<LogisticsAgent[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('logistics_agents')
    .select('*')
    .order('is_primary', { ascending: false })
    .order('name', { ascending: true })

  return (data || []) as LogisticsAgent[]
}

export async function getLogisticsAgent(id: string): Promise<LogisticsAgent | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('logistics_agents')
    .select('*')
    .eq('id', id)
    .single()

  return data as LogisticsAgent | null
}
