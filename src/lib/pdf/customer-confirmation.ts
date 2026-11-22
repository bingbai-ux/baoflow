import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// 再設計 工程3: 顧客へ送る「商品内容の確認」の明細PDF。

export interface ConfirmationItem { name: string; quantities: number[]; shipping_mode?: string | null; sample_required?: boolean; food_inspection_required?: boolean; notes?: string | null; memo?: string | null }
export interface ConfirmationSnapshot { deal_name: string | null; deal_code: string | null; client_name: string | null; brand: string | null; desired_delivery_date: string | null; items: ConfirmationItem[] }

let fontBytes: Promise<Uint8Array> | undefined
const INK = rgb(0.208, 0.118, 0.157), SOFT = rgb(0.518, 0.471, 0.49)

export function itemLines(item: ConfirmationItem): string[] {
  const extras = [item.shipping_mode === 'sea' ? '船便' : item.shipping_mode === 'air' ? '航空便' : null, item.sample_required ? 'サンプルあり' : null, item.food_inspection_required ? '食品検査あり' : null].filter(Boolean).join(' ・ ')
  return [`数量: ${item.quantities.map(q => q.toLocaleString('ja-JP')).join(' / ')}`, extras, item.notes ? `補足: ${item.notes}` : '', item.memo ? `備考: ${item.memo}` : ''].filter(Boolean)
}

export async function customerConfirmationPDF(s: ConfirmationSnapshot, issuedOn: string, issuerName: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  fontBytes ??= readFile(join(process.cwd(), 'public/fonts/NotoSansJP-Regular.ttf'))
  const font = await pdf.embedFont(await fontBytes, { subset: false, features: { locl: false, liga: false, clig: false, calt: false, kern: false, frac: false, numr: false, dnom: false } })
  pdf.setTitle(`商品内容のご確認 ${s.deal_code || ''}`)
  const W = 595.28, H = 841.89, LEFT = 48, MAX = W - LEFT * 2
  let page = pdf.addPage([W, H]), y = H - 56
  const write = (raw: string, size = 11, color = INK, indent = 0) => {
    let part = ''
    const flush = () => {
      if (y - size < 56) { page = pdf.addPage([W, H]); y = H - 56 }
      page.drawText(part, { x: LEFT + indent, y, size, font, color }); y -= size + 7; part = ''
    }
    // 制御文字を除き、幅に収まるところで折り返す
    for (const ch of raw.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, ' ')) {
      if (font.widthOfTextAtSize(part + ch, size) > MAX - indent) flush()
      part += ch
    }
    if (part) flush()
  }
  write('商品内容のご確認', 20); y -= 6
  write(`${s.client_name || ''} 御中`, 14)
  write(`件名: ${s.deal_name || ''}${s.brand ? `（${s.brand}）` : ''}　　番号: ${s.deal_code || ''}`, 10, SOFT)
  write(`作成日: ${issuedOn}${s.desired_delivery_date ? `　　ご希望納期: ${s.desired_delivery_date}` : ''}`, 10, SOFT); y -= 10
  s.items.forEach((item, i) => {
    write(`${i + 1}. ${item.name}`, 12)
    for (const line of itemLines(item)) write(line, 10, SOFT, 14)
    y -= 8
  })
  y -= 6
  write('内容に問題がなければ、メールのリンクから「この内容で進める」を押してください。', 10)
  write(`${issuerName} (bao)`, 10, SOFT)
  pdf.getPages().forEach((p, i) => p.drawText(`${i + 1} / ${pdf.getPageCount()}`, { x: W - 80, y: 30, size: 9, font, color: SOFT }))
  return pdf.save()
}
