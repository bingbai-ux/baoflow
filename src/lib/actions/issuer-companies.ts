'use server'

// 発行元の会社マスター（帳票の発行元。ロゴ・角印・インボイス登録番号・振込先を会社ごとに登録して選ぶ）。

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSalesAccess } from './deal-access'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TEXT = ['postal_code', 'address', 'phone', 'email', 'registration_number', 'bank_name', 'branch_name', 'account_type', 'account_number', 'account_holder'] as const
export type IssuerTextField = typeof TEXT[number]
export interface IssuerCompany extends Record<IssuerTextField, string | null> {
  id: string; name: string; logo_data: string | null; stamp_data: string | null; is_default: boolean; archived: boolean
  /** 請求書の発行に足りない項目 */
  missing: string[]
}
/** 請求書の発行元として選べる会社（画像なしの軽い形） */
export interface IssuerChoice { id: string; name: string; isDefault: boolean; missing: string[] }
const NEED: Array<[IssuerTextField, string]> = [['address', '住所'], ['bank_name', '銀行名'], ['branch_name', '支店名'], ['account_type', '口座種別'], ['account_number', '口座番号'], ['account_holder', '口座名義']]
const gaps = (row: Record<string, unknown>) => NEED.filter(([k]) => !String(row[k] ?? '').trim()).map(([, label]) => label)
const refresh = () => { revalidatePath('/settings/companies'); revalidatePath('/deals', 'layout') }

export async function listIssuerCompanies(): Promise<IssuerCompany[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('issuer_companies').select(`id, name, ${TEXT.join(', ')}, logo_data, stamp_data, is_default, archived_at`).order('is_default', { ascending: false }).order('created_at')
  if (error) throw new Error('Issuer companies could not be loaded')
  return ((data || []) as unknown as Array<Record<string, unknown>>).map(r => ({ ...(r as unknown as IssuerCompany), archived: r.archived_at != null, missing: gaps(r) }))
}

export async function listIssuerChoices(): Promise<IssuerChoice[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('issuer_companies').select(`id, name, is_default, archived_at, ${NEED.map(([k]) => k).join(', ')}`).order('is_default', { ascending: false }).order('created_at')
  if (error) throw new Error('Issuer companies could not be loaded')
  return ((data || []) as unknown as Array<Record<string, unknown>>).filter(r => r.archived_at == null).map(r => ({ id: String(r.id), name: String(r.name), isDefault: !!r.is_default, missing: gaps(r) }))
}

/** 帳票の署名に使う、既定の会社の名前。未登録なら例外（黙って別の名前を使わない）。 */
export async function defaultIssuerName(): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('issuer_companies').select('name, archived_at').eq('is_default', true).limit(1)
  const row = (data || []).find(r => r.archived_at == null)
  if (error || !row) throw new Error('Default issuer company is not registered')
  return row.name
}

export async function saveIssuerCompany(input: { id?: string; name: string; archived?: boolean; logo_data?: string | null; stamp_data?: string | null } & Partial<Record<IssuerTextField, string>>): Promise<{ error: string | null; id?: string }> {
  if (input.id && !UUID.test(input.id)) return { error: '会社が見つかりません' }
  const supabase = await createClient()
  const accessError = await requireSalesAccess(supabase)
  if (accessError) return { error: accessError }
  const payload: Record<string, unknown> = { id: input.id || null, name: input.name, archived: !!input.archived }
  for (const k of TEXT) payload[k] = input[k] ?? ''
  if ('logo_data' in input) payload.logo_data = input.logo_data
  if ('stamp_data' in input) payload.stamp_data = input.stamp_data
  const { data, error } = await supabase.rpc('save_issuer_company', { p_payload: payload })
  if (error || !data?.success) return { error: error?.message || '保存できませんでした' }
  refresh()
  return { error: null, id: data.id }
}

export async function setDefaultIssuerCompany(id: string): Promise<{ error: string | null }> {
  if (!UUID.test(id || '')) return { error: '会社が見つかりません' }
  const supabase = await createClient()
  const accessError = await requireSalesAccess(supabase)
  if (accessError) return { error: accessError }
  const { data, error } = await supabase.rpc('set_default_issuer_company', { p_id: id })
  if (error || !data?.success) return { error: error?.message || '変更できませんでした' }
  refresh()
  return { error: null }
}
