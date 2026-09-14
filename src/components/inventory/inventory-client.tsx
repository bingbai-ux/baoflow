'use client'

// Sprint 10: 在庫管理(社内MVP)クライアントUI。
// 1行=1商品の密な表。入庫・出庫は行の中の小さなフォームで完結させる。

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  type InventoryItemRow,
  type InventoryTxRow,
  createInventoryItem,
  recordInventoryTransaction,
  listItemTransactions,
} from '@/lib/actions/inventory'
import { useUi } from '@/components/ui/ui-store'
import { formatDate } from '@/lib/utils/format'

interface ClientOption {
  id: string
  company_name: string
  short_name: string | null
}
interface DealOption {
  id: string
  deal_code: string
  deal_name: string | null
}

const TX_LABEL: Record<InventoryTxRow['tx_type'], string> = {
  inbound: '入庫',
  outbound: '出庫',
  adjust: '調整',
}

export function InventoryClient({
  items,
  clients,
  deals,
}: {
  items: InventoryItemRow[]
  clients: ClientOption[]
  deals: DealOption[]
}) {
  const [showNew, setShowNew] = useState(false)
  const totalQty = items.reduce((s, i) => s + i.quantity_on_hand, 0)
  const lowCount = items.filter((i) => i.quantity_on_hand <= 0).length

  return (
    <div>
      <div className="flex items-end justify-between py-[18px] gap-4">
        <div>
          <h1 className="font-display text-[21px] font-extrabold text-[#351E28]">在庫</h1>
          <p className="text-[12.5px] text-[#84787D] font-body mt-1">
            物流倉庫にある商品 <span className="fc-num">{items.length}件</span> · 合計{' '}
            <span className="fc-num">{totalQty.toLocaleString()}点</span>
            {lowCount > 0 && (
              <span className="ml-1 text-[#B03616]">· 在庫切れ {lowCount}件</span>
            )}
            。入庫・出庫はこの台帳に記録します。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNew((v) => !v)}
          className="rounded-full bg-[#E9F056] text-[#666C14] text-[12.5px] font-extrabold px-5 py-2.5 hover:brightness-95 transition-[filter] whitespace-nowrap"
        >
          {showNew ? '入庫フォームを閉じる' : '届いた商品を入庫する'}
        </button>
      </div>

      {showNew && (
        <NewItemForm clients={clients} deals={deals} onDone={() => setShowNew(false)} />
      )}

      {items.length === 0 && !showNew ? (
        <div className="bg-white rounded-[16px] border border-[#E2E1DA] px-5 py-8 text-[12.5px] text-[#84787D] font-body">
          在庫はまだありません。発注した商品が物流倉庫に届いたら
          「届いた商品を入庫する」から登録してください。
        </div>
      ) : (
        <div className="bg-white rounded-[16px] border border-[#E2E1DA] overflow-hidden">
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_90px_70px_minmax(0,1fr)_150px] gap-2 px-4 py-2 bg-[#FBFAF6] border-b border-[#E2E1DA] text-[11px] font-bold text-[#84787D]">
            <span>商品</span>
            <span>クライアント</span>
            <span>案件</span>
            <span className="text-right">現在庫</span>
            <span className="text-right">CTN</span>
            <span>倉庫</span>
            <span className="text-right">操作</span>
          </div>
          {items.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

function ItemRow({ item }: { item: InventoryItemRow }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<'inbound' | 'outbound' | null>(null)
  const [txs, setTxs] = useState<InventoryTxRow[] | null>(null)

  const toggleOpen = async () => {
    const next = !open
    setOpen(next)
    if (next && txs === null) {
      const r = await listItemTransactions(item.id)
      setTxs(r.txs)
    }
  }

  const refreshTxs = async () => {
    const r = await listItemTransactions(item.id)
    setTxs(r.txs)
  }

  const empty = item.quantity_on_hand <= 0

  return (
    <div className="border-b border-[#EFEFEA] last:border-b-0">
      <div
        className={`grid grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_90px_70px_minmax(0,1fr)_150px] gap-2 px-4 py-2.5 items-center cursor-pointer hover:bg-[#FBFAF6] ${
          empty ? 'bg-[#FFD8C2]' : ''
        }`}
        onClick={toggleOpen}
      >
        <div className="min-w-0 flex items-center gap-2">
          {item.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.thumbnail_url} alt="" className="w-8 h-8 rounded-[8px] object-cover flex-shrink-0" />
          ) : (
            <span className="w-8 h-8 rounded-[8px] bg-[#EFEFEA] border border-[#E2E1DA] flex-shrink-0" />
          )}
          <div className="min-w-0">
            <p className={`text-[12.5px] font-bold truncate ${empty ? 'text-[#B03616]' : 'text-[#351E28]'}`}>
              {item.item_name}
            </p>
            <p className={`text-[10.5px] truncate ${empty ? 'text-[#B03616] opacity-80' : 'text-[#84787D]'}`}>
              {item.item_code || ''}{item.spec_note ? ` · ${item.spec_note}` : ''}
            </p>
          </div>
        </div>
        <span className={`text-[11.5px] truncate ${empty ? 'text-[#B03616]' : 'text-[#351E28]'}`}>
          {item.client?.short_name || item.client?.company_name || '—'}
        </span>
        <span className="text-[11px] truncate">
          {item.deal ? (
            <Link
              href={`/deals/${item.deal_id}`}
              onClick={(e) => e.stopPropagation()}
              className={`no-underline fc-num ${empty ? 'text-[#B03616]' : 'text-[#84787D] hover:text-[#351E28]'}`}
            >
              {item.deal.deal_code}
            </Link>
          ) : (
            <span className={empty ? 'text-[#B03616]' : 'text-[#84787D]'}>—</span>
          )}
        </span>
        <span className={`text-right fc-num text-[13px] font-extrabold ${empty ? 'text-[#B03616]' : 'text-[#351E28]'}`}>
          {item.quantity_on_hand.toLocaleString()}
          <span className="text-[10px] font-normal ml-0.5">{item.unit}</span>
        </span>
        <span className={`text-right fc-num text-[11.5px] ${empty ? 'text-[#B03616]' : 'text-[#84787D]'}`}>
          {item.cartons_on_hand ?? '—'}
        </span>
        <span className={`text-[11px] truncate ${empty ? 'text-[#B03616]' : 'text-[#84787D]'}`}>
          {item.warehouse_name || '—'}
        </span>
        <span className="text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => { setOpen(true); setForm('inbound'); if (txs === null) refreshTxs() }}
            className="rounded-full bg-white border border-[#E2E1DA] text-[#351E28] text-[10.5px] font-bold px-2.5 py-1 hover:bg-[#FBFAF6] mr-1"
          >
            入庫
          </button>
          <button
            type="button"
            onClick={() => { setOpen(true); setForm('outbound'); if (txs === null) refreshTxs() }}
            className="rounded-full bg-[#351E28] text-[#C9A2B8] text-[10.5px] font-bold px-2.5 py-1 hover:brightness-95"
          >
            出庫
          </button>
        </span>
      </div>

      {open && (
        <div className="bg-[#FBFAF6] border-t border-[#E2E1DA] px-4 py-3">
          {form && (
            <TxForm
              item={item}
              type={form}
              onDone={() => { setForm(null); refreshTxs() }}
              onCancel={() => setForm(null)}
            />
          )}
          <p className="text-[11px] font-bold text-[#84787D] mb-1.5">入出庫の記録</p>
          {txs === null ? (
            <p className="text-[11px] text-[#84787D]">読み込み中…</p>
          ) : txs.length === 0 ? (
            <p className="text-[11px] text-[#84787D]">まだ記録がありません。</p>
          ) : (
            <ul className="space-y-1">
              {txs.map((t) => (
                <li key={t.id} className="grid grid-cols-[70px_52px_80px_minmax(0,1fr)] gap-2 text-[11px] items-baseline">
                  <span className="fc-num text-[#84787D]">{formatDate(t.occurred_on)}</span>
                  <span className={`font-bold ${
                    t.tx_type === 'inbound' ? 'text-[#666C14]' : t.tx_type === 'outbound' ? 'text-[#B03616]' : 'text-[#33566F]'
                  }`}>
                    {TX_LABEL[t.tx_type]}
                  </span>
                  <span className="fc-num text-right text-[#351E28]">
                    {t.quantity_delta > 0 ? `+${t.quantity_delta.toLocaleString()}` : t.quantity_delta.toLocaleString()}
                  </span>
                  <span className="text-[#84787D] truncate">
                    {[t.destination, t.note].filter(Boolean).join(' · ') || ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function TxForm({
  item,
  type,
  onDone,
  onCancel,
}: {
  item: InventoryItemRow
  type: 'inbound' | 'outbound'
  onDone: () => void
  onCancel: () => void
}) {
  const router = useRouter()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const [qty, setQty] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [destination, setDestination] = useState('')
  const [note, setNote] = useState('')

  const isOut = type === 'outbound'

  const submit = () => {
    startTransition(async () => {
      const r = await recordInventoryTransaction({
        item_id: item.id,
        tx_type: type,
        quantity: Number(qty),
        occurred_on: date,
        destination: isOut ? destination : null,
        note,
      })
      if (r.success) {
        toast(`${isOut ? '出庫' : '入庫'}を記録しました(${item.item_name})`)
        router.refresh()
        onDone()
      } else {
        toast(r.error || '記録に失敗しました', 'warn')
      }
    })
  }

  const inputCls =
    'bg-white rounded-[12px] border border-[#E2E1DA] px-3 py-1.5 text-[12px] font-body text-[#351E28] outline-none focus:border-[#351E28]'

  return (
    <div className="bg-white rounded-[12px] border border-[#E2E1DA] p-3 mb-3">
      <p className="text-[12px] font-bold text-[#351E28] mb-2">
        {isOut ? 'この商品を出庫する' : 'この商品を追加入庫する'}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[10.5px] text-[#84787D]">
          数量({item.unit})
          <input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} className={`${inputCls} w-[100px] fc-num`} placeholder="0" />
        </label>
        <label className="flex flex-col gap-1 text-[10.5px] text-[#84787D]">
          日付
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputCls} fc-num`} />
        </label>
        {isOut && (
          <label className="flex flex-col gap-1 text-[10.5px] text-[#84787D] flex-1 min-w-[160px]">
            出庫先(納品先・宛先)
            <input value={destination} onChange={(e) => setDestination(e.target.value)} className={inputCls} placeholder="例: カフェ・ルミエール 渋谷店" />
          </label>
        )}
        <label className="flex flex-col gap-1 text-[10.5px] text-[#84787D] flex-1 min-w-[140px]">
          メモ
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} placeholder="任意" />
        </label>
        <button
          type="button"
          onClick={submit}
          disabled={pending || !qty}
          className="rounded-full bg-[#351E28] text-[#C9A2B8] text-[11.5px] font-bold px-4 py-2 hover:brightness-95 disabled:opacity-50"
        >
          {pending ? '記録中…' : isOut ? 'この内容で出庫する' : 'この内容で入庫する'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full text-[#84787D] text-[11.5px] px-3 py-2 hover:bg-[#EFEFEA]"
        >
          やめる
        </button>
      </div>
    </div>
  )
}

function NewItemForm({
  clients,
  deals,
  onDone,
}: {
  clients: ClientOption[]
  deals: DealOption[]
  onDone: () => void
}) {
  const router = useRouter()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const [f, setF] = useState({
    item_name: '',
    item_code: '',
    spec_note: '',
    unit: '個',
    client_id: '',
    deal_id: '',
    warehouse_name: '',
    first_quantity: '',
    first_cartons: '',
    first_arrived_at: new Date().toISOString().slice(0, 10),
    note: '',
  })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }))

  const submit = () => {
    startTransition(async () => {
      const r = await createInventoryItem({
        item_name: f.item_name,
        item_code: f.item_code || null,
        spec_note: f.spec_note || null,
        unit: f.unit || '個',
        client_id: f.client_id || null,
        deal_id: f.deal_id || null,
        warehouse_name: f.warehouse_name || null,
        first_quantity: Number(f.first_quantity),
        first_cartons: f.first_cartons ? Number(f.first_cartons) : null,
        first_arrived_at: f.first_arrived_at || null,
        note: f.note || null,
      })
      if (r.success) {
        toast(`入庫を記録しました(${f.item_name})`)
        router.refresh()
        onDone()
      } else {
        toast(r.error || '登録に失敗しました', 'warn')
      }
    })
  }

  const inputCls =
    'bg-[#EFEFEA] rounded-[12px] px-3 py-2 text-[12.5px] font-body text-[#351E28] border border-transparent outline-none focus:border-[#E2E1DA] w-full'
  const labelCls = 'flex flex-col gap-1 text-[11px] font-bold text-[#84787D]'

  return (
    <div className="bg-white rounded-[16px] border border-[#E2E1DA] p-5 mb-3">
      <p className="text-[15px] font-bold text-[#351E28] mb-1">届いた商品を入庫する</p>
      <p className="text-[11.5px] text-[#84787D] font-body mb-4">
        物流倉庫に届いた商品を台帳に登録します。どのクライアントの在庫かを必ず選んでください。
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <label className={labelCls}>
          商品名(必須)
          <input value={f.item_name} onChange={set('item_name')} className={inputCls} placeholder="例: Peanuts Craft bag" />
        </label>
        <label className={labelCls}>
          クライアント
          <select value={f.client_id} onChange={set('client_id')} className={inputCls}>
            <option value="">(選択)</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.short_name || c.company_name}</option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          関連案件
          <select value={f.deal_id} onChange={set('deal_id')} className={inputCls}>
            <option value="">(なし)</option>
            {deals.map((d) => (
              <option key={d.id} value={d.id}>{d.deal_code} {d.deal_name || ''}</option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          入庫数量(必須)
          <input type="number" min={1} value={f.first_quantity} onChange={set('first_quantity')} className={`${inputCls} fc-num`} placeholder="0" />
        </label>
        <label className={labelCls}>
          カートン数
          <input type="number" min={0} value={f.first_cartons} onChange={set('first_cartons')} className={`${inputCls} fc-num`} placeholder="任意" />
        </label>
        <label className={labelCls}>
          入庫日
          <input type="date" value={f.first_arrived_at} onChange={set('first_arrived_at')} className={`${inputCls} fc-num`} />
        </label>
        <label className={labelCls}>
          商品コード
          <input value={f.item_code} onChange={set('item_code')} className={inputCls} placeholder="任意" />
        </label>
        <label className={labelCls}>
          倉庫名
          <input value={f.warehouse_name} onChange={set('warehouse_name')} className={inputCls} placeholder="例: 新ロジセンター" />
        </label>
        <label className={labelCls}>
          仕様メモ
          <input value={f.spec_note} onChange={set('spec_note')} className={inputCls} placeholder="サイズ・色など(任意)" />
        </label>
      </div>
      <div className="flex items-center gap-2 mt-4">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !f.item_name || !f.first_quantity}
          className="rounded-full bg-[#E9F056] text-[#666C14] text-[12.5px] font-extrabold px-5 py-2.5 hover:brightness-95 disabled:opacity-50"
        >
          {pending ? '登録中…' : 'この内容で入庫する'}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-full text-[#84787D] text-[12px] px-3 py-2 hover:bg-[#EFEFEA]"
        >
          やめる
        </button>
      </div>
    </div>
  )
}
