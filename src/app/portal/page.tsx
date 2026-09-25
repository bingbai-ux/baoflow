// Sprint 12: クライアントポータル本実装。
// 自社在庫のリアルタイム閲覧 / 発注 (出荷依頼) / 発注履歴 / 入庫予定 / 発送履歴。
// データは RLS (client_read_own / client_insert_own) で自社分のみに絞られる。

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PortalShell } from '@/components/external/portal-shell'
import { ClientPortal } from '@/components/portal/client-portal'
import { listInventory } from '@/lib/actions/inventory'
import { listOutboundHistory } from '@/lib/actions/inventory'
import { listShipmentRequests } from '@/lib/actions/shipment-requests'
import { listInboundShipments } from '@/lib/actions/inbound'

export default async function PortalHome() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/portal/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, email, client_id')
    .eq('id', user.id)
    .single()

  const shell = {
    title: 'クライアント様ページ',
    loginPath: '/portal/login',
    userLabel: profile?.display_name || profile?.email || null,
  }

  if (!profile?.client_id) {
    return (
      <PortalShell {...shell}>
        <div className="bg-white rounded-[16px] border p-8" style={{ borderColor: 'rgba(229,163,46,0.25)' }}>
          <h1 className="font-display text-[18px] font-bold mb-2">アカウントの紐付けが未完了です</h1>
          <p className="text-[13px] leading-relaxed">
            このアカウントはまだ会社に紐付いていません。(bao) の担当者から届いた
            <b>招待リンク</b>を開いて有効化するか、担当者にご連絡ください。
          </p>
        </div>
      </PortalShell>
    )
  }

  const [{ data: client }, inv, reqs, inb, out] = await Promise.all([
    supabase.from('clients').select('company_name, short_name').eq('id', profile.client_id).single(),
    listInventory(),
    listShipmentRequests(),
    listInboundShipments(),
    listOutboundHistory(),
  ])

  return (
    <PortalShell {...shell}>
      <ClientPortal
        clientName={client?.short_name || client?.company_name || 'お客'}
        items={inv.items}
        requests={reqs.requests}
        inbound={inb.shipments}
        outbound={out.txs}
      />
    </PortalShell>
  )
}
