'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type {
  DealFactoryPayment,
  CreatePaymentInput,
  UpdatePaymentInput,
  PaymentStatus,
} from '@/lib/types'

export async function createPayment(
  input: CreatePaymentInput
): Promise<{ data: DealFactoryPayment | null; error: string | null }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('deal_factory_payments')
    .insert({
      deal_id: input.deal_id,
      factory_id: input.factory_id,
      payment_type: input.payment_type,
      payment_method: input.payment_method || null,
      amount_usd: input.amount_usd || null,
      amount_jpy: input.amount_jpy || null,
      due_date: input.due_date || null,
      trigger_condition: input.trigger_condition || null,
      status: 'unpaid',
    })
    .select()
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  revalidatePath('/payments')
  revalidatePath(`/deals/${input.deal_id}`)
  return { data, error: null }
}

export async function updatePayment(
  id: string,
  input: UpdatePaymentInput
): Promise<{ data: DealFactoryPayment | null; error: string | null }> {
  const supabase = await createClient()

  const updateData: Record<string, unknown> = { ...input }

  // If marking as paid, set paid_at timestamp
  if (input.status === 'paid' && !input.paid_at) {
    updateData.paid_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('deal_factory_payments')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  revalidatePath('/payments')
  if (data.deal_id) {
    revalidatePath(`/deals/${data.deal_id}`)
  }
  return { data, error: null }
}

export async function markPaymentAsPaid(
  id: string
): Promise<{ data: DealFactoryPayment | null; error: string | null }> {
  return updatePayment(id, {
    status: 'paid' as PaymentStatus,
    paid_at: new Date().toISOString(),
  })
}

export async function getPaymentsForDeal(dealId: string): Promise<DealFactoryPayment[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('deal_factory_payments')
    .select('*, factory:factories(factory_name)')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: true })

  return data || []
}

export async function getAllPayments(filters?: {
  status?: PaymentStatus
  upcomingDays?: number
}): Promise<DealFactoryPayment[]> {
  const supabase = await createClient()

  let query = supabase
    .from('deal_factory_payments')
    .select('*, deal:deals(deal_code, deal_name), factory:factories(factory_name)')
    .order('due_date', { ascending: true })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.upcomingDays) {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + filters.upcomingDays)
    query = query
      .eq('status', 'unpaid')
      .lte('due_date', futureDate.toISOString().split('T')[0])
  }

  const { data } = await query

  return data || []
}

export async function getUpcomingPayments(days: number = 14): Promise<DealFactoryPayment[]> {
  return getAllPayments({ upcomingDays: days })
}

// FormData wrapper for legacy page compatibility
export async function createPaymentAction(
  formData: FormData
): Promise<{ data: DealFactoryPayment | null; error: string | null }> {
  const input: CreatePaymentInput = {
    deal_id: formData.get('deal_id') as string,
    factory_id: (formData.get('factory_id') as string) || undefined,
    payment_type: formData.get('payment_type') as 'advance' | 'balance' | 'full',
    payment_method: (formData.get('payment_method') as 'wise' | 'alibaba_cc' | 'bank_transfer') || undefined,
    amount_usd: formData.get('amount_usd') ? parseFloat(formData.get('amount_usd') as string) : undefined,
    amount_jpy: formData.get('amount_jpy') ? parseInt(formData.get('amount_jpy') as string) : undefined,
    due_date: (formData.get('due_date') as string) || undefined,
    trigger_condition: (formData.get('trigger_condition') as string) || undefined,
  }

  return createPayment(input)
}
