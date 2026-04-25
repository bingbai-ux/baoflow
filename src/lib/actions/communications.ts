'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { DealCommunication, CommChannel, CommAuthorRole } from '@/lib/types'

export interface CommInput {
  channel: CommChannel
  author_role?: CommAuthorRole | null
  subject?: string | null
  body: string
  needs_followup?: boolean
  followup_date?: string | null
  occurred_at?: string | null
}

function parseFormData(input: CommInput | FormData): CommInput {
  if (!(input instanceof FormData)) return input
  const text = (key: string): string | null => {
    const v = (input.get(key) as string)?.trim()
    return v ? v : null
  }
  const channel = (input.get('channel') as string) || 'memo'
  const role = (input.get('author_role') as string) || null
  return {
    channel: (channel as CommChannel) || 'memo',
    author_role: (role as CommAuthorRole | null) || null,
    subject: text('subject'),
    body: text('body') || '',
    needs_followup: input.get('needs_followup') === 'on',
    followup_date: text('followup_date'),
    occurred_at: text('occurred_at'),
  }
}

export async function listCommunications(dealId: string): Promise<DealCommunication[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('deal_communications')
    .select('*')
    .eq('deal_id', dealId)
    .order('occurred_at', { ascending: false })
  return (data || []) as DealCommunication[]
}

export async function createCommunication(
  dealId: string,
  input: CommInput | FormData
): Promise<{ data: DealCommunication | null; error: string | null }> {
  const supabase = await createClient()
  const data = parseFormData(input)
  if (!data.body?.trim()) return { data: null, error: '本文は必須です' }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Unauthorized' }

  const occurredAt = data.occurred_at || new Date().toISOString()

  const { data: row, error } = await supabase
    .from('deal_communications')
    .insert({
      deal_id: dealId,
      author_user_id: user.id,
      author_role: data.author_role || 'staff',
      channel: data.channel,
      subject: data.subject,
      body: data.body,
      needs_followup: data.needs_followup ?? false,
      followup_date: data.followup_date,
      occurred_at: occurredAt,
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }

  // Mirror into deal_status_history with kind='comm'
  await supabase.from('deal_status_history').insert({
    deal_id: dealId,
    from_status: null,
    to_status: 'M01',
    from_simple_status: null,
    to_simple_status: null,
    changed_by: user.id,
    note: data.subject || data.body.slice(0, 80),
    kind: 'comm',
  })

  revalidatePath(`/deals/${dealId}`)
  return { data: row as DealCommunication, error: null }
}

export async function markCommRead(
  commId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('deal_communications')
    .select('deal_id')
    .eq('id', commId)
    .single()
  const { error } = await supabase
    .from('deal_communications')
    .update({ is_read: true, updated_at: new Date().toISOString() })
    .eq('id', commId)
  if (error) return { success: false, error: error.message }
  if (existing?.deal_id) revalidatePath(`/deals/${existing.deal_id}`)
  return { success: true }
}

export async function setCommFollowup(
  commId: string,
  needs: boolean,
  date: string | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('deal_communications')
    .select('deal_id')
    .eq('id', commId)
    .single()
  const { error } = await supabase
    .from('deal_communications')
    .update({ needs_followup: needs, followup_date: date, updated_at: new Date().toISOString() })
    .eq('id', commId)
  if (error) return { success: false, error: error.message }
  if (existing?.deal_id) revalidatePath(`/deals/${existing.deal_id}`)
  return { success: true }
}

export async function deleteCommunication(
  commId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('deal_communications')
    .select('deal_id')
    .eq('id', commId)
    .single()
  const { error } = await supabase.from('deal_communications').delete().eq('id', commId)
  if (error) return { success: false, error: error.message }
  if (existing?.deal_id) revalidatePath(`/deals/${existing.deal_id}`)
  return { success: true }
}
