'use server'

// 再設計 工程2: 商品マスター（種類・形状・ディテールの3階層と、素材・印刷の色数・付属品の選択肢）。

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSalesAccess } from './deal-access'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export type OptionKind = 'material' | 'print_colors' | 'accessory'
export interface OptionItem { id: string; kind: OptionKind; name: string; sort: number }
const KINDS: OptionKind[] = ['material', 'print_colors', 'accessory']
type Result<T = object> = ({ error: null } & T) | { error: string }
const refresh = () => { revalidatePath('/settings/product-master'); revalidatePath('/deals', 'layout') }

async function staff() {
  const supabase = await createClient()
  return { supabase, accessError: await requireSalesAccess(supabase) }
}

export async function listOptionItems(): Promise<OptionItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('product_option_items').select('id, kind, name, sort').order('sort').order('name')
  if (error) throw new Error('Product options could not be loaded')
  return (data || []) as OptionItem[]
}

export async function addOptionItem(kind: OptionKind, name: string): Promise<Result<{ item: OptionItem }>> {
  if (!KINDS.includes(kind)) return { error: '選択肢の種類を確認してください' }
  if (!name?.trim()) return { error: '名前を入力してください' }
  const { supabase, accessError } = await staff()
  if (accessError) return { error: accessError }
  const { data, error } = await supabase.from('product_option_items').insert({ kind, name: name.trim() }).select('id, kind, name, sort').single()
  if (error || !data) return { error: error?.code === '23505' ? '同じ名前が既にあります' : error?.message || '追加できませんでした' }
  refresh()
  return { error: null, item: data as OptionItem }
}

export async function renameOptionItem(id: string, name: string): Promise<Result> {
  if (!UUID.test(id)) return { error: '選択肢が見つかりません' }
  if (!name?.trim()) return { error: '名前を入力してください' }
  const { supabase, accessError } = await staff()
  if (accessError) return { error: accessError }
  const { error } = await supabase.from('product_option_items').update({ name: name.trim() }).eq('id', id)
  if (error) return { error: error.code === '23505' ? '同じ名前が既にあります' : error.message }
  refresh()
  return { error: null }
}

export async function deleteOptionItem(id: string): Promise<Result> {
  if (!UUID.test(id)) return { error: '選択肢が見つかりません' }
  const { supabase, accessError } = await staff()
  if (accessError) return { error: accessError }
  const { error } = await supabase.from('product_option_items').delete().eq('id', id)
  if (error) return { error: error.message }
  refresh()
  return { error: null }
}

export async function renameCatalogNode(id: string, name: string): Promise<Result> {
  if (!UUID.test(id)) return { error: '分類が見つかりません' }
  if (!name?.trim()) return { error: '名前を入力してください' }
  const { supabase, accessError } = await staff()
  if (accessError) return { error: accessError }
  const { error } = await supabase.from('product_catalog').update({ name: name.trim() }).eq('id', id)
  if (error) return { error: error.code === '23505' ? '同じ名前が既にあります' : error.message }
  refresh()
  return { error: null }
}

/** 分類の削除。下の階層（形状・ディテール）も一緒に消える。登録済みの商品に書かれた分類名はそのまま残る。 */
export async function deleteCatalogNode(id: string): Promise<Result> {
  if (!UUID.test(id)) return { error: '分類が見つかりません' }
  const { supabase, accessError } = await staff()
  if (accessError) return { error: accessError }
  const { error } = await supabase.from('product_catalog').delete().eq('id', id)
  if (error) return { error: error.message }
  refresh()
  return { error: null }
}
