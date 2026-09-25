'use server'

// Sprint 13: ポータル向けの限定データ取得 (SECURITY DEFINER RPC ラッパー)。

import { createClient } from '@/lib/supabase/server'

export interface PortalDeal {
  id: string
  deal_code: string
  deal_name: string | null
  simple_status: string
  desired_delivery_date: string | null
  last_activity_at: string
}

export async function portalMyDeals(): Promise<PortalDeal[]> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('portal_my_deals')
  return (data || []) as PortalDeal[]
}

export interface FactoryRfqEntry {
  invitation_id: string
  rfq_number: string | null
  response_deadline: string | null
  request_message: string | null
  invitation_sent_at: string | null
  responded_at: string | null
  form_token: string | null
  form_status: string | null
  product_count: number
}

export async function portalFactoryRfqs(): Promise<FactoryRfqEntry[]> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('portal_factory_rfqs')
  return (data || []) as FactoryRfqEntry[]
}
