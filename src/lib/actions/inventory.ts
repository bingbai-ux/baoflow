'use server'

// Sprint 10: 在庫管理(社内MVP)。
// 物流センター切替に伴い、入庫→在庫→出庫を BAO Flow の台帳で管理する。
// 数量の変更は必ず inventory_transactions への追記で行い(取消は逆仕訳)、
// 現在庫 quantity_on_hand は DB トリガーが維持する(migration 031)。

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export interface InventoryItemRow {
  id: string
  client_id: string | null
  deal_id: string | null
  product_id: string | null
  item_name: string
  item_code: string | null
  spec_note: string | null
  unit: string
  quantity_on_hand: number
  cartons_on_hand: number | null
  warehouse_name: string | null
  location_note: string | null
  thumbnail_url: string | null
  first_arrived_at: string | null
  note: string | null
  created_at: string
  updated_at: string
  client?: { company_name: string; short_name: string | null } | null
  deal?: { deal_code: string; deal_name: string | null } | null
}

export interface InventoryTxRow {
  id: string
  item_id: string
  tx_type: 'inbound' | 'outbound' | 'adjust'
  quantity_delta: number
  occurred_on: string
  destination: string | null
  note: string | null
  created_at: string
}

export async function listInventory(): Promise<{
  items: InventoryItemRow[]
  error: string | null
}> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inventory_items')
    .select(
      `*,
       client:clients(company_name, short_name),
       deal:deals(deal_code, deal_name)`
    )
    .order('updated_at', { ascending: false })
  if (error) return { items: [], error: error.message }
  return { items: (data || []) as InventoryItemRow[], error: null }
}

export interface OutboundHistoryRow {
  id: string
  item_id: string
  quantity_delta: number
  occurred_on: string
  destination: string | null
  note: string | null
  created_at: string
  item?: { item_name: string; unit: string; client_id: string | null } | null
}

/** 発送履歴 (出庫仕訳)。RLS によりクライアントは自社分のみ返る。 */
export async function listOutboundHistory(): Promise<{
  txs: OutboundHistoryRow[]
  error: string | null
}> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inventory_transactions')
    .select('id, item_id, quantity_delta, occurred_on, destination, note, created_at, item:inventory_items(item_name, unit, client_id)')
    .eq('tx_type', 'outbound')
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return { txs: [], error: error.message }
  return { txs: (data || []) as unknown as OutboundHistoryRow[], error: null }
}

export async function listItemTransactions(
  itemId: string
): Promise<{ txs: InventoryTxRow[]; error: string | null }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inventory_transactions')
    .select('id, item_id, tx_type, quantity_delta, occurred_on, destination, note, created_at')
    .eq('item_id', itemId)
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return { txs: [], error: error.message }
  return { txs: (data || []) as InventoryTxRow[], error: null }
}

export interface CreateInventoryItemInput {
  client_id?: string | null
  deal_id?: string | null
  item_name: string
  item_code?: string | null
  spec_note?: string | null
  unit?: string
  warehouse_name?: string | null
  location_note?: string | null
  first_quantity: number
  first_cartons?: number | null
  first_arrived_at?: string | null
  note?: string | null
}

export async function createInventoryItem(
  input: CreateInventoryItemInput
): Promise<{ success: boolean; error?: string; itemId?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'ログインしてください' }

  if (!input.item_name?.trim()) return { success: false, error: '商品名を入力してください' }
  const qty = Math.floor(Number(input.first_quantity))
  if (!Number.isFinite(qty) || qty <= 0)
    return { success: false, error: '入庫数量は1以上の整数で入力してください' }

  const { data: item, error } = await supabase
    .from('inventory_items')
    .insert({
      client_id: input.client_id || null,
      deal_id: input.deal_id || null,
      item_name: input.item_name.trim(),
      item_code: input.item_code?.trim() || null,
      spec_note: input.spec_note?.trim() || null,
      unit: input.unit?.trim() || '個',
      cartons_on_hand: input.first_cartons ?? null,
      warehouse_name: input.warehouse_name?.trim() || null,
      location_note: input.location_note?.trim() || null,
      first_arrived_at: input.first_arrived_at || null,
      note: input.note?.trim() || null,
      created_by: user.id,
    })
    .select('id')
    .single()
  if (error || !item) return { success: false, error: error?.message || '登録に失敗しました' }

  // 初回入庫を台帳に記録(quantity_on_hand はトリガーが加算)
  const { error: txError } = await supabase.from('inventory_transactions').insert({
    item_id: item.id,
    tx_type: 'inbound',
    quantity_delta: qty,
    occurred_on: input.first_arrived_at || new Date().toISOString().slice(0, 10),
    note: '初回入庫',
    created_by: user.id,
  })
  if (txError) return { success: false, error: `入庫記録に失敗: ${txError.message}` }

  revalidatePath('/inventory')
  return { success: true, itemId: item.id }
}

export async function recordInventoryTransaction(input: {
  item_id: string
  tx_type: 'inbound' | 'outbound' | 'adjust'
  quantity: number
  occurred_on?: string | null
  destination?: string | null
  note?: string | null
  cartons_delta?: number | null
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'ログインしてください' }

  const q = Math.floor(Number(input.quantity))
  if (!Number.isFinite(q) || q === 0)
    return { success: false, error: '数量は0以外の整数で入力してください' }

  // inbound は正、outbound は負に正規化。adjust は入力の符号どおり。
  const delta =
    input.tx_type === 'inbound' ? Math.abs(q) : input.tx_type === 'outbound' ? -Math.abs(q) : q

  if (input.tx_type === 'outbound') {
    const { data: item } = await supabase
      .from('inventory_items')
      .select('quantity_on_hand, item_name')
      .eq('id', input.item_id)
      .single()
    if (item && item.quantity_on_hand + delta < 0) {
      return {
        success: false,
        error: `在庫が足りません(現在 ${item.quantity_on_hand})。数量を確認してください`,
      }
    }
  }

  const { error } = await supabase.from('inventory_transactions').insert({
    item_id: input.item_id,
    tx_type: input.tx_type,
    quantity_delta: delta,
    occurred_on: input.occurred_on || new Date().toISOString().slice(0, 10),
    destination: input.destination?.trim() || null,
    note: input.note?.trim() || null,
    created_by: user.id,
  })
  if (error) return { success: false, error: error.message }

  // カートン数はアイテム側の目安値として上書き更新(任意)
  if (input.cartons_delta != null && Number.isFinite(Number(input.cartons_delta))) {
    const { data: item } = await supabase
      .from('inventory_items')
      .select('cartons_on_hand')
      .eq('id', input.item_id)
      .single()
    const next = Math.max(0, (item?.cartons_on_hand || 0) + Math.floor(Number(input.cartons_delta)))
    await supabase.from('inventory_items').update({ cartons_on_hand: next }).eq('id', input.item_id)
  }

  revalidatePath('/inventory')
  return { success: true }
}

export async function updateInventoryItemField(
  itemId: string,
  field: string,
  value: string | null
): Promise<{ success: boolean; error?: string }> {
  const allowed = new Set([
    'item_name', 'item_code', 'spec_note', 'unit',
    'warehouse_name', 'location_note', 'note',
  ])
  if (!allowed.has(field)) return { success: false, error: 'forbidden field' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('inventory_items')
    .update({ [field]: value })
    .eq('id', itemId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/inventory')
  return { success: true }
}
