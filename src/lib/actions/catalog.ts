'use server'

// Sprint 14: 商品カタログ (大分類/中分類/小分類のプリセット + スタッフ追加)。

import { createClient } from '@/lib/supabase/server'

export interface CatalogNode {
  id: string
  level: 1 | 2 | 3
  parent_id: string | null
  name: string
  sort: number
  icon_key: string | null
}

export async function listCatalog(): Promise<CatalogNode[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('product_catalog')
    .select('id, level, parent_id, name, sort, icon_key')
    .order('level', { ascending: true })
    .order('sort', { ascending: true })
    .order('name', { ascending: true })
  return (data || []) as CatalogNode[]
}

export async function addCatalogNode(input: {
  level: 1 | 2 | 3
  parent_id: string | null
  name: string
}): Promise<{ node: CatalogNode | null; error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { node: null, error: 'ログインしてください' }
  const name = input.name?.trim()
  if (!name) return { node: null, error: '名前を入力してください' }

  const { data, error } = await supabase
    .from('product_catalog')
    .insert({
      level: input.level,
      parent_id: input.parent_id,
      name,
      sort: 500, // 追加分はプリセットの後ろ
      created_by: user.id,
    })
    .select('id, level, parent_id, name, sort, icon_key')
    .single()
  if (error) {
    if (error.code === '23505') return { node: null, error: '同じ名前が既にあります' }
    return { node: null, error: error.message }
  }
  return { node: data as CatalogNode, error: null }
}
