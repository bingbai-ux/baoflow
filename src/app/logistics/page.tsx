import Link from 'next/link'
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

  const [{ data: profile }, inv, inb, reqs, out, { data: clientsRaw, error: clientsError }] = await Promise.all([
    supabase.from('profiles').select('display_name, email').eq('id', user.id).single(),
    listInventory(),
    listInboundShipments(),
    listShipmentRequests(),
    listOutboundHistory(),
    supabase.from('clients').select('id, company_name, short_name').order('company_name'),
  ])

  if ([inv.error, inb.error, reqs.error, out.error, clientsError].some(Boolean)) throw new Error('物流データを取得できませんでした')

  return (
    <PortalShell
      title="物流パートナーページ"
      wide
      loginPath="/logistics/login"
      userLabel={profile?.display_name || profile?.email || null}
    >
      <nav aria-label="案件・請求の確認" className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-[13px]">
      <Link href="/logistics/messages" className="underline min-h-11 inline-flex items-center">営業との案件別会話</Link>
      <Link href="/logistics/shipments" className="underline min-h-11 inline-flex items-center">担当輸送・食品検査を確認</Link>
      </nav>
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
