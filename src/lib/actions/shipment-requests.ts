'use server'

// Sprint 12: 出荷依頼 (クライアントの「発注」)。
// クライアント: 自社の依頼を作成・閲覧 (RLS client_insert_own / client_read_own)
// スタッフ/ロジ会社: 確認 → 出荷 (出庫仕訳) → 納品完了 / 却下
// 出荷時に inventory_transactions(outbound) を作り、在庫不足はエラーにする。

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { inventoryRpcError, isInventoryInteger } from '@/lib/utils/inventory-validation'

export type RequestStatus = 'requested' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'

export interface ShipmentRequestItemRow {
  id: string
  request_id: string
  item_id: string
  quantity: number
  note: string | null
  item?: { item_name: string; unit: string; quantity_on_hand: number } | null
}

export interface ShipmentRequestRow {
  id: string
  request_no: string
  client_id: string
  status: RequestStatus
  destination_name: string | null
  destination_address: string | null
  desired_date: string | null
  note: string | null
  shipped_at: string | null
  created_at: string
  client?: { company_name: string; short_name: string | null } | null
  requester?: { display_name: string | null; email: string | null } | null
  items: ShipmentRequestItemRow[]
}

function genRequestNo(): string {
  const d = new Date()
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `SR-${ymd}-${rand}`
}

export async function listShipmentRequests(): Promise<{
  requests: ShipmentRequestRow[]
  error: string | null
}> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('shipment_requests')
    .select(
      `*,
       client:clients(company_name, short_name),
       requester:profiles!shipment_requests_requested_by_fkey(display_name, email),
       items:shipment_request_items(*, item:inventory_items(item_name, unit, quantity_on_hand))`
    )
    .order('created_at', { ascending: false })
    .limit(80)
  if (error) return { requests: [], error: error.message }
  return { requests: (data || []) as ShipmentRequestRow[], error: null }
}

export interface CreateRequestInput {
  client_id?: string | null // 省略時は自分の client_id (クライアントポータル)
  destination_name: string
  destination_address?: string | null
  desired_date?: string | null
  note?: string | null
  items: Array<{ item_id: string; quantity: number; note?: string | null }>
}

export async function createShipmentRequest(
  input: CreateRequestInput
): Promise<{ success: boolean; error?: string; requestNo?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'ログインしてください' }

  if (!input.items?.length || input.items.some((i) => !i.item_id || !isInventoryInteger(i.quantity, 1))) {
    return { success: false, error: '商品を選び、数量を1以上の整数で入力してください' }
  }
  if (!input.destination_name?.trim()) return { success: false, error: 'お届け先を入力してください' }
  const requestNo = genRequestNo()
  const { error } = await supabase.rpc('create_shipment_request_atomic', {
    p_input: input, p_request_no: requestNo,
  })
  if (error) return { success: false, error: inventoryRpcError(error) }

  revalidatePath('/inventory')
  revalidatePath('/portal')
  revalidatePath('/logistics')
  return { success: true, requestNo }
}

async function setRequestStatus(
  requestId: string,
  from: RequestStatus[],
  to: RequestStatus,
  extra?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'ログインしてください' }

  const { data: current } = await supabase
    .from('shipment_requests')
    .select('status')
    .eq('id', requestId)
    .single()
  if (!current) return { success: false, error: '依頼が見つかりません' }
  if (!from.includes(current.status as RequestStatus))
    return { success: false, error: `現在の状態 (${current.status}) からは変更できません` }

  const { error } = await supabase
    .from('shipment_requests')
    .update({ status: to, ...(extra || {}) })
    .eq('id', requestId)
    .in('status', from)
    .select('id')
    .single()
  if (error) return { success: false, error: error.message }

  revalidatePath('/inventory')
  revalidatePath('/portal')
  revalidatePath('/logistics')
  return { success: true }
}

export async function confirmShipmentRequest(requestId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return setRequestStatus(requestId, ['requested'], 'confirmed', { confirmed_by: user?.id })
}

export async function cancelShipmentRequest(requestId: string) {
  return setRequestStatus(requestId, ['requested', 'confirmed'], 'cancelled')
}

export async function deliverShipmentRequest(requestId: string) {
  return setRequestStatus(requestId, ['shipped'], 'delivered')
}

/** 出荷: 在庫チェック → 出庫仕訳を全行作成 → shipped へ */
export async function shipShipmentRequest(
  requestId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'ログインしてください' }

  const { error } = await supabase.rpc('ship_shipment_request_atomic', { p_request_id: requestId })
  if (error) return { success: false, error: inventoryRpcError(error) }
  revalidatePath('/inventory')
  revalidatePath('/portal')
  revalidatePath('/logistics')
  return { success: true }
}
