'use client'

// Sprint 12: 発送履歴 (出庫仕訳の一覧)。スタッフ / クライアント / ロジで共用。
// 渡された表示範囲だけを検索する。追加の取得・書込みはしない。

import {useState} from 'react'
import {SearchField,matchesSearch} from '@/components/ui/search-field'
import type { OutboundHistoryRow } from '@/lib/actions/inventory'
import { formatDate } from '@/lib/utils/format'

export function ShippingHistory({ txs }: { txs: OutboundHistoryRow[] }) {
  const [search,setSearch]=useState('')
  const visible=txs.filter(t=>matchesSearch(search,[t.item?.item_name,t.destination,t.note]))
  if (txs.length === 0) {
    return (
      <p className="text-[12px] text-[#84787D] font-body bg-white rounded-[16px] border border-[#E2E1DA] px-4 py-5">
        まだ発送履歴がありません。
      </p>
    )
  }
  return (
    <div><SearchField label="商品・届け先・メモで検索" value={search} onChange={setSearch} count={visible.length}/>
      {visible.length===0&&<p className="text-[12px]">一致する発送履歴がありません。検索を解除してください。</p>}
      <div className="bg-white rounded-[16px] border border-[#E2E1DA] overflow-x-auto">
      <table className="w-full min-w-[600px] text-[11.5px] font-body" style={{ fontVariantNumeric: 'tabular-nums' }}>
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
          {visible.map((t, i) => (
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
    </div></div>
  )
}
