'use client'

// 再設計 工程2: 商品の登録フォーム。
// 基本はすべて「押して選ぶ」。選択肢にないときだけ各項目の自由記入欄を使う。
// 順番: ①種類・形状・ディテール → ②素材・印刷・付属品 → ③大きさ → ④数量 → ⑤配送 → ⑥サンプル・食品検査 → ⑦備考

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import type { CatalogNode } from '@/lib/actions/catalog'
import type { OptionItem } from '@/lib/actions/product-master'
import { saveProjectProduct, type ProjectProductInput } from '@/lib/actions/project-products'
import { productName } from '@/lib/process/product-name'

export interface ProductFormValue {
  l1: string | null; l2: string | null; l3: string | null; categoryNote: string
  material: string | null; materialNote: string
  print: string | null; printNote: string
  accessories: string[]; accessoriesNote: string
  sizeMode: 'box' | 'round' | 'capacity' | 'undecided'
  w: string; h: string; d: string; dia: string; capacity: string; sizeNote: string
  quantities: number[]
  shippingMode: 'sea' | 'air' | null; arranger: 'factory' | 'partner' | null
  sample: boolean; food: boolean
  memo: string
}

export const EMPTY_PRODUCT: ProductFormValue = {
  l1: null, l2: null, l3: null, categoryNote: '', material: null, materialNote: '', print: null, printNote: '', accessories: [], accessoriesNote: '',
  sizeMode: 'undecided', w: '', h: '', d: '', dia: '', capacity: '', sizeNote: '', quantities: [], shippingMode: null, arranger: null, sample: false, food: false, memo: '',
}

const QUICK_QUANTITIES = [500, 1000, 3000, 5000, 10000, 30000]
const WHEEL_QUANTITIES = [100, 200, 300, 500, 800, 1000, 1500, 2000, 3000, 5000, 8000, 10000, 15000, 20000, 30000, 50000, 80000, 100000, 200000, 300000, 500000, 1000000]
const CAPACITIES = ['100g', '200g', '250g', '500g', '1kg', '2kg', '5kg']
const fmt = (n: number) => n.toLocaleString('ja-JP')

const chip = 'min-h-[44px] inline-flex items-center justify-center rounded-full border px-4 text-[12.5px] font-bold transition-colors duration-150 disabled:opacity-50'
const chipOff = chip + ' border-[#E2E1DA] bg-white text-[#351E28] hover:bg-[#FBFAF6]'
const chipOn = chip + ' border-[#351E28] bg-[#351E28] text-[#C9A2B8]'
const input = 'w-full min-h-[44px] rounded-[12px] border border-transparent bg-[#EFEFEA] px-3.5 text-[14px] text-[#351E28] outline-none focus:border-[#351E28]'
const freeInput = input + ' mt-2 !min-h-[40px] !text-[12.5px]'
const groupTitle = 'text-[12.5px] font-bold text-[#351E28] mb-1.5'

function Chips({ label, options, value, onChange, empty }: { label: string; options: string[]; value: string | null; onChange: (v: string | null) => void; empty?: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map(o => <button key={o} type="button" aria-pressed={value === o} onClick={() => onChange(value === o ? null : o)} className={value === o ? chipOn : chipOff}>{o}</button>)}
      {!options.length && <span className="self-center text-[12.5px] text-[#84787D]">{empty || '選択肢なし'}</span>}
    </div>
  )
}

