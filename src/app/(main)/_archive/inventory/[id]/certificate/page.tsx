import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function InventoryCertificatePage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Get inventory item with client info
  const { data: item } = await supabase
    .from('inventory_items')
    .select(`
      *,
      client:clients(company_name, company_name_en, address, phone)
    `)
    .eq('id', id)
    .single()

  if (!item) {
    notFound()
  }

  const client = Array.isArray(item.client) ? item.client[0] : item.client
  const today = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const certificateNumber = `CERT-${item.id.slice(0, 8).toUpperCase()}`

  return (
    <div className="px-[26px] py-5 space-y-5">
      <div className="flex items-center justify-between">
        <Link
          href="/inventory"
          className="inline-flex items-center gap-1 text-[12px] text-[#888] font-body hover:text-[#0a0a0a] no-underline"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          在庫一覧に戻る
        </Link>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-[#0a0a0a] text-white rounded-[8px] px-[13px] py-[7px] text-[12px] font-body font-medium"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          印刷
        </button>
      </div>

      {/* Certificate */}
      <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-10 print:border-0 print:rounded-none">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-[24px] font-display font-semibold text-[#0a0a0a] mb-2">
            在庫保管証明書
          </h1>
          <p className="text-[14px] text-[#888] font-body">
            Certificate of Inventory Storage
          </p>
        </div>

        {/* Certificate Info */}
        <div className="flex justify-between mb-8">
          <div>
            <p className="text-[11px] text-[#888] font-body">証明書番号</p>
            <p className="text-[14px] font-display tabular-nums text-[#0a0a0a]">{certificateNumber}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-[#888] font-body">発行日</p>
            <p className="text-[14px] font-body text-[#0a0a0a]">{today}</p>
          </div>
        </div>

        {/* Client Info */}
        <div className="mb-8 p-4 bg-[#f2f2f0] rounded-[12px]">
          <p className="text-[11px] text-[#888] font-body mb-1">保管依頼者</p>
          <p className="text-[16px] font-body font-medium text-[#0a0a0a]">{client?.company_name}</p>
          {client?.company_name_en && (
            <p className="text-[12px] text-[#555] font-body">{client.company_name_en}</p>
          )}
        </div>

        {/* Item Details */}
        <div className="mb-8">
          <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a] mb-4 border-b border-[rgba(0,0,0,0.06)] pb-2">
            保管品詳細
          </h2>
          <table className="w-full">
            <tbody>
              <tr className="border-b border-[rgba(0,0,0,0.06)]">
                <th className="text-left py-3 text-[12px] text-[#888] font-body font-normal w-1/3">商品名</th>
                <td className="py-3 text-[13px] text-[#0a0a0a] font-body">{item.product_name}</td>
              </tr>
              <tr className="border-b border-[rgba(0,0,0,0.06)]">
                <th className="text-left py-3 text-[12px] text-[#888] font-body font-normal">SKU</th>
                <td className="py-3 text-[13px] font-display tabular-nums text-[#0a0a0a]">{item.sku || '-'}</td>
              </tr>
              <tr className="border-b border-[rgba(0,0,0,0.06)]">
                <th className="text-left py-3 text-[12px] text-[#888] font-body font-normal">現在数量</th>
                <td className="py-3 text-[16px] font-display tabular-nums font-semibold text-[#0a0a0a]">
                  {item.current_stock.toLocaleString()} 個
                </td>
              </tr>
              <tr className="border-b border-[rgba(0,0,0,0.06)]">
                <th className="text-left py-3 text-[12px] text-[#888] font-body font-normal">保管場所</th>
                <td className="py-3 text-[13px] text-[#0a0a0a] font-body">{item.storage_location || '-'}</td>
              </tr>
              <tr className="border-b border-[rgba(0,0,0,0.06)]">
                <th className="text-left py-3 text-[12px] text-[#888] font-body font-normal">入庫日</th>
                <td className="py-3 text-[13px] font-body text-[#0a0a0a]">
                  {new Date(item.created_at).toLocaleDateString('ja-JP')}
                </td>
              </tr>
              <tr>
                <th className="text-left py-3 text-[12px] text-[#888] font-body font-normal">最終更新</th>
                <td className="py-3 text-[13px] font-body text-[#0a0a0a]">
                  {new Date(item.updated_at).toLocaleDateString('ja-JP')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="mt-10 pt-8 border-t border-[rgba(0,0,0,0.06)]">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-[11px] text-[#888] font-body mb-1">発行者</p>
              <p className="text-[14px] font-display font-semibold text-[#0a0a0a]">(bao)</p>
              <p className="text-[11px] text-[#555] font-body">BAO Flow Logistics Center</p>
            </div>
            <div className="text-right">
              <div className="w-32 h-16 border border-dashed border-[#888] rounded-[8px] flex items-center justify-center">
                <span className="text-[11px] text-[#888] font-body">印鑑</span>
              </div>
            </div>
          </div>
        </div>

        {/* Legal Note */}
        <div className="mt-8 p-4 bg-[#f2f2f0] rounded-[12px]">
          <p className="text-[10px] text-[#888] font-body leading-relaxed">
            本証明書は上記保管品が当社倉庫において適正に保管されていることを証明するものです。
            本証明書の有効期限は発行日から30日間です。保管条件の詳細については別途保管契約書をご参照ください。
          </p>
        </div>
      </div>
    </div>
  )
}
