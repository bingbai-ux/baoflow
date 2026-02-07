'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type PaymentType = 'deposit' | 'balance' | 'full'
export type PaymentMethodType = 'wise' | 'alibaba' | 'bank_transfer'
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed'

export async function createPaymentAction(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'ログインが必要です' }
  }

  const amountCny = formData.get('amount_cny') as string
  const amountJpy = formData.get('amount_jpy') as string
  const exchangeRate = formData.get('exchange_rate') as string

  const { data, error } = await supabase
    .from('payments')
    .insert({
      deal_id: formData.get('deal_id') as string,
      payment_type: formData.get('payment_type') as PaymentType,
      payment_method: formData.get('payment_method') as PaymentMethodType,
      amount_cny: amountCny ? parseFloat(amountCny) : null,
      amount_jpy: amountJpy ? parseFloat(amountJpy) : null,
      exchange_rate: exchangeRate ? parseFloat(exchangeRate) : null,
      reference_number: formData.get('reference_number') as string || null,
      status: 'pending' as PaymentStatus,
      notes: formData.get('notes') as string || null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/payments')
  return { data }
}

export async function updatePaymentStatus(id: string, status: PaymentStatus) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('payments')
    .update({ status })
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/payments')
  return { success: true }
}

export async function deletePaymentAction(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('payments')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/payments')
  return { success: true }
}
