'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Client, CreateClientInput, UpdateClientInput } from '@/lib/types'

export async function createClientAction(
  input: CreateClientInput | FormData
): Promise<{ data: Client | null; error: string | null }> {
  const supabase = await createClient()

  // Handle FormData input
  let insertData: {
    company_name: string
    brand_name?: string | null
    contact_name?: string | null
    contact_role?: string | null
    industry?: string | null
    phone?: string | null
    email?: string | null
    address?: string | null
    default_delivery_address?: string | null
    default_sample_cost_rate?: number
    notes?: string | null
  }

  if (input instanceof FormData) {
    const companyName = input.get('company_name') as string
    if (!companyName) {
      return { data: null, error: '会社名は必須です' }
    }
    insertData = {
      company_name: companyName,
      brand_name: (input.get('brand_name') as string) || null,
      contact_name: (input.get('contact_name') as string) || null,
      contact_role: (input.get('contact_role') as string) || null,
      industry: (input.get('industry') as string) || null,
      phone: (input.get('phone') as string) || null,
      email: (input.get('email') as string) || null,
      address: (input.get('address') as string) || null,
      default_delivery_address: (input.get('default_delivery_address') as string) || null,
      default_sample_cost_rate: 0.5,
      notes: (input.get('notes') as string) || null,
    }
  } else {
    insertData = {
      company_name: input.company_name,
      brand_name: input.brand_name || null,
      contact_name: input.contact_name || null,
      contact_role: input.contact_role || null,
      industry: input.industry || null,
      phone: input.phone || null,
      email: input.email || null,
      address: input.address || null,
      default_delivery_address: input.default_delivery_address || null,
      default_sample_cost_rate: input.default_sample_cost_rate ?? 0.5,
      notes: input.notes || null,
    }
  }

  const { data, error } = await supabase
    .from('clients')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  revalidatePath('/clients')
  return { data, error: null }
}

export async function updateClientAction(
  id: string,
  input: UpdateClientInput | FormData
): Promise<{ data: Client | null; error: string | null }> {
  const supabase = await createClient()

  // Handle FormData input
  let updateData: UpdateClientInput
  if (input instanceof FormData) {
    updateData = {
      company_name: (input.get('company_name') as string) || undefined,
      brand_name: (input.get('brand_name') as string) || undefined,
      contact_name: (input.get('contact_name') as string) || undefined,
      contact_role: (input.get('contact_role') as string) || undefined,
      industry: (input.get('industry') as string) || undefined,
      phone: (input.get('phone') as string) || undefined,
      email: (input.get('email') as string) || undefined,
      address: (input.get('address') as string) || undefined,
      notes: (input.get('notes') as string) || undefined,
    }
    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key as keyof UpdateClientInput] === undefined) {
        delete updateData[key as keyof UpdateClientInput]
      }
    })
  } else {
    updateData = input
  }

  const { data, error } = await supabase
    .from('clients')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  revalidatePath('/clients')
  revalidatePath(`/clients/${id}`)
  return { data, error: null }
}

export async function deleteClientAction(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const { error } = await supabase.from('clients').delete().eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/clients')
  return { error: null }
}

export async function getClient(id: string): Promise<Client | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()

  return data
}

export async function getClients(search?: string): Promise<Client[]> {
  const supabase = await createClient()

  let query = supabase
    .from('clients')
    .select('*')
    .order('company_name', { ascending: true })

  if (search) {
    query = query.or(`company_name.ilike.%${search}%,brand_name.ilike.%${search}%,contact_name.ilike.%${search}%`)
  }

  const { data } = await query

  return data || []
}
