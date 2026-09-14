import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/lib/utils/format'

// Sprint 10 監査対応: サイドバー「帳票」の行き先が無かった(404)ため新設。
// 発行済み帳票を案件横断で一覧し、各案件の帳票ページへつなぐ。

const DOC_TYPE_LABEL: Record<string, { label: string; bg: string; ink: string }> = {
  quotation: { label: '見積書', bg: '#E9F056', ink: '#666C14' },
  invoice: { label: '請求書', bg: '#D7EFFF', ink: '#33566F' },
  delivery_note: { label: '納品書', bg: '#AEB8A0', ink: '#4C5544' },
  rfq: { label: 'RFQ', bg: '#FFD8C2', ink: '#B03616' },
  inventory_cert: { label: '在庫証明', bg: '#EFEFEA', ink: '#84787D' },
  storage_invoice: { label: '保管料請求', bg: '#EFEFEA', ink: '#84787D' },
}

export default async function DocsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: docs } = await supabase
    .from('documents')
    .select('id, deal_id, document_type, document_number, issued_at, created_at, deals(deal_code, deal_name, client_name_text)')
    .order('created_at', { ascending: false })
    .limit(100)

  const rows = (docs || []).map((d) => ({
    ...d,
    deal: Array.isArray(d.deals) ? d.deals[0] : d.deals,
  }))

  return (
    <div>
      <div className="py-[18px]">
        <h1 className="font-display text-[21px] font-extrabold text-[#351E28]">帳票</h1>
        <p className="text-[12.5px] text-[#84787D] font-body mt-1">
          発行済みの帳票 <span className="fc-num">{rows.length}件</span>(新しい順・直近100件)。
          帳票の発行は各案件の「帳票発行」から行います。
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-[16px] border border-[#E2E1DA] px-5 py-8 text-[12.5px] text-[#84787D] font-body">
          まだ帳票がありません。案件詳細の「帳票発行」から見積書・請求書・納品書・RFQをつくれます。
        </div>
      ) : (
        <div className="bg-white rounded-[16px] border border-[#E2E1DA] overflow-hidden">
          <div className="grid grid-cols-[90px_140px_minmax(0,1.5fr)_minmax(0,1fr)_90px_110px] gap-2 px-4 py-2 bg-[#FBFAF6] border-b border-[#E2E1DA] text-[11px] font-bold text-[#84787D]">
            <span>種別</span>
            <span>番号</span>
            <span>案件</span>
            <span>クライアント</span>
            <span>発行日</span>
            <span className="text-right"></span>
          </div>
          {rows.map((d) => {
            const t = DOC_TYPE_LABEL[d.document_type || ''] || {
              label: d.document_type || '—',
              bg: '#EFEFEA',
              ink: '#84787D',
            }
            return (
              <div
                key={d.id}
                className="grid grid-cols-[90px_140px_minmax(0,1.5fr)_minmax(0,1fr)_90px_110px] gap-2 px-4 py-2.5 items-center border-b border-[#EFEFEA] last:border-b-0 hover:bg-[#FBFAF6]"
              >
                <span
                  className="inline-block w-fit rounded-full px-2.5 py-1 text-[10.5px] font-bold leading-none whitespace-nowrap"
                  style={{ background: t.bg, color: t.ink }}
                >
                  {t.label}
                </span>
                <span className="fc-num text-[11.5px] text-[#351E28] truncate">
                  {d.document_number || '—'}
                </span>
                <span className="text-[12px] text-[#351E28] truncate">
                  {d.deal?.deal_name || '(案件名未設定)'}
                  <span className="fc-num text-[10.5px] text-[#84787D] ml-1.5">{d.deal?.deal_code}</span>
                </span>
                <span className="text-[11.5px] text-[#84787D] truncate">
                  {d.deal?.client_name_text || '—'}
                </span>
                <span className="fc-num text-[11px] text-[#84787D]">
                  {formatDate(d.issued_at || d.created_at)}
                </span>
                <span className="text-right">
                  <Link
                    href={`/deals/${d.deal_id}/documents`}
                    className="no-underline rounded-full bg-white border border-[#E2E1DA] text-[#351E28] text-[10.5px] font-bold px-3 py-1.5 hover:bg-[#FBFAF6] whitespace-nowrap"
                  >
                    案件の帳票へ
                  </Link>
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
