'use server'

import { createClient as createSupabase } from '@/lib/supabase/server'
import type { SearchHit } from './search-types'

export async function searchAll(query: string): Promise<SearchHit[]> {
  const supabase = await createSupabase()
  const q = (query || '').trim().toLowerCase()
  const escape = (s: string) => s.replace(/[%_]/g, (m) => `\\${m}`)

  const hits: SearchHit[] = []

  // Deals
  let dealsQ = supabase
    .from('deals')
    .select('id, deal_code, deal_name, client_name_text, simple_status, last_activity_at')
    .order('last_activity_at', { ascending: false })
    .limit(8)
  if (q) {
    const e = escape(q)
    dealsQ = dealsQ.or(
      `deal_name.ilike.%${e}%,deal_code.ilike.%${e}%,client_name_text.ilike.%${e}%`
    )
  }
  const { data: deals } = await dealsQ
  for (const d of deals || []) {
    hits.push({
      kind: 'deal',
      id: d.id,
      title: d.deal_name || '(案件名未設定)',
      sub: `${d.deal_code} · ${d.client_name_text || ''}`.trim(),
      badge: shortStatus(d.simple_status),
      href: `/deals/${d.id}`,
    })
  }

  // Clients
  let clientsQ = supabase
    .from('clients')
    .select('id, company_name, short_name, industry')
    .order('company_name', { ascending: true })
    .limit(6)
  if (q) {
    const e = escape(q)
    clientsQ = clientsQ.or(
      `company_name.ilike.%${e}%,short_name.ilike.%${e}%,brand_name.ilike.%${e}%`
    )
  }
  const { data: clients } = await clientsQ
  for (const c of clients || []) {
    hits.push({
      kind: 'client',
      id: c.id,
      title: c.short_name || c.company_name,
      sub: c.industry || 'クライアント',
      badge: '取引先',
      href: `/master?tab=clients&id=${c.id}`,
    })
  }

  // Factories
  let factoriesQ = supabase
    .from('factories')
    .select('id, factory_name, name_cn, contact_name')
    .order('factory_name', { ascending: true })
    .limit(6)
  if (q) {
    const e = escape(q)
    factoriesQ = factoriesQ.or(
      `factory_name.ilike.%${e}%,name_cn.ilike.%${e}%,contact_name.ilike.%${e}%`
    )
  }
  const { data: factories } = await factoriesQ
  for (const f of factories || []) {
    hits.push({
      kind: 'factory',
      id: f.id,
      title: f.factory_name,
      sub: [f.name_cn, f.contact_name].filter(Boolean).join(' · ') || '工場',
      badge: '工場',
      href: `/master?tab=factories&id=${f.id}`,
    })
  }

  return hits
}

function shortStatus(s: string): string {
  const m: Record<string, string> = {
    quoting: '見積',
    quote_confirmed: '確定',
    paid: '入金',
    data_confirmed: 'データ',
    in_production: '製作',
    shipped: '発送',
    delivered: '納品',
  }
  return m[s] || s
}
