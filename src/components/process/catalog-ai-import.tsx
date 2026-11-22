'use client'

// 商品マスター: カタログ（画像・PDF）をAIに読ませて、マスターに足す候補を出す。選んだものだけ登録する。

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { importCatalogCandidates } from '@/lib/actions/product-master'
import type { CatalogCandidates } from '@/lib/process/catalog-import'
import { useUi } from '@/components/ui/ui-store'

const ghost = 'min-h-[44px] inline-flex items-center justify-center rounded-full border border-[#E2E1DA] bg-white px-4 text-[12px] font-bold text-[#351E28] hover:bg-[#FBFAF6] disabled:opacity-40'
const dark = 'min-h-[44px] inline-flex items-center justify-center rounded-full bg-[#351E28] px-4 text-[12px] font-bold text-[#C9A2B8] hover:brightness-95 disabled:opacity-40'
const MAX_FILES = 4, MAX_SOURCE = 20 * 1024 * 1024, MAX_PDF = 3 * 1024 * 1024, MAX_IMAGE_CHARS = 900_000
const GROUPS = [['materials', '素材'], ['print_colors', '印刷の色数'], ['accessories', '付属品']] as const
const path = (c: CatalogCandidates['categories'][number]) => [c.l1, c.l2, c.l3].filter(Boolean).join(' › ')

const readAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(new Error(`${file.name}: 読み込めませんでした`)); r.readAsDataURL(file) })
/** 画像は文字が読める大きさ（長辺 2000px まで）の JPEG に縮めて送る。 */
async function imageForAi(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => { const el = new Image(); el.onload = () => resolve(el); el.onerror = () => reject(new Error(`${file.name}: 読み込めませんでした`)); el.src = url })
    let side = Math.min(2000, Math.max(img.naturalWidth, img.naturalHeight))
    for (let i = 0; i < 6; i++) {
      const k = side / Math.max(img.naturalWidth, img.naturalHeight), canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.naturalWidth * k)); canvas.height = Math.max(1, Math.round(img.naturalHeight * k))
      const ctx = canvas.getContext('2d')
      if (!ctx) break
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const data = canvas.toDataURL('image/jpeg', 0.85)
      if (data.length <= MAX_IMAGE_CHARS) return data
      side = Math.round(side * 0.8)
    }
    throw new Error(`${file.name}: 画像を小さくしきれませんでした`)
  } finally { URL.revokeObjectURL(url) }
}

export function CatalogAiImport({ aiReady }: { aiReady: boolean }) {
  const router = useRouter()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const [reading, setReading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [found, setFound] = useState<CatalogCandidates | null>(null)
  const [off, setOff] = useState<Set<string>>(new Set()) // 外した候補（最初は全部選ばれている）
  const toggle = (key: string) => setOff(s => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n })
  const count = found ? found.categories.length + GROUPS.reduce((n, [k]) => n + found[k].length, 0) : 0
  const picked = found ? { categories: found.categories.filter(c => !off.has('c:' + path(c))), ...Object.fromEntries(GROUPS.map(([k]) => [k, found[k].filter(x => !off.has(`${k}:${x}`))])) } as CatalogCandidates : null
  const pickedCount = picked ? picked.categories.length + GROUPS.reduce((n, [k]) => n + picked[k].length, 0) : 0

  const read = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []); e.target.value = ''
    if (!files.length) return
    setError(null); setFound(null); setOff(new Set())
    if (files.length > MAX_FILES) { setError(`一度に読めるのは ${MAX_FILES}件までです`); return }
    setReading(true)
    try {
      const data: string[] = []
      for (const f of files) {
        if (f.type === 'application/pdf') { if (f.size > MAX_PDF) throw new Error(`${f.name}: PDF は 3MB までです。ページを画像にしてお試しください`); data.push(await readAsDataUrl(f)) }
        else if (['image/png', 'image/jpeg'].includes(f.type)) { if (f.size > MAX_SOURCE) throw new Error(`${f.name}: 画像は 20MB までです`); data.push(await imageForAi(f)) }
        else throw new Error(`${f.name}: 画像（PNG / JPEG）か PDF を選んでください`)
      }
      const res = await fetch('/api/catalog-import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ files: data }) })
      const out = await res.json().catch(() => null) as { candidates?: CatalogCandidates; error?: string } | null
      if (!res.ok || !out?.candidates) throw new Error(out?.error || 'AIで読み取れませんでした。時間をおいてもう一度お試しください。')
      setFound(out.candidates)
    } catch (err) { setError(err instanceof Error ? err.message : 'AIで読み取れませんでした') } finally { setReading(false) }
  }
  const save = () => { if (!picked) return; setError(null); startTransition(async () => {
    const r = await importCatalogCandidates(picked)
    if (r.error !== null) { setError(r.error); router.refresh(); return }
    setFound(null); toast(`${r.added}件を商品マスターに登録しました`); router.refresh()
  }) }
  const chip = (key: string, text: string) => (
    <li key={key}><label className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border px-3 text-[12.5px] ${off.has(key) ? 'border-[#E2E1DA] bg-white text-[#84787D]' : 'border-[#351E28] bg-[#FBFAF6] font-bold'}`}>
      <input type="checkbox" checked={!off.has(key)} onChange={() => toggle(key)} className="accent-[#351E28]" />{text}</label></li>
  )

  return (
    <section aria-label="カタログからAIで取り込む" className="rounded-[16px] border border-[#E2E1DA] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold">カタログからAIで取り込む</h2>
        <label className={dark + ' cursor-pointer' + (reading || !aiReady ? ' opacity-40' : '')}>{reading ? '読み取り中…' : 'カタログを選ぶ'}
          <input type="file" multiple accept="image/png,image/jpeg,application/pdf" disabled={reading || !aiReady} aria-label="カタログの画像・PDF" className="sr-only" onChange={read} /></label>
      </div>
      <p className="mt-1 text-[11px] text-[#84787D]">画像（PNG / JPEG）か PDF（3MB まで）を {MAX_FILES}件まで</p>
      {!aiReady && <p role="alert" className="mt-2 rounded-[16px] border-[1.5px] border-[#FF5C34] bg-[#FFD8C2] p-3 text-[12.5px] text-[#B03616]">AIの設定（ANTHROPIC_API_KEY）がありません</p>}
      {error && <p role="alert" className="mt-2 rounded-[16px] border-[1.5px] border-[#FF5C34] bg-[#FFD8C2] p-3 text-[12.5px] text-[#B03616] break-words">{error}</p>}
      {found && (count === 0 ? <p role="status" className="mt-3 text-[13px] text-[#84787D]">新しく登録できる候補は見つかりませんでした</p> : (
        <div className="mt-3 space-y-3">
          {found.categories.length > 0 && <div><h3 className="mb-1.5 text-[12.5px] font-bold">種類 › 形状 › ディテール</h3><ul aria-label="分類の候補" className="flex flex-wrap gap-2">{found.categories.map(c => chip('c:' + path(c), path(c)))}</ul></div>}
          {GROUPS.map(([k, title]) => found[k].length > 0 && <div key={k}><h3 className="mb-1.5 text-[12.5px] font-bold">{title}</h3><ul aria-label={`${title}の候補`} className="flex flex-wrap gap-2">{found[k].map(x => chip(`${k}:${x}`, x))}</ul></div>)}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={ghost} onClick={() => setFound(null)}>やめる</button>
            <button type="button" disabled={pending || pickedCount === 0} className={dark} onClick={save}>選んだ {pickedCount}件を登録する</button>
          </div>
        </div>
      ))}
    </section>
  )
}
