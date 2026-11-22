import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireSalesAccess } from '@/lib/actions/deal-access'
import { deliveryNotePDF } from '@/lib/pdf/receipt-delivery-note'
import type { ReceiptSnapshot } from '@/lib/process/receipt-format'

// 再設計 工程9: 納品書のPDF（営業・管理者のみ）。受領済みの案件だけ。

export const dynamic = 'force-dynamic'
const fail = (message: string, status: number) => new NextResponse(message, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } })
const image = (v: unknown) => typeof v === 'string' && /^data:image\/(png|jpeg);base64,/.test(v) ? v : null

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return fail('案件が見つかりません', 404)
  const supabase = await createClient()
  const accessError = await requireSalesAccess(supabase)
  if (accessError) return fail(accessError, 403)
  const receipt = await supabase.from('deal_receipts').select('snapshot').eq('deal_id', id).eq('status', 'received').limit(1)
  if (receipt.error) return fail('納品書を読み込めませんでした', 500)
  const s = receipt.data?.[0]?.snapshot as ReceiptSnapshot | undefined
  if (!s) return fail('納品書は、受領を記録したあとに開けます', 409)
  const issuer = s.issuer.id ? await supabase.from('issuer_companies').select('logo_data, stamp_data').eq('id', s.issuer.id).limit(1) : { data: null, error: null }
  if (issuer.error) return fail('納品書を読み込めませんでした', 500)
  const pdf = await deliveryNotePDF(s, { logo: image(issuer.data?.[0]?.logo_data), stamp: image(issuer.data?.[0]?.stamp_data) })
  return new NextResponse(Buffer.from(pdf), { headers: { 'content-type': 'application/pdf', 'content-disposition': `inline; filename="delivery-note-${encodeURIComponent(s.delivery_note_number)}.pdf"`, 'cache-control': 'no-store' } })
}
