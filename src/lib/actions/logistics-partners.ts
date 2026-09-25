'use server'

// Sprint 11: 物流パートナー (発送業者 / ロジスティック会社) マスター。

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface LogisticsPartner {
  id: string
  partner_kind: 'shipping' | 'warehouse'
  company_name: string
  name_cn: string | null
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  wechat: string | null
  address: string | null
  services: string[] | null
  coverage: string | null
  pricing_notes: string | null
  payment_terms: string | null
  bank_info: Record<string, unknown> | null
  notes: string | null
  is_active: boolean
  self_registered_at: string | null
  created_at: string
  updated_at: string
}

export async function listLogisticsPartners(): Promise<LogisticsPartner[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('logistics_partners')
    .select('*')
    .order('partner_kind', { ascending: true })
    .order('created_at', { ascending: false })
  return (data || []) as LogisticsPartner[]
}

const ALLOWED_PARTNER_FIELDS = new Set([
  'company_name',
  'name_cn',
  'contact_name',
  'contact_phone',
  'contact_email',
  'wechat',
  'address',
  'coverage',
  'pricing_notes',
  'payment_terms',
  'notes',
])

export async function updatePartnerField(
  partnerId: string,
  field: string,
  value: string | null
): Promise<{ success: boolean; error?: string }> {
  if (!ALLOWED_PARTNER_FIELDS.has(field)) {
    return { success: false, error: `編集できない項目です: ${field}` }
  }
  const supabase = await createClient()
  const { error } = await supabase
    .from('logistics_partners')
    .update({ [field]: value || null })
    .eq('id', partnerId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/master')
  return { success: true }
}

export async function setPartnerActive(
  partnerId: string,
  active: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('logistics_partners')
    .update({ is_active: active })
    .eq('id', partnerId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/master')
  return { success: true }
}

export async function createPartnerRecord(
  kind: 'shipping' | 'warehouse',
  companyName: string
): Promise<{ id: string | null; error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { id: null, error: 'Unauthorized' }
  if (!companyName.trim()) return { id: null, error: '会社名は必須です' }
  const { data, error } = await supabase
    .from('logistics_partners')
    .insert({ partner_kind: kind, company_name: companyName.trim() })
    .select('id')
    .single()
  if (error) return { id: null, error: error.message }
  revalidatePath('/master')
  return { id: data.id, error: null }
}
