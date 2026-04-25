'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getInventoryItems(clientId?: string) {
  const supabase = await createClient()

  let query = supabase
    .from('inventory_items')
    .select(`
      *,
      client:clients(company_name),
      product:deals(deal_name, specifications:deal_specifications(product_name))
    `)
    .order('created_at', { ascending: false })

  if (clientId) {
    query = query.eq('client_id', clientId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching inventory:', error)
    return []
  }

  return data || []
}

export async function getInventoryMovements(inventoryItemId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('inventory_movements')
    .select('*')
    .eq('inventory_item_id', inventoryItemId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching movements:', error)
    return []
  }

  return data || []
}

interface ShipmentOrderData {
  inventoryItemId: string
  quantity: number
  deliveryAddress: string
  requestedDate?: string
  notes?: string
}

export async function createShipmentOrder(data: ShipmentOrderData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  try {
    // Get inventory item details
    const { data: item } = await supabase
      .from('inventory_items')
      .select('client_id, current_stock')
      .eq('id', data.inventoryItemId)
      .single()

    if (!item) {
      return { error: 'Inventory item not found' }
    }

    if ((item.current_stock || 0) < data.quantity) {
      return { error: 'Insufficient quantity' }
    }

    // Generate order code
    const date = new Date()
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
    const { count } = await supabase
      .from('shipment_orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', date.toISOString().slice(0, 10))

    const orderCode = `SO-${dateStr}-${String((count || 0) + 1).padStart(3, '0')}`

    const { data: order, error } = await supabase
      .from('shipment_orders')
      .insert({
        order_code: orderCode,
        inventory_item_id: data.inventoryItemId,
        client_id: item.client_id,
        quantity: data.quantity,
        delivery_address: data.deliveryAddress,
        requested_date: data.requestedDate,
        notes: data.notes,
        status: 'pending',
        requested_by: user.id,
      })
      .select()
      .single()

    if (error) throw error

    revalidatePath('/inventory/shipment-orders')
    revalidatePath('/portal/inventory')

    return { success: true, order }
  } catch (error) {
    console.error('Create shipment order error:', error)
    return { error: 'Failed to create order' }
  }
}

export async function approveShipmentOrder(orderId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  try {
    // Get order details
    const { data: order } = await supabase
      .from('shipment_orders')
      .select('*, inventory_item:inventory_items(*)')
      .eq('id', orderId)
      .single()

    if (!order) {
      return { error: 'Order not found' }
    }

    const inventoryItem = Array.isArray(order.inventory_item)
      ? order.inventory_item[0]
      : order.inventory_item

    // Update order status
    const { error: updateError } = await supabase
      .from('shipment_orders')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    if (updateError) throw updateError

    // Record outgoing movement
    await recordOutgoing({
      inventoryItemId: order.inventory_item_id,
      quantity: order.quantity,
      orderId: orderId,
      notes: `出庫依頼 ${order.order_code}`,
    })

    revalidatePath('/inventory/shipment-orders')
    revalidatePath('/inventory')

    return { success: true }
  } catch (error) {
    console.error('Approve order error:', error)
    return { error: 'Failed to approve order' }
  }
}

interface MovementData {
  inventoryItemId: string
  quantity: number
  orderId?: string
  dealId?: string
  notes?: string
}

export async function recordIncoming(data: MovementData) {
  const supabase = await createClient()

  try {
    // Create movement record
    const { error: movementError } = await supabase.from('inventory_movements').insert({
      inventory_item_id: data.inventoryItemId,
      movement_type: 'incoming',
      quantity: data.quantity,
      source_type: data.dealId ? 'deal' : null,
      source_id: data.dealId || null,
      notes: data.notes,
    })

    if (movementError) throw movementError

    // Update current stock
    const { data: item } = await supabase
      .from('inventory_items')
      .select('current_stock')
      .eq('id', data.inventoryItemId)
      .single()

    const newStock = (item?.current_stock || 0) + data.quantity

    const { error: updateError } = await supabase
      .from('inventory_items')
      .update({ current_stock: newStock })
      .eq('id', data.inventoryItemId)

    if (updateError) throw updateError

    revalidatePath('/inventory')

    return { success: true }
  } catch (error) {
    console.error('Record incoming error:', error)
    return { error: 'Failed to record incoming' }
  }
}

export async function recordOutgoing(data: MovementData) {
  const supabase = await createClient()

  try {
    // Create movement record
    const { error: movementError } = await supabase.from('inventory_movements').insert({
      inventory_item_id: data.inventoryItemId,
      movement_type: 'outgoing',
      quantity: data.quantity,
      source_type: data.orderId ? 'shipment_order' : null,
      source_id: data.orderId || null,
      notes: data.notes,
    })

    if (movementError) throw movementError

    // Update current stock
    const { data: item } = await supabase
      .from('inventory_items')
      .select('current_stock')
      .eq('id', data.inventoryItemId)
      .single()

    const newStock = Math.max(0, (item?.current_stock || 0) - data.quantity)

    const { error: updateError } = await supabase
      .from('inventory_items')
      .update({ current_stock: newStock })
      .eq('id', data.inventoryItemId)

    if (updateError) throw updateError

    revalidatePath('/inventory')

    return { success: true }
  } catch (error) {
    console.error('Record outgoing error:', error)
    return { error: 'Failed to record outgoing' }
  }
}

export async function getShipmentOrders(status?: string) {
  const supabase = await createClient()

  let query = supabase
    .from('shipment_orders')
    .select(`
      *,
      client:clients(company_name),
      inventory_item:inventory_items(
        product_name,
        current_stock
      )
    `)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching shipment orders:', error)
    return []
  }

  return data || []
}
