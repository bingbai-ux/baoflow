import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/lib/utils/format'
import { SearchableCollection } from '@/components/ui/searchable-collection'

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

  const { data: docs, error: docsError } = await supabase
    .from('documents')
    .select('id, deal_id, document_type, document_number, issued_at, created_at, deals(deal_code, deal_name, client_name_text)')
    .order('created_at', { ascending: false })
    .limit(100)
  const {data:bills,error:billingError}=await supabase.from('storage_billing').select('id,invoice_document_id,snapshot')
  const billByDoc=new Map((bills||[]).map(b=>[b.invoice_document_id,b]))

  if (docsError || billingError) throw new Error('Documents could not be loaded')

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
          案件の帳票は各案件から、保管請求は在庫管理から発行します。
        </p>
      </div>

      {(docsError||billingError)&&<p role="alert" className="text-[12px] text-[#B03616] mb-3">帳票または保管請求の履歴を取得できません。再読込して確認してください。</p>}

      {!docsError && !billingError && <SearchableCollection
        label="帳票番号・案件・クライアントで検索"
        categories={Object.entries(DOC_TYPE_LABEL).map(([value, type]) => ({ value, label: type.label }))}
        empty={<div className="bg-white rounded-card border border-[#E2E1DA] p-5 text-[13px] space-y-3">
          <p>発行済みの帳票はありません。案件を選んで発行するか、倉庫で確定した内容から保管請求書を作成してください。</p>
          <div className="flex flex-wrap gap-2"><Link href="/deals" className="min-h-[44px] inline-flex items-center rounded-full bg-[#E9F056] text-[#666C14] px-4 font-bold">案件を選ぶ</Link><Link href="/inventory?tab=fees" className="min-h-[44px] inline-flex items-center rounded-full border border-[#E2E1DA] px-4">保管請求書を作成</Link></div>
        </div>}
        rows={rows.map(d => {
          const bill = billByDoc.get(d.id)
          const storagePdf = d.document_type === 'storage_invoice' && bill?.snapshot
          const type = DOC_TYPE_LABEL[d.document_type || ''] || { label: d.document_type || '—', bg: '#EFEFEA', ink: '#84787D' }
          const client = d.deal?.client_name_text || bill?.snapshot?.client?.name || '—'
          return { id: d.id, category: d.document_type || '', text: [d.document_number, d.deal?.deal_name, d.deal?.deal_code, client, type.label].join(' '), content:
            <article className="rounded-card border border-[#E2E1DA] bg-white px-4 py-3 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1 basis-[240px]">
                <div className="flex flex-wrap items-center gap-2"><span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: type.bg, color: type.ink }}>{type.label}</span><span className="fc-num text-[12px] break-all">{d.document_number || '番号未設定'}</span></div>
                <p className="mt-2 text-[13px] font-bold break-words">{d.deal?.deal_name || (d.document_type === 'storage_invoice' ? '保管料請求' : '案件なし')} <span className="fc-num text-[11px] font-normal text-[#84787D]">{d.deal?.deal_code}</span></p>
                <p className="text-[12px] text-[#84787D]">{client} · 発行 {formatDate(d.issued_at || d.created_at)}</p>
              </div>
              <Link href={storagePdf ? `/api/storage-invoices/${bill.id}/pdf` : d.deal_id ? `/deals/${d.deal_id}/documents` : '/inventory?tab=fees'} className="min-h-[44px] inline-flex items-center rounded-full border border-[#E2E1DA] bg-white px-4 text-[12px] font-bold">
                {storagePdf ? '請求書PDFを確認' : d.deal_id ? '案件の帳票を確認' : '保管請求履歴を確認'}
              </Link>
            </article>
          }
        })}
      />}
    </div>
  )
}
