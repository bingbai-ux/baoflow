import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ReceiptSnapshot } from '@/lib/process/receipt-format'

// 再設計 工程9: 顧客へ送る「納品書」PDF（金額は載せない）。

let fontBytes: Promise<Uint8Array> | undefined
const INK = rgb(0.208, 0.118, 0.157), SOFT = rgb(0.518, 0.471, 0.49)
const ymd = (d: string | null) => d ? d.replace(/-/g, '/') : ''

export async function deliveryNotePDF(s: ReceiptSnapshot, images: { logo?: string | null; stamp?: string | null } = {}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  fontBytes ??= readFile(join(process.cwd(), 'public/fonts/NotoSansJP-Regular.ttf'))
  const font = await pdf.embedFont(await fontBytes, { subset: false, features: { locl: false, liga: false, clig: false, calt: false, kern: false, frac: false, numr: false, dnom: false } })
  pdf.setTitle(`納品書 ${s.delivery_note_number}`)
  const W = 595.28, H = 841.89, LEFT = 48, MAX = W - LEFT * 2
  let page = pdf.addPage([W, H]), y = H - 56
  const write = (raw: string, size = 11, color = INK, indent = 0) => {
    let part = ''
    const flush = () => {
      if (y - size < 56) { page = pdf.addPage([W, H]); y = H - 56 }
      page.drawText(part, { x: LEFT + indent, y, size, font, color }); y -= size + 7; part = ''
    }
    for (const ch of raw.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, ' ')) {
      if (font.widthOfTextAtSize(part + ch, size) > MAX - indent) flush()
      part += ch
    }
    if (part) flush()
  }
  const embed = async (data: string) => { const bytes = Buffer.from(data.slice(data.indexOf(',') + 1), 'base64'); return data.startsWith('data:image/png') ? pdf.embedPng(bytes) : pdf.embedJpg(bytes) }
  if (images.logo) { const img = await embed(images.logo), k = Math.min(120 / img.width, 48 / img.height); page.drawImage(img, { x: W - LEFT - img.width * k, y: H - 44 - img.height * k, width: img.width * k, height: img.height * k }) }
  write('納品書', 20); y -= 6
  write(`${s.client_name || ''} 御中`, 14)
  write(`件名: ${s.deal_name || ''}${s.brand ? `（${s.brand}）` : ''}`, 10, SOFT)
  write(`納品書番号: ${s.delivery_note_number}　　納品日: ${ymd(s.arrived_on)}${s.shipped_on ? `　　発送日: ${ymd(s.shipped_on)}` : ''}`, 10, SOFT); y -= 8
  write('下記のとおり納品いたしました。', 11); y -= 4
  s.lines.forEach((l, i) => write(`${i + 1}. ${l.name}　　${Number(l.quantity).toLocaleString('ja-JP')}個`, 11))
  y -= 8
  if (s.ship_to?.address) write(`お届け先: ${s.ship_to.name || ''}　${s.ship_to.postal_code ? `〒${s.ship_to.postal_code} ` : ''}${s.ship_to.address}`, 10, SOFT)
  const ship = [s.carton_count ? `${s.carton_count}箱` : null, s.carrier, s.tracking_number ? `追跡番号 ${s.tracking_number}` : null].filter(Boolean).join('　')
  if (ship) write(ship, 10, SOFT)
  y -= 10
  const issuerTop = y
  write(s.issuer.name, 11)
  if (s.issuer.address) write(`${s.issuer.postal_code ? `〒${s.issuer.postal_code} ` : ''}${s.issuer.address}`, 10, SOFT)
  const contact = [s.issuer.phone ? `TEL ${s.issuer.phone}` : null, s.issuer.email].filter(Boolean).join('　')
  if (contact) write(contact, 10, SOFT)
  if (s.issuer.registration_number) write(`登録番号: ${s.issuer.registration_number}`, 10, SOFT)
  if (images.stamp && issuerTop > 110) { const img = await embed(images.stamp), k = Math.min(56 / img.width, 56 / img.height); page.drawImage(img, { x: W - LEFT - 76, y: issuerTop - img.height * k + 14, width: img.width * k, height: img.height * k, opacity: 0.9 }) }
  pdf.getPages().forEach((p, i) => p.drawText(`${i + 1} / ${pdf.getPageCount()}`, { x: W - 80, y: 30, size: 9, font, color: SOFT }))
  return pdf.save()
}
