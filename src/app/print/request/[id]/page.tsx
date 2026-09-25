// Sprint 13: 出荷指示書 (印刷用)。出荷依頼カードの「出荷指示書」から開く。

import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { PrintToolbar } from '@/components/print/print-toolbar'
import { formatDate } from '@/lib/utils/format'
import type { CompanyInfoPhase1 } from '@/lib/types'

interface Props {
  params: Promise<{ id: string }>
}

const STATUS_LABEL: Record<string, string> = {
  requested: '依頼受付',
  confirmed: '確認済み',
  shipped: '出荷済み',
  delivered: '納品完了',
  cancelled: 'キャンセル',
}

export default async function ShippingInstructionPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: req }, { data: settings }] = await Promise.all([
    supabase
      .from('shipment_requests')
      .select(
        `*,
         client:clients(company_name, short_name),
         items:shipment_request_items(quantity, note, item:inventory_items(item_name, item_code, unit, warehouse_name, location_note))`
      )
      .eq('id', id)
      .single(),
    supabase.from('system_settings').select('company_info_phase1').single(),
  ])
  if (!req) notFound()
  const company = (settings?.company_info_phase1 || {}) as CompanyInfoPhase1
  const items = (req.items || []) as Array<{
    quantity: number
    note: string | null
    item: { item_name: string; item_code: string | null; unit: string; warehouse_name: string | null; location_note: string | null } | null
  }>

  return (
    <div>
      <PrintToolbar />
      <div className="flex items-start justify-between mb-8">
        <h1 className="font-display text-[26px] font-extrabold tracking-wide">出 荷 指 示 書</h1>
        <div className="text-right text-[11px] fc-num">
          <p>No. {req.request_no}</p>
          <p>発行日: {formatDate(new Date().toISOString())}</p>
          <p>状態: {STATUS_LABEL[req.status] || req.status}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8 text-[12px]">
        <div className="border border-[#351E28] rounded-[8px] p-4">
          <p className="text-[10.5px] text-[#84787D] font-bold mb-1">お届け先</p>
          <p className="text-[15px] font-bold">{req.destination_name || '—'}</p>
          {req.destination_address && <p className="mt-1">{req.destination_address}</p>}
          {req.desired_date && (
            <p className="mt-2 fc-num">希望日: {formatDate(req.desired_date)}</p>
          )}
        </div>
        <div className="text-[11px] leading-relaxed">
          <p className="text-[10.5px] text-[#84787D] font-bold mb-1">依頼元 (荷主)</p>
          <p className="text-[13px] font-bold">
            {(req.client as { company_name?: string } | null)?.company_name || '—'}
          </p>
          <p className="mt-3 text-[10.5px] text-[#84787D] font-bold mb-1">発行</p>
          <p className="font-bold">{company.name || '(bao)'}</p>
          {company.phone && <p>TEL: {company.phone}</p>}
        </div>
      </div>

      <table className="w-full text-[12px] border-collapse" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <thead>
          <tr className="border-y-2 border-[#351E28] text-[11px]">
            <th className="text-left py-2 px-2">商品名</th>
            <th className="text-left py-2 px-2">品番</th>
            <th className="text-right py-2 px-2">出荷数量</th>
            <th className="text-left py-2 px-2">保管場所</th>
            <th className="text-left py-2 px-2">備考</th>
          </tr>
        </thead>
        <tbody>
          {items.map((l, idx) => (
            <tr key={idx} className="border-b border-[#E2E1DA]">
              <td className="py-2 px-2 font-bold">{l.item?.item_name || '—'}</td>
              <td className="py-2 px-2 fc-num">{l.item?.item_code || '—'}</td>
              <td className="py-2 px-2 text-right fc-num font-bold">
                {l.quantity.toLocaleString()} {l.item?.unit || ''}
              </td>
              <td className="py-2 px-2">
                {[l.item?.warehouse_name, l.item?.location_note].filter(Boolean).join(' ') || '—'}
              </td>
              <td className="py-2 px-2">{l.note || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {req.note && (
        <div className="mt-6 text-[12px]">
          <p className="text-[10.5px] text-[#84787D] font-bold mb-1">備考</p>
          <p className="border border-[#E2E1DA] rounded-[8px] p-3">{req.note}</p>
        </div>
      )}

      <div className="mt-10 grid grid-cols-3 gap-4 text-[10.5px] text-center">
        {['出荷担当', '検品', '確認'].map((label) => (
          <div key={label}>
            <p className="mb-1 text-[#84787D]">{label}</p>
            <div className="border border-[#351E28] rounded-[8px] h-[64px]" />
          </div>
        ))}
      </div>
    </div>
  )
}
