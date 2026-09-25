'use client'

// Sprint 12: 在庫画面のタブ (スタッフ用)。
// 在庫台帳 / 入庫予定(輸送追跡・検収) / 出荷依頼 / 発送履歴 / 保管料。

import { useState } from 'react'
import { InventoryClient } from './inventory-client'
import { InboundSection } from './inbound-section'
import { RequestsSection } from './requests-section'
import { ShippingHistory } from './shipping-history'
import { StorageFeeSection } from './storage-fee'
import type { InventoryItemRow, OutboundHistoryRow } from '@/lib/actions/inventory'
import type { InboundShipmentRow } from '@/lib/actions/inbound'
import type { ShipmentRequestRow } from '@/lib/actions/shipment-requests'

interface ClientOpt {
  id: string
  company_name: string
  short_name: string | null
  storage_rate_config?: Record<string, unknown> | null
}
interface DealOpt {
  id: string
  deal_code: string
  deal_name: string | null
}

export type InventoryTab = 'stock' | 'inbound' | 'requests' | 'shipping' | 'fees'

interface Props {
  initialTab: InventoryTab
  prefillDealId?: string | null
  items: InventoryItemRow[]
  clients: ClientOpt[]
  deals: DealOpt[]
  shipments: InboundShipmentRow[]
  requests: ShipmentRequestRow[]
  outbound: OutboundHistoryRow[]
}

export function InventoryTabs({
  initialTab,
  prefillDealId,
  items,
  clients,
  deals,
  shipments,
  requests,
  outbound,
}: Props) {
  const [tab, setTab] = useState<InventoryTab>(initialTab)

  const inTransit = shipments.filter((s) => s.status === 'in_transit').length
  const openReq = requests.filter((r) => r.status === 'requested' || r.status === 'confirmed').length

  const TABS: Array<{ id: InventoryTab; label: string; badge?: number }> = [
    { id: 'stock', label: '在庫台帳', badge: items.length },
    { id: 'inbound', label: '入庫予定', badge: inTransit },
    { id: 'requests', label: '出荷依頼', badge: openReq },
    { id: 'shipping', label: '発送履歴' },
    { id: 'fees', label: '保管料' },
  ]

  return (
    <div>
      <div className="flex gap-1.5 flex-wrap mt-4 mb-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-3.5 py-1.5 text-[12px] font-bold border ${
              tab === t.id
                ? 'bg-[#351E28] text-[#C9A2B8] border-[#351E28]'
                : 'bg-white text-[#351E28] border-[#E2E1DA] hover:bg-[#FBFAF6]'
            }`}
          >
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span className="fc-num ml-1.5 opacity-80">{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'stock' && <InventoryClient items={items} clients={clients} deals={deals} />}
      {tab === 'inbound' && (
        <InboundSection
          shipments={shipments}
          clients={clients}
          items={items}
          prefillDealId={prefillDealId}
        />
      )}
      {tab === 'requests' && <RequestsSection requests={requests} mode="staff" />}
      {tab === 'shipping' && <ShippingHistory txs={outbound} />}
      {tab === 'fees' && <StorageFeeSection items={items} clients={clients} />}
    </div>
  )
}
