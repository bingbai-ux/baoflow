'use server'

// Sprint 12: 入庫予定 (輸送追跡 → 着荷検収 → 入庫)。
// スタッフとロジ会社の両方が操作できる (RLS: staff_full_access / logistics_access)。
// 検収確定で inventory_items(無ければ新規) + inventory_transactions(inbound) を作る。

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { inventoryRpcError, isInventoryInteger } from '@/lib/utils/inventory-validation'

export interface InboundLine {
  id: string
  shipment_id: string
  item_id: string | null
  item_name: string
  expected_quantity: number
  expected_cartons: number | null
  received_quantity: number | null
  note: string | null
}

export interface InboundShipmentRow {
  id: string
  shipment_no: string
  client_id: string | null
  deal_id: string | null
  carrier_name: string | null
  tracking_number: string | null
  status: 'in_transit' | 'received' | 'cancelled'
  eta_date: string | null
  shipped_on: string | null
  received_at: string | null
  note: string | null
  created_at: string
  client?: { company_name: string; short_name: string | null } | null
  deal?: { deal_code: string } | null
  lines: InboundLine[]
}

function genShipmentNo(): string {
  const d = new Date()
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `IB-${ymd}-${rand}`
}

export async function listInboundShipments(): Promise<{
  shipments: InboundShipmentRow[]
  error: string | null
}> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inbound_shipments')
    .select(
      `*,
       client:clients(company_name, short_name),
       deal:deals(deal_code),
       lines:inbound_shipment_items(*)`
    )
    .order('created_at', { ascending: false })
    .limit(60)
  if (error) return { shipments: [], error: error.message }
  return { shipments: (data || []) as InboundShipmentRow[], error: null }
}

export interface CreateInboundInput {
  request_key?: string | null
  purchase_order_id?: string | null
  client_id?: string | null
  deal_id?: string | null
  carrier_name?: string | null
  tracking_number?: string | null
  eta_date?: string | null
  shipped_on?: string | null
  note?: string | null
  lines: Array<{
    item_id?: string | null
    item_name: string
    expected_quantity: number
    expected_cartons?: number | null
  }>
}

export async function createInboundShipment(
  input: CreateInboundInput
): Promise<{ success: boolean; error?: string; shipmentId?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'ログインしてください' }

  if (!input.lines?.length || input.lines.some((l) => !l.item_name?.trim() || !isInventoryInteger(l.expected_quantity, 1) || (l.expected_cartons != null && !isInventoryInteger(l.expected_cartons, 0)))) {
    return { success: false, error: '商品名と1以上の整数数量を入力してください。カートン数は0以上の整数です' }
  }
  const { data, error } = await supabase.rpc('create_inbound_shipment_atomic', {
    p_input: input, p_shipment_no: genShipmentNo(),
  })
  if (error) return { success: false, error: inventoryRpcError(error) }

  revalidatePath('/inventory')
  revalidatePath('/logistics')
  return { success: true, shipmentId: data?.shipmentId }
}

/**
 * 着荷検収: 各行の実受入数を確定し、在庫アイテム(無ければ新規)+入庫仕訳を作成。
 * expected と同数なら「OK」、違えば修正した数で確定する。
 */
export async function receiveInboundShipment(
  shipmentId: string,
  received: Array<{ line_id: string; received_quantity: number }>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'ログインしてください' }

  if (!received.length || received.some((r) => !r.line_id || !isInventoryInteger(r.received_quantity, 0)) || new Set(received.map((r) => r.line_id)).size !== received.length) {
    return { success: false, error: '各明細を一度ずつ選び、受入数を0以上の整数で入力してください' }
  }
  const { error } = await supabase.rpc('receive_inbound_shipment_atomic', {
    p_shipment_id: shipmentId, p_received: received,
  })
  if (error) return { success: false, error: inventoryRpcError(error) }

  revalidatePath('/inventory')
  revalidatePath('/logistics')
  return { success: true }
}

export async function cancelInboundShipment(
  shipmentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('inbound_shipments')
    .update({ status: 'cancelled' })
    .eq('id', shipmentId)
    .eq('status', 'in_transit')
    .select('id')
    .single()
  if (error) return { success: false, error: error.message }
  revalidatePath('/inventory')
  revalidatePath('/logistics')
  return { success: true }
}

/** 追跡番号だけあとから入れる/直す (輸送会社から連絡が来たとき) */
export async function updateInboundField(
  shipmentId: string,
  field: 'tracking_number' | 'carrier_name' | 'eta_date' | 'note',
  value: string | null
): Promise<{ success: boolean; error?: string }> {
  const allowed = new Set(['tracking_number', 'carrier_name', 'eta_date', 'note'])
  if (!allowed.has(field)) return { success: false, error: 'forbidden field' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('inbound_shipments')
    .update({ [field]: value || null })
    .eq('id', shipmentId)
    .select('id')
    .single()
  if (error) return { success: false, error: error.message }
  revalidatePath('/inventory')
  revalidatePath('/logistics')
  return { success: true }
}
