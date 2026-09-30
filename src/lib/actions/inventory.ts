'use server'

// Sprint 10: 在庫管理(社内MVP)。
// 物流センター切替に伴い、入庫→在庫→出庫を BAO Flow の台帳で管理する。
// 数量の変更は必ず inventory_transactions への追記で行い(取消は逆仕訳)、
// 現在庫 quantity_on_hand は DB トリガーが維持する(migration 031)。

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { inventoryRpcError, isInventoryInteger } from '@/lib/utils/inventory-validation'

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
  if (!isInventoryInteger(input.first_quantity, 1) || (input.first_cartons != null && !isInventoryInteger(input.first_cartons, 0))) {
    return { success: false, error: '入庫数量は1以上、カートン数は0以上の整数で入力してください' }
  }
  const { data, error } = await supabase.rpc('create_inventory_item_atomic', { p_input: input })
  if (error) return { success: false, error: inventoryRpcError(error) }
  const item = data as { itemId: string }

  revalidatePath('/inventory')
  return { success: true, itemId: item.itemId }
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

  if (!Number.isInteger(input.quantity) || input.quantity === 0 || Math.abs(input.quantity) > 2147483647 || (input.cartons_delta != null && (!Number.isInteger(input.cartons_delta) || Math.abs(input.cartons_delta) > 2147483647))) {
    return { success: false, error: '数量は0以外の整数、カートン数は整数で入力してください' }
  }
  const { error } = await supabase.rpc('record_inventory_transaction_atomic', { p_input: input })
  if (error) return { success: false, error: inventoryRpcError(error) }

  revalidatePath('/inventory')
  return { success: true }
}

/** Sprint 13: 商品写真アップロード (deal-images バケットを流用、公開URL) */
export async function uploadInventoryItemPhoto(
  itemId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string; url?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'ログインしてください' }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { success: false, error: 'ファイルを選択してください' }
  if (!file.type.startsWith('image/'))
    return { success: false, error: '画像ファイルを選択してください' }
  if (file.size > 10 * 1024 * 1024)
    return { success: false, error: '10MB以下の画像にしてください' }

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
  const path = `inventory/${itemId}/${Date.now()}.${ext}`
  const { error: upErr } = await supabase.storage.from('deal-images').upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (upErr) return { success: false, error: upErr.message }

  const {
    data: { publicUrl },
  } = supabase.storage.from('deal-images').getPublicUrl(path)

  const { error } = await supabase
    .from('inventory_items')
    .update({ thumbnail_url: publicUrl })
    .eq('id', itemId)
    .select('id')
    .single()
  if (error) return { success: false, error: error.message }

  revalidatePath('/inventory')
  revalidatePath('/portal')
  revalidatePath('/logistics')
  return { success: true, url: publicUrl }
}

/** Sprint 13: クライアント別の保管料単価 (円/CTN・月) を clients.storage_rate_config に保存 */
export async function updateClientStorageRate(
  clientId: string,
  monthlyPerCarton: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const rate = Number(monthlyPerCarton)
  if (!Number.isFinite(rate) || rate < 0)
    return { success: false, error: '単価は0以上で入力してください' }
  const { data: current } = await supabase
    .from('clients')
    .select('storage_rate_config')
    .eq('id', clientId)
    .single()
  const cfg = { ...((current?.storage_rate_config as Record<string, unknown>) || {}), monthly_per_carton: rate }
  const { error } = await supabase
    .from('clients')
    .update({ storage_rate_config: cfg })
    .eq('id', clientId)
    .select('id')
    .single()
  if (error) return { success: false, error: error.message }
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
    .select('id')
    .single()
  if (error) return { success: false, error: error.message }
  revalidatePath('/inventory')
  return { success: true }
}
