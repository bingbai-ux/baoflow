'use client'

// Sprint 12: 保管料の簡易計算 (現在庫スナップショット方式)。
// クライアントごとの現在カートン数 × 月額単価で概算し、請求メモとして使う。
// ※日割り・坪貸し等の正式な料金体系が決まったら精緻化する。

import { useMemo, useState } from 'react'
import type { InventoryItemRow } from '@/lib/actions/inventory'
import { formatJPY } from '@/lib/utils/format'

interface ClientOpt {
  id: string
  company_name: string
  short_name: string | null
}

export function StorageFeeSection({
  items,
  clients,
}: {
  items: InventoryItemRow[]
  clients: ClientOpt[]
}) {
  const [ratePerCarton, setRatePerCarton] = useState('100')

  const rows = useMemo(() => {
    const byClient = new Map<
      string,
      { name: string; itemCount: number; qty: number; cartons: number }
    >()
    for (const i of items) {
      const key = i.client_id || 'none'
      const c = clients.find((x) => x.id === i.client_id)
      const cur = byClient.get(key) || {
        name: c ? c.short_name || c.company_name : '(クライアント未設定)',
        itemCount: 0,
        qty: 0,
        cartons: 0,
      }
      cur.itemCount += 1
      cur.qty += i.quantity_on_hand
      cur.cartons += i.cartons_on_hand || 0
      byClient.set(key, cur)
    }
    return Array.from(byClient.values()).sort((a, b) => b.cartons - a.cartons)
  }, [items, clients])

  const rate = Number(ratePerCarton) || 0
  const total = rows.reduce((s, r) => s + r.cartons * rate, 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-[12px] text-[#84787D] font-body">
          現在庫のカートン数 × 月額単価で概算します(簡易版)。
        </p>
        <label className="text-[11px] text-[#84787D] font-body inline-flex items-center gap-1.5">
          カートン単価(円/CTN・月)
          <input
            type="number"
            min={0}
            value={ratePerCarton}
            onChange={(e) => setRatePerCarton(e.target.value)}
            className="w-[90px] text-right fc-num bg-[#EFEFEA] rounded-[10px] px-2.5 py-1.5 text-[12px] border border-transparent outline-none focus:border-[#351E28]"
          />
        </label>
      </div>

      <div className="bg-white rounded-[16px] border border-[#E2E1DA] overflow-hidden">
        <table className="w-full text-[11.5px] font-body" style={{ fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr className="bg-[#FBFAF6] text-[#84787D] text-[10.5px] font-bold border-b border-[#E2E1DA]">
              <th className="text-left px-4 py-2">クライアント</th>
              <th className="text-right px-3 py-2">品目数</th>
              <th className="text-right px-3 py-2">総数量</th>
              <th className="text-right px-3 py-2">カートン</th>
              <th className="text-right px-4 py-2">保管料(月・概算)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.name} className={`border-b border-[#EFEFEA] last:border-b-0 ${i % 2 ? 'bg-[#FBFAF6]' : ''}`}>
                <td className="px-4 py-2 font-bold text-[#351E28]">{r.name}</td>
                <td className="px-3 py-2 text-right fc-num">{r.itemCount}</td>
                <td className="px-3 py-2 text-right fc-num">{r.qty.toLocaleString()}</td>
                <td className="px-3 py-2 text-right fc-num font-bold">{r.cartons}</td>
                <td className="px-4 py-2 text-right fc-num font-bold text-[#351E28]">
                  {formatJPY(r.cartons * rate)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#D7EFFF]">
              <td className="px-4 py-2 font-bold text-[#33566F]" colSpan={4}>
                合計
              </td>
              <td className="px-4 py-2 text-right fc-num font-extrabold text-[#33566F]">
                {formatJPY(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-[10.5px] text-[#84787D] font-body">
        ※ カートン数が未入力の商品は 0 として計算されます。正式な料金体系(日割り・坪単価等)が決まったら精緻化します。
      </p>
    </div>
  )
}
