import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { listInventory, listOutboundHistory } from '@/lib/actions/inventory'
import { listInboundShipments } from '@/lib/actions/inbound'
import { listShipmentRequests } from '@/lib/actions/shipment-requests'
import { InventoryTabs, type InventoryTab } from '@/components/inventory/inventory-tabs'

// Sprint 12: 在庫保管サービス (スタッフ)。
// 在庫台帳 / 入庫予定(輸送追跡・検収) / 出荷依頼 / 発送履歴 / 保管料。

interface Props {
  searchParams: Promise<{ tab?: string; deal?: string }>
}

export default async function InventoryPage({ searchParams }: Props) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ items }, { data: clients }, { data: deals }, inb, reqs, out] = await Promise.all([
    listInventory(),
    supabase.from('clients').select('id, company_name, short_name, storage_rate_config').order('company_name'),
    supabase
      .from('deals')
      .select('id, deal_code, deal_name')
      .is('archived_at', null)
      .order('last_activity_at', { ascending: false })
      .limit(100),
    listInboundShipments(),
    listShipmentRequests(),
    listOutboundHistory(),
  ])

  const valid: InventoryTab[] = ['stock', 'inbound', 'requests', 'shipping', 'fees']
  const initialTab = valid.includes(params.tab as InventoryTab)
    ? (params.tab as InventoryTab)
    : 'stock'

  return (
    <InventoryTabs
      initialTab={initialTab}
      prefillDealId={params.deal || null}
      items={items}
      clients={clients || []}
      deals={deals || []}
      shipments={inb.shipments}
      requests={reqs.requests}
      outbound={out.txs}
    />
  )
}
