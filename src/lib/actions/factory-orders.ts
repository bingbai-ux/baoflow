'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSalesAccess } from './deal-access'
import { createInboundShipment } from './inbound'
import { inventoryRpcError } from '@/lib/utils/inventory-validation'

export interface FactoryOrderRow {
  id: string
  order_no: string
  source_quote_id: string | null
  deal_id: string
  factory_id: string
  quantity: number
  unit_price_usd: number
  expected_delivery_date: string | null
  status: 'ordered' | 'cancelled'
  snapshot: { item_name?: string; pcs_per_carton?: number; [key: string]: unknown }
  created_at: string
  factory?: { factory_name: string } | null
}

export async function listFactoryOrders(dealId?: string): Promise<{ orders: FactoryOrderRow[]; error: string | null }> {
  const supabase = await createClient()
  let query = supabase.from('factory_purchase_orders').select('*,factory:factories(factory_name)').order('created_at', { ascending: false })
  if (dealId) query = query.eq('deal_id', dealId)
  const { data, error } = await query
  return { orders: (data || []) as FactoryOrderRow[], error: error ? inventoryRpcError(error) : null }
}

/** Approval and immutable factory-facing purchase snapshot; does not send email. */
export async function createFactoryOrder(quoteId: string, factoryId: string): Promise<{ success: boolean; error?: string; orderId?: string }> {
  const supabase = await createClient()
  const accessError = await requireSalesAccess(supabase)
  if (accessError) return { success: false, error: accessError }
  const orderNo = `PO-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`
  const { data, error } = await supabase.rpc('create_factory_order_atomic', { p_quote_id: quoteId, p_factory_id: factoryId, p_order_no: orderNo })
  if (error) return { success: false, error: inventoryRpcError(error) }
  if (!data?.success || !data.orderId) return { success: false, error: '工場発注を確認できませんでした' }
  revalidatePath(`/deals/${data.dealId}`)
  revalidatePath('/factory')
  return { success: true, orderId: data.orderId }
}

/** One order line → one inbound plan. Existing plans are counted in the atomic RPC. */
export async function createInboundForFactoryOrder(orderId: string, input?: { requestKey?: string; quantity?: number; tracking_number?: string; carrier_name?: string; eta_date?: string }): Promise<{ success: boolean; error?: string; shipmentId?: string }> {
  const supabase = await createClient()
  const accessError = await requireSalesAccess(supabase)
  if (accessError) return { success: false, error: accessError }
  const { data: order, error } = await supabase.from('factory_purchase_orders').select('*').eq('id', orderId).single()
  if (error || !order) return { success: false, error: '工場発注が見つかりません' }
  const snapshot = order.snapshot as FactoryOrderRow['snapshot']
  const quantity = input?.quantity ?? order.quantity
  const result = await createInboundShipment({
    purchase_order_id: order.id, deal_id: order.deal_id,
    request_key: input?.requestKey || (quantity === order.quantity ? `${order.id}:full` : null),
    tracking_number: input?.tracking_number, carrier_name: input?.carrier_name,
    eta_date: input?.eta_date || order.expected_delivery_date,
    lines: [{ item_name: snapshot.item_name || '発注商品', expected_quantity: quantity,
      expected_cartons: typeof snapshot.pcs_per_carton === 'number' && snapshot.pcs_per_carton > 0 ? Math.ceil(quantity / snapshot.pcs_per_carton) : null }],
  })
  if (result.success) revalidatePath(`/deals/${order.deal_id}`)
  return result
}
