// 商品マスター: カタログ（画像・PDF）からAIが読み取った候補の型と、既に登録済みのものを除く処理。

export interface CatalogCandidates {
  categories: Array<{ l1: string; l2: string | null; l3: string | null }>   // 種類 > 形状 > ディテール
  materials: string[]; print_colors: string[]; accessories: string[]
}
export interface ExistingMaster { catalog: Array<{ id: string; level: number; parent_id: string | null; name: string }>; options: Array<{ kind: string; name: string }> }

const norm = (s: string) => s.normalize('NFKC').trim().toLowerCase()
const clean = (v: unknown) => typeof v === 'string' ? v.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 60) : ''
const uniq = (list: string[]) => [...new Map(list.filter(Boolean).map(x => [norm(x), x])).values()]

/** AIの返答（形が崩れていても）を安全な形に直し、既に登録済みのものを外す。最大数も切る。 */
export function tidyCandidates(raw: unknown, existing: ExistingMaster): CatalogCandidates {
  const o = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const arr = (v: unknown) => Array.isArray(v) ? v : []
  const has = (kind: string, name: string) => existing.options.some(x => x.kind === kind && norm(x.name) === norm(name))
  const find = (level: number, parent: string | null, name: string) => existing.catalog.find(c => c.level === level && (c.parent_id || null) === parent && norm(c.name) === norm(name))
  const seen = new Set<string>()
  const categories: CatalogCandidates['categories'] = []
  for (const item of arr(o.categories)) {
    const r = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    const l1 = clean(r.l1), l2 = clean(r.l2) || null, l3 = l2 ? clean(r.l3) || null : null
    if (!l1) continue
    const key = [l1, l2, l3].map(x => norm(x || '')).join('>')
    if (seen.has(key)) continue
    seen.add(key)
    // 一番深い階層まで登録済みなら候補から外す
    const n1 = find(1, null, l1), n2 = n1 && l2 ? find(2, n1.id, l2) : undefined, n3 = n2 && l3 ? find(3, n2.id, l3) : undefined
    if (l3 ? n3 : l2 ? n2 : n1) continue
    categories.push({ l1, l2, l3 })
  }
  const options = (key: string, kind: string) => uniq(arr(o[key]).map(clean)).filter(name => !has(kind, name)).slice(0, 40)
  return { categories: categories.slice(0, 60), materials: options('materials', 'material'), print_colors: options('print_colors', 'print_colors'), accessories: options('accessories', 'accessory') }
}
