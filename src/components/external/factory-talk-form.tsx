'use client'

// 工場の返信ページの入力欄。ファイルは、サーバーが決めた置き場所へブラウザから直接置く（大きなファイルをサーバー経由にしない）。

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { postFactoryTalk, prepareTalkUpload } from '@/lib/actions/deal-talk'

const MAX_FILES = 5, MAX_BYTES = 26214400

export function FactoryTalkForm({ token }: { token: string }) {
  const [body, setBody] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(0)

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = [...files, ...Array.from(e.target.files || [])]; e.target.value = ''
    setError(null)
    if (next.length > MAX_FILES) { setError(`最多 ${MAX_FILES} 个文件（ファイルは${MAX_FILES}件まで）`); return }
    const big = next.find(f => f.size > MAX_BYTES)
    if (big) { setError(`${big.name}: 每个文件 25MB 以内（1件 25MB まで）`); return }
    setFiles(next)
  }
  const send = async () => {
    setError(null)
    try {
      const supabase = createClient(), placed: Array<{ name: string; type: string; size: number; path: string }> = []
      for (const [i, f] of files.entries()) {
        setBusy(`上传中… ${i + 1} / ${files.length}`)
        const ticket = await prepareTalkUpload(token, { name: f.name, type: f.type, size: f.size })
        if (ticket.error || !ticket.path || !ticket.uploadToken) throw new Error(ticket.error || '上传失败（アップロードできませんでした）')
        const up = await supabase.storage.from('deal-images').uploadToSignedUrl(ticket.path, ticket.uploadToken, f, { contentType: f.type })
        if (up.error) throw new Error(`${f.name}: 上传失败，请重试（アップロードできませんでした）`)
        placed.push({ name: f.name, type: f.type, size: f.size, path: ticket.path })
      }
      setBusy('发送中…')
      const r = await postFactoryTalk(token, body, placed)
      if (r.error) throw new Error(r.error)
      setBody(''); setFiles([]); setSent(n => n + 1)
    } catch (e) { setError(e instanceof Error ? e.message : '发送失败，请重试（送信できませんでした）') } finally { setBusy('') }
  }

  return (
    <div className="space-y-3">
      {sent > 0 && <p role="status" className="rounded-[16px] bg-[#D7EFFF] p-4 text-[14px] font-bold text-[#33566F]">已发送，谢谢。（送信しました）</p>}
      {error && <p role="alert" className="rounded-[16px] border-[1.5px] border-[#FF5C34] bg-[#FFD8C2] p-3 text-[13px] text-[#B03616] break-words">{error}</p>}
      <label className="block text-[12.5px] text-[#84787D]">内容（本文）
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={6} maxLength={4000} className="mt-1 w-full rounded-[12px] border border-transparent bg-[#EFEFEA] px-3 py-2 text-[14px] text-[#351E28] outline-none focus:border-[#351E28]" /></label>
      <div>
        <label className={'inline-flex min-h-[44px] cursor-pointer items-center rounded-full border border-[#E2E1DA] bg-white px-4 text-[13px] font-bold text-[#351E28] hover:brightness-95' + (busy ? ' opacity-40' : '')}>添加照片・视频・PDF（ファイルを追加）
          <input type="file" multiple accept="image/*,video/mp4,video/quicktime,application/pdf" disabled={!!busy} aria-label="文件（ファイル）" className="sr-only" onChange={pick} /></label>
        {files.length > 0 && <ul aria-label="已选文件" className="mt-2 space-y-1">{files.map((f, i) => (
          <li key={i} className="flex items-center justify-between gap-2 rounded-[12px] border border-[#E2E1DA] bg-white px-3 py-1 text-[12.5px]"><span className="min-w-0 break-all">{f.name}</span>
            <button type="button" disabled={!!busy} onClick={() => setFiles(list => list.filter((_, n) => n !== i))} className="min-h-[44px] shrink-0 rounded-full px-3 text-[12.5px] font-bold text-[#351E28] underline disabled:opacity-40">删除（外す）</button></li>))}</ul>}
        <p className="mt-1 text-[11px] text-[#84787D]">最多 {MAX_FILES} 个，每个 25MB 以内</p>
      </div>
      <button type="button" disabled={!!busy || (!body.trim() && !files.length)} onClick={send}
        className="min-h-[48px] w-full rounded-full bg-[#E9F056] px-6 text-[15px] font-extrabold text-[#666C14] hover:brightness-95 disabled:opacity-60 sm:w-auto">{busy || '发送（送信する）'}</button>
    </div>
  )
}
