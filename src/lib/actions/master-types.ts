// Pure type exports for clients / factories / staff actions.
// Kept in a separate file (no 'use server') so client components can import
// types without confusing the React Server Components bundler — which drops
// client-manifest entries for components when 'use client' files import
// types from 'use server' files (root cause of digest 3559434938).

import type { UserRole } from '@/lib/types'

export interface ClientRollup {
  client_id: string
  deal_count: number
  in_progress_count: number
  approved_total_jpy: number
  recent_deals: Array<{
    id: string
    deal_code: string
    deal_name: string | null
    simple_status: string
    last_activity_at: string
    approved_total_jpy: number
  }>
}

export interface FactoryRollup {
  factory_id: string
  quote_count: number
  approved_quote_count: number
  avg_lead_days: number | null
}

export interface StaffInput {
  display_name?: string | null
  role?: UserRole
  language_preference?: string | null
}

export interface StaffRollup {
  staff_id: string
  deal_count: number
  in_progress_count: number
  approved_total_jpy: number
  recent_deals: Array<{
    id: string
    deal_code: string
    deal_name: string | null
    simple_status: string
    last_activity_at: string
    approved_total_jpy: number
  }>
}