function Section({ n, title, children, hint }: { n: number; title: string; children: React.ReactNode; hint?: string }) {
  return (
    <section aria-label={title} className="border-t border-[#E2E1DA] pt-4 first:border-0 first:pt-0">
      <h4 className="mb-3 text-[15px] font-bold text-[#351E28]"><span className="mr-2 tabular-nums text-[#84787D]">{n}</span>{title}{hint && <span className="ml-2 text-[11px] font-normal text-[#84787D]">{hint}</span>}</h4>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

/** 数量のスロット（上下に回して中央の数量を選ぶ）。 */
function QuantityWheel({ onPick, taken }: { onPick: (n: number) => void; taken: number[] }) {
  const ROW = 44
  const box = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(5)
  useEffect(() => { if (box.current) box.current.scrollTop = 5 * ROW }, [])
  const value = WHEEL_QUANTITIES[index]
  return (
    <div className="flex items-center gap-3">
      <div className="relative w-[140px]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[44px] h-[44px] rounded-[12px] border border-[#351E28]" />
        <div ref={box} role="listbox" aria-label="数量のスロット" tabIndex={0}
          onScroll={e => setIndex(Math.max(0, Math.min(WHEEL_QUANTITIES.length - 1, Math.round(e.currentTarget.scrollTop / ROW))))}
          onKeyDown={e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const next = Math.max(0, Math.min(WHEEL_QUANTITIES.length - 1, index + (e.key === 'ArrowDown' ? 1 : -1))); box.current?.scrollTo({ top: next * ROW }) } }}
          className="h-[132px] snap-y snap-mandatory overflow-y-auto rounded-[12px] bg-[#EFEFEA] py-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#351E28]" style={{ scrollbarWidth: 'none' }}>
          {WHEEL_QUANTITIES.map((q, i) => (
            <button key={q} type="button" role="option" aria-selected={i === index} tabIndex={-1} onClick={() => box.current?.scrollTo({ top: i * ROW, behavior: 'smooth' })}
              className={'block h-[44px] w-full snap-center text-center text-[14px] tabular-nums ' + (i === index ? 'font-extrabold text-[#351E28]' : 'text-[#84787D]')}>{fmt(q)}</button>
          ))}
        </div>
      </div>
      <button type="button" disabled={taken.includes(value)} onClick={() => onPick(value)} className={chipOff}>{taken.includes(value) ? `${fmt(value)} は追加済み` : `${fmt(value)} を追加`}</button>
    </div>
  )
}

