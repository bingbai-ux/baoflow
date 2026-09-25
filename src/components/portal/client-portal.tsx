'use client'

// Sprint 12: クライアントポータル。
// 自社の在庫をリアルタイム閲覧 / 発注 (出荷依頼) / 発注履歴 / 入庫予定 / 発送履歴。

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createShipmentRequest, type ShipmentRequestRow } from '@/lib/actions/shipment-requests'
import { REQUEST_STATUS_LABEL, REQUEST_STATUS_BADGE } from '@/lib/utils/shipment-status'
import type { InventoryItemRow, OutboundHistoryRow } from '@/lib/actions/inventory'
import type { InboundShipmentRow } from '@/lib/actions/inbound'
import type { PortalDeal } from '@/lib/actions/portal-data'
import { ShippingHistory } from '@/components/inventory/shipping-history'
import { formatDate } from '@/lib/utils/format'
import { SIMPLE_STATUS_CONFIG, SIMPLE_STATUS_ORDER, type SimpleStatus } from '@/lib/types'

interface Props {
  clientName: string
  items: InventoryItemRow[]
  requests: ShipmentRequestRow[]
  inbound: InboundShipmentRow[]
  outbound: OutboundHistoryRow[]
  deals: PortalDeal[]
}

type Tab = 'stock' | 'order' | 'history' | 'shipping' | 'deals'

const inputCls =
  'bg-[#EFEFEA] rounded-[12px] px-3 py-2 text-[13px] font-body text-[#351E28] border border-transparent outline-none focus:border-[#B03616] w-full'

export function ClientPortal({ clientName, items, requests, inbound, outbound, deals }: Props) {
  const [tab, setTab] = useState<Tab>('stock')
  const inTransit = inbound.filter((s) => s.status === 'in_transit')

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: 'stock', label: `在庫 (${items.length})` },
    { id: 'order', label: '発注する' },
    { id: 'history', label: `発注履歴 (${requests.length})` },
    { id: 'shipping', label: `発送履歴 (${outbound.length})` },
    { id: 'deals', label: `案件の進捗 (${deals.length})` },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-[20px] font-bold">{clientName} さまの保管在庫</h1>
        <p className="text-[12px] text-[#84787D] mt-0.5">
          在庫はリアルタイムです。出荷してほしいときは「発注する」からご依頼ください。
          {inTransit.length > 0 && (
            <span className="ml-2 rounded-full bg-[#D7EFFF] text-[#33566F] text-[10.5px] font-bold px-2 py-[2px]">
              入庫予定 {inTransit.length}件 輸送中
            </span>
          )}
        </p>
      </div>

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

      {tab === 'stock' && <StockTab items={items} inbound={inTransit} />}
      {tab === 'order' && <OrderTab items={items} onDone={() => setTab('history')} />}
      {tab === 'history' && <HistoryTab requests={requests} />}
      {tab === 'shipping' && <ShippingHistory txs={outbound} />}
      {tab === 'deals' && <DealsTab deals={deals} />}
    </div>
  )
}

