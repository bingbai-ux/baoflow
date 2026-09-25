// Sprint 12: 発送履歴 (出庫仕訳の一覧)。スタッフ / クライアント / ロジで共用。
// サーバーコンポーネントから使える純粋表示 (client hooks なし)。

import type { OutboundHistoryRow } from '@/lib/actions/inventory'
import { formatDate } from '@/lib/utils/format'

export function ShippingHistory({ txs }: { txs: OutboundHistoryRow[] }) {
  if (txs.length === 0) {
    return (
      <p className="text-[12px] text-[#84787D] font-body bg-white rounded-[16px] border border-[#E2E1DA] px-4 py-5">
        まだ発送履歴がありません。
      </p>
    )
  }
  return (
    <div className="bg-white rounded-[16px] border border-[#E2E1DA] overflow-hidden">
      <table className="w-full text-[11.5px] font-body" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <thead>
          <tr className="bg-[#FBFAF6] text-[#84787D] text-[10.5px] font-bold border-b border-[#E2E1DA]">
            <th className="text-left px-4 py-1.5">出荷日</th>
            <th className="text-left px-3 py-1.5">商品</th>
            <th className="text-right px-3 py-1.5">数量</th>
            <th className="text-left px-3 py-1.5">お届け先</th>
            <th className="text-left px-4 py-1.5">メモ</th>
          </tr>
        </thead>
        <tbody>
          {txs.map((t, i) => (
            <tr key={t.id} className={`border-b border-[#EFEFEA] last:border-b-0 ${i % 2 ? 'bg-[#FBFAF6]' : ''}`}>
              <td className="px-4 py-1.5 fc-num">{formatDate(t.occurred_on)}</td>
              <td className="px-3 py-1.5 font-bold text-[#351E28]">{t.item?.item_name || '—'}</td>
              <td className="px-3 py-1.5 text-right fc-num font-bold">
                {Math.abs(t.quantity_delta).toLocaleString()} {t.item?.unit || ''}
              </td>
              <td className="px-3 py-1.5">{t.destination || '—'}</td>
              <td className="px-4 py-1.5 text-[#84787D]">{t.note || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
