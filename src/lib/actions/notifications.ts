'use server'

import { createClient as createSupabase } from '@/lib/supabase/server'
import type { NotifItem } from './notifications-types'

const URGENT_DAYS = 14
const STALE_DAYS = 5

function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / 86400000)
}

export async function listNotifications(): Promise<NotifItem[]> {
  const supabase = await createSupabase()
  const today = new Date()

  const { data: deals } = await supabase
    .from('deals')
    .select('id, deal_code, deal_name, simple_status, desired_delivery_date, last_activity_at')
    .neq('simple_status', 'delivered')

  const items: NotifItem[] = []

  for (const d of deals || []) {
    // Urgent: delivery within 14 days
    if (d.desired_delivery_date) {
      const dueDays = daysBetween(today, new Date(d.desired_delivery_date))
      if (dueDays >= 0 && dueDays <= URGENT_DAYS) {
        items.push({
          id: `urgent-${d.id}`,
          kind: 'urgent',
          icon: '⚠',
          title: `${d.deal_code} 納期${dueDays}日切迫`,
          body: `${d.deal_name || '案件'} — ${formatJpDate(d.desired_delivery_date)}納品予定`,
          when: relativeTime(today),
          dealId: d.id,
        })
      }
    }
    // Stale: no update in 5+ days
    if (d.last_activity_at) {
      const stale = daysBetween(new Date(d.last_activity_at), today)
      if (stale >= STALE_DAYS) {
        items.push({
          id: `stale-${d.id}`,
          kind: 'stale',
          icon: '●',
          title: `${d.deal_code} 状態が停滞`,
          body: `${labelOf(d.simple_status)}のまま${stale}日経過 — 確認を`,
          when: `${stale}日前`,
          dealId: d.id,
        })
      }
    }
  }

  // Sort: urgent first, then stale
  items.sort((a, b) => {
    if (a.kind === 'urgent' && b.kind !== 'urgent') return -1
    if (b.kind === 'urgent' && a.kind !== 'urgent') return 1
    return 0
  })

  return items.slice(0, 20)
}

function labelOf(s: string): string {
  const m: Record<string, string> = {
    quoting: '見積中',
    quote_confirmed: '見積確定',
    paid: '入金完了',
    data_confirmed: 'データ確認完了',
    in_production: '製作中',
    shipped: '工場発送完了',
    delivered: '納品完了',
  }
  return m[s] || s
}

function formatJpDate(s: string): string {
  const d = new Date(s)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function relativeTime(_now: Date): string {
  return '今'
}
