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

// ---- カタログからAIで読み取った候補のうち、画面で選ばれたものをマスターに登録する ----

const KIND_OF = { materials: 'material', print_colors: 'print_colors', accessories: 'accessory' } as const
const same = (a: string, b: string) => a.normalize('NFKC').trim().toLowerCase() === b.normalize('NFKC').trim().toLowerCase()

export async function importCatalogCandidates(picked: { categories: Array<{ l1: string; l2: string | null; l3: string | null }>; materials: string[]; print_colors: string[]; accessories: string[] }): Promise<Result<{ added: number }>> {
  const { supabase, accessError } = await staff()
  if (accessError) return { error: accessError }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'ログインし直してください' }
  const text = (v: unknown) => typeof v === 'string' ? v.trim().slice(0, 60) : ''
  const categories = (Array.isArray(picked?.categories) ? picked.categories : []).slice(0, 60).map(c => ({ l1: text(c?.l1), l2: text(c?.l2) || null, l3: text(c?.l3) || null })).filter(c => c.l1)
  const lists = Object.fromEntries((Object.keys(KIND_OF) as Array<keyof typeof KIND_OF>).map(k => [k, (Array.isArray(picked?.[k]) ? picked[k] : []).slice(0, 40).map(text).filter(Boolean)])) as Record<keyof typeof KIND_OF, string[]>
  if (!categories.length && !Object.values(lists).some(l => l.length)) return { error: '登録するものを選んでください' }

  const [catalog, options] = await Promise.all([supabase.from('product_catalog').select('id, level, parent_id, name'), supabase.from('product_option_items').select('kind, name')])
  if (catalog.error || options.error) return { error: '登録済みのマスターを読み込めませんでした' }
  const nodes = [...(catalog.data || [])] as Array<{ id: string; level: number; parent_id: string | null; name: string }>
  let added = 0
  // 同じ名前が既にあればそれを使い、無ければ足す（上の階層から順に）
  const ensure = async (level: 1 | 2 | 3, parent: string | null, name: string): Promise<string> => {
    const found = nodes.find(n => n.level === level && (n.parent_id || null) === parent && same(n.name, name))
    if (found) return found.id
    const { data, error } = await supabase.from('product_catalog').insert({ level, parent_id: parent, name, sort: 500, created_by: user.id }).select('id, level, parent_id, name').single()
    if (error || !data) throw new Error(`「${name}」を登録できませんでした`)
    nodes.push(data as { id: string; level: number; parent_id: string | null; name: string }); added += 1
    return data.id
  }
  try {
    for (const c of categories) {
      const id1 = await ensure(1, null, c.l1)
      const id2 = c.l2 ? await ensure(2, id1, c.l2) : null
      if (id2 && c.l3) await ensure(3, id2, c.l3)
    }
    for (const key of Object.keys(KIND_OF) as Array<keyof typeof KIND_OF>) {
      for (const name of lists[key]) {
        if ((options.data || []).some(o => o.kind === KIND_OF[key] && same(o.name, name))) continue
        const { error } = await supabase.from('product_option_items').insert({ kind: KIND_OF[key], name })
        if (error && error.code !== '23505') throw new Error(`「${name}」を登録できませんでした`)
        if (!error) added += 1
      }
    }
  } catch (e) {
    refresh()
    return { error: `${e instanceof Error ? e.message : '登録できませんでした'}（ここまでの ${added}件は登録済みです）` }
  }
  refresh()
  return { error: null, added }
}
