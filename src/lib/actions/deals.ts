'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type {
  Deal,
  DealWithRelations,
  MasterStatus,
  CreateDealInput,
  UpdateDealInput,
} from '@/lib/types'

// System message templates for status changes
const STATUS_MESSAGES: Partial<Record<MasterStatus, { client?: string; factory?: string }>> = {
  M03: { factory: '新しい見積もり依頼があります。ご確認ください。' },
  M05: { client: '工場から見積もりが届きました。' },
  M06: { client: 'お見積書をお送りしました。ご確認ください。' },
  M08: { factory: 'クライアントから修正依頼がありました。' },
  M11: { client: 'ご承認ありがとうございます。', factory: '見積もりが承認されました。' },
  M12: { client: '請求書を発行しました。ご確認ください。' },
  M14: { client: 'ご入金を確認しました。ありがとうございます。', factory: '入金が確認されました。製造を開始してください。' },
  M17: { client: '製造を開始しました。', factory: '製造開始を記録しました。' },
  M19: { client: '製造が完了しました。発送準備を進めています。' },
  M22: { client: '発送が完了しました。', factory: '発送情報を記録しました。' },
  M24: { client: '商品が到着しました。検品を行っています。' },
  M25: { client: '納品が完了しました。ありがとうございました。', factory: '納品が完了しました。' },
}

async function postSystemMessage(
  dealId: string,
  roomType: 'client_sales' | 'sales_factory',
  content: string
) {
  const supabase = await createClient()

  const { data: room } = await supabase
    .from('chat_rooms')
    .select('id')
    .eq('deal_id', dealId)
    .eq('room_type', roomType)
    .single()

  if (!room) return

  await supabase.from('chat_messages').insert({
    room_id: room.id,
    sender_id: null,
    content,
    is_system_message: true,
  })
}

async function postStatusChangeMessages(dealId: string, newStatus: MasterStatus, trackingNumber?: string) {
  const messages = STATUS_MESSAGES[newStatus]
  if (!messages) return

  if (messages.client) {
    let content = messages.client
    if (newStatus === 'M22' && trackingNumber) {
      content = `発送が完了しました。トラッキング番号: ${trackingNumber}`
    }
    await postSystemMessage(dealId, 'client_sales', content)
  }

  if (messages.factory) {
    await postSystemMessage(dealId, 'sales_factory', messages.factory)
  }
}

// Generate deal code: PF-YYYYMM-NNN
async function generateDealCode(): Promise<string> {
  const supabase = await createClient()
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const prefix = `PF-${year}${month}-`

  const { data } = await supabase
    .from('deals')
    .select('deal_code')
    .like('deal_code', `${prefix}%`)
    .order('deal_code', { ascending: false })
    .limit(1)

  let nextNumber = 1
  if (data && data.length > 0) {
    const lastCode = data[0].deal_code
    const lastNumber = parseInt(lastCode.split('-')[2], 10)
    nextNumber = lastNumber + 1
  }

  return `${prefix}${String(nextNumber).padStart(3, '0')}`
}

