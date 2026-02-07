'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createFactoryAction(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'ログインが必要です' }
  }

  const specialtiesRaw = formData.get('specialties') as string
  const specialties = specialtiesRaw
    ? specialtiesRaw.split(',').map(s => s.trim()).filter(Boolean)
    : null

  const ratingRaw = formData.get('rating') as string
  const rating = ratingRaw ? parseFloat(ratingRaw) : null

  const { data, error } = await supabase
    .from('factories')
    .insert({
      name: formData.get('name') as string,
      country: formData.get('country') as string || '中国',
      city: formData.get('city') as string || null,
      specialties,
      payment_terms: formData.get('payment_terms') as string || null,
      contact_name: formData.get('contact_name') as string || null,
      contact_email: formData.get('contact_email') as string || null,
      contact_wechat: formData.get('contact_wechat') as string || null,
      rating,
      notes: formData.get('notes') as string || null,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/factories')
  return { data }
}

export async function updateFactoryAction(id: string, formData: FormData) {
  const supabase = await createClient()

  const specialtiesRaw = formData.get('specialties') as string
  const specialties = specialtiesRaw
    ? specialtiesRaw.split(',').map(s => s.trim()).filter(Boolean)
    : null

  const ratingRaw = formData.get('rating') as string
  const rating = ratingRaw ? parseFloat(ratingRaw) : null

  const { error } = await supabase
    .from('factories')
    .update({
      name: formData.get('name') as string,
      country: formData.get('country') as string || '中国',
      city: formData.get('city') as string || null,
      specialties,
      payment_terms: formData.get('payment_terms') as string || null,
      contact_name: formData.get('contact_name') as string || null,
      contact_email: formData.get('contact_email') as string || null,
      contact_wechat: formData.get('contact_wechat') as string || null,
      rating,
      notes: formData.get('notes') as string || null,
    })
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/factories')
  revalidatePath(`/factories/${id}`)
  return { success: true }
}

export async function deleteFactoryAction(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('factories')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/factories')
  return { success: true }
}
