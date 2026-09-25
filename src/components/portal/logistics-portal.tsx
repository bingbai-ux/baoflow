'use client'

// Sprint 12: ロジ会社(倉庫)ポータル。
// 入庫予定の追跡・検収入庫 / 任意のクライアントを選んだ手動入庫 / 出荷依頼の出荷処理 / 発送履歴。

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { InboundSection } from '@/components/inventory/inbound-section'
import { RequestsSection } from '@/components/inventory/requests-section'
import { ShippingHistory } from '@/components/inventory/shipping-history'
import { createInventoryItem, recordInventoryTransaction } from '@/lib/actions/inventory'
import type { InventoryItemRow, OutboundHistoryRow } from '@/lib/actions/inventory'
import type { InboundShipmentRow } from '@/lib/actions/inbound'
import type { ShipmentRequestRow } from '@/lib/actions/shipment-requests'
import { useUi } from '@/components/ui/ui-store'

interface ClientOpt {
  id: string
  company_name: string
  short_name: string | null
}

interface Props {
  shipments: InboundShipmentRow[]
  requests: ShipmentRequestRow[]
  items: InventoryItemRow[]
  clients: ClientOpt[]
  outbound: OutboundHistoryRow[]
}

type Tab = 'inbound' | 'manual' | 'requests' | 'shipping' | 'stock'

const inputCls =
  'bg-[#EFEFEA] rounded-[12px] px-3 py-2 text-[12.5px] font-body text-[#351E28] border border-transparent outline-none focus:border-[#B03616] w-full'

export function LogisticsPortal({ shipments, requests, items, clients, outbound }: Props) {
  const inTransit = shipments.filter((s) => s.status === 'in_transit').length
  const pendingReq = requests.filter((r) => r.status === 'confirmed' || r.status === 'requested').length
  const [tab, setTab] = useState<Tab>('inbound')

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: 'inbound', label: `入庫予定 (${inTransit})` },
    { id: 'manual', label: '手動入庫' },
    { id: 'requests', label: `出荷依頼 (${pendingReq})` },
    { id: 'shipping', label: '発送履歴' },
    { id: 'stock', label: `在庫一覧 (${items.length})` },
  ]

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-3.5 py-1.5 text-[12px] font-bold border ${
              tab === t.id
                ? 'bg-[#351E28] text-[#C9A2B8] border-[#351E28]'
                : 'bg-white text-[#351E28] border-[#E2E1DA]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'inbound' && (
        <InboundSection shipments={shipments} clients={clients} items={items} />
      )}
      {tab === 'manual' && <ManualInbound clients={clients} items={items} />}
      {tab === 'requests' && <RequestsSection requests={requests} mode="logistics" />}
      {tab === 'shipping' && <ShippingHistory txs={outbound} />}
      {tab === 'stock' && <StockList items={items} clients={clients} />}
    </div>
  )
}

