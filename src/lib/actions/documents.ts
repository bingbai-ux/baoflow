'use server'

import { createClient } from '@/lib/supabase/server'
import { requireSalesAccess } from './deal-access'
import { revalidatePath } from 'next/cache'

export type DocumentType = 'quotation' | 'invoice' | 'delivery_note' | 'rfq' | 'inventory_cert'

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
  inventory_cert: 'CRT',
}

async function nextDocumentNumber(supabase: Awaited<ReturnType<typeof createClient>>, type: DocumentType): Promise<string> {
  const prefix = PREFIX_BY_TYPE[type]
  const ym = new Date().toISOString().slice(0, 7).replace('-', '') // YYYYMM
  const startsWith = `${prefix}-${ym}-`

  const { data, error } = await supabase
    .from('documents')
    .select('document_number')
    .eq('document_type', type)
    .like('document_number', `${startsWith}%`)


  if (error) throw new Error('帳票番号を取得できませんでした')
  const existing = (data || []).map(row => Number(row.document_number?.slice(startsWith.length))).filter(Number.isSafeInteger)
  const next = Math.max(0, ...existing) + 1
  return `${startsWith}${String(next).padStart(3, '0')}`
}

export async function issueDocument(input: {
  request_id: string
  deal_id: string
  document_type: DocumentType
  metadata?: Record<string, unknown>
}): Promise<{ data: DocumentRow | null; error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Unauthorized' }

  const accessError = await requireSalesAccess(supabase)
  if (accessError) return { data: null, error: accessError }
  const bundle = await fetchDocumentBundle(input.deal_id)
  if (bundle.error || !bundle.data) return { data: null, error: bundle.error || '帳票データを取得できませんでした' }
  const quotes = bundle.data.quotes as Array<{ status: string; quantity: number; total_billing_jpy: number }>
  const approved = quotes.filter(q => q.status === 'approved')
  if (input.document_type !== 'rfq' && (!approved.length || approved.some(q => !Number.isInteger(Number(q.quantity)) || Number(q.quantity) <= 0 || q.total_billing_jpy == null || !Number.isFinite(Number(q.total_billing_jpy)) || Number(q.total_billing_jpy) < 0)))
    return { data: null, error: '有効な数量・金額の採用見積を登録してから発行してください' }
  if (input.document_type === 'rfq' && !(bundle.data.variants as unknown[]).length)
    return { data: null, error: '商品仕様を登録してからRFQを発行してください' }
  const { deal, specs, products, variants, fees, company, banks } = bundle.data
  const byId = (rows: unknown) => (rows as Array<Record<string, unknown>>).slice().sort((a,b) => String(a.id).localeCompare(String(b.id)))
  const snapshot = { deal, specs: byId(specs), products: byId(products), variants: byId(variants), quotes: byId(quotes), fees: byId(fees), company, banks }
  const { data, error } = await supabase.rpc('issue_document_atomic', {
    p_request_id: input.request_id, p_deal_id: input.deal_id, p_type: input.document_type,
    p_metadata: input.metadata || {}, p_snapshot: snapshot,
  })
  if (error || !data) return { data: null, error: error?.message.includes('different input')
    ? 'この依頼IDは既に発行済みです。内容が変わっているため、発行履歴を確認してください'
    : error?.message.includes('Legacy separate fees') ? '旧別途費用と新価格版の費目が未整理です。二重請求を避けるため発行を停止しました。担当者が配賦を確認してください'
    : error?.message.includes('manual FX') || error?.message.includes('Revise all') ? '発行時の手入力FXと全採用価格版を確認してください。変更があれば価格を改訂してPDFを再確認してください'
    : error?.message.includes('snapshot changed') ? '価格版が変更されています。再読込して採用版とPDFを確認してください'
    : '帳票を発行できませんでした。同じ内容で再試行してください' }

  revalidatePath(`/deals/${input.deal_id}`)
  revalidatePath(`/deals/${input.deal_id}/documents`)
  return { data: data as DocumentRow, error: null }
}

/**
 * Sprint 13: 案件に紐付かない帳票の発行 (在庫証明書など)。
 * 番号は既存の nextDocumentNumber 方式を共有する。
 */
export async function issueStandaloneDocument(input: {
  request_id: string
  document_type: DocumentType
  metadata?: Record<string, unknown>
}): Promise<{ number: string | null; error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { number: null, error: 'Unauthorized' }

  const accessError = await requireSalesAccess(supabase)
  if (accessError) return { number: null, error: accessError }
  const { data, error } = await supabase.rpc('issue_document_atomic', {
    p_request_id: input.request_id, p_deal_id: null, p_type: input.document_type,
    p_metadata: input.metadata || {}, p_snapshot: {},
  })
  if (error || !data) return { number: null, error: '帳票を発行できませんでした。同じ内容で再試行してください' }
  return { number: (data as DocumentRow).document_number, error: null }
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
    { data: deal, error: dealError },
    { data: specs, error: specsError },
    { data: products, error: productsError },
    { data: variantsRaw, error: variantsError },
    { data: quotes, error: quotesError },
    { data: fees, error: feesError },
    docs,
    { data: settings, error: settingsError },
    nextQuotation,
    nextInvoice,
    nextDelivery,
    nextRfq,
  ] = await Promise.all([
    supabase
      .from('deals')
      .select('id, deal_code, deal_name, client_id, client_name_text, desired_delivery_date')
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
        'id, spec_id, variant_id, version, quantity, moq, selling_price_jpy, total_billing_jpy, total_billing_tax_jpy, status, pricing_snapshot'
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

  if ([dealError, specsError, productsError, variantsError, quotesError, feesError, settingsError].some(Boolean)) return { data: null, error: '帳票データの取得に失敗しました。再読み込みしてください' }
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
      // Sprint 9: 帳票定型文 (system_settings)
      boilerplateTexts: {
        quotation: settings?.quote_default_text || '',
        invoice: settings?.invoice_default_text || '',
        delivery_note: settings?.delivery_note_default_text || '',
        rfq: settings?.rfq_default_text || '',
      },
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
