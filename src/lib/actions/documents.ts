'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type DocumentType = 'quotation' | 'invoice' | 'delivery_note' | 'rfq'

export interface DocumentRow {
  id: string
  deal_id: string
  document_type: DocumentType
  document_number: string | null
  version: number | null
  metadata: Record<string, unknown> | null
  issued_at: string
  created_at: string
}

const PREFIX_BY_TYPE: Record<DocumentType, string> = {
  quotation: 'QUO',
  invoice: 'INV',
  delivery_note: 'DLV',
  rfq: 'RFQ',
}

async function nextDocumentNumber(supabase: Awaited<ReturnType<typeof createClient>>, type: DocumentType): Promise<string> {
  const prefix = PREFIX_BY_TYPE[type]
  const ym = new Date().toISOString().slice(0, 7).replace('-', '') // YYYYMM
  const startsWith = `${prefix}-${ym}-`

  const { data } = await supabase
    .from('documents')
    .select('document_number')
    .eq('document_type', type)
    .like('document_number', `${startsWith}%`)
    .order('document_number', { ascending: false })
    .limit(1)

  let next = 1
  if (data && data.length > 0 && data[0].document_number) {
    const tail = data[0].document_number.split('-').pop()
    const n = Number(tail)
    if (Number.isFinite(n)) next = n + 1
  }
  return `${startsWith}${String(next).padStart(3, '0')}`
}

export async function issueDocument(input: {
  deal_id: string
  document_type: DocumentType
  metadata?: Record<string, unknown>
}): Promise<{ data: DocumentRow | null; error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Unauthorized' }

  const number = await nextDocumentNumber(supabase, input.document_type)

  const { data, error } = await supabase
    .from('documents')
    .insert({
      deal_id: input.deal_id,
      document_type: input.document_type,
      document_number: number,
      version: 1,
      metadata: input.metadata || null,
      issued_at: new Date().toISOString(),
      issued_by_user_id: user.id,
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }

  revalidatePath(`/deals/${input.deal_id}`)
  revalidatePath(`/deals/${input.deal_id}/documents`)
  return { data: data as DocumentRow, error: null }
}

export async function listDocumentsForDeal(dealId: string): Promise<DocumentRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('documents')
    .select('id, deal_id, document_type, document_number, version, metadata, issued_at, created_at')
    .eq('deal_id', dealId)
    .order('issued_at', { ascending: false })
  return (data || []) as DocumentRow[]
}

export async function previewNextNumber(type: DocumentType): Promise<string> {
  const supabase = await createClient()
  return nextDocumentNumber(supabase, type)
}

// Sprint 6 fixes: 1 回で帳票モーダルに必要な全データを取得
export async function fetchDocumentBundle(
  dealId: string
): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Unauthorized' }

  const [
    { data: deal },
    { data: specs },
    { data: products },
    { data: variantsRaw },
    { data: quotes },
    { data: fees },
    docs,
    { data: settings },
    nextQuotation,
    nextInvoice,
    nextDelivery,
    nextRfq,
  ] = await Promise.all([
    supabase
      .from('deals')
      .select('id, deal_code, deal_name, client_name_text, desired_delivery_date')
      .eq('id', dealId)
      .single(),
    supabase
      .from('deal_specifications')
      .select(
        'id, product_name, product_category, height_mm, width_mm, depth_mm, material_category, print_colors, printing_method, processing_list, specification_memo'
      )
      .eq('deal_id', dealId)
      .order('created_at', { ascending: true }),
    supabase
      .from('deal_products')
      .select('id, product_no, description')
      .eq('deal_id', dealId)
      .order('product_no', { ascending: true }),
    supabase
      .from('deal_product_variants')
      .select('*, deal_products!inner(deal_id)')
      .eq('deal_products.deal_id', dealId)
      .order('variant_order', { ascending: true }),
    supabase
      .from('deal_quotes')
      .select(
        'id, spec_id, variant_id, version, quantity, moq, selling_price_jpy, total_billing_jpy, total_billing_tax_jpy, status, cost_ratio'
      )
      .eq('deal_id', dealId)
      .order('version', { ascending: false }),
    supabase
      .from('deal_fees')
      .select('id, spec_id, variant_id, fee_type, amount_jpy, is_initial_only, note')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: true }),
    listDocumentsForDeal(dealId),
    supabase.from('system_settings').select('*').limit(1).single(),
    nextDocumentNumber(supabase, 'quotation'),
    nextDocumentNumber(supabase, 'invoice'),
    nextDocumentNumber(supabase, 'delivery_note'),
    nextDocumentNumber(supabase, 'rfq'),
  ])

  if (!deal) return { data: null, error: '案件が見つかりません' }

  const variants = (variantsRaw || []).map((v) => {
    const { deal_products: _omit, ...rest } = v as Record<string, unknown>
    return rest
  })

  return {
    data: {
      deal,
      specs: specs || [],
      products: products || [],
      variants,
      quotes: quotes || [],
      fees: fees || [],
      docs,
      company: settings?.company_info_phase1 || null,
      banks: settings?.bank_accounts_phase1 || null,
      defaultShippingAddress: settings?.default_shipping_address || null,
      nextNumbers: {
        quotation: nextQuotation,
        invoice: nextInvoice,
        delivery_note: nextDelivery,
        rfq: nextRfq,
      },
    },
    error: null,
  }
}