export async function createDeal(input: CreateDealInput | FormData): Promise<{ data: Deal | null; error: string | null }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: 'Unauthorized' }
  }

  // Handle FormData input
  let dealData: {
    deal_name?: string | null
    client_id: string
    delivery_type?: 'direct' | 'logistics_center'
    ai_mode?: 'auto' | 'assist' | 'manual'
  }

  if (input instanceof FormData) {
    const clientId = input.get('client_id') as string
    if (!clientId) {
      return { data: null, error: 'クライアントは必須です' }
    }
    dealData = {
      deal_name: (input.get('deal_name') as string) || null,
      client_id: clientId,
      delivery_type: (input.get('delivery_type') as 'direct' | 'logistics_center') || 'direct',
      ai_mode: (input.get('ai_mode') as 'auto' | 'assist' | 'manual') || 'assist',
    }
  } else {
    dealData = {
      deal_name: input.deal_name || null,
      client_id: input.client_id,
      delivery_type: input.delivery_type || 'direct',
      ai_mode: input.ai_mode || 'assist',
    }
  }

  const dealCode = await generateDealCode()

  const { data, error } = await supabase
    .from('deals')
    .insert({
      deal_code: dealCode,
      deal_name: dealData.deal_name,
      client_id: dealData.client_id,
      sales_user_id: user.id,
      master_status: 'M01',
      win_probability: 'medium',
      delivery_type: dealData.delivery_type,
      ai_mode: dealData.ai_mode,
      last_activity_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  await supabase.from('deal_status_history').insert({
    deal_id: data.id,
    from_status: null,
    to_status: 'M01',
    changed_by: user.id,
    note: '案件作成',
  })

  // Create chat room for client-sales communication
  await supabase.from('chat_rooms').insert({
    deal_id: data.id,
    room_type: 'client_sales',
  })

  // Create chat room for sales-factory communication
  await supabase.from('chat_rooms').insert({
    deal_id: data.id,
    room_type: 'sales_factory',
  })

  revalidatePath('/deals')
  revalidatePath('/')
  return { data, error: null }
}

export async function updateDeal(
  id: string,
  input: UpdateDealInput | FormData
): Promise<{ data: Deal | null; error: string | null }> {
  const supabase = await createClient()

  // Handle FormData input
  let updateData: UpdateDealInput
  if (input instanceof FormData) {
    updateData = {}
    const deal_name = input.get('deal_name') as string
    const client_id = input.get('client_id') as string
    const delivery_type = input.get('delivery_type') as string
    const ai_mode = input.get('ai_mode') as string
    const win_probability = input.get('win_probability') as string
    const expected_delivery = input.get('expected_delivery') as string

    if (deal_name) updateData.deal_name = deal_name
    if (client_id) updateData.client_id = client_id
    if (delivery_type) updateData.delivery_type = delivery_type as 'direct' | 'logistics_center'
    if (ai_mode) updateData.ai_mode = ai_mode as 'auto' | 'assist' | 'manual'
    if (win_probability) updateData.win_probability = win_probability as 'high' | 'medium' | 'low' | 'won' | 'lost'
    if (expected_delivery) updateData.expected_delivery = expected_delivery
  } else {
    updateData = input
  }

  const { data, error } = await supabase
    .from('deals')
    .update({
      ...updateData,
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  revalidatePath('/deals')
  revalidatePath(`/deals/${id}`)
  revalidatePath('/')
  return { data, error: null }
}

export async function updateDealStatus(
  id: string,
  newStatus: MasterStatus,
  note?: string,
  options?: { trackingNumber?: string }
): Promise<{ data: Deal | null; error: string | null }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: 'Unauthorized' }
  }

  const { data: currentDeal } = await supabase
    .from('deals')
    .select('master_status')
    .eq('id', id)
    .single()

  if (!currentDeal) {
    return { data: null, error: 'Deal not found' }
  }

  const updateData: Record<string, unknown> = {
    master_status: newStatus,
    last_activity_at: new Date().toISOString(),
  }

  if (newStatus === 'M11' || newStatus >= 'M14') {
    updateData.win_probability = 'won'
  }

  const { data, error } = await supabase
    .from('deals')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  await supabase.from('deal_status_history').insert({
    deal_id: id,
    from_status: currentDeal.master_status,
    to_status: newStatus,
    changed_by: user.id,
    note: note || null,
  })

  // Post system messages to chat rooms
  await postStatusChangeMessages(id, newStatus, options?.trackingNumber)

  revalidatePath('/deals')
  revalidatePath(`/deals/${id}`)
  revalidatePath('/portal/orders')
  revalidatePath(`/portal/orders/${id}`)
  revalidatePath('/')
  return { data, error: null }
}

// Specific status transition actions
export async function sendQuoteRequest(dealId: string): Promise<{ error: string | null }> {
  const result = await updateDealStatus(dealId, 'M03', '工場に見積もり依頼を送信')
  return { error: result.error }
}

export async function presentQuoteToClient(dealId: string): Promise<{ error: string | null }> {
  const result = await updateDealStatus(dealId, 'M06', 'クライアントに見積もりを提示')
  return { error: result.error }
}

export async function issueInvoice(dealId: string): Promise<{ error: string | null }> {
  const supabase = await createClient()

  // Create invoice document record
  await supabase.from('documents').insert({
    deal_id: dealId,
    document_type: 'invoice',
    version: 1,
  })

  const result = await updateDealStatus(dealId, 'M12', '請求書発行')
  return { error: result.error }
}

export async function confirmPayment(dealId: string): Promise<{ error: string | null }> {
  const result = await updateDealStatus(dealId, 'M14', '入金確認')
  return { error: result.error }
}

export async function payFactoryAdvance(dealId: string): Promise<{ error: string | null }> {
  const supabase = await createClient()

  // Update factory payment to paid
  await supabase
    .from('deal_factory_payments')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('deal_id', dealId)
    .eq('payment_type', 'advance')

  const result = await updateDealStatus(dealId, 'M15', '工場前払い完了')
  return { error: result.error }
}

export async function confirmArrival(dealId: string): Promise<{ error: string | null }> {
  const result = await updateDealStatus(dealId, 'M24', '到着確認')
  return { error: result.error }
}

