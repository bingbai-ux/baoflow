// Sprint 13: 在庫証明書 (印刷用)。保管料タブの「在庫証明書」ボタンから開く。
// 番号は documents (inventory_cert) で発行済みのものをクエリで受け取る。

import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { PrintToolbar } from '@/components/print/print-toolbar'
import { formatDate } from '@/lib/utils/format'
import type { CompanyInfoPhase1 } from '@/lib/types'

interface Props {
  params: Promise<{ clientId: string }>
  searchParams: Promise<{ no?: string }>
}

export default async function StockCertificatePage({ params, searchParams }: Props) {
  const { clientId } = await params
  const { no } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: client }, { data: items }, { data: settings }] = await Promise.all([
    supabase.from('clients').select('company_name, short_name, address').eq('id', clientId).single(),
    supabase
      .from('inventory_items')
      .select('item_name, item_code, unit, quantity_on_hand, cartons_on_hand, warehouse_name')
      .eq('client_id', clientId)
      .order('item_name'),
    supabase.from('system_settings').select('company_info_phase1').single(),
  ])
  if (!client) notFound()
  const company = (settings?.company_info_phase1 || {}) as CompanyInfoPhase1
  const today = new Date().toISOString()

  const totalQty = (items || []).reduce((s, i) => s + i.quantity_on_hand, 0)
  const totalCtn = (items || []).reduce((s, i) => s + (i.cartons_on_hand || 0), 0)

  return (
    <div>
      <PrintToolbar />
      <div className="flex items-start justify-between mb-8">
        <h1 className="font-display text-[26px] font-extrabold tracking-wide">在 庫 証 明 書</h1>
        <div className="text-right text-[11px] fc-num">
          {no && <p>No. {no}</p>}
          <p>発行日: {formatDate(today)}</p>
        </div>
      </div>

      <div className="flex justify-between items-end mb-8">
        <div>
          <p className="text-[15px] font-bold border-b border-[#351E28] pb-1 pr-8">
            {client.company_name} 御中
          </p>
          <p className="text-[11px] text-[#84787D] mt-2">
            下記のとおり、貴社商品をお預かりしていることを証明いたします。
          </p>
        </div>
        <div className="text-[11px] text-right leading-relaxed">
          <p className="font-bold text-[13px]">{company.name || '(bao)'}</p>
          {company.address && <p>{company.address}</p>}
          {company.phone && <p>TEL: {company.phone}</p>}
          {company.registration_number && <p className="fc-num">{company.registration_number}</p>}
        </div>
      </div>

      <table className="w-full text-[12px] border-collapse" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <thead>
          <tr className="border-y-2 border-[#351E28] text-[11px]">
            <th className="text-left py-2 px-2">商品名</th>
            <th className="text-left py-2 px-2">品番</th>
            <th className="text-right py-2 px-2">数量</th>
            <th className="text-right py-2 px-2">カートン</th>
            <th className="text-left py-2 px-2">保管場所</th>
          </tr>
        </thead>
        <tbody>
          {(items || []).map((i, idx) => (
            <tr key={idx} className="border-b border-[#E2E1DA]">
              <td className="py-2 px-2">{i.item_name}</td>
              <td className="py-2 px-2 fc-num">{i.item_code || '—'}</td>
              <td className="py-2 px-2 text-right fc-num">
                {i.quantity_on_hand.toLocaleString()} {i.unit}
              </td>
              <td className="py-2 px-2 text-right fc-num">{i.cartons_on_hand ?? '—'}</td>
              <td className="py-2 px-2">{i.warehouse_name || '—'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[#351E28] font-bold">
            <td className="py-2 px-2" colSpan={2}>
              合計
            </td>
            <td className="py-2 px-2 text-right fc-num">{totalQty.toLocaleString()}</td>
            <td className="py-2 px-2 text-right fc-num">{totalCtn}</td>
            <td />
          </tr>
        </tfoot>
      </table>

      <p className="text-[10.5px] text-[#84787D] mt-8">
        ※ 本証明書は発行日時点の在庫数量を示すものです。
      </p>
    </div>
  )
}
