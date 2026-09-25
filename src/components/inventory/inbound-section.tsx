'use client'

// Sprint 12: 入庫予定 (輸送追跡 → 着荷検収)。スタッフとロジポータルで共用。
// - 一覧: 追跡番号 (17TRACK リンク)、予定明細、状態
// - 輸送中のものは「検収して入庫」: 予定数のまま OK / その場で修正して確定
// - 新規作成: クライアント・輸送情報・明細 (既存在庫アイテム or 新規商品名)

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createInboundShipment,
  receiveInboundShipment,
  cancelInboundShipment,
  type InboundShipmentRow,
} from '@/lib/actions/inbound'
import type { InventoryItemRow } from '@/lib/actions/inventory'
import { useUi } from '@/components/ui/ui-store'
import { formatDate } from '@/lib/utils/format'

interface ClientOpt {
  id: string
  company_name: string
  short_name: string | null
}

interface Props {
  shipments: InboundShipmentRow[]
  clients: ClientOpt[]
  items: InventoryItemRow[]
  prefillDealId?: string | null
}

const inputCls =
  'bg-[#EFEFEA] rounded-[12px] px-3 py-2 text-[12px] font-body text-[#351E28] border border-transparent outline-none focus:border-[#351E28] w-full'

export function InboundSection({ shipments, clients, items, prefillDealId }: Props) {
  const [showNew, setShowNew] = useState(!!prefillDealId)
  const inTransit = shipments.filter((s) => s.status === 'in_transit')
  const done = shipments.filter((s) => s.status !== 'in_transit')

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[12px] text-[#84787D] font-body">
          工場出荷後の輸送を追跡し、倉庫に届いたら「検収して入庫」で在庫に反映します。
        </p>
        <button
          type="button"
          onClick={() => setShowNew((v) => !v)}
          className="rounded-full bg-[#351E28] text-[#C9A2B8] text-[12px] font-bold px-4 py-2 hover:brightness-95"
        >
          {showNew ? '作成フォームを閉じる' : '+ 入庫予定をつくる'}
        </button>
      </div>

      {showNew && (
        <NewInboundForm
          clients={clients}
          items={items}
          prefillDealId={prefillDealId}
          onDone={() => setShowNew(false)}
        />
      )}

      {inTransit.length === 0 && (
        <p className="text-[12px] text-[#84787D] font-body bg-white rounded-[16px] border border-[#E2E1DA] px-4 py-5">
          輸送中の入庫予定はありません。
        </p>
      )}
      {inTransit.map((s) => (
        <ShipmentCard key={s.id} shipment={s} />
      ))}

      {done.length > 0 && (
        <details className="bg-[#FBFAF6] rounded-[16px] border border-[#E2E1DA]">
          <summary className="px-4 py-2.5 text-[12px] font-bold text-[#351E28] cursor-pointer">
            処理済みの入庫予定 ({done.length})
          </summary>
          <div className="px-2 pb-2 space-y-2">
            {done.map((s) => (
              <ShipmentCard key={s.id} shipment={s} />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

function trackingUrl(no: string) {
  return `https://t.17track.net/ja#nums=${encodeURIComponent(no)}`
}

function ShipmentCard({ shipment: s }: { shipment: InboundShipmentRow }) {
  const router = useRouter()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const [receiving, setReceiving] = useState(false)
  const [qtys, setQtys] = useState<Record<string, string>>({})

  const badge =
    s.status === 'in_transit'
      ? { label: '輸送中', cls: 'bg-[#D7EFFF] text-[#33566F]' }
      : s.status === 'received'
        ? { label: '入庫済み', cls: 'bg-[#AEB8A0] text-[#4C5544]' }
        : { label: '取消', cls: 'bg-[#EFEFEA] border border-[#E2E1DA] text-[#84787D]' }

  const confirmReceive = () =>
    startTransition(async () => {
      const payload = s.lines.map((l) => ({
        line_id: l.id,
        received_quantity: Number(qtys[l.id] ?? l.expected_quantity),
      }))
      const r = await receiveInboundShipment(s.id, payload)
      if (r.success) {
        toast('検収して入庫しました')
        setReceiving(false)
        router.refresh()
      } else {
        toast(r.error || '入庫に失敗しました', 'warn')
      }
    })

  const cancel = () =>
    startTransition(async () => {
      const r = await cancelInboundShipment(s.id)
      if (r.success) {
        toast('入庫予定を取り消しました')
        router.refresh()
      } else toast(r.error || '失敗しました', 'warn')
    })

  return (
    <div className="bg-white rounded-[16px] border border-[#E2E1DA]">
      <div className="px-4 py-2.5 flex items-center gap-2.5 flex-wrap border-b border-[#EFEFEA]">
        <span className="fc-num text-[11px] text-[#84787D]">{s.shipment_no}</span>
        <span className="text-[12.5px] font-bold text-[#351E28]">
          {s.client?.short_name || s.client?.company_name || 'クライアント未指定'}
        </span>
        {s.deal?.deal_code && (
          <span className="fc-num text-[10.5px] text-[#84787D]">案件 {s.deal.deal_code}</span>
        )}
        <span className={`rounded-full text-[10px] font-bold px-2 py-[2px] ${badge.cls}`}>
          {badge.label}
        </span>
        <span className="flex-1" />
        {s.eta_date && (
          <span className="fc-num text-[11px] text-[#84787D]">到着予定 {formatDate(s.eta_date)}</span>
        )}
      </div>

      <div className="px-4 py-2 flex items-center gap-3 flex-wrap text-[11.5px] font-body border-b border-[#EFEFEA]">
        <span className="text-[#84787D]">輸送: {s.carrier_name || '—'}</span>
        {s.tracking_number ? (
          <>
            <span className="fc-num text-[#351E28]">追跡 {s.tracking_number}</span>
            <a
              href={trackingUrl(s.tracking_number)}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-[#D7EFFF] text-[#33566F] text-[10.5px] font-bold px-2.5 py-[3px] no-underline hover:brightness-95"
            >
              リアルタイム追跡 →
            </a>
          </>
        ) : (
          <span className="text-[#AEB8A0]">追跡番号 未登録</span>
        )}
        {s.note && <span className="text-[#84787D]">{s.note}</span>}
      </div>

      <table className="w-full text-[11.5px] font-body" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <thead>
          <tr className="text-[#84787D] text-[10px] font-bold border-b border-[#EFEFEA]">
            <th className="text-left px-4 py-1.5">商品</th>
            <th className="text-right px-3 py-1.5">予定数</th>
            <th className="text-right px-3 py-1.5">CTN</th>
            <th className="text-right px-4 py-1.5 w-[140px]">
              {s.status === 'received' ? '受入数' : receiving ? '受入数(修正可)' : ''}
            </th>
          </tr>
        </thead>
        <tbody>
          {s.lines.map((l) => (
            <tr key={l.id} className="border-b border-[#EFEFEA] last:border-b-0">
              <td className="px-4 py-1.5">
                {l.item_name}
                {!l.item_id && s.status === 'in_transit' && (
                  <span className="ml-1.5 rounded-full bg-[#E9F056] text-[#666C14] text-[9.5px] font-bold px-1.5 py-[1px]">新規</span>
                )}
              </td>
              <td className="px-3 py-1.5 text-right fc-num font-bold">{l.expected_quantity.toLocaleString()}</td>
              <td className="px-3 py-1.5 text-right fc-num">{l.expected_cartons ?? '—'}</td>
              <td className="px-4 py-1.5 text-right">
                {s.status === 'received' ? (
                  <span className={`fc-num font-bold ${l.received_quantity !== l.expected_quantity ? 'text-[#B03616]' : 'text-[#351E28]'}`}>
                    {l.received_quantity?.toLocaleString() ?? '—'}
                  </span>
                ) : receiving ? (
                  <input
                    type="number"
                    min={0}
                    value={qtys[l.id] ?? String(l.expected_quantity)}
                    onChange={(e) => setQtys((q) => ({ ...q, [l.id]: e.target.value }))}
                    className="w-[90px] text-right fc-num bg-[#EFEFEA] rounded-[8px] px-2 py-1 border border-transparent outline-none focus:border-[#351E28]"
                  />
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {s.status === 'in_transit' && (
        <div className="px-4 py-2.5 border-t border-[#EFEFEA] flex items-center gap-2 flex-wrap">
          {receiving ? (
            <>
              <button
                type="button"
                onClick={confirmReceive}
                disabled={pending}
                className="rounded-full bg-[#E9F056] text-[#666C14] text-[12px] font-extrabold px-4 py-2 disabled:opacity-40 hover:brightness-95"
              >
                {pending ? '…' : 'この数で入庫を確定する'}
              </button>
              <button
                type="button"
                onClick={() => setReceiving(false)}
                className="rounded-full bg-white border border-[#E2E1DA] text-[#84787D] text-[11.5px] font-bold px-3 py-2"
              >
                やめる
              </button>
              <span className="text-[10.5px] text-[#84787D]">数が違うときはその場で直してから確定してください</span>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setReceiving(true)}
                className="rounded-full bg-[#351E28] text-[#C9A2B8] text-[12px] font-bold px-4 py-2 hover:brightness-95"
              >
                届いた → 検収して入庫
              </button>
              <button
                type="button"
                onClick={cancel}
                disabled={pending}
                className="rounded-full bg-white border border-[#FF5C34] text-[#B03616] text-[11px] font-bold px-3 py-2 disabled:opacity-40"
              >
                取消
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

interface NewLine {
  item_id: string
  item_name: string
  qty: string
  cartons: string
}

function NewInboundForm({
  clients,
  items,
  prefillDealId,
  onDone,
}: {
  clients: ClientOpt[]
  items: InventoryItemRow[]
  prefillDealId?: string | null
  onDone: () => void
}) {
  const router = useRouter()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const [clientId, setClientId] = useState('')
  const [carrier, setCarrier] = useState('')
  const [tracking, setTracking] = useState('')
  const [eta, setEta] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<NewLine[]>([{ item_id: '', item_name: '', qty: '', cartons: '' }])

  const clientItems = items.filter((i) => !clientId || i.client_id === clientId)

  const setLine = (idx: number, patch: Partial<NewLine>) =>
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)))

  const submit = () =>
    startTransition(async () => {
      const r = await createInboundShipment({
        client_id: clientId || null,
        deal_id: prefillDealId || null,
        carrier_name: carrier,
        tracking_number: tracking,
        eta_date: eta || null,
        note,
        lines: lines
          .filter((l) => (l.item_id || l.item_name.trim()) && Number(l.qty) > 0)
          .map((l) => {
            const existing = l.item_id ? items.find((i) => i.id === l.item_id) : null
            return {
              item_id: l.item_id || null,
              item_name: existing?.item_name || l.item_name,
              expected_quantity: Number(l.qty),
              expected_cartons: l.cartons ? Number(l.cartons) : null,
            }
          }),
      })
      if (r.success) {
        toast('入庫予定を作成しました')
        onDone()
        router.refresh()
      } else {
        toast(r.error || '作成に失敗しました', 'warn')
      }
    })

  return (
    <div className="bg-white rounded-[16px] border-[1.5px] border-[#E9F056] p-4 space-y-3">
      <p className="text-[13px] font-display font-bold text-[#351E28]">入庫予定をつくる</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <label className="text-[10.5px] text-[#84787D] font-body">
          クライアント
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputCls}>
            <option value="">— 選択 —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.short_name || c.company_name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[10.5px] text-[#84787D] font-body">
          輸送会社
          <input value={carrier} onChange={(e) => setCarrier(e.target.value)} className={inputCls} placeholder="例: SF Express / 海運" />
        </label>
        <label className="text-[10.5px] text-[#84787D] font-body">
          追跡番号
          <input value={tracking} onChange={(e) => setTracking(e.target.value)} className={inputCls} placeholder="あとから追加も可" />
        </label>
        <label className="text-[10.5px] text-[#84787D] font-body">
          到着予定日
          <input type="date" value={eta} onChange={(e) => setEta(e.target.value)} className={inputCls} />
        </label>
      </div>

      <div className="space-y-1.5">
        <p className="text-[10.5px] font-bold text-[#84787D]">明細(既存の在庫に追加 or 新規商品名)</p>
        {lines.map((l, idx) => (
          <div key={idx} className="flex items-center gap-2 flex-wrap">
            <select
              value={l.item_id}
              onChange={(e) => setLine(idx, { item_id: e.target.value })}
              className={`${inputCls} w-auto min-w-[180px] flex-1`}
            >
              <option value="">新規商品(右に名前を入力)</option>
              {clientItems.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.item_name}(現在 {i.quantity_on_hand}
                  {i.unit})
                </option>
              ))}
            </select>
            {!l.item_id && (
              <input
                value={l.item_name}
                onChange={(e) => setLine(idx, { item_name: e.target.value })}
                className={`${inputCls} w-auto flex-1 min-w-[160px]`}
                placeholder="新規商品名"
              />
            )}
            <input
              type="number"
              min={1}
              value={l.qty}
              onChange={(e) => setLine(idx, { qty: e.target.value })}
              className={`${inputCls} w-[90px] text-right fc-num`}
              placeholder="数量"
            />
            <input
              type="number"
              min={0}
              value={l.cartons}
              onChange={(e) => setLine(idx, { cartons: e.target.value })}
              className={`${inputCls} w-[80px] text-right fc-num`}
              placeholder="CTN"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setLines((ls) => [...ls, { item_id: '', item_name: '', qty: '', cartons: '' }])}
          className="rounded-full bg-white border border-[#E2E1DA] text-[#351E28] text-[10.5px] font-bold px-2.5 py-1"
        >
          + 行を追加
        </button>
      </div>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-full bg-[#351E28] text-[#C9A2B8] text-[12px] font-bold px-4 py-2 disabled:opacity-40 hover:brightness-95"
        >
          {pending ? '…' : 'この内容で作成する'}
        </button>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={`${inputCls} flex-1`}
          placeholder="メモ(任意)"
        />
      </div>
    </div>
  )
}
