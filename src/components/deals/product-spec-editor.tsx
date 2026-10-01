'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { CatalogNode } from '@/lib/actions/catalog'
import type { DealProduct } from '@/lib/types'
import { createProductFromWizard } from '@/lib/actions/deal-wizard'
import { validateQuantities } from '@/lib/validation/deal-input'
import { useWorkflowRequest } from '@/lib/hooks/use-workflow-request'
import { MATERIAL_PRESETS, COLOR_PRESETS, PRINT_PRESETS, PROCESS_PRESETS } from './product-wizard'
import { useUi } from '@/components/ui/ui-store'

const control = 'min-h-[44px] w-full rounded-input border border-[#E2E1DA] bg-[#EFEFEA] px-3 text-[13px]'
const button = 'min-h-[44px] rounded-full border border-[#E2E1DA] px-4 text-[12px] font-bold'
function Choice({ label, value, options, onChange, fixed = false }: { label: string; value: string; options: string[]; onChange: (value: string) => void; fixed?: boolean }) {
  const [custom, setCustom] = useState(!!value && !options.includes(value))
  return <label className="block space-y-1 text-[12px]"><span className="font-bold">{label}</span>{fixed ? <span className="block min-h-[44px] py-3">{value || '未設定'}</span> : <><select aria-label={label} className={control} value={custom ? '__other__' : value} onChange={e => { if (e.target.value === '__other__') { setCustom(true); onChange('') } else { setCustom(false); onChange(e.target.value) } }}><option value="">未選択</option>{options.map(o => <option key={o}>{o}</option>)}<option value="__other__">その他を入力</option></select>{custom && <input aria-label={label + '（自由入力）'} value={value} maxLength={100} onChange={e => onChange(e.target.value)} className={control} placeholder="例外の仕様を入力" />}</>}</label>
}

