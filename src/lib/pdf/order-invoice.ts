import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { yen } from '@/lib/process/offer-format'
import { bankLine, jpDate, type InvoiceSnapshot } from '@/lib/process/invoice-format'

// 再設計 工程5: 顧客へ送る「請求書」PDF。

let fontBytes: Promise<Uint8Array> | undefined
const INK = rgb(0.208, 0.118, 0.157), SOFT = rgb(0.518, 0.471, 0.49)

export async function orderInvoicePDF(s: InvoiceSnapshot): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  fontBytes ??= readFile(join(process.cwd(), 'public/fonts/NotoSansJP-Regular.ttf'))
  const font = await pdf.embedFont(await fontBytes, { subset: false, features: { locl: false, liga: false, clig: false, calt: false, kern: false, frac: false, numr: false, dnom: false } })
  pdf.setTitle(`請求書 ${s.invoice_number}`)
  const W = 595.28, H = 841.89, LEFT = 48, MAX = W - LEFT * 2
  let page = pdf.addPage([W, H]), y = H - 56
  const write = (raw: string, size = 11, color = INK, indent = 0) => {
    let part = ''
    const flush = () => {
      if (y - size < 56) { page = pdf.addPage([W, H]); y = H - 56 }
      page.drawText(part, { x: LEFT + indent, y, size, font, color }); y -= size + 7; part = ''
    }
    for (const line of raw.normalize('NFC').split('\n')) {
      for (const ch of line.replace(/[\u0000-\u001f\u007f]/g, ' ')) {
        if (font.widthOfTextAtSize(part + ch, size) > MAX - indent) flush()
        part += ch
      }
      if (part) flush()
    }
  }
  write('請求書', 20); y -= 6
  write(`${s.client_name || ''} 御中`, 14)
  write(`件名: ${s.deal_name || ''}${s.brand ? `（${s.brand}）` : ''}`, 10, SOFT)
  write(`請求書番号: ${s.invoice_number}　　発行日: ${jpDate(s.issue_date)}　　お振込期限: ${jpDate(s.due_date)}`, 10, SOFT); y -= 6
  write(`ご請求金額（税込）　${yen(s.total_jpy)}`, 16); y -= 8
  s.lines.forEach((l, i) => write(`${i + 1}. ${l.name}　${Number(l.quantity).toLocaleString('ja-JP')}個 × ${yen(l.unit_jpy)} = ${yen(l.net_jpy)}`, 10.5))
  y -= 6
  write(`小計 ${yen(s.subtotal_jpy)}　　消費税（${s.tax_rate}%） ${yen(s.tax_jpy)}　　合計 ${yen(s.total_jpy)}`, 11); y -= 10
  write('お振込先', 11)
  write(bankLine(s.bank), 10.5, INK, 14); y -= 6
  if (s.notes) { write(s.notes, 9.5, SOFT); y -= 6 }
  write(s.issuer.name, 11)
  write(s.issuer.address, 10, SOFT)
  const contact = [s.issuer.phone ? `TEL ${s.issuer.phone}` : null, s.issuer.email].filter(Boolean).join('　')
  if (contact) write(contact, 10, SOFT)
  if (s.issuer.registration_number) write(`登録番号: ${s.issuer.registration_number}`, 10, SOFT)
  pdf.getPages().forEach((p, i) => p.drawText(`${i + 1} / ${pdf.getPageCount()}`, { x: W - 80, y: 30, size: 9, font, color: SOFT }))
  return pdf.save()
}
