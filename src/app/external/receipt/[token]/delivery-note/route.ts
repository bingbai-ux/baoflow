import { NextResponse } from 'next/server'
import { loadReceipt } from '@/lib/actions/deal-receipt'
import { deliveryNotePDF } from '@/lib/pdf/receipt-delivery-note'

// 再設計 工程9: 顧客が受領を確認したあとに開ける納品書PDF（リンクの持ち主だけ）。

export const dynamic = 'force-dynamic'
const fail = (message: string, status: number) => new NextResponse(message, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } })

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const r = await loadReceipt(token)
  if (!r.snapshot || r.status === 'missing') return fail('ページが見つかりません', 404)
  if (r.status !== 'received') return fail('納品書は、受領のご確認のあとに開けます', 409)
  const pdf = await deliveryNotePDF(r.snapshot, { logo: r.logo, stamp: r.stamp })
  return new NextResponse(Buffer.from(pdf), { headers: { 'content-type': 'application/pdf', 'content-disposition': `inline; filename="delivery-note-${encodeURIComponent(r.snapshot.delivery_note_number)}.pdf"`, 'cache-control': 'no-store' } })
}