/** Uses the existing atomic specification API; no classification master is changed. */
export function ProductSpecEditor({ dealId, product, catalog, onClose }: { dealId: string; product: DealProduct | null; catalog: CatalogNode[]; onClose: () => void }) {
  const router = useRouter(), { toast } = useUi()
  const recovery = useWorkflowRequest(`spec/${dealId}/${product?.id || 'new'}`, 'spec', dealId)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [l1, setL1] = useState(product?.category_l1 || '')
  const [l2, setL2] = useState(product?.category_l2 || '')
  const [l3, setL3] = useState(product?.category_l3 || '')
  const [size, setSize] = useState({ width_mm: '', height_mm: '', depth_mm: '' })
  const [material, setMaterial] = useState(''), [colors, setColors] = useState(''), [print, setPrint] = useState('')
  const [processing, setProcessing] = useState<string[]>([]), [note, setNote] = useState('')
  const [quantities, setQuantities] = useState(['', '', ''])
  const l1Id = catalog.find(n => n.level === 1 && n.name === l1)?.id
  const l2Id = catalog.find(n => n.level === 2 && n.parent_id === l1Id && n.name === l2)?.id
  const quantityValues = quantities.filter(v => v.trim() !== '').map(Number)
  const invalidSize = Object.values(size).some(v => v !== '' && (!Number.isFinite(Number(v)) || Number(v) <= 0))
  const blocked = !l1.trim() ? '大分類を選択してください' : validateQuantities(quantityValues) || (invalidSize ? '寸法は正の数をmmで入力してください' : null)
  const dirty = !!(quantityValues.length || material || colors || print || processing.length || note || Object.values(size).some(Boolean) || l1 !== (product?.category_l1 || '') || l2 !== (product?.category_l2 || '') || l3 !== (product?.category_l3 || ''))
  useEffect(() => {
    if (!dirty) return
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [dirty])
  const { recovered, complete } = recovery
  useEffect(() => {
    if (recovered) { complete(); toast('前回保存した商品仕様を確認しました'); router.refresh(); onClose() }
  }, [recovered, complete, toast, router, onClose])
  const save = () => {
    if (pending || blocked) return
    startTransition(async () => {
      setError(null)
      try {
        const payload = { product_id: product?.id || null, category_l1: l1.trim(), category_l2: l2.trim() || null, category_l3: l3.trim() || null, ...Object.fromEntries(Object.entries(size).map(([k, v]) => [k, v === '' ? null : Number(v)])), material: material.trim() || null, print_color_count: colors || null, print_method: print || null, processing: processing.join('・') || null, other_notes: note.trim() || null, quantities: quantityValues }
        const result = await createProductFromWizard(dealId, { ...payload, request_id: await recovery.requestId({ ...payload, deal_id: dealId }) })
        if (!result.success) { setError(result.error || '保存できませんでした'); return }
        recovery.complete(); toast('商品仕様と数量パターンを保存しました'); router.refresh(); onClose()
      } catch (e) { setError(e instanceof Error ? e.message : '保存結果を確認できません。同じ入力で再試行してください') }
    })
  }
  return <section aria-label="商品仕様の入力" data-case-unsaved={dirty} className="rounded-card border border-[#E2E1DA] bg-[#FBFAF6] p-4 space-y-4">
    <div className="flex justify-between gap-3 items-center"><h3 className="text-[15px] font-bold">{product ? `${product.description}の仕様を追加` : '新しい商品を追加'}</h3><button type="button" disabled={pending} onClick={() => { if (!dirty || window.confirm('未保存の入力を閉じますか？')) onClose() }} className={button}>入力を閉じる</button></div>
    {(error || recovery.error) && <p role="alert" className="text-[12px] text-[#B03616]">{error || recovery.error}</p>}
    {recovery.unfinished && !recovered && <p role="status" className="text-[12px]">前回の保存結果が未確認です。同じ内容で再試行するか、登録済み仕様を確認してください。</p>}
    <fieldset disabled={pending} className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3"><Choice label="大分類" value={l1} options={catalog.filter(n => n.level === 1).map(n => n.name)} fixed={!!product?.category_l1} onChange={v => { setL1(v); setL2(''); setL3('') }} /><Choice key={'l2-' + l1} label="中分類" value={l2} options={catalog.filter(n => n.level === 2 && n.parent_id === l1Id).map(n => n.name)} fixed={!!product?.category_l2} onChange={v => { setL2(v); setL3('') }} /><Choice key={'l3-' + l2} label="小分類" value={l3} options={catalog.filter(n => n.level === 3 && n.parent_id === l2Id).map(n => n.name)} fixed={!!product?.category_l3} onChange={setL3} /></div>
      <div className="grid grid-cols-3 gap-3">{Object.entries(size).map(([key, value], i) => <label key={key} className="text-[12px] space-y-1"><span className="font-bold">{['幅（mm）', '高さ（mm）', '奥行（mm）'][i]}</span><input type="number" step="any" min="0" aria-label={['幅（mm）', '高さ（mm）', '奥行（mm）'][i]} value={value} onChange={e => setSize(s => ({ ...s, [key]: e.target.value }))} className={control} placeholder="未入力" /></label>)}</div>
      <div className="grid sm:grid-cols-3 gap-3"><Choice label="素材" value={material} options={MATERIAL_PRESETS} onChange={setMaterial} /><Choice label="印刷色数" value={colors} options={COLOR_PRESETS} onChange={setColors} /><Choice label="印刷方法" value={print} options={PRINT_PRESETS} onChange={setPrint} /></div>
      <fieldset><legend className="text-[12px] font-bold mb-1">加工（複数選択）</legend><div className="flex flex-wrap gap-2">{PROCESS_PRESETS.map(p => <label key={p} className="min-h-[44px] inline-flex items-center gap-2 rounded-full border border-[#E2E1DA] bg-white px-3 text-[12px]"><input type="checkbox" checked={processing.includes(p)} onChange={e => setProcessing(xs => e.target.checked ? [...xs, p] : xs.filter(x => x !== p))} />{p}</label>)}</div></fieldset>
      <label className="block text-[12px] space-y-1"><span className="font-bold">補足仕様・例外の加工</span><textarea value={note} onChange={e => setNote(e.target.value)} maxLength={1000} className={control + ' py-2'} rows={2} /></label>
      <fieldset><legend className="text-[12px] font-bold mb-2">この仕様の数量候補（個）</legend><div className="flex flex-wrap items-end gap-2">{quantities.map((v, i) => <label key={i} className="text-[11px] text-[#84787D] w-[120px]"><span>数量パターン {i + 1}</span><input aria-label={`数量パターン ${i + 1}`} type="number" min="1" step="1" value={v} onChange={e => setQuantities(qs => qs.map((q, j) => i === j ? e.target.value : q))} className={control + ' tabular-nums'} /></label>)}<button type="button" onClick={() => setQuantities(qs => [...qs, ''])} className={button}>数量候補を追加</button></div></fieldset>
    </fieldset>
    <div className="flex flex-wrap items-center gap-3"><button type="button" onClick={save} disabled={!recovery.ready || !!blocked || pending} aria-describedby="spec-save-reason" className={button + ' bg-[#E9F056] text-[#666C14] disabled:opacity-40'}>{pending ? '保存中…' : '仕様と数量を保存'}</button><p id="spec-save-reason" role="status" className="text-[12px] text-[#84787D]">{blocked || '保存すると仕様1件と数量候補の見積枠が登録されます。'}</p></div>
  </section>
}
