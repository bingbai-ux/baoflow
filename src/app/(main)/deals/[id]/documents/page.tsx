import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { DocumentIssuer } from '@/components/documents/document-issuer'
import { listDocumentsForDeal, previewNextNumber } from '@/lib/actions/documents'
import { getSettings } from '@/lib/actions/settings'

interface Props {
  params: Promise<{ id: string }>
}

export default async function DocumentsPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: deal }, { data: specs }, { data: quotes }, { data: fees }, docs, settings] =
    await Promise.all([
      supabase
        .from('deals')
        .select('id, deal_code, deal_name, client_name_text, desired_delivery_date')
        .eq('id', id)
        .single(),
      supabase
        .from('deal_specifications')
        .select(
          'id, product_name, product_category, height_mm, width_mm, depth_mm, material_category, print_colors, printing_method, processing_list, specification_memo'
        )
        .eq('deal_id', id)
        .order('created_at', { ascending: true }),
      supabase
        .from('deal_quotes')
        .select(
          'id, spec_id, version, quantity, selling_price_jpy, total_billing_jpy, total_billing_tax_jpy, status, cost_ratio'
        )
        .eq('deal_id', id)
        .order('version', { ascending: false }),
      supabase
        .from('deal_fees')
        .select('id, spec_id, fee_type, amount_jpy, is_initial_only, note')
        .eq('deal_id', id)
        .order('created_at', { ascending: true }),
      listDocumentsForDeal(id),
      getSettings(),
    ])

  if (!deal) notFound()

  const [nextQuotation, nextInvoice, nextDelivery] = await Promise.all([
    previewNextNumber('quotation'),
    previewNextNumber('invoice'),
    previewNextNumber('delivery_note'),
  ])

  return (
    <>
      <Link
        href={`/deals/${id}`}
        className="inline-flex items-center gap-1 text-[13px] text-[#888] font-body no-underline hover:text-[#555] mt-4 mb-2 no-print"
      >
        <ChevronLeft className="w-4 h-4" />
        案件詳細に戻る
      </Link>

      <div className="py-3 no-print">
        <p className="text-[11px] text-[#888] font-body tabular-nums">{deal.deal_code}</p>
        <h1 className="font-display text-[24px] font-semibold text-[#0a0a0a]">帳票発行</h1>
        <p className="text-[12px] font-body text-[#888] mt-1">
          採用された見積と別途費用が自動的に明細に入ります。
        </p>
      </div>

      <DocumentIssuer
        deal={deal}
        specs={specs || []}
        quotes={(quotes || []) as never}
        fees={(fees || []) as never}
        company={settings?.company_info_phase1 || null}
        banks={settings?.bank_accounts_phase1 || null}
        defaultShippingAddress={settings?.default_shipping_address || null}
        initialDocs={docs}
        nextNumbers={{ quotation: nextQuotation, invoice: nextInvoice, delivery_note: nextDelivery }}
      />
    </>
  )
}
