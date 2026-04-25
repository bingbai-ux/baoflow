import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  listClients,
  getClient,
  getClientRollup,
} from '@/lib/actions/clients'
import {
  listFactories,
  getFactory,
  getFactoryRollup,
} from '@/lib/actions/factories'
import { MasterShell } from '@/components/master/master-shell'

interface Props {
  searchParams: Promise<{ tab?: string; id?: string }>
}

export default async function MasterPage({ searchParams }: Props) {
  const params = await searchParams
  const tab: 'clients' | 'factories' = params.tab === 'factories' ? 'factories' : 'clients'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [clients, factories] = await Promise.all([listClients(), listFactories()])

  // Aggregate per-client approved totals + in-progress counts
  const dealIds = new Map<string, string[]>() // client_id → deal ids
  const inProgressByClient = new Map<string, number>()
  const { data: deals } = await supabase
    .from('deals')
    .select('id, client_id, simple_status')
    .not('client_id', 'is', null)
  for (const d of deals || []) {
    if (!d.client_id) continue
    const arr = dealIds.get(d.client_id) || []
    arr.push(d.id)
    dealIds.set(d.client_id, arr)
    if (d.simple_status !== 'delivered') {
      inProgressByClient.set(d.client_id, (inProgressByClient.get(d.client_id) || 0) + 1)
    }
  }
  const allDealIds = Array.from(dealIds.values()).flat()
  const approvedByClient = new Map<string, number>()
  if (allDealIds.length > 0) {
    const { data: quotes } = await supabase
      .from('deal_quotes')
      .select('deal_id, total_billing_tax_jpy')
      .in('deal_id', allDealIds)
      .eq('status', 'approved')
    for (const q of quotes || []) {
      // Find client_id for this deal
      for (const [cid, ids] of dealIds.entries()) {
        if (ids.includes(q.deal_id)) {
          approvedByClient.set(cid, (approvedByClient.get(cid) || 0) + (Number(q.total_billing_tax_jpy) || 0))
          break
        }
      }
    }
  }

  const clientsWithTotal = clients.map((c) => ({
    ...c,
    approved_total_jpy: approvedByClient.get(c.id) || 0,
    in_progress_count: inProgressByClient.get(c.id) || 0,
  }))

  // Per-factory quote count
  const factoryIds = factories.map((f) => f.id)
  const quoteCountByFactory = new Map<string, number>()
  if (factoryIds.length > 0) {
    const { data: factoryQuotes } = await supabase
      .from('deal_quotes')
      .select('factory_id')
      .in('factory_id', factoryIds)
    for (const q of factoryQuotes || []) {
      if (!q.factory_id) continue
      quoteCountByFactory.set(q.factory_id, (quoteCountByFactory.get(q.factory_id) || 0) + 1)
    }
  }
  const factoriesWithStats = factories.map((f) => ({
    ...f,
    quote_count: quoteCountByFactory.get(f.id) || 0,
  }))

  // Selected detail
  let selectedClient = null
  let selectedFactory = null
  if (params.id) {
    if (tab === 'clients') {
      const c = await getClient(params.id)
      if (c) {
        const rollup = await getClientRollup(params.id)
        selectedClient = { client: c, rollup }
      }
    } else {
      const f = await getFactory(params.id)
      if (f) {
        const rollup = await getFactoryRollup(params.id)
        selectedFactory = { factory: f, rollup }
      }
    }
  }

  return (
    <>
      <div className="py-[18px]">
        <h1 className="font-display text-[22px] font-semibold text-[#0a0a0a] tracking-tight">マスター</h1>
        <p className="text-[11px] text-[#888] font-body mt-1">クライアント・工場の登録、編集、取引履歴管理</p>
      </div>

      <MasterShell
        tab={tab}
        clients={clientsWithTotal}
        factories={factoriesWithStats}
        selectedClient={selectedClient}
        selectedFactory={selectedFactory}
      />
    </>
  )
}
