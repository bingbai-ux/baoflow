'use client'

// Sprint 12: 出荷依頼の管理 (スタッフ / ロジポータル共用)。
// requested → 確認 → 出荷(出庫仕訳) → 納品完了。却下も可。

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  confirmShipmentRequest,
  shipShipmentRequest,
  deliverShipmentRequest,
  cancelShipmentRequest,
  type ShipmentRequestRow,
} from '@/lib/actions/shipment-requests'
import { REQUEST_STATUS_LABEL, REQUEST_STATUS_BADGE } from '@/lib/utils/shipment-status'
import { useUi } from '@/components/ui/ui-store'
import { formatDate } from '@/lib/utils/format'

interface Props {
  requests: ShipmentRequestRow[]
  mode: 'staff' | 'logistics'
}

export function RequestsSection({ requests, mode }: Props) {
  const active = requests.filter((r) => r.status === 'requested' || r.status === 'confirmed' || r.status === 'shipped')
  const done = requests.filter((r) => r.status === 'delivered' || r.status === 'cancelled')

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-[#84787D] font-body">
        クライアントからの出荷依頼です。内容を確認して出荷すると在庫から自動で引き落とされます。
      </p>
      {active.length === 0 && (
        <p className="text-[12px] text-[#84787D] font-body bg-white rounded-[16px] border border-[#E2E1DA] px-4 py-5">
          進行中の出荷依頼はありません。
        </p>
      )}
      {active.map((r) => (
        <RequestCard key={r.id} request={r} mode={mode} />
      ))}
      {done.length > 0 && (
        <details className="bg-[#FBFAF6] rounded-[16px] border border-[#E2E1DA]">
          <summary className="px-4 py-2.5 text-[12px] font-bold text-[#351E28] cursor-pointer">
            完了・キャンセル ({done.length})
          </summary>
          <div className="px-2 pb-2 space-y-2">
            {done.map((r) => (
              <RequestCard key={r.id} request={r} mode={mode} />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

function RequestCard({ request: r, mode }: { request: ShipmentRequestRow; mode: 'staff' | 'logistics' }) {
  const router = useRouter()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()

  const run = (fn: (id: string) => Promise<{ success: boolean; error?: string }>, ok: string) =>
    startTransition(async () => {
      const res = await fn(r.id)
      if (res.success) {
        toast(ok)
        router.refresh()
      } else {
        toast(res.error || '失敗しました', 'warn')
      }
    })

  return (
    <div className="bg-white rounded-[16px] border border-[#E2E1DA]">
      <div className="px-4 py-2.5 flex items-center gap-2.5 flex-wrap border-b border-[#EFEFEA]">
        <span className="fc-num text-[11px] text-[#84787D]">{r.request_no}</span>
        <span className="text-[12.5px] font-bold text-[#351E28]">
          {r.client?.short_name || r.client?.company_name || '—'}
        </span>
        <span className={`rounded-full text-[10px] font-bold px-2 py-[2px] ${REQUEST_STATUS_BADGE[r.status]}`}>
          {REQUEST_STATUS_LABEL[r.status]}
        </span>
        <span className="flex-1" />
        <span className="fc-num text-[10.5px] text-[#84787D]">
          依頼 {formatDate(r.created_at)}
          {r.desired_date && ` · 希望 ${formatDate(r.desired_date)}`}
        </span>
      </div>

      <div className="px-4 py-2 text-[11.5px] font-body border-b border-[#EFEFEA]">
        <span className="text-[#84787D]">お届け先: </span>
        <span className="font-bold text-[#351E28]">{r.destination_name || '—'}</span>
        {r.destination_address && <span className="text-[#351E28] ml-2">{r.destination_address}</span>}
        {r.note && <span className="text-[#84787D] ml-2">備考: {r.note}</span>}
      </div>

      <table className="w-full text-[11.5px] font-body" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <tbody>
          {r.items.map((i) => (
            <tr key={i.id} className="border-b border-[#EFEFEA] last:border-b-0">
              <td className="px-4 py-1.5">{i.item?.item_name || '—'}</td>
              <td className="px-3 py-1.5 text-right fc-num font-bold w-[120px]">
                {i.quantity.toLocaleString()} {i.item?.unit || ''}
              </td>
              <td className="px-4 py-1.5 text-right fc-num text-[#84787D] w-[140px]">
                現在庫 {i.item?.quantity_on_hand?.toLocaleString() ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {(r.status === 'requested' || r.status === 'confirmed' || r.status === 'shipped') && (
        <div className="px-4 py-2.5 border-t border-[#EFEFEA] flex items-center gap-2 flex-wrap">
          <a
            href={`/print/request/${r.id}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-white border border-[#E2E1DA] text-[#351E28] text-[11px] font-bold px-3 py-2 no-underline hover:bg-[#FBFAF6]"
          >
            出荷指示書 →
          </a>
          {r.status === 'requested' && mode === 'staff' && (
            <button
              type="button"
              onClick={() => run(confirmShipmentRequest, '依頼を確認済みにしました')}
              disabled={pending}
              className="rounded-full bg-[#351E28] text-[#C9A2B8] text-[12px] font-bold px-4 py-2 disabled:opacity-40 hover:brightness-95"
            >
              内容OK → 確認済みにする
            </button>
          )}
          {(r.status === 'confirmed' || (r.status === 'requested' && mode === 'staff')) && (
            <button
              type="button"
              onClick={() => run(shipShipmentRequest, '出荷しました(在庫から引き落とし)')}
              disabled={pending}
              className="rounded-full bg-[#E9F056] text-[#666C14] text-[12px] font-extrabold px-4 py-2 disabled:opacity-40 hover:brightness-95"
            >
              出荷した → 在庫から引き落とす
            </button>
          )}
          {r.status === 'shipped' && (
            <button
              type="button"
              onClick={() => run(deliverShipmentRequest, '納品完了にしました')}
              disabled={pending}
              className="rounded-full bg-[#351E28] text-[#C9A2B8] text-[12px] font-bold px-4 py-2 disabled:opacity-40 hover:brightness-95"
            >
              届いた → 納品完了
            </button>
          )}
          {(r.status === 'requested' || r.status === 'confirmed') && mode === 'staff' && (
            <button
              type="button"
              onClick={() => run(cancelShipmentRequest, '依頼をキャンセルしました')}
              disabled={pending}
              className="rounded-full bg-white border border-[#FF5C34] text-[#B03616] text-[11px] font-bold px-3 py-2 disabled:opacity-40"
            >
              却下
            </button>
          )}
        </div>
      )}
    </div>
  )
}
