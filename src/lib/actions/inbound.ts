'use server'

// Sprint 12: 入庫予定 (輸送追跡 → 着荷検収 → 入庫)。
// スタッフとロジ会社の両方が操作できる (RLS: staff_full_access / logistics_access)。
// 検収確定で inventory_items(無ければ新規) + inventory_transactions(inbound) を作る。

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'ログインしてください' }

  const lines = (input.lines || []).filter(
    (l) => l.item_name?.trim() && Number(l.expected_quantity) > 0
  )
  if (lines.length === 0)
    return { success: false, error: '商品名と数量を1行以上入力してください' }

  const { data: shipment, error } = await supabase
    .from('inbound_shipments')
    .insert({
      shipment_no: genShipmentNo(),
      client_id: input.client_id || null,
      deal_id: input.deal_id || null,
      carrier_name: input.carrier_name?.trim() || null,
      tracking_number: input.tracking_number?.trim() || null,
      eta_date: input.eta_date || null,
      shipped_on: input.shipped_on || null,
      note: input.note?.trim() || null,
      created_by: user.id,
    })
    .select('id')
    .single()
  if (error || !shipment) return { success: false, error: error?.message || '作成に失敗しました' }

  const { error: lineErr } = await supabase.from('inbound_shipment_items').insert(
    lines.map((l) => ({
      shipment_id: shipment.id,
      item_id: l.item_id || null,
      item_name: l.item_name.trim(),
      expected_quantity: Math.floor(Number(l.expected_quantity)),
      expected_cartons: l.expected_cartons != null ? Math.floor(Number(l.expected_cartons)) : null,
    }))
  )
  if (lineErr) return { success: false, error: lineErr.message }

  revalidatePath('/inventory')
  revalidatePath('/logistics')
  return { success: true }
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

  const { data: shipment } = await supabase
    .from('inbound_shipments')
    .select('id, status, client_id, deal_id, shipment_no, tracking_number')
    .eq('id', shipmentId)
    .single()
  if (!shipment) return { success: false, error: '入庫予定が見つかりません' }
  if (shipment.status !== 'in_transit')
    return { success: false, error: 'この入庫予定は既に処理済みです' }

  const { data: lines } = await supabase
    .from('inbound_shipment_items')
    .select('*')
    .eq('shipment_id', shipmentId)
  const byId = new Map((lines || []).map((l) => [l.id, l]))

  const today = new Date().toISOString().slice(0, 10)

  for (const r of received) {
    const line = byId.get(r.line_id)
    if (!line) continue
    const qty = Math.floor(Number(r.received_quantity))
    if (!Number.isFinite(qty) || qty < 0)
      return { success: false, error: '受入数は0以上の整数で入力してください' }

    let itemId = line.item_id as string | null
    if (!itemId && qty > 0) {
      // 新規アイテムとして登録
      const { data: item, error: itemErr } = await supabase
        .from('inventory_items')
        .insert({
          client_id: shipment.client_id,
          deal_id: shipment.deal_id,
          item_name: line.item_name,
          cartons_on_hand: line.expected_cartons,
          first_arrived_at: today,
          created_by: user.id,
        })
        .select('id')
        .single()
      if (itemErr || !item) return { success: false, error: itemErr?.message || '在庫登録に失敗' }
      itemId = item.id
      await supabase.from('inbound_shipment_items').update({ item_id: itemId }).eq('id', line.id)
    }

    if (itemId && qty > 0) {
      const { error: txErr } = await supabase.from('inventory_transactions').insert({
        item_id: itemId,
        tx_type: 'inbound',
        quantity_delta: qty,
        occurred_on: today,
        deal_id: shipment.deal_id,
        note: `入庫予定 ${shipment.shipment_no} 検収${shipment.tracking_number ? ` (追跡 ${shipment.tracking_number})` : ''}`,
        created_by: user.id,
      })
      if (txErr) return { success: false, error: txErr.message }
    }

    await supabase
      .from('inbound_shipment_items')
      .update({ received_quantity: qty })
      .eq('id', line.id)
  }

  const { error: updErr } = await supabase
    .from('inbound_shipments')
    .update({ status: 'received', received_at: new Date().toISOString(), received_by: user.id })
    .eq('id', shipmentId)
  if (updErr) return { success: false, error: updErr.message }

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
  if (error) return { success: false, error: error.message }
  revalidatePath('/inventory')
  revalidatePath('/logistics')
  return { success: true }
}
