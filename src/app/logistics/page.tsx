// Sprint 12: ロジ会社(倉庫)ポータル本実装。
// 入庫予定の追跡・検収 / 手動入庫 / 出荷依頼の処理 / 発送履歴 / 在庫一覧。
// role='logistics' のみ (middleware + RLS logistics_access)。

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PortalShell } from '@/components/external/portal-shell'
import { LogisticsPortal } from '@/components/portal/logistics-portal'
import { listInventory, listOutboundHistory } from '@/lib/actions/inventory'
import { listInboundShipments } from '@/lib/actions/inbound'
import { listShipmentRequests } from '@/lib/actions/shipment-requests'

export default async function LogisticsHome() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/logistics/login')

  const [{ data: profile }, inv, inb, reqs, out, { data: clientsRaw }] = await Promise.all([
    supabase.from('profiles').select('display_name, email').eq('id', user.id).single(),
    listInventory(),
    listInboundShipments(),
    listShipmentRequests(),
    listOutboundHistory(),
    supabase.from('clients').select('id, company_name, short_name').order('company_name'),
  ])

  return (
    <PortalShell
      title="物流パートナーページ"
      wide
      loginPath="/logistics/login"
      userLabel={profile?.display_name || profile?.email || null}
    >
      <LogisticsPortal
        shipments={inb.shipments}
        requests={reqs.requests}
        items={inv.items}
        clients={clientsRaw || []}
        outbound={out.txs}
      />
    </PortalShell>
  )
}
