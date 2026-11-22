// 商品名の自動組み立て（登録前の下書き表示用）。
// 保存時の正式な名前は DB 関数 project_product_name が付ける。並びは必ず同じにする
// （tests/process-stage2-sql.test.ts が両方の結果を突き合わせている）。

export interface ProductNameInput {
  category_l1?: string | null; category_l2?: string | null; category_l3?: string | null; category_note?: string | null
  size_mode?: string | null; width_mm?: string | number | null; height_mm?: string | number | null; depth_mm?: string | number | null
  diameter_mm?: string | number | null; capacity_text?: string | null
  material?: string | null; material_note?: string | null; print_color_count?: string | null; print_note?: string | null
  accessories?: string[] | null
}

const text = (v: string | number | null | undefined) => { const t = String(v ?? '').trim(); return t || null }
const num = (v: string | number | null | undefined) => { const t = String(v ?? ''); return /^[0-9]+(\.[0-9]+)?$/.test(t) ? t : null }

export function productName(p: ProductNameInput): string {
  const parts: string[] = [text(p.category_l3) || text(p.category_l2) || text(p.category_l1) || text(p.category_note) || '商品']
  let size = ''
  if (p.size_mode === 'box') {
    size = [num(p.width_mm) && 'W' + num(p.width_mm), num(p.height_mm) && 'H' + num(p.height_mm), num(p.depth_mm) && 'D' + num(p.depth_mm)].filter(Boolean).join('×')
    if (size) size += 'mm'
  } else if (p.size_mode === 'round') {
    size = [num(p.diameter_mm) && 'φ' + num(p.diameter_mm), num(p.height_mm) && 'H' + num(p.height_mm)].filter(Boolean).join('×')
    if (size) size += 'mm'
  } else if (p.size_mode === 'capacity') {
    size = text(p.capacity_text) ? text(p.capacity_text) + '入り' : ''
  }
  parts.push(size || 'サイズ未定')
  const material = text(p.material) || text(p.material_note)
  if (material) parts.push(material)
  const print = text(p.print_color_count) || text(p.print_note)
  if (print) parts.push(print)
  const acc = (p.accessories || []).map(a => a.trim()).filter(Boolean)
  if (acc.length) parts.push(acc.join('・'))
  return parts.join(' / ')
}
