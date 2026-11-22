'use client'

// 再設計 工程2: 商品マスターの編集（種類 › 形状 › ディテール の3階層と、素材・印刷の色数・付属品）。

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addCatalogNode, type CatalogNode } from '@/lib/actions/catalog'
import { addOptionItem, deleteCatalogNode, deleteOptionItem, renameCatalogNode, renameOptionItem, type OptionItem, type OptionKind } from '@/lib/actions/product-master'
import { useUi } from '@/components/ui/ui-store'

const card = 'rounded-[16px] border border-[#E2E1DA] bg-white p-4'
const input = 'min-h-[44px] rounded-[12px] border border-transparent bg-[#EFEFEA] px-3.5 text-[14px] text-[#351E28] outline-none focus:border-[#351E28]'
const ghost = 'min-h-[44px] inline-flex items-center justify-center rounded-full border border-[#E2E1DA] bg-white px-3 text-[12px] font-bold text-[#351E28] hover:bg-[#FBFAF6] disabled:opacity-50'
const dark = 'min-h-[44px] inline-flex items-center justify-center rounded-full bg-[#351E28] px-4 text-[12px] font-bold text-[#C9A2B8] hover:brightness-95 disabled:opacity-50'
const chipOff = 'min-h-[44px] inline-flex items-center rounded-full border border-[#E2E1DA] bg-white px-4 text-[12.5px] font-bold text-[#351E28] hover:bg-[#FBFAF6]'
const chipOn = 'min-h-[44px] inline-flex items-center rounded-full border border-[#351E28] bg-[#351E28] px-4 text-[12.5px] font-bold text-[#C9A2B8]'
const KIND_LABEL: Record<OptionKind, string> = { material: '素材', print_colors: '印刷の色数', accessory: '付属品' }

type Target = { type: 'catalog' | 'option'; id: string; name: string; warn?: string }