export async function completeDelivery(dealId: string): Promise<{ error: string | null }> {
  const supabase = await createClient()

  // Create delivery note document record
  await supabase.from('documents').insert({
    deal_id: dealId,
    document_type: 'delivery_note',
    version: 1,
  })

  const result = await updateDealStatus(dealId, 'M25', '納品完了')
  return { error: result.error }
}

export async function deleteDeal(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const { error } = await supabase.from('deals').delete().eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/deals')
  revalidatePath('/')
  return { error: null }
}

export async function duplicateDeal(
  id: string
): Promise<{ data: Deal | null; error: string | null }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: 'Unauthorized' }
  }

  const { data: original } = await supabase
    .from('deals')
    .select('*, deal_specifications(*)')
    .eq('id', id)
    .single()

  if (!original) {
    return { data: null, error: 'Deal not found' }
  }

  const dealCode = await generateDealCode()

  const { data: newDeal, error } = await supabase
    .from('deals')
    .insert({
      deal_code: dealCode,
      deal_name: original.deal_name ? `${original.deal_name} (リピート)` : null,
      client_id: original.client_id,
      sales_user_id: user.id,
      master_status: 'M01',
      win_probability: 'high',
      parent_deal_id: id,
      delivery_type: original.delivery_type,
      ai_mode: original.ai_mode,
      last_activity_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  if (original.deal_specifications && original.deal_specifications.length > 0) {
    const spec = original.deal_specifications[0]
    await supabase.from('deal_specifications').insert({
      deal_id: newDeal.id,
      product_category: spec.product_category,
      product_name: spec.product_name,
      height_mm: spec.height_mm,
      width_mm: spec.width_mm,
      depth_mm: spec.depth_mm,
      material_category: spec.material_category,
      material_thickness: spec.material_thickness,
      printing_method: spec.printing_method,
      print_colors: spec.print_colors,
      processing_list: spec.processing_list,
      attachments_list: spec.attachments_list,
      specification_memo: spec.specification_memo,
    })
  }

  await supabase.from('deal_status_history').insert({
    deal_id: newDeal.id,
    from_status: null,
    to_status: 'M01',
    changed_by: user.id,
    note: `リピート注文 (元案件: ${original.deal_code})`,
  })

  revalidatePath('/deals')
  revalidatePath('/')
  return { data: newDeal, error: null }
}

export async function getDeal(id: string): Promise<DealWithRelations | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('deals')
    .select(`
      *,
      client:clients(*),
      factory_assignments:deal_factory_assignments(
        *,
        factory:factories(*)
      ),
      specifications:deal_specifications(*),
      quotes:deal_quotes(
        *,
        factory:factories(*),
        shipping_options:deal_shipping_options(*)
      ),
      samples:deal_samples(*),
      payments:deal_factory_payments(*),
      design_files:deal_design_files(*),
      status_history:deal_status_history(*),
      shipping:deal_shipping(*)
    `)
    .eq('id', id)
    .single()

  return data as DealWithRelations | null
}

export interface GetDealsFilters {
  status?: MasterStatus | MasterStatus[]
  clientId?: string
  search?: string
  limit?: number
  offset?: number
}

export async function getDeals(filters?: GetDealsFilters): Promise<Deal[]> {
  const supabase = await createClient()

  let query = supabase
    .from('deals')
    .select('*, client:clients(company_name)')
    .order('created_at', { ascending: false })

  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      query = query.in('master_status', filters.status)
    } else {
      query = query.eq('master_status', filters.status)
    }
  }

  if (filters?.clientId) {
    query = query.eq('client_id', filters.clientId)
  }

  if (filters?.search) {
    query = query.or(`deal_code.ilike.%${filters.search}%,deal_name.ilike.%${filters.search}%`)
  }

  if (filters?.limit) {
    query = query.limit(filters.limit)
  }

  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1)
  }

  const { data } = await query

  return (data || []) as Deal[]
}

export async function getActiveDeals(): Promise<Deal[]> {
  const activeStatuses: MasterStatus[] = [
    'M01', 'M02', 'M03', 'M04', 'M05', 'M06', 'M07', 'M08', 'M09', 'M10',
    'M11', 'M12', 'M13', 'M14', 'M15', 'M16', 'M17', 'M18', 'M19', 'M20',
    'M21', 'M22', 'M23', 'M24',
  ]
  return getDeals({ status: activeStatuses })
}

export async function getStaleDeals(thresholdDays: number = 7): Promise<Deal[]> {
  const supabase = await createClient()

  const threshold = new Date()
  threshold.setDate(threshold.getDate() - thresholdDays)

  const { data } = await supabase
    .from('deals')
    .select('*, client:clients(company_name)')
    .lt('last_activity_at', threshold.toISOString())
    .neq('master_status', 'M25')
    .order('last_activity_at', { ascending: true })

  return (data || []) as Deal[]
}
