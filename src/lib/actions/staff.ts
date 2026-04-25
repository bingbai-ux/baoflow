'use server'

import { createClient as createSupabase } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Profile, UserRole } from '@/lib/types'

const STAFF_ROLES: UserRole[] = ['admin', 'sales']

export interface StaffInput {
  display_name?: string | null
  role?: UserRole
  language_preference?: string | null
}

function parseFormData(input: StaffInput | FormData): StaffInput {
  if (!(input instanceof FormData)) return input
  const text = (key: string): string | null => {
    const v = (input.get(key) as string)?.trim()
    return v ? v : null
  }
  const role = text('role') as UserRole | null
  return {
    display_name: text('display_name'),
    role: role && STAFF_ROLES.includes(role) ? role : undefined,
    language_preference: text('language_preference'),
  }
}

export async function listStaff(): Promise<Profile[]> {
  const supabase = await createSupabase()
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .in('role', STAFF_ROLES)
    .order('created_at', { ascending: true })
  return (data || []) as Profile[]
}

export async function getStaff(id: string): Promise<Profile | null> {
  const supabase = await createSupabase()
  const { data } = await supabase.from('profiles').select('*').eq('id', id).single()
  return (data as Profile) || null
}

export async function updateStaffRecord(
  id: string,
  input: StaffInput | FormData
): Promise<{ data: Profile | null; error: string | null }> {
  const supabase = await createSupabase()
  const data = parseFormData(input)
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (data.display_name !== undefined) update.display_name = data.display_name
  if (data.role !== undefined) update.role = data.role
  if (data.language_preference !== undefined) update.language_preference = data.language_preference

  const { data: row, error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', id)
    .select()
    .single()
  if (error) return { data: null, error: error.message }
  revalidatePath('/master')
  return { data: row as Profile, error: null }
}

export interface StaffRollup {
  staff_id: string
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

export async function getStaffRollup(staffId: string): Promise<StaffRollup> {
  const supabase = await createSupabase()
  const { data: deals } = await supabase
    .from('deals')
    .select('id, deal_code, deal_name, simple_status, last_activity_at')
    .eq('sales_user_id', staffId)
    .order('last_activity_at', { ascending: false })

  const dealList = deals || []
  const dealIds = dealList.map((d) => d.id)

  const approvedByDeal = new Map<string, number>()
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
    staff_id: staffId,
    deal_count: dealList.length,
    in_progress_count: dealList.filter((d) => d.simple_status !== 'delivered').length,
    approved_total_jpy: approvedTotalAll,
    recent_deals: recent,
  }
}
