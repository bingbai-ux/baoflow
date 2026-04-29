// Pure types for deal pane data — kept outside 'use server' file.

import type { DealCommunication, SimpleStatus } from '@/lib/types'

export interface DealPaneData {
  deal: {
    id: string
    deal_code: string
    deal_name: string | null
    client_name_text: string | null
    desired_delivery_date: string | null
    memo: string | null
    simple_status: SimpleStatus
    created_at: string
    last_activity_at: string | null
    sales_user?: { display_name: string | null } | null
  }
  products: unknown[]
  variants: unknown[]
  quotes: unknown[]
  fees: unknown[]
  designFiles: unknown[]
  statusHistory: unknown[]
  communications: DealCommunication[]
}
