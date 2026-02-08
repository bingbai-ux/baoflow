'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Factory, CreateFactoryInput, UpdateFactoryInput } from '@/lib/types'

export async function createFactoryAction(
  input: CreateFactoryInput | FormData
): Promise<{ data: Factory | null; error: string | null }> {
  const supabase = await createClient()

  let insertData: {
    factory_name: string
    contact_name?: string | null
    address?: string | null
    specialties?: string[] | null
    rating?: number | null
    quality?: string | null
    price_level?: string | null
    response_speed?: string | null
    default_payment_terms?: string | null
    default_payment_method?: string | null
    notes?: string | null
  }

  if (input instanceof FormData) {
    const factoryName = input.get('factory_name') as string
    if (!factoryName) {
      return { data: null, error: '工場名は必須です' }
    }
    const specialtiesStr = input.get('specialties') as string
    insertData = {
      factory_name: factoryName,
      contact_name: (input.get('contact_name') as string) || null,
      address: (input.get('address') as string) || null,
      specialties: specialtiesStr ? specialtiesStr.split(',').filter(Boolean) : null,
      rating: input.get('rating') ? parseFloat(input.get('rating') as string) : null,
      quality: (input.get('quality') as string) || null,
      price_level: (input.get('price_level') as string) || null,
      response_speed: (input.get('response_speed') as string) || null,
      default_payment_terms: (input.get('default_payment_terms') as string) || null,
      default_payment_method: (input.get('default_payment_method') as string) || null,
      notes: (input.get('notes') as string) || null,
    }
  } else {
    insertData = {
      factory_name: input.factory_name,
      contact_name: input.contact_name || null,
      address: input.address || null,
      specialties: input.specialties || null,
      rating: input.rating || null,
      quality: input.quality || null,
      price_level: input.price_level || null,
      response_speed: input.response_speed || null,
      default_payment_terms: input.default_payment_terms || null,
      default_payment_method: input.default_payment_method || null,
      notes: input.notes || null,
    }
  }

  const { data, error } = await supabase
    .from('factories')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  revalidatePath('/factories')
  return { data, error: null }
}

export async function updateFactoryAction(
  id: string,
  input: UpdateFactoryInput | FormData
): Promise<{ data: Factory | null; error: string | null }> {
  const supabase = await createClient()

  let updateData: UpdateFactoryInput

  if (input instanceof FormData) {
    const specialtiesStr = input.get('specialties') as string
    updateData = {}

    const factoryName = input.get('factory_name') as string
    if (factoryName) updateData.factory_name = factoryName

    const contactName = input.get('contact_name') as string
    if (contactName) updateData.contact_name = contactName

    const address = input.get('address') as string
    if (address) updateData.address = address

    if (specialtiesStr) updateData.specialties = specialtiesStr.split(',').filter(Boolean)

    const rating = input.get('rating') as string
    if (rating) updateData.rating = parseFloat(rating)

    const quality = input.get('quality') as string
    if (quality) updateData.quality = quality

    const priceLevel = input.get('price_level') as string
    if (priceLevel) updateData.price_level = priceLevel

    const responseSpeed = input.get('response_speed') as string
    if (responseSpeed) updateData.response_speed = responseSpeed

    const paymentTerms = input.get('default_payment_terms') as string
    if (paymentTerms) updateData.default_payment_terms = paymentTerms

    const paymentMethod = input.get('default_payment_method') as string
    if (paymentMethod) updateData.default_payment_method = paymentMethod as 'wise' | 'alibaba_cc' | 'bank_transfer'

    const notes = input.get('notes') as string
    if (notes) updateData.notes = notes
  } else {
    updateData = input
  }

  const { data, error } = await supabase
    .from('factories')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  revalidatePath('/factories')
  revalidatePath(`/factories/${id}`)
  return { data, error: null }
}

export async function deleteFactoryAction(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const { error } = await supabase.from('factories').delete().eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/factories')
  return { error: null }
}

export async function getFactory(id: string): Promise<Factory | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('factories')
    .select('*')
    .eq('id', id)
    .single()

  return data
}

export async function getFactories(search?: string): Promise<Factory[]> {
  const supabase = await createClient()

  let query = supabase
    .from('factories')
    .select('*')
    .order('factory_name', { ascending: true })

  if (search) {
    query = query.or(`factory_name.ilike.%${search}%,contact_name.ilike.%${search}%`)
  }

  const { data } = await query

  return data || []
}
