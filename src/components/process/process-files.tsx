'use client'

// 工程の作業で使うファイルの一覧（開く・リンクをコピー・登録・削除）。登録はブラウザから保管場所へ直接アップロードする。

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteDesignImage } from '@/lib/actions/designs'
import { uploadProcessFiles } from '@/lib/process/upload'
import { useUi } from '@/components/ui/ui-store'

export interface ProcessFile { id: string; category: string; name: string; url: string; sizeBytes: number | null; createdAt: string }
const size = (n: number | null) => n == null ? '' : n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`
const link = 'min-h-[44px] inline-flex items-center px-2 text-[12px] underline disabled:opacity-40'

export function ProcessFiles({ dealId, category, title, files, editable, onError }: { dealId: string; category: string; title: string; files: ProcessFile[]; editable: boolean; onError: (message: string | null) => void }) {
  const router = useRouter()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)
  const list = files.filter(f => f.category === category)
  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []); e.target.value = ''
    if (!picked.length) return
    onError(null); setUploading(true)
    try { toast(`${await uploadProcessFiles(dealId, category, picked)}件のファイルを登録しました`) } catch (err) { onError(err instanceof Error ? err.message : 'アップロードできませんでした') } finally { setUploading(false); router.refresh() }
  }
  const remove = (f: ProcessFile) => { onError(null); startTransition(async () => {
    const r = await deleteDesignImage(f.id)
    if (!r.success) { onError(r.error || '削除できませんでした'); return }
    toast('ファイルを削除しました'); router.refresh()
  }) }
  return (
    <div className="mt-2 rounded-[12px] border border-[#E2E1DA] bg-[#FBFAF6] p-3">
      <ul aria-label={title} className="space-y-1">
        {list.map(f => (
          <li key={f.id} className="flex flex-wrap items-center gap-x-2 text-[12.5px]">
            <a href={f.url} target="_blank" rel="noreferrer" className="min-w-0 break-all font-bold underline">{f.name}</a>
            <span className="text-[11px] text-[#84787D] tabular-nums">{size(f.sizeBytes)}</span>
            <button type="button" className={link} onClick={() => navigator.clipboard?.writeText(f.url).then(() => toast('リンクをコピーしました'))}>リンクをコピー</button>
            {editable && <button type="button" disabled={pending} aria-label={`${f.name} を削除`} className={link + ' text-[#B03616]'} onClick={() => remove(f)}>削除</button>}
          </li>
        ))}
        {!list.length && <li className="text-[12.5px] text-[#84787D]">{title}はまだありません</li>}
      </ul>
      {editable && <label className={'mt-2 inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-full border border-[#E2E1DA] bg-white px-4 text-[12px] font-bold text-[#351E28] hover:bg-[#FBFAF6]' + (uploading ? ' opacity-40' : '')}>{uploading ? 'アップロード中…' : `${title}を登録`}
        <input type="file" multiple disabled={uploading} aria-label={`${title}を選ぶ`} className="sr-only" onChange={upload} /></label>}
    </div>
  )
}