/** 入庫予定を経由しない直接入庫: クライアント → 既存商品 or 新規商品 → 数量 */
function ManualInbound({ clients, items }: { clients: ClientOpt[]; items: InventoryItemRow[] }) {
  const router = useRouter()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const [clientId, setClientId] = useState('')
  const [itemId, setItemId] = useState('')
  const [newName, setNewName] = useState('')
  const [qty, setQty] = useState('')
  const [cartons, setCartons] = useState('')
  const [note, setNote] = useState('')

  const clientItems = items.filter((i) => i.client_id === clientId)

  const submit = () =>
    startTransition(async () => {
      const q = Math.floor(Number(qty))
      if (!clientId) return toast('クライアントを選んでください', 'warn')
      if (!Number.isFinite(q) || q <= 0) return toast('数量は1以上で入力してください', 'warn')

      if (itemId) {
        const r = await recordInventoryTransaction({
          item_id: itemId,
          tx_type: 'inbound',
          quantity: q,
          note: note || '手動入庫',
          cartons_delta: cartons ? Number(cartons) : null,
        })
        if (!r.success) return toast(r.error || '入庫に失敗しました', 'warn')
      } else {
        if (!newName.trim()) return toast('新規商品名を入力してください', 'warn')
        const r = await createInventoryItem({
          client_id: clientId,
          item_name: newName,
          first_quantity: q,
          first_cartons: cartons ? Number(cartons) : null,
          note: note || null,
        })
        if (!r.success) return toast(r.error || '登録に失敗しました', 'warn')
      }
      toast('入庫を記録しました')
      setItemId('')
      setNewName('')
      setQty('')
      setCartons('')
      setNote('')
      router.refresh()
    })

  return (
    <div className="bg-white rounded-[16px] border border-[#E2E1DA] p-5 space-y-3 max-w-xl">
      <p className="text-[13px] font-display font-bold">クライアントを選んで直接入庫する</p>
      <label className="block text-[11px] text-[#84787D]">
        クライアント <span className="text-[#B03616]">*</span>
        <select
          value={clientId}
          onChange={(e) => {
            setClientId(e.target.value)
            setItemId('')
          }}
          className={inputCls}
        >
          <option value="">— 選択 —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.short_name || c.company_name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-[11px] text-[#84787D]">
        商品(登録済みから選ぶ / 新規)
        <select value={itemId} onChange={(e) => setItemId(e.target.value)} className={inputCls} disabled={!clientId}>
          <option value="">新規商品(下に名前を入力)</option>
          {clientItems.map((i) => (
            <option key={i.id} value={i.id}>
              {i.item_name}(現在 {i.quantity_on_hand}
              {i.unit})
            </option>
          ))}
        </select>
      </label>
      {!itemId && (
        <label className="block text-[11px] text-[#84787D]">
          新規商品名
          <input value={newName} onChange={(e) => setNewName(e.target.value)} className={inputCls} placeholder="例: PETカップ1000入" />
        </label>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-[11px] text-[#84787D]">
          入庫数量 <span className="text-[#B03616]">*</span>
          <input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} className={`${inputCls} fc-num text-right`} placeholder="0" />
        </label>
        <label className="block text-[11px] text-[#84787D]">
          カートン数
          <input type="number" min={0} value={cartons} onChange={(e) => setCartons(e.target.value)} className={`${inputCls} fc-num text-right`} placeholder="任意" />
        </label>
      </div>
      <label className="block text-[11px] text-[#84787D]">
        メモ
        <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} placeholder="任意" />
      </label>
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="w-full rounded-full bg-[#E9F056] text-[#666C14] text-[13px] font-extrabold py-2.5 disabled:opacity-40 hover:brightness-95"
      >
        {pending ? '記録中…' : 'この内容で入庫する'}
      </button>
    </div>
  )
}

function StockList({ items, clients }: { items: InventoryItemRow[]; clients: ClientOpt[] }) {
  const nameOf = (id: string | null) => {
    const c = clients.find((x) => x.id === id)
    return c ? c.short_name || c.company_name : '—'
  }
  return (
    <div className="bg-white rounded-[16px] border border-[#E2E1DA] overflow-x-auto">
      <table className="w-full text-[11.5px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <thead>
          <tr className="bg-[#FBFAF6] text-[#84787D] text-[10.5px] font-bold border-b border-[#E2E1DA]">
            <th className="text-left px-4 py-2">クライアント</th>
            <th className="text-left px-3 py-2">商品</th>
            <th className="text-right px-3 py-2">現在庫</th>
            <th className="text-right px-3 py-2">CTN</th>
            <th className="text-left px-4 py-2">置き場所</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i, idx) => (
            <tr key={i.id} className={`border-b border-[#EFEFEA] last:border-b-0 ${idx % 2 ? 'bg-[#FBFAF6]' : ''}`}>
              <td className="px-4 py-1.5">{nameOf(i.client_id)}</td>
              <td className="px-3 py-1.5 font-bold text-[#351E28]">{i.item_name}</td>
              <td className="px-3 py-1.5 text-right fc-num font-bold">
                {i.quantity_on_hand.toLocaleString()} {i.unit}
              </td>
              <td className="px-3 py-1.5 text-right fc-num">{i.cartons_on_hand ?? '—'}</td>
              <td className="px-4 py-1.5 text-[#84787D]">
                {[i.warehouse_name, i.location_note].filter(Boolean).join(' ') || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