export function ProductForm({ dealId, productId, initial, catalog, options, title, onSaved, onCancel }: {
  dealId: string; productId: string | null; initial: ProductFormValue; catalog: CatalogNode[]; options: OptionItem[]
  title: string; onSaved: (name: string) => void; onCancel: () => void
}) {
  const [f, setF] = useState<ProductFormValue>(initial)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [wheel, setWheel] = useState(false)
  const [manual, setManual] = useState('')
  const request = useRef<{ key: string; id: string } | null>(null)
  const set = <K extends keyof ProductFormValue>(k: K, v: ProductFormValue[K]) => setF(s => ({ ...s, [k]: v }))
  const dirty = JSON.stringify(f) !== JSON.stringify(initial)

  const l1s = useMemo(() => catalog.filter(c => c.level === 1), [catalog])
  const l1 = l1s.find(c => c.name === f.l1)
  const l2s = useMemo(() => l1 ? catalog.filter(c => c.level === 2 && c.parent_id === l1.id) : [], [catalog, l1])
  const l2 = l2s.find(c => c.name === f.l2)
  const l3s = useMemo(() => l2 ? catalog.filter(c => c.level === 3 && c.parent_id === l2.id) : [], [catalog, l2])
  const opt = (kind: OptionItem['kind'], current: string[]) => {
    const names = options.filter(o => o.kind === kind).map(o => o.name)
    return [...names, ...current.filter(c => c && !names.includes(c))] // マスターから消えた値も、この商品に入っている間は出す
  }

  const payload = (): Omit<ProjectProductInput, 'request_id'> => ({
    deal_id: dealId, product_id: productId,
    category_l1: f.l1, category_l2: f.l2, category_l3: f.l3, category_note: f.categoryNote.trim() || null,
    size_mode: f.sizeMode, width_mm: f.w.trim() || null, height_mm: f.h.trim() || null, depth_mm: f.d.trim() || null, diameter_mm: f.dia.trim() || null,
    capacity_text: f.capacity.trim() || null, size_note: f.sizeNote.trim() || null,
    material: f.material, material_note: f.materialNote.trim() || null, print_color_count: f.print, print_note: f.printNote.trim() || null,
    accessories: f.accessories, accessories_note: f.accessoriesNote.trim() || null,
    quantities: [...f.quantities].sort((a, b) => a - b),
    shipping_mode: f.shippingMode, shipping_arranger: f.arranger, sample_required: f.sample, food_inspection_required: f.food, memo: f.memo.trim() || null,
  })
  const preview = productName(payload())

  const addQuantity = (n: number) => { if (Number.isInteger(n) && n >= 1 && n <= 100000000 && !f.quantities.includes(n)) set('quantities', [...f.quantities, n].sort((a, b) => a - b)) }
  const addManual = () => {
    const n = Number(manual.replace(/[,\s，]/g, ''))
    if (!Number.isInteger(n) || n < 1) { setError('数量は 1 以上の整数で入力してください'); return }
    setError(null); addQuantity(n); setManual('')
  }
  const numeric = (v: string) => v === '' || (/^[0-9]+(\.[0-9]+)?$/.test(v) && Number(v) > 0)
  const sizeFields: Array<[keyof ProductFormValue & ('w' | 'h' | 'd' | 'dia'), string]> = f.sizeMode === 'box' ? [['w', '横（幅）'], ['h', '縦（高さ）'], ['d', '奥行（マチ・深さ）']] : f.sizeMode === 'round' ? [['dia', '直径'], ['h', '高さ']] : []

  const submit = () => {
    setError(null)
    if (!f.quantities.length) { setError('見積を取りたい数量を1つ以上選んでください'); return }
    if (sizeFields.some(([k]) => !numeric(f[k].trim()))) { setError('大きさは 0 より大きい数字（mm）で入力してください。決まっていなければ空欄のままで登録できます'); return }
    const body = payload(), key = JSON.stringify(body)
    if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() } // 同じ内容の押し直しは同じ要求IDで送る（二重登録を防ぐ）
    startTransition(async () => {
      const res = await saveProjectProduct({ request_id: request.current!.id, ...body })
      if (res.error || !res.productId) { setError(res.error || '登録できませんでした'); return }
      onSaved(res.name || preview)
    })
  }

  return (
    <div data-case-unsaved={dirty ? 'true' : undefined} className="rounded-[16px] border border-[#351E28] bg-white p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0"><h3 className="text-[15px] font-bold text-[#351E28]">{title}</h3>
          <p className="mt-1 text-[12.5px] text-[#351E28]"><span className="text-[#84787D]">商品名（自動）: </span><span data-testid="product-name-preview">{preview}</span></p></div>
        <Link href="/settings/product-master" target="_blank" className="min-h-[44px] inline-flex items-center text-[11px] text-[#84787D] underline">選択肢を編集</Link>
      </div>

      <div className="space-y-4">
        <Section n={1} title="種類・形状・ディテール">
          <div><p className={groupTitle}>種類</p><Chips label="種類" options={l1s.map(c => c.name)} value={f.l1} onChange={v => setF(s => ({ ...s, l1: v, l2: null, l3: null }))} /></div>
          {f.l1 && l2s.length > 0 && <div><p className={groupTitle}>形状</p><Chips label="形状" options={l2s.map(c => c.name)} value={f.l2} onChange={v => setF(s => ({ ...s, l2: v, l3: null }))} /></div>}
          {f.l2 && l3s.length > 0 && <div><p className={groupTitle}>ディテール</p><Chips label="ディテール" options={l3s.map(c => c.name)} value={f.l3} onChange={v => set('l3', v)} /></div>}
          <label className="block text-[11px] text-[#84787D]"><span className="sr-only">種類・形状の自由記入</span><input placeholder="自由記入" value={f.categoryNote} onChange={e => set('categoryNote', e.target.value)} className={freeInput} /></label>
        </Section>

        <Section n={2} title="素材・印刷・付属品">
          <div><p className={groupTitle}>素材</p><Chips label="素材" options={opt('material', [f.material || ''])} value={f.material} onChange={v => set('material', v)} />
            <label className="block text-[11px] text-[#84787D]"><span className="sr-only">素材の自由記入</span><input value={f.materialNote} onChange={e => set('materialNote', e.target.value)} placeholder="自由記入" className={freeInput} /></label></div>
          <div><p className={groupTitle}>印刷の色数</p><Chips label="印刷の色数" options={opt('print_colors', [f.print || ''])} value={f.print} onChange={v => set('print', v)} />
            <label className="block text-[11px] text-[#84787D]"><span className="sr-only">印刷の自由記入</span><input value={f.printNote} onChange={e => set('printNote', e.target.value)} placeholder="自由記入" className={freeInput} /></label></div>
          <div><p className={groupTitle}>付属品 <span className="font-normal text-[#84787D]">（いくつでも）</span></p>
            <div role="group" aria-label="付属品" className="flex flex-wrap gap-2">
              {opt('accessory', f.accessories).map(o => { const on = f.accessories.includes(o); return <button key={o} type="button" aria-pressed={on} onClick={() => set('accessories', on ? f.accessories.filter(a => a !== o) : [...f.accessories, o])} className={on ? chipOn : chipOff}>{o}</button> })}
            </div>
            <label className="block text-[11px] text-[#84787D]"><span className="sr-only">付属品の自由記入</span><input value={f.accessoriesNote} onChange={e => set('accessoriesNote', e.target.value)} placeholder="自由記入" className={freeInput} /></label></div>
        </Section>

        <Section n={3} title="大きさ">
          <div role="group" aria-label="大きさの決め方" className="flex flex-wrap gap-2">
            {([['box', '縦×横×奥行'], ['round', '直径×高さ（瓶・缶など）'], ['capacity', '入る量で指定'], ['undecided', '未定']] as const).map(([k, t]) =>
              <button key={k} type="button" aria-pressed={f.sizeMode === k} onClick={() => set('sizeMode', k)} className={f.sizeMode === k ? chipOn : chipOff}>{t}</button>)}
          </div>
          {sizeFields.length > 0 && <div className="grid gap-3 sm:grid-cols-3">
            {sizeFields.map(([k, t]) => <label key={k} className="block text-[11px] text-[#84787D]">{t}（mm）<input inputMode="decimal" value={f[k]} onChange={e => set(k, e.target.value)} aria-invalid={!numeric(f[k].trim())} className={input + ' tabular-nums'} /></label>)}
          </div>}
          {f.sizeMode === 'capacity' && <div><Chips label="入る量" options={[...CAPACITIES, ...(f.capacity && !CAPACITIES.includes(f.capacity) ? [f.capacity] : [])]} value={f.capacity || null} onChange={v => set('capacity', v || '')} />
            <label className="block text-[11px] text-[#84787D]"><span className="sr-only">入る量の自由記入</span><input value={CAPACITIES.includes(f.capacity) ? '' : f.capacity} onChange={e => set('capacity', e.target.value)} placeholder="自由記入（例: 350ml）" className={freeInput} /></label></div>}
          <label className="block text-[11px] text-[#84787D]"><span className="sr-only">大きさの自由記入</span><input value={f.sizeNote} onChange={e => set('sizeNote', e.target.value)} placeholder="自由記入" className={freeInput} /></label>
        </Section>

        <Section n={4} title="数量">
          <div role="group" aria-label="よく使う数量" className="flex flex-wrap gap-2">
            {QUICK_QUANTITIES.map(q => { const on = f.quantities.includes(q); return <button key={q} type="button" aria-pressed={on} onClick={() => set('quantities', on ? f.quantities.filter(x => x !== q) : [...f.quantities, q].sort((a, b) => a - b))} className={(on ? chipOn : chipOff) + ' tabular-nums'}>{fmt(q)}</button> })}
            <button type="button" aria-expanded={wheel} onClick={() => setWheel(v => !v)} className={chipOff}>{wheel ? 'スロットを閉じる' : 'スロットで選ぶ'}</button>
          </div>
          {wheel && <QuantityWheel taken={f.quantities} onPick={addQuantity} />}
          <div className="flex flex-wrap items-end gap-2">
            <label className="block text-[11px] text-[#84787D]">数量を手で入力<input inputMode="numeric" value={manual} onChange={e => setManual(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addManual() } }} placeholder="例: 12000" className={input + ' !w-[160px] tabular-nums'} /></label>
            <button type="button" onClick={addManual} disabled={!manual.trim()} className={chipOff}>この数量を追加</button>
          </div>
          <div aria-live="polite">
            <p className={groupTitle}>見積を取る数量 <span className="font-normal text-[#84787D] tabular-nums">{f.quantities.length}件</span></p>
            <ul aria-label="選んだ数量" className="flex flex-wrap gap-2">
              {f.quantities.map(q => <li key={q} className="inline-flex items-center gap-1 rounded-full bg-[#D7EFFF] py-1 pl-3 pr-1 text-[13px] font-bold text-[#33566F] tabular-nums">{fmt(q)}
                <button type="button" aria-label={`数量 ${fmt(q)} を外す`} onClick={() => set('quantities', f.quantities.filter(x => x !== q))} className="min-h-[36px] min-w-[36px] rounded-full text-[13px]">×</button></li>)}
              {!f.quantities.length && <li className="text-[12.5px] text-[#84787D]">未選択</li>}
            </ul>
          </div>
        </Section>

        <Section n={5} title="配送">
          <div><p className={groupTitle}>配送方法</p><div role="group" aria-label="配送方法" className="flex flex-wrap gap-2">
            {([['sea', '船便'], ['air', 'エアー（航空便）']] as const).map(([k, t]) => <button key={k} type="button" aria-pressed={f.shippingMode === k} onClick={() => set('shippingMode', f.shippingMode === k ? null : k)} className={f.shippingMode === k ? chipOn : chipOff}>{t}</button>)}
          </div></div>
          <div><p className={groupTitle}>配送の手配</p><div role="group" aria-label="配送の手配" className="flex flex-wrap gap-2">
            {([['factory', '工場に頼む'], ['partner', '提携の配送業者に頼む']] as const).map(([k, t]) => <button key={k} type="button" aria-pressed={f.arranger === k} onClick={() => set('arranger', f.arranger === k ? null : k)} className={f.arranger === k ? chipOn : chipOff}>{t}</button>)}
          </div></div>
        </Section>

        <Section n={6} title="サンプル・食品検査">
          <div><p className={groupTitle}>サンプル</p><div role="group" aria-label="サンプル" className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={f.sample} onClick={() => set('sample', true)} className={f.sample ? chipOn : chipOff}>サンプルを頼む</button>
            <button type="button" aria-pressed={!f.sample} onClick={() => set('sample', false)} className={!f.sample ? chipOn : chipOff}>頼まない</button>
          </div></div>
          <div><p className={groupTitle}>食品検査</p><div role="group" aria-label="食品検査" className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={f.food} onClick={() => set('food', true)} className={f.food ? chipOn : chipOff}>必要</button>
            <button type="button" aria-pressed={!f.food} onClick={() => set('food', false)} className={!f.food ? chipOn : chipOff}>必要ない</button>
          </div></div>
        </Section>

        <Section n={7} title="備考">
          <label className="block text-[11px] text-[#84787D]"><span className="sr-only">備考</span><textarea value={f.memo} onChange={e => set('memo', e.target.value)} rows={3} placeholder="備考" className={input + ' py-2'} /></label>
        </Section>
      </div>

      {error && <p role="alert" className="mt-4 rounded-[16px] border-[1.5px] border-[#FF5C34] bg-[#FFD8C2] p-3 text-[12.5px] text-[#B03616]">{error}</p>}
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-[#E2E1DA] pt-4">
        <button type="button" onClick={() => { if (!dirty || window.confirm('入力した内容を捨てて閉じますか？')) onCancel() }} className={chipOff}>やめる</button>
        <button type="button" onClick={submit} disabled={pending} className="min-h-[44px] rounded-full bg-[#E9F056] px-6 text-[14px] font-extrabold text-[#666C14] hover:brightness-95 disabled:opacity-60">{pending ? '登録しています…' : productId ? 'この内容で保存する' : 'この内容で登録する'}</button>
      </div>
    </div>
  )
}
