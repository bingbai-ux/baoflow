'use server'

// 再設計 工程1: 取引先マスター（会社・担当者（複数）・ブランド）。

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSalesAccess } from './deal-access'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const clean = (v: string | null | undefined) => { const t = (v ?? '').trim(); return t ? t : null }

export interface ContactInput { name: string; email?: string | null; phone?: string | null; role?: string | null; notes?: string | null }
export interface NewClientInput {
  company_name: string
  short_name?: string | null
  address?: string | null
  notes?: string | null
  contact?: ContactInput | null
  brand_name?: string | null
}
type Result<T = object> = ({ error: null } & T) | { error: string }

function contactError(c: ContactInput): string | null {
  if (!clean(c.name)) return '担当者の名前を入力してください'
  if (clean(c.email) && !EMAIL.test(clean(c.email)!)) return 'メールアドレスの形を確認してください'
  return null
}

async function staffClient() {
  const supabase = await createClient()
  const accessError = await requireSalesAccess(supabase)
  return { supabase, accessError }
}

function refresh(clientId?: string) {
  revalidatePath('/clients')
  if (clientId) revalidatePath(`/clients/${clientId}`)
  revalidatePath('/deals/new')
}

/** 新規取引先（担当者1人・ブランド1つまで同時に登録できる）。 */
export async function createClientWithContact(input: NewClientInput): Promise<Result<{ clientId: string; contactId: string | null; brandId: string | null }>> {
  const company = clean(input.company_name)
  if (!company) return { error: '会社名を入力してください' }
  const contact = input.contact && clean(input.contact.name) ? input.contact : null
  if (input.contact && !contact && (clean(input.contact.email) || clean(input.contact.phone))) return { error: '担当者の名前を入力してください' }
  if (contact) { const e = contactError(contact); if (e) return { error: e } }
  const { supabase, accessError } = await staffClient()
  if (accessError) return { error: accessError }

  const { data: row, error } = await supabase.from('clients').insert({
    company_name: company,
    short_name: clean(input.short_name),
    address: clean(input.address),
    notes: clean(input.notes),
    // 旧画面（アカウント管理）でも同じ担当者が見えるよう、代表の1人分は従来の欄にも入れる
    contact_name: contact ? clean(contact.name) : null,
    email: contact ? clean(contact.email) : null,
    contact_phone: contact ? clean(contact.phone) : null,
  }).select('id').single()
  if (error || !row) return { error: error?.message || '取引先を登録できませんでした' }

  let contactId: string | null = null
  if (contact) {
    const { data: c, error: ce } = await supabase.from('client_contacts').insert({
      client_id: row.id, name: clean(contact.name), email: clean(contact.email), phone: clean(contact.phone), role: clean(contact.role), is_primary: true,
    }).select('id').single()
    if (ce || !c) return { error: `取引先は登録できましたが、担当者を登録できませんでした（${ce?.message || '理由不明'}）。取引先の画面から担当者を追加してください。` }
    contactId = c.id
  }
  let brandId: string | null = null
  if (clean(input.brand_name)) {
    const { data: b, error: be } = await supabase.from('brands').insert({ client_id: row.id, name: clean(input.brand_name) }).select('id').single()
    if (be || !b) return { error: `取引先は登録できましたが、ブランドを登録できませんでした（${be?.message || '理由不明'}）。取引先の画面からブランドを追加してください。` }
    brandId = b.id
  }
  refresh(row.id)
  return { error: null, clientId: row.id, contactId, brandId }
}

export async function updateClientBasics(clientId: string, input: { company_name: string; short_name?: string | null; address?: string | null; notes?: string | null }): Promise<Result> {
  if (!UUID.test(clientId)) return { error: '取引先が見つかりません' }
  const company = clean(input.company_name)
  if (!company) return { error: '会社名を入力してください' }
  const { supabase, accessError } = await staffClient()
  if (accessError) return { error: accessError }
  const { error } = await supabase.from('clients').update({
    company_name: company, short_name: clean(input.short_name), address: clean(input.address), notes: clean(input.notes), updated_at: new Date().toISOString(),
  }).eq('id', clientId)
  if (error) return { error: error.message }
  refresh(clientId)
  return { error: null }
}

