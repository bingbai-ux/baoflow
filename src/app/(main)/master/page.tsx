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
import { listStaff, getStaff, getStaffRollup } from '@/lib/actions/staff'
import { MasterShell } from '@/components/master/master-shell'

interface Props {
  searchParams: Promise<{ tab?: string; id?: string }>
}

export default async function MasterPage({ searchParams }: Props) {
  const params = await searchParams
  const tab: 'clients' | 'factories' | 'staff' =
    params.tab === 'factories' ? 'factories' : params.tab === 'staff' ? 'staff' : 'clients'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [clients, factories, staff] = await Promise.all([
    listClients(),
    listFactories(),
    listStaff(),
  ])

  // Aggregate per-client approved totals + in-progress counts
  const dealToClient = new Map<string, string>() // O(1) reverse lookup deal_id → client_id
  const inProgressByClient = new Map<string, number>()
  const inProgressByStaff = new Map<string, number>()
  const { data: deals } = await supabase
    .from('deals')
    .select('id, client_id, sales_user_id, simple_status')
  for (const d of deals || []) {
    if (d.client_id) {
      dealToClient.set(d.id, d.client_id)
      if (d.simple_status !== 'delivered') {
        inProgressByClient.set(d.client_id, (inProgressByClient.get(d.client_id) || 0) + 1)
      }
    }
    if (d.sales_user_id && d.simple_status !== 'delivered') {
      inProgressByStaff.set(d.sales_user_id, (inProgressByStaff.get(d.sales_user_id) || 0) + 1)
    }
  }
  const allDealIds = Array.from(dealToClient.keys())
  const approvedByClient = new Map<string, number>()
  if (allDealIds.length > 0) {
    const { data: quotes } = await supabase
      .from('deal_quotes')
      .select('deal_id, total_billing_tax_jpy')
      .in('deal_id', allDealIds)
      .eq('status', 'approved')
    for (const q of quotes || []) {
      const cid = dealToClient.get(q.deal_id)
      if (cid) {
        approvedByClient.set(cid, (approvedByClient.get(cid) || 0) + (Number(q.total_billing_tax_jpy) || 0))
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

  const staffWithStats = staff.map((s) => ({
    ...s,
    in_progress_count: inProgressByStaff.get(s.id) || 0,
  }))

  // Selected detail
  let selectedClient = null
  let selectedFactory = null
  let selectedStaff = null
  if (params.id) {
    if (tab === 'clients') {
      const c = await getClient(params.id)
      if (c) {
        const rollup = await getClientRollup(params.id)
        selectedClient = { client: c, rollup }
      }
    } else if (tab === 'factories') {
      const f = await getFactory(params.id)
      if (f) {
        const rollup = await getFactoryRollup(params.id)
        selectedFactory = { factory: f, rollup }
      }
    } else if (tab === 'staff') {
      const s = await getStaff(params.id)
      if (s) {
        const rollup = await getStaffRollup(params.id)
        selectedStaff = { staff: s, rollup }
      }
    }
  }

  return (
    <>
      <div className="py-[18px]">
        <h1 className="font-display text-[22px] font-semibold text-[#0a0a0a] tracking-tight">マスター</h1>
        <p className="text-[11px] text-[#888] font-body mt-1">クライアント・工場・担当者の登録、編集、取引履歴管理</p>
      </div>

      <MasterShell
        tab={tab}
        clients={clientsWithTotal}
        factories={factoriesWithStats}
        staff={staffWithStats}
        selectedClient={selectedClient}
        selectedFactory={selectedFactory}
        selectedStaff={selectedStaff}
      />
    </>
  )
}