export function ProductMaster({ catalog, options }: { catalog: CatalogNode[]; options: OptionItem[] }) {
  const router = useRouter()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [l1, setL1] = useState<string | null>(catalog.find(c => c.level === 1)?.id || null)
  const [l2, setL2] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<(Target & { draft: string }) | null>(null)
  const [confirm, setConfirm] = useState<Target | null>(null)

  const run = (work: () => Promise<{ error: string | null }>, done: string, after?: () => void) => {
    setError(null)
    startTransition(async () => {
      const res = await work()
      if (res.error) { setError(res.error); return }
      after?.(); toast(done); router.refresh()
    })
  }
  const l1s = catalog.filter(c => c.level === 1)
  const l2s = catalog.filter(c => c.level === 2 && c.parent_id === l1)
  const l3s = catalog.filter(c => c.level === 3 && c.parent_id === l2)
  const childCount = (id: string) => catalog.filter(c => c.parent_id === id).length

  const Level = ({ title, level, parent, items, selected, onSelect, hint }: { title: string; level: 1 | 2 | 3; parent: string | null; items: CatalogNode[]; selected?: string | null; onSelect?: (id: string) => void; hint?: string }) => {
    const [name, setName] = useState('')
    return (
      <div>
        <h3 className="mb-1.5 text-[12.5px] font-bold">{title} <span className="font-normal text-[#84787D] tabular-nums">{items.length}件</span></h3>
        {hint ? <p className="text-[12.5px] text-[#84787D]">{hint}</p> : <>
          <ul aria-label={title} className="flex flex-wrap gap-2">
            {items.map(c => (
              <li key={c.id} className="inline-flex items-center gap-1">
                {onSelect ? <button type="button" aria-pressed={selected === c.id} onClick={() => onSelect(c.id)} className={selected === c.id ? chipOn : chipOff}>{c.name}{level < 3 && <span className="ml-1 text-[11px] font-normal tabular-nums">（{childCount(c.id)}）</span>}</button>
                  : <span className={chipOff + ' hover:!bg-white'}>{c.name}</span>}
                {(!onSelect || selected === c.id) && <>
                  <button type="button" className="min-h-[44px] px-1 text-[11px] underline" aria-label={`${c.name} の名前を変える`} onClick={() => setRenaming({ type: 'catalog', id: c.id, name: c.name, draft: c.name })}>名前を変える</button>
                  <button type="button" className="min-h-[44px] px-1 text-[11px] text-[#B03616] underline" aria-label={`${c.name} を削除`} onClick={() => setConfirm({ type: 'catalog', id: c.id, name: c.name, warn: level < 3 && childCount(c.id) ? `下の階層 ${childCount(c.id)}件も一緒に消えます。` : undefined })}>削除</button>
                </>}
              </li>
            ))}
            {!items.length && <li className="text-[12.5px] text-[#84787D]">まだありません。</li>}
          </ul>
          <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); const n = name; run(async () => { const r = await addCatalogNode({ level, parent_id: parent, name: n }); return { error: r.error } }, `「${n.trim()}」を追加しました`, () => setName('')) }}>
            <label className="text-[11px] text-[#84787D]">新しい{title}<input value={name} onChange={e => setName(e.target.value)} className={input + ' block w-[220px] max-w-full'} /></label>
            <button type="submit" disabled={pending || !name.trim()} className={dark}>{title}を追加</button>
          </form>
        </>}
      </div>
    )
  }

  const Options = ({ kind }: { kind: OptionKind }) => {
    const [name, setName] = useState('')
    const items = options.filter(o => o.kind === kind)
    return (
      <section aria-label={KIND_LABEL[kind]} className={card}>
        <h2 className="mb-2 text-[15px] font-bold">{KIND_LABEL[kind]} <span className="text-[12.5px] font-normal text-[#84787D] tabular-nums">{items.length}件</span></h2>
        <ul className="flex flex-wrap gap-2">
          {items.map(o => (
            <li key={o.id} className="inline-flex items-center gap-1 rounded-full border border-[#E2E1DA] bg-[#EFEFEA] py-1 pl-3 pr-1 text-[12.5px]">{o.name}
              <button type="button" className="min-h-[36px] px-1 text-[11px] underline" aria-label={`${o.name} の名前を変える`} onClick={() => setRenaming({ type: 'option', id: o.id, name: o.name, draft: o.name })}>変更</button>
              <button type="button" className="min-h-[36px] px-1 text-[11px] text-[#B03616] underline" aria-label={`${o.name} を削除`} onClick={() => setConfirm({ type: 'option', id: o.id, name: o.name })}>削除</button>
            </li>
          ))}
          {!items.length && <li className="text-[12.5px] text-[#84787D]">まだありません。</li>}
        </ul>
        <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); const n = name; run(() => addOptionItem(kind, n), `「${n.trim()}」を追加しました`, () => setName('')) }}>
          <label className="text-[11px] text-[#84787D]">新しい{KIND_LABEL[kind]}<input value={name} onChange={e => setName(e.target.value)} className={input + ' block w-[220px] max-w-full'} /></label>
          <button type="submit" disabled={pending || !name.trim()} className={dark}>{KIND_LABEL[kind]}を追加</button>
        </form>
      </section>
    )
  }

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="rounded-[16px] border-[1.5px] border-[#FF5C34] bg-[#FFD8C2] p-3 text-[12.5px] text-[#B03616]">{error}</p>}
      <section aria-label="種類・形状・ディテール" className={card + ' space-y-4'}>
        <div><h2 className="text-[15px] font-bold">種類 › 形状 › ディテール</h2></div>
        {Level({ title: '種類', level: 1, parent: null, items: l1s, selected: l1, onSelect: id => { setL1(id); setL2(null) } })}
        {Level({ title: '形状', level: 2, parent: l1, items: l2s, selected: l2, onSelect: setL2, hint: l1 ? undefined : '先に種類を選んでください。' })}
        {Level({ title: 'ディテール', level: 3, parent: l2, items: l3s, hint: l2 ? undefined : '先に形状を選んでください。' })}
      </section>
      {Options({ kind: 'material' })}
      {Options({ kind: 'print_colors' })}
      {Options({ kind: 'accessory' })}

      {renaming && (
        <div role="dialog" aria-modal="true" aria-label="名前を変える" className="fixed inset-0 z-[70] flex items-center justify-center bg-[#351E28]/40 p-4">
          <form className="w-full max-w-[400px] rounded-[16px] border border-[#E2E1DA] bg-white p-4 shadow-[0_20px_50px_rgba(53,30,40,.12)]" onSubmit={e => { e.preventDefault(); const r = renaming; run(() => r.type === 'catalog' ? renameCatalogNode(r.id, r.draft) : renameOptionItem(r.id, r.draft), '名前を変えました', () => setRenaming(null)) }}>
            <label className="block text-[12.5px] font-bold">「{renaming.name}」の新しい名前<input autoFocus value={renaming.draft} onChange={e => setRenaming({ ...renaming, draft: e.target.value })} className={input + ' mt-1 block w-full'} /></label>
            <div className="mt-4 flex justify-end gap-2"><button type="button" className={ghost} onClick={() => setRenaming(null)}>やめる</button><button type="submit" disabled={pending || !renaming.draft.trim()} className={dark}>この名前にする</button></div>
          </form>
        </div>
      )}
      {confirm && (
        <div role="dialog" aria-modal="true" aria-label="削除の確認" className="fixed inset-0 z-[70] flex items-center justify-center bg-[#351E28]/40 p-4">
          <div className="w-full max-w-[400px] rounded-[16px] border border-[#E2E1DA] bg-white p-4 shadow-[0_20px_50px_rgba(53,30,40,.12)]">
            <p className="text-[15px] font-bold">「{confirm.name}」を削除しますか？</p>
            <p className="mt-1 text-[12.5px] text-[#84787D]">{confirm.warn}登録済みの商品は変わりません。</p>
            <div className="mt-4 flex justify-end gap-2"><button type="button" className={ghost} onClick={() => setConfirm(null)}>やめる</button>
              <button type="button" disabled={pending} className={ghost + ' !border-[#FF5C34] !text-[#B03616]'} onClick={() => { const c = confirm; setConfirm(null); run(() => c.type === 'catalog' ? deleteCatalogNode(c.id) : deleteOptionItem(c.id), '削除しました', () => { if (c.id === l1) { setL1(null); setL2(null) } if (c.id === l2) setL2(null) }) }}>削除する</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
