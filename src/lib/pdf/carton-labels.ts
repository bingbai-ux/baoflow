import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// 再設計 工程8: 段ボールに貼るラベル（A4 横に1枚、箱数ぶんのページ）。工場が印刷して貼る。

export interface CartonLabelInput { dealCode: string; dealName: string; toName: string; toPostalCode: string; toAddress: string; toPhone: string; fromName: string; contents: string[]; cartonCount: number }
let fontBytes: Promise<Uint8Array> | undefined
const INK = rgb(0.208, 0.118, 0.157), SOFT = rgb(0.518, 0.471, 0.49)

export async function cartonLabelsPDF(l: CartonLabelInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  fontBytes ??= readFile(join(process.cwd(), 'public/fonts/NotoSansJP-Regular.ttf'))
  const font = await pdf.embedFont(await fontBytes, { subset: false, features: { locl: false, liga: false, clig: false, calt: false, kern: false, frac: false, numr: false, dnom: false } })
  pdf.setTitle(`段ボールラベル ${l.dealCode}`)
  const W = 841.89, H = 595.28, LEFT = 44, MAX = W - LEFT * 2
  const clean = (s: string) => s.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, ' ')
  for (let n = 1; n <= l.cartonCount; n++) {
    const page = pdf.addPage([W, H])
    let y = H - 44
    const write = (raw: string, size: number, color = INK) => {
      let part = ''
      // 文字の高さぶん下げてから書く（大きさの違う行が重ならないように）
      const flush = () => { y -= size; page.drawText(part, { x: LEFT, y, size, font, color }); y -= size * 0.45; part = '' }
      for (const ch of clean(raw)) { if (font.widthOfTextAtSize(part + ch, size) > MAX) flush(); part += ch }
      if (part) flush()
    }
    page.drawRectangle({ x: 20, y: 20, width: W - 40, height: H - 40, borderColor: INK, borderWidth: 2 })
    write('お届け先 / TO', 14, SOFT); y -= 4
    write(l.toName, 34)
    write(`${l.toPostalCode ? `〒${l.toPostalCode}　` : ''}${l.toAddress}`, 24)
    if (l.toPhone) write(`TEL ${l.toPhone}`, 20)
    y -= 14
    page.drawLine({ start: { x: LEFT, y: y + 10 }, end: { x: W - LEFT, y: y + 10 }, thickness: 1, color: SOFT })
    y -= 12
    write(`ご依頼主 / FROM　${l.fromName} (bao)`, 16)
    write(`案件 / ORDER　${l.dealCode}　${l.dealName}`, 16)
    write(`内容 / CONTENTS　${l.contents.join('、') || '—'}`, 14, SOFT)
    const count = `${n} / ${l.cartonCount}`
    page.drawText('箱 / CARTON', { x: W - LEFT - 200, y: 96, size: 14, font, color: SOFT })
    page.drawText(count, { x: W - LEFT - font.widthOfTextAtSize(count, 56), y: 40, size: 56, font, color: INK })
    page.drawText('MADE IN CHINA', { x: LEFT, y: 40, size: 16, font, color: INK })
  }
  return pdf.save()
}
