// Pure type exports for staff actions.
// Kept in a separate file (no 'use server') so client components can import
// types without confusing the React Server Components bundler — which has
// been observed to drop client-manifest entries for components when
// 'use client' files import types from 'use server' files.

import type { UserRole } from '@/lib/types'

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