export async function addContact(clientId: string, input: ContactInput): Promise<Result<{ contactId: string }>> {
  if (!UUID.test(clientId)) return { error: '取引先が見つかりません' }
  const e = contactError(input); if (e) return { error: e }
  const { supabase, accessError } = await staffClient()
  if (accessError) return { error: accessError }
  const { count, error: countError } = await supabase.from('client_contacts').select('id', { count: 'exact', head: true }).eq('client_id', clientId)
  if (countError) return { error: countError.message }
  const { data, error } = await supabase.from('client_contacts').insert({
    client_id: clientId, name: clean(input.name), email: clean(input.email), phone: clean(input.phone), role: clean(input.role), notes: clean(input.notes),
    is_primary: (count || 0) === 0, // 最初の1人は自動で主担当
  }).select('id').single()
  if (error || !data) return { error: error?.message || '担当者を登録できませんでした' }
  refresh(clientId)
  return { error: null, contactId: data.id }
}

export async function updateContact(contactId: string, clientId: string, input: ContactInput): Promise<Result> {
  if (!UUID.test(contactId) || !UUID.test(clientId)) return { error: '担当者が見つかりません' }
  const e = contactError(input); if (e) return { error: e }
  const { supabase, accessError } = await staffClient()
  if (accessError) return { error: accessError }
  const { error } = await supabase.from('client_contacts').update({
    name: clean(input.name), email: clean(input.email), phone: clean(input.phone), role: clean(input.role), notes: clean(input.notes), updated_at: new Date().toISOString(),
  }).eq('id', contactId).eq('client_id', clientId)
  if (error) return { error: error.message }
  refresh(clientId)
  return { error: null }
}

/** 主担当の付け替え。1社に1人だけなので、先に今の主担当を外してから付ける。 */
export async function setPrimaryContact(contactId: string, clientId: string): Promise<Result> {
  if (!UUID.test(contactId) || !UUID.test(clientId)) return { error: '担当者が見つかりません' }
  const { supabase, accessError } = await staffClient()
  if (accessError) return { error: accessError }
  const { data: target, error: findError } = await supabase.from('client_contacts').select('id').eq('id', contactId).eq('client_id', clientId).maybeSingle()
  if (findError || !target) return { error: '担当者がこの取引先に登録されていません' }
  const { error: offError } = await supabase.from('client_contacts').update({ is_primary: false }).eq('client_id', clientId).eq('is_primary', true)
  if (offError) return { error: offError.message }
  const { error } = await supabase.from('client_contacts').update({ is_primary: true }).eq('id', contactId)
  if (error) return { error: `主担当を付け替えられませんでした（${error.message}）。もう一度お試しください。` }
  refresh(clientId)
  return { error: null }
}

export async function deleteContact(contactId: string, clientId: string): Promise<Result> {
  if (!UUID.test(contactId) || !UUID.test(clientId)) return { error: '担当者が見つかりません' }
  const { supabase, accessError } = await staffClient()
  if (accessError) return { error: accessError }
  const { error } = await supabase.from('client_contacts').delete().eq('id', contactId).eq('client_id', clientId)
  if (error) return { error: error.message }
  refresh(clientId)
  return { error: null }
}

export async function addBrand(clientId: string, name: string): Promise<Result<{ brandId: string }>> {
  if (!UUID.test(clientId)) return { error: '取引先が見つかりません' }
  if (!clean(name)) return { error: 'ブランド名を入力してください' }
  const { supabase, accessError } = await staffClient()
  if (accessError) return { error: accessError }
  const { data, error } = await supabase.from('brands').insert({ client_id: clientId, name: clean(name) }).select('id').single()
  if (error || !data) return { error: error?.code === '23505' ? '同じ名前のブランドが既に登録されています' : error?.message || 'ブランドを登録できませんでした' }
  refresh(clientId)
  return { error: null, brandId: data.id }
}

export async function deleteBrand(brandId: string, clientId: string): Promise<Result> {
  if (!UUID.test(brandId) || !UUID.test(clientId)) return { error: 'ブランドが見つかりません' }
  const { supabase, accessError } = await staffClient()
  if (accessError) return { error: accessError }
  const { count, error: countError } = await supabase.from('deals').select('id', { count: 'exact', head: true }).eq('brand_id', brandId)
  if (countError) return { error: countError.message }
  if ((count || 0) > 0) return { error: `このブランドは案件 ${count}件で使われているため削除できません` }
  const { error } = await supabase.from('brands').delete().eq('id', brandId).eq('client_id', clientId)
  if (error) return { error: error.message }
  refresh(clientId)
  return { error: null }
}