function DealsTab({ deals }: { deals: PortalDeal[] }) {
  if (deals.length === 0)
    return (
      <p className="text-[12.5px] text-[#84787D] bg-white rounded-[16px] border border-[#E2E1DA] px-4 py-6">
        進行中の案件はありません。
      </p>
    )
  return (
    <div className="space-y-2">
      {deals.map((d) => {
        const cfg = SIMPLE_STATUS_CONFIG[(d.simple_status || 'quoting') as SimpleStatus]
        const stepIdx = SIMPLE_STATUS_ORDER.indexOf((d.simple_status || 'quoting') as SimpleStatus)
        return (
          <div key={d.id} className="bg-white rounded-[16px] border border-[#E2E1DA] px-4 py-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="fc-num text-[11px] text-[#84787D]">{d.deal_code}</span>
              <span className="text-[13px] font-bold text-[#351E28]">
                {d.deal_name || '(案件名未設定)'}
              </span>
              <span className="rounded-full bg-[#D7EFFF] text-[#33566F] text-[10px] font-bold px-2 py-[2px]">
                {cfg?.label || d.simple_status}
              </span>
              <span className="flex-1" />
              {d.desired_delivery_date && (
                <span className="fc-num text-[10.5px] text-[#84787D]">
                  納品予定 {formatDate(d.desired_delivery_date)}
                </span>
              )}
            </div>
            {/* 進捗ドット: 過去=Cool Blue / 現在=濃 / 未来=Line (D78) */}
            <div className="flex items-center gap-1 mt-2">
              {SIMPLE_STATUS_ORDER.map((s, i) => (
                <span
                  key={s}
                  className={`h-[6px] flex-1 rounded-full ${
                    i < stepIdx ? 'bg-[#D7EFFF]' : i === stepIdx ? 'bg-[#351E28]' : 'bg-[#E2E1DA]'
                  }`}
                  title={SIMPLE_STATUS_CONFIG[s].label}
                />
              ))}
            </div>
            <p className="text-[10.5px] text-[#84787D] mt-1">
              {stepIdx + 1} / {SIMPLE_STATUS_ORDER.length} — {cfg?.label}
            </p>
          </div>
        )
      })}
    </div>
  )
}

function StockTab({ items, inbound }: { items: InventoryItemRow[]; inbound: InboundShipmentRow[] }) {
  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-[12.5px] text-[#84787D] bg-white rounded-[16px] border border-[#E2E1DA] px-4 py-6">
          お預かり中の在庫はまだありません。
        </p>
      ) : (
        <div className="bg-white rounded-[16px] border border-[#E2E1DA] overflow-x-auto">
          <table className="w-full text-[12px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr className="bg-[#FBFAF6] text-[#84787D] text-[10.5px] font-bold border-b border-[#E2E1DA]">
                <th className="text-left px-4 py-2">商品</th>
                <th className="text-left px-3 py-2">品番</th>
                <th className="text-right px-3 py-2">現在庫</th>
                <th className="text-right px-3 py-2">カートン</th>
                <th className="text-left px-4 py-2">保管場所</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i, idx) => (
                <tr key={i.id} className={`border-b border-[#EFEFEA] last:border-b-0 ${idx % 2 ? 'bg-[#FBFAF6]' : ''}`}>
                  <td className="px-4 py-2 font-bold text-[#351E28]">
                    <span className="flex items-center gap-2.5">
                      {i.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={i.thumbnail_url} alt="" className="w-10 h-10 rounded-[10px] object-cover border border-[#E2E1DA] flex-shrink-0" />
                      ) : (
                        <span className="w-10 h-10 rounded-[10px] bg-[#EFEFEA] flex-shrink-0" />
                      )}
                      {i.item_name}
                    </span>
                  </td>
                  <td className="px-3 py-2 fc-num text-[#84787D]">{i.item_code || '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <span className="fc-num font-extrabold text-[15px] text-[#351E28]">
                      {i.quantity_on_hand.toLocaleString()}
                    </span>
                    <span className="text-[10.5px] text-[#84787D] ml-0.5">{i.unit}</span>
                  </td>
                  <td className="px-3 py-2 text-right fc-num">{i.cartons_on_hand ?? '—'}</td>
                  <td className="px-4 py-2 text-[#84787D]">
                    {[i.warehouse_name, i.location_note].filter(Boolean).join(' ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {inbound.length > 0 && (
        <div className="bg-white rounded-[16px] border border-[#E2E1DA] p-4">
          <p className="text-[12px] font-bold text-[#351E28] mb-2">入庫予定(輸送中)</p>
          <ul className="space-y-1.5">
            {inbound.map((s) => (
              <li key={s.id} className="text-[11.5px] flex items-center gap-2 flex-wrap">
                <span className="fc-num text-[#84787D]">{s.shipment_no}</span>
                <span>{s.lines.map((l) => `${l.item_name} ×${l.expected_quantity.toLocaleString()}`).join(' / ')}</span>
                {s.eta_date && <span className="fc-num text-[#84787D]">到着予定 {formatDate(s.eta_date)}</span>}
                {s.tracking_number && (
                  <a
                    href={`https://t.17track.net/ja#nums=${encodeURIComponent(s.tracking_number)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-[#D7EFFF] text-[#33566F] text-[10px] font-bold px-2 py-[2px] no-underline"
                  >
                    追跡 →
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function OrderTab({ items, onDone }: { items: InventoryItemRow[]; onDone: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [qty, setQty] = useState<Record<string, string>>({})
  const [destName, setDestName] = useState('')
  const [destAddr, setDestAddr] = useState('')
  const [desired, setDesired] = useState('')
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const selected = useMemo(
    () =>
      items
        .map((i) => ({ item: i, q: Math.floor(Number(qty[i.id] || 0)) }))
        .filter((x) => x.q > 0),
    [items, qty]
  )

  const submit = () =>
    startTransition(async () => {
      setMsg(null)
      const r = await createShipmentRequest({
        destination_name: destName,
        destination_address: destAddr,
        desired_date: desired || null,
        note,
        items: selected.map((s) => ({ item_id: s.item.id, quantity: s.q })),
      })
      if (r.success) {
        setMsg({ ok: true, text: `発注を受け付けました(${r.requestNo})。担当者が確認して出荷します。` })
        setQty({})
        setDestName('')
        setDestAddr('')
        setDesired('')
        setNote('')
        router.refresh()
        onDone()
      } else {
        setMsg({ ok: false, text: r.error || '送信に失敗しました' })
      }
    })

  if (items.length === 0)
    return (
      <p className="text-[12.5px] text-[#84787D] bg-white rounded-[16px] border border-[#E2E1DA] px-4 py-6">
        発注できる在庫がまだありません。
      </p>
    )

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-[16px] border border-[#E2E1DA] overflow-x-auto">
        <table className="w-full text-[12px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr className="bg-[#FBFAF6] text-[#84787D] text-[10.5px] font-bold border-b border-[#E2E1DA]">
              <th className="text-left px-4 py-2">商品</th>
              <th className="text-right px-3 py-2">現在庫</th>
              <th className="text-right px-4 py-2 w-[140px]">発注数</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-b border-[#EFEFEA] last:border-b-0">
                <td className="px-4 py-2 font-bold text-[#351E28]">{i.item_name}</td>
                <td className="px-3 py-2 text-right fc-num">
                  {i.quantity_on_hand.toLocaleString()} {i.unit}
                </td>
                <td className="px-4 py-2 text-right">
                  <input
                    type="number"
                    min={0}
                    max={i.quantity_on_hand}
                    value={qty[i.id] || ''}
                    onChange={(e) => setQty((q) => ({ ...q, [i.id]: e.target.value }))}
                    className="w-[100px] text-right fc-num bg-[#EFEFEA] rounded-[10px] px-2.5 py-1.5 border border-transparent outline-none focus:border-[#B03616]"
                    placeholder="0"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-[16px] border border-[#E2E1DA] p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-[11px] text-[#84787D]">
            お届け先(店舗名・宛名) <span className="text-[#B03616]">*</span>
            <input value={destName} onChange={(e) => setDestName(e.target.value)} className={inputCls} placeholder="例: 渋谷店" />
          </label>
          <label className="text-[11px] text-[#84787D]">
            希望日
            <input type="date" value={desired} onChange={(e) => setDesired(e.target.value)} className={inputCls} />
          </label>
        </div>
        <label className="block text-[11px] text-[#84787D]">
          お届け先住所
          <input value={destAddr} onChange={(e) => setDestAddr(e.target.value)} className={inputCls} placeholder="都道府県から番地・建物名まで" />
        </label>
        <label className="block text-[11px] text-[#84787D]">
          備考
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} placeholder="任意" />
        </label>

        {msg && (
          <p className={`text-[12px] rounded-[12px] px-3 py-2 ${msg.ok ? 'bg-[#E9F056] text-[#666C14]' : 'bg-[#FFD8C2] text-[#B03616]'}`}>
            {msg.text}
          </p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={pending || selected.length === 0 || !destName.trim()}
          className="w-full rounded-full bg-[#E9F056] text-[#666C14] text-[13px] font-extrabold py-2.5 disabled:opacity-40 hover:brightness-95"
        >
          {pending
            ? '送信中…'
            : selected.length === 0
              ? '発注数を入力してください'
              : `${selected.length}品目をこの内容で発注する`}
        </button>
      </div>
    </div>
  )
}

function HistoryTab({ requests }: { requests: ShipmentRequestRow[] }) {
  if (requests.length === 0)
    return (
      <p className="text-[12.5px] text-[#84787D] bg-white rounded-[16px] border border-[#E2E1DA] px-4 py-6">
        まだ発注履歴がありません。
      </p>
    )
  return (
    <div className="space-y-2">
      {requests.map((r) => (
        <div key={r.id} className="bg-white rounded-[16px] border border-[#E2E1DA] px-4 py-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="fc-num text-[11px] text-[#84787D]">{r.request_no}</span>
            <span className={`rounded-full text-[10px] font-bold px-2 py-[2px] ${REQUEST_STATUS_BADGE[r.status]}`}>
              {REQUEST_STATUS_LABEL[r.status]}
            </span>
            <span className="text-[12px] font-bold text-[#351E28]">{r.destination_name}</span>
            <span className="flex-1" />
            <span className="fc-num text-[10.5px] text-[#84787D]">
              {formatDate(r.created_at)}
              {r.desired_date && ` · 希望 ${formatDate(r.desired_date)}`}
            </span>
          </div>
          <p className="text-[11.5px] text-[#351E28] mt-1.5">
            {r.items.map((i) => `${i.item?.item_name || '—'} ×${i.quantity.toLocaleString()}`).join(' / ')}
          </p>
        </div>
      ))}
    </div>
  )
}
