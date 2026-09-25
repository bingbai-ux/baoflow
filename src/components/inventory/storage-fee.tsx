'use client'

// Sprint 13: 保管料 (クライアント別単価の保存 + 在庫証明書の発行)。
// 現在庫カートン数 × クライアント別の月額単価で概算する (簡易版)。
// 単価は clients.storage_rate_config.monthly_per_carton に保存され、次回も使われる。

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { InventoryItemRow } from '@/lib/actions/inventory'
import { updateClientStorageRate } from '@/lib/actions/inventory'
import { issueStandaloneDocument } from '@/lib/actions/documents'
import { useUi } from '@/components/ui/ui-store'
import { formatJPY } from '@/lib/utils/format'

interface ClientOpt {
  id: string
  company_name: string
  short_name: string | null
  storage_rate_config?: Record<string, unknown> | null
}

export function StorageFeeSection({
  items,
  clients,
}: {
  items: InventoryItemRow[]
  clients: ClientOpt[]
}) {
  const router = useRouter()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const rows = useMemo(() => {
    const byClient = new Map<
      string,
      { clientId: string | null; name: string; itemCount: number; qty: number; cartons: number; savedRate: number }
    >()
    for (const i of items) {
      const key = i.client_id || 'none'
      const c = clients.find((x) => x.id === i.client_id)
      const savedRate = Number(
        (c?.storage_rate_config as { monthly_per_carton?: number } | null)?.monthly_per_carton ?? 0
      )
      const cur = byClient.get(key) || {
        clientId: i.client_id,
        name: c ? c.short_name || c.company_name : '(クライアント未設定)',
        itemCount: 0,
        qty: 0,
        cartons: 0,
        savedRate,
      }
      cur.itemCount += 1
      cur.qty += i.quantity_on_hand
      cur.cartons += i.cartons_on_hand || 0
      byClient.set(key, cur)
    }
    return Array.from(byClient.values()).sort((a, b) => b.cartons - a.cartons)
  }, [items, clients])

  const rateOf = (r: (typeof rows)[number]) =>
    Number(drafts[r.clientId || 'none'] ?? (r.savedRate || '')) || 0

  const total = rows.reduce((s, r) => s + r.cartons * rateOf(r), 0)

  const saveRate = (clientId: string | null, value: number) => {
    if (!clientId) return
    startTransition(async () => {
      const res = await updateClientStorageRate(clientId, value)
      if (res.success) {
        toast('単価を保存しました')
        router.refresh()
      } else toast(res.error || '保存に失敗しました', 'warn')
    })
  }

  const issueCert = (clientId: string | null, name: string) => {
    startTransition(async () => {
      const r = await issueStandaloneDocument({
        document_type: 'inventory_cert',
        metadata: { client_id: clientId, client_name: name },
      })
      if (r.number && clientId) {
        toast(`在庫証明書 ${r.number} を発行しました`)
        window.open(`/print/stock/${clientId}?no=${encodeURIComponent(r.number)}`, '_blank')
      } else {
        toast(r.error || '発行に失敗しました', 'warn')
      }
    })
  }

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-[#84787D] font-body">
        現在庫のカートン数 × クライアント別の月額単価で概算します(簡易版)。単価は保存され、次回もそのまま使われます。
      </p>

      <div className="bg-white rounded-[16px] border border-[#E2E1DA] overflow-x-auto">
        <table className="w-full text-[11.5px] font-body" style={{ fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr className="bg-[#FBFAF6] text-[#84787D] text-[10.5px] font-bold border-b border-[#E2E1DA]">
              <th className="text-left px-4 py-2">クライアント</th>
              <th className="text-right px-3 py-2">品目数</th>
              <th className="text-right px-3 py-2">総数量</th>
              <th className="text-right px-3 py-2">カートン</th>
              <th className="text-right px-3 py-2">単価(円/CTN・月)</th>
              <th className="text-right px-3 py-2">保管料(月・概算)</th>
              <th className="text-right px-4 py-2 w-[130px]"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const key = r.clientId || 'none'
              return (
                <tr key={key} className={`border-b border-[#EFEFEA] last:border-b-0 ${i % 2 ? 'bg-[#FBFAF6]' : ''}`}>
                  <td className="px-4 py-2 font-bold text-[#351E28]">{r.name}</td>
                  <td className="px-3 py-2 text-right fc-num">{r.itemCount}</td>
                  <td className="px-3 py-2 text-right fc-num">{r.qty.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right fc-num font-bold">{r.cartons}</td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      value={drafts[key] ?? (r.savedRate || '')}
                      onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                      onBlur={(e) => {
                        const v = Number(e.target.value)
                        if (r.clientId && Number.isFinite(v) && v !== r.savedRate) saveRate(r.clientId, v)
                      }}
                      disabled={!r.clientId || pending}
                      className="w-[90px] text-right fc-num bg-[#EFEFEA] rounded-[10px] px-2.5 py-1.5 border border-transparent outline-none focus:border-[#351E28] disabled:opacity-40"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-3 py-2 text-right fc-num font-bold text-[#351E28]">
                    {formatJPY(r.cartons * rateOf(r))}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => issueCert(r.clientId, r.name)}
                      disabled={!r.clientId || pending}
                      className="rounded-full bg-white border border-[#E2E1DA] text-[#351E28] text-[10.5px] font-bold px-2.5 py-1 hover:bg-[#FBFAF6] disabled:opacity-40"
                    >
                      在庫証明書
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-[#D7EFFF]">
              <td className="px-4 py-2 font-bold text-[#33566F]" colSpan={5}>
                合計
              </td>
              <td className="px-3 py-2 text-right fc-num font-extrabold text-[#33566F]">
                {formatJPY(total)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-[10.5px] text-[#84787D] font-body">
        ※ カートン数が未入力の商品は 0 として計算。正式な料金体系(日割り・坪単価等)が決まったら精緻化します。
      </p>
    </div>
  )
}
