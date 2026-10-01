import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CaseList, type CaseListRow } from '@/components/deals/case-list'
import { caseAction, approvedAmount, invalidDocumentQuotes, type CaseEvidence } from '@/lib/deals/case-workspace'
import { hasFactoryPrice } from '@/lib/deals/readiness'
import type { SimpleStatus } from '@/lib/types'
import GridView from './grid-view'

export default async function DealsPage({ searchParams }: { searchParams: Promise<{ view?: string; status?: string; q?: string; selected?: string; client?: string }> }) {
  const params = await searchParams
  if (params.view === 'grid') return <GridView searchParams={Promise.resolve(params)} />
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: deals, error } = await supabase.from('deals').select('id,deal_code,deal_name,client_name_text,desired_delivery_date,simple_status,waiting_on,last_activity_at,sales_user_id,sales_user:profiles!deals_sales_user_id_fkey(display_name)').is('archived_at', null).order('last_activity_at', { ascending: false })
  if (error) throw new Error('Deals could not be loaded')
  const ids = (deals || []).map(d => d.id)
  const [products, variants, quotes, rfqs, docs] = ids.length ? await Promise.all([
    supabase.from('deal_products').select('id,deal_id').in('deal_id', ids),
    supabase.from('deal_product_variants').select('id,product_id,deal_products!inner(deal_id)').in('deal_products.deal_id', ids),
    supabase.from('deal_quotes').select('deal_id,variant_id,status,quantity,factory_unit_price_usd,total_billing_jpy,total_billing_tax_jpy').in('deal_id', ids),
    supabase.from('rfq_requests').select('deal_id').in('deal_id', ids),
    supabase.from('documents').select('deal_id,document_type').in('deal_id', ids),
  ]) : []
  if ([products, variants, quotes, rfqs, docs].some(r => r?.error)) throw new Error('Case tasks could not be loaded')
  const byDeal = <T extends { deal_id: string }>(rows: T[]) => {
    const map = new Map<string, T[]>()
    for (const row of rows) { const group = map.get(row.deal_id) || []; group.push(row); map.set(row.deal_id, group) }
    return map
  }
  const productMap = byDeal(products?.data || [])
  const quoteMap = byDeal(quotes?.data || [])
  const rfqMap = byDeal(rfqs?.data || [])
  const docMap = byDeal(docs?.data || [])
  const variantCount = new Map<string, number>()
  const variantsByProduct = new Map<string, string[]>()
  const productDeal = new Map((products?.data || []).map(p => [p.id, p.deal_id]))
  for (const v of variants?.data || []) { const id = productDeal.get(v.product_id); if (id) variantCount.set(id, (variantCount.get(id) || 0) + 1); const group = variantsByProduct.get(v.product_id) || []; group.push(v.id); variantsByProduct.set(v.product_id, group) }
  const rows: CaseListRow[] = (deals || []).map(d => {
    const qs = quoteMap.get(d.id) || [], ds = docMap.get(d.id) || []
    const amount = approvedAmount(qs)
    const ps = productMap.get(d.id) || []
    const vs = ps.flatMap(p => variantsByProduct.get(p.id) || [])
    const evidence: CaseEvidence = { products: ps.length, variants: variantCount.get(d.id) || 0, incompleteProducts: ps.filter(p => !variantsByProduct.has(p.id)).length, missingQuantities: vs.filter(id => !qs.some(q => q.variant_id === id && Number.isInteger(Number(q.quantity)) && Number(q.quantity) > 0)).length, rfqs: rfqMap.get(d.id)?.length || 0, pricedQuotes: qs.filter(hasFactoryPrice).length, approvedQuotes: amount.count, missingAmounts: amount.missing, invalidApprovedQuotes: invalidDocumentQuotes(qs), quotationDocs: ds.filter(x => x.document_type === 'quotation').length, invoiceDocs: ds.filter(x => x.document_type === 'invoice').length }
    const owner = Array.isArray(d.sales_user) ? d.sales_user[0] : d.sales_user
    return { ...d, simple_status: d.simple_status as SimpleStatus, owner: owner?.display_name || null, amount, action: caseAction(d.simple_status as SimpleStatus, evidence) }
  })
  return <CaseList rows={rows} selfId={user.id} today={new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })} />
}
