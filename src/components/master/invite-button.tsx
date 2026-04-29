'use client'

// Sprint 8-5: マスター画面の「+ 招待」ボタン。クリックでトークン生成、URL を表示。
// メール送信は実装しない (§0.5-3、リンクコピーのみ)。

import { useState, useTransition } from 'react'
import { Copy, Link as LinkIcon, X } from 'lucide-react'
import {
  createClientInvitation,
  createFactoryInvitation,
} from '@/lib/actions/external-forms'
import { useUi } from '@/components/ui/ui-store'

interface Props {
  kind: 'client' | 'factory'
}

export function InviteButton({ kind }: Props) {
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState<string>('')

  const handleClick = () => {
    if (pending) return
    startTransition(async () => {
      const r =
        kind === 'client' ? await createClientInvitation() : await createFactoryInvitation()
      if (!r.token || r.error) {
        toast(r.error || 'リンク生成に失敗しました', 'warn')
        return
      }
      const origin =
        typeof window !== 'undefined' ? window.location.origin : ''
      setUrl(`${origin}/external/${r.token}`)
      setOpen(true)
    })
  }

  const copy = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      toast('URL をコピーしました')
    } catch {
      toast('クリップボードへのコピーに失敗しました', 'warn')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="text-[11px] px-2.5 py-1 border border-[#e0dfd9] rounded-[6px] bg-white hover:bg-[#fafaf9] inline-flex items-center gap-1 disabled:opacity-50"
        title={kind === 'client' ? 'クライアント招待リンクを生成' : '工場招待リンクを生成'}
      >
        <LinkIcon className="w-3 h-3" />
        {pending ? '生成中…' : kind === 'client' ? '+ 招待リンク' : '+ 工場招待'}
      </button>

      {open && url && (
        <div
          className="fixed inset-0 z-[1100] bg-black/40 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-[14px] shadow-2xl max-w-md w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-[14px] font-semibold">
                {kind === 'client' ? 'クライアント招待リンク' : '工場招待リンク'}
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 text-[#888] hover:bg-[#fafaf9] rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-[#555] mb-3">
              このリンクを WeChat / メール / Slack 等で先方に送ってください。**有効期限は 7 日**。
            </p>
            <div className="flex items-center gap-2 bg-[#fafaf9] border border-[#e8e8e6] rounded-[8px] px-3 py-2 mb-3">
              <input
                value={url}
                readOnly
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 bg-transparent border-none outline-none text-[11px] font-mono"
              />
              <button
                type="button"
                onClick={copy}
                className="text-[11px] px-2.5 py-1 bg-[#0a0a0a] text-white rounded-[6px] inline-flex items-center gap-1 hover:bg-[#222]"
              >
                <Copy className="w-3 h-3" />
                コピー
              </button>
            </div>
            <p className="text-[10px] text-[#888]">
              リンクを開くと相手側の入力フォームが表示され、送信後に自動で
              {kind === 'client' ? 'クライアント' : '工場'}マスターに登録されます。
            </p>
          </div>
        </div>
      )}
    </>
  )
}
