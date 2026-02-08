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
  note?: string
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

  revalidatePath('/deals')
  revalidatePath(`/deals/${id}`)
  revalidatePath('/')
  return { data, error: null }
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
