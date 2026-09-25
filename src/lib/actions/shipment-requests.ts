'use server'

// Sprint 12: 出荷依頼 (クライアントの「発注」)。
// クライアント: 自社の依頼を作成・閲覧 (RLS client_insert_own / client_read_own)
// スタッフ/ロジ会社: 確認 → 出荷 (出庫仕訳) → 納品完了 / 却下
// 出荷時に inventory_transactions(outbound) を作り、在庫不足はエラーにする。

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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

  // client_id: 明示指定 (スタッフ) or 自分のプロフィール (クライアント)
  let clientId = input.client_id || null
  if (!clientId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('client_id')
      .eq('id', user.id)
      .single()
    clientId = profile?.client_id || null
  }
  if (!clientId) return { success: false, error: 'クライアントが特定できません' }

  const items = (input.items || []).filter((i) => i.item_id && Number(i.quantity) > 0)
  if (items.length === 0) return { success: false, error: '商品と数量を1行以上選んでください' }
  if (!input.destination_name?.trim())
    return { success: false, error: 'お届け先を入力してください' }

  const requestNo = genRequestNo()
  const { data: req, error } = await supabase
    .from('shipment_requests')
    .insert({
      request_no: requestNo,
      client_id: clientId,
      status: 'requested',
      destination_name: input.destination_name.trim(),
      destination_address: input.destination_address?.trim() || null,
      desired_date: input.desired_date || null,
      note: input.note?.trim() || null,
      requested_by: user.id,
    })
    .select('id')
    .single()
  if (error || !req) return { success: false, error: error?.message || '作成に失敗しました' }

  const { error: itemErr } = await supabase.from('shipment_request_items').insert(
    items.map((i) => ({
      request_id: req.id,
      item_id: i.item_id,
      quantity: Math.floor(Number(i.quantity)),
      note: i.note?.trim() || null,
    }))
  )
  if (itemErr) return { success: false, error: itemErr.message }

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

  const { data: req } = await supabase
    .from('shipment_requests')
    .select('id, status, request_no, destination_name, items:shipment_request_items(id, item_id, quantity)')
    .eq('id', requestId)
    .single()
  if (!req) return { success: false, error: '依頼が見つかりません' }
  if (req.status !== 'confirmed' && req.status !== 'requested')
    return { success: false, error: `現在の状態 (${req.status}) からは出荷できません` }

  const items = (req.items || []) as Array<{ id: string; item_id: string; quantity: number }>
  if (items.length === 0) return { success: false, error: '明細がありません' }

  // 在庫チェック (全行)
  const itemIds = items.map((i) => i.item_id)
  const { data: stock } = await supabase
    .from('inventory_items')
    .select('id, item_name, quantity_on_hand')
    .in('id', itemIds)
  const stockMap = new Map((stock || []).map((s) => [s.id, s]))
  for (const line of items) {
    const s = stockMap.get(line.item_id)
    if (!s) return { success: false, error: '在庫アイテムが見つかりません' }
    if (s.quantity_on_hand < line.quantity)
      return {
        success: false,
        error: `在庫不足: ${s.item_name} (現在 ${s.quantity_on_hand} / 依頼 ${line.quantity})`,
      }
  }

  const today = new Date().toISOString().slice(0, 10)
  for (const line of items) {
    const { error: txErr } = await supabase.from('inventory_transactions').insert({
      item_id: line.item_id,
      tx_type: 'outbound',
      quantity_delta: -Math.abs(line.quantity),
      occurred_on: today,
      destination: req.destination_name,
      note: `出荷依頼 ${req.request_no}`,
      created_by: user.id,
    })
    if (txErr) return { success: false, error: txErr.message }
  }

  return setRequestStatus(requestId, ['requested', 'confirmed'], 'shipped', {
    shipped_at: new Date().toISOString(),
    shipped_by: user.id,
  })
}
