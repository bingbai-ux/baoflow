import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// 再設計 工程4: 顧客へ送る「お見積書」PDF（原価・工場名は含めない）。

import { offerNumber, optionLine, type OfferSnapshot } from '@/lib/process/offer-format'

let fontBytes: Promise<Uint8Array> | undefined
const INK = rgb(0.208, 0.118, 0.157), SOFT = rgb(0.518, 0.471, 0.49)

export async function priceOfferPDF(s: OfferSnapshot, issuedOn: string, validUntil: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  fontBytes ??= readFile(join(process.cwd(), 'public/fonts/NotoSansJP-Regular.ttf'))
  const font = await pdf.embedFont(await fontBytes, { subset: false, features: { locl: false, liga: false, clig: false, calt: false, kern: false, frac: false, numr: false, dnom: false } })
  pdf.setTitle(`お見積書 ${offerNumber(s)}`)
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
  write(`お見積書（第${s.round}回）`, 20); y -= 6
  write(`${s.client_name || ''} 御中`, 14)
  write(`件名: ${s.deal_name || ''}${s.brand ? `（${s.brand}）` : ''}　　番号: ${offerNumber(s)}`, 10, SOFT)
  write(`発行日: ${issuedOn}　　有効期限: ${validUntil}　　消費税: ${s.tax_rate}%`, 10, SOFT); y -= 10
  s.items.forEach((item, i) => {
    write(`${i + 1}. ${item.name}`, 12)
    for (const o of item.options) write(optionLine(o), 10.5, INK, 14)
    const meta = [item.production_days ? `製造日数: 約${item.production_days}日` : null, item.shipping_mode === 'sea' ? '船便' : item.shipping_mode === 'air' ? '航空便' : null].filter(Boolean).join(' ・ ')
    if (meta) write(meta, 10, SOFT, 14)
    y -= 8
  })
  y -= 6
  write('ご承認・変更のご希望は、メールのリンクからお知らせください。', 10)
  write('株式会社FOOD&COMPANY (bao)', 10, SOFT)
  pdf.getPages().forEach((p, i) => p.drawText(`${i + 1} / ${pdf.getPageCount()}`, { x: W - 80, y: 30, size: 9, font, color: SOFT }))
  return pdf.save()
}
