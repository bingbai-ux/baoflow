import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireSalesAccess } from '@/lib/actions/deal-access'
import { defaultIssuerName } from '@/lib/actions/issuer-companies'
import { cartonLabelsPDF } from '@/lib/pdf/carton-labels'

// 再設計 工程8: 段ボールラベルのPDF（営業・管理者のみ）。届け先と箱数が保存されていないと作れない。

export const dynamic = 'force-dynamic'
const fail = (message: string, status: number) => new NextResponse(message, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } })

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return fail('案件が見つかりません', 404)
  const supabase = await createClient()
  const accessError = await requireSalesAccess(supabase)
  if (accessError) return fail(accessError, 403)
  const [deal, shipment, products] = await Promise.all([
    supabase.from('deals').select('deal_code, deal_name').eq('id', id).limit(1),
    supabase.from('deal_shipments').select('ship_to_name, ship_to_postal_code, ship_to_address, ship_to_phone, carton_count').eq('deal_id', id).limit(1),
    supabase.from('deal_products').select('description, sort_order, product_no').eq('deal_id', id).order('sort_order'),
  ])
  if (deal.error || shipment.error || products.error) return fail('ラベルの内容を読み込めませんでした', 500)
  const d = deal.data?.[0], s = shipment.data?.[0]
  if (!d) return fail('案件が見つかりません', 404)
  if (!s?.ship_to_name || !s.ship_to_address || !s.carton_count) return fail('先に届け先と箱数を保存してください', 409)
  const pdf = await cartonLabelsPDF({
    dealCode: d.deal_code || '', dealName: d.deal_name || '', toName: s.ship_to_name, toPostalCode: s.ship_to_postal_code || '', toAddress: s.ship_to_address, toPhone: s.ship_to_phone || '',
    fromName: await defaultIssuerName(), contents: (products.data || []).map(p => p.description).filter(Boolean) as string[], cartonCount: s.carton_count,
  })
  return new NextResponse(Buffer.from(pdf), { headers: { 'content-type': 'application/pdf', 'content-disposition': `inline; filename="carton-labels-${encodeURIComponent(d.deal_code || id)}.pdf"`, 'cache-control': 'no-store' } })
}
