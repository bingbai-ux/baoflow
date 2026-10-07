'use server'

import { createClient as createSupabase } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Factory } from '@/lib/types'
import type { FactoryRollup } from './master-types'
import { requireSalesAccess } from './deal-access'
import { normalizeAccountInviteEmail } from '@/lib/utils/account-invites'

export interface FactoryInput {
  factory_name: string
  name_cn?: string | null
  contact_name?: string | null
  contact_phone?: string | null
  contact_email?: string | null
  wechat?: string | null
  address?: string | null
  specialties?: string[] | null
  payment_terms?: string | null
  default_payment_terms?: string | null
  incoterm?: string | null
  lead_time_range?: string | null
  quality_stars?: number | null
  delivery_stars?: number | null
  price_stars?: number | null
  since?: string | null
  notes?: string | null
}

function parseFormData(input: FactoryInput | FormData): FactoryInput {
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
  const specsRaw = (input.get('specialties') as string) || ''
  const specs = specsRaw
    .split(/[、,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)

  return {
    factory_name: text('factory_name') || '',
    name_cn: text('name_cn'),
    contact_name: text('contact_name'),
    contact_phone: text('contact_phone'),
    contact_email: text('contact_email'),
    wechat: text('wechat'),
    address: text('address'),
    specialties: specs.length > 0 ? specs : null,
    payment_terms: text('payment_terms'),
    default_payment_terms: text('default_payment_terms'),
    incoterm: text('incoterm'),
    lead_time_range: text('lead_time_range'),
    quality_stars: num('quality_stars'),
    delivery_stars: num('delivery_stars'),
    price_stars: num('price_stars'),
    since: text('since'),
    notes: text('notes'),
  }
}

export async function listFactories(): Promise<Factory[]> {
  const supabase = await createSupabase()
  const { data, error } = await supabase.from('factories').select('*').order('factory_name', { ascending: true })
  if (error) throw new Error('工場一覧を取得できませんでした')
  return (data || []) as Factory[]
}

export async function getFactory(id: string): Promise<Factory | null> {
  const supabase = await createSupabase()
  const { data } = await supabase.from('factories').select('*').eq('id', id).single()
  return (data as Factory) || null
}

export async function createFactoryRecord(
  input: FactoryInput | FormData
): Promise<{ data: Factory | null; error: string | null }> {
  const supabase = await createSupabase()
  const data = parseFormData(input)
  if (!data.factory_name?.trim()) return { data: null, error: '工場名は必須です' }

  const { data: row, error } = await supabase.from('factories').insert(data).select().single()
  if (error) return { data: null, error: error.message }
  revalidatePath('/master')
  return { data: row as Factory, error: null }
}

export async function updateFactoryRecord(
  id: string,
  input: FactoryInput | FormData,
  expectedUpdatedAt: string
): Promise<{ data: Factory | null; error: string | null }> {
  return saveExistingFactory(id, input, expectedUpdatedAt, false)
}

/** Explicit staff attestation; saves verified RFQ information on the existing factory. */
export async function completeFactoryBasicInfo(
  id: string,
  input: FormData,
  expectedUpdatedAt: string
): Promise<{ data: Factory | null; error: string | null }> {
  if (!(input instanceof FormData) || input.get('basic_info_reviewed') !== 'on')
    return { data: null, error: '工場名と連絡先メールを確認してください' }
  return saveExistingFactory(id, input, expectedUpdatedAt, true)
}

async function saveExistingFactory(id: string, input: FactoryInput | FormData, expectedUpdatedAt: string, complete: boolean) {
  const supabase = await createSupabase()
  const accessError = await requireSalesAccess(supabase)
  if (accessError) return { data: null, error: accessError }
  if (!input || typeof input !== 'object') return { data: null, error: '工場の基本情報を入力してください' }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    || typeof expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(expectedUpdatedAt)))
    return { data: null, error: '工場を再読み込みしてから保存してください' }
  // Parse an allowlisted set of fields, even if the server action receives an object.
  const form = input instanceof FormData ? input : (() => {
    const fd = new FormData()
    for (const [key, value] of Object.entries(input)) if (value != null) fd.set(key, Array.isArray(value) ? value.join('\n') : String(value))
    return fd
  })()
  const data = parseFormData(form)
  const { data: current, error: readError } = await supabase.from('factories')
    .select('id,basic_info_completed').eq('id', id).eq('updated_at', expectedUpdatedAt).maybeSingle()
  if (readError || !current) return { data: null, error: '工場が変更されたか、編集できません。再読み込みしてください' }
  if (!data.factory_name?.trim()) return { data: null, error: '工場名は必須です' }
  if (complete || current.basic_info_completed) {
    const email = normalizeAccountInviteEmail(data.contact_email)
    if (!email) return { data: null, error: 'RFQ用の連絡先メールアドレスは必須です' }
    data.contact_email = email
  }

  const { data: row, error } = await supabase
    .from('factories')
    .update({ ...data, ...(complete ? { basic_info_completed: true } : {}), updated_at: new Date(Math.max(Date.now(), Date.parse(expectedUpdatedAt) + 1)).toISOString() })
    .eq('id', id).eq('updated_at', expectedUpdatedAt)
    .select()
    .maybeSingle()
  if (error || !row) return { data: null, error: '工場が変更されたか、保存できません。再読み込みしてください' }
  revalidatePath('/master')
  return { data: row as Factory, error: null }
}

export async function deleteFactoryRecord(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabase()
  // Check usage in deal_quotes
  const { count } = await supabase
    .from('deal_quotes')
    .select('id', { count: 'exact', head: true })
    .eq('factory_id', id)
  if ((count || 0) > 0) {
    return { success: false, error: `見積 ${count} 件で使用中のため削除できません` }
  }
  const { error } = await supabase.from('factories').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/master')
  return { success: true }
}

export async function getFactoryRollup(factoryId: string): Promise<FactoryRollup> {
  const supabase = await createSupabase()
  const { data } = await supabase
    .from('deal_quotes')
    .select('id, status')
    .eq('factory_id', factoryId)

  const list = data || []
  return {
    factory_id: factoryId,
    quote_count: list.length,
    approved_quote_count: list.filter((q) => q.status === 'approved').length,
    avg_lead_days: null, // TODO: derive from deal_product_variants if needed
  }
}
