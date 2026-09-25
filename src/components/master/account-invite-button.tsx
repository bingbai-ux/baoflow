'use client'

// Sprint 12: ポータルログイン招待。クライアント/ロジ会社の詳細画面から
// 対象組織に紐付いたアカウント招待リンクを生成してコピーする。

import { useState, useTransition } from 'react'
import { Copy, KeyRound, X } from 'lucide-react'
import { createAccountInvitation } from '@/lib/actions/account-invites'
import { useUi } from '@/components/ui/ui-store'

interface Props {
  portalRole: 'client' | 'logistics'
  clientId?: string
  partnerId?: string
  orgLabel: string
}

export function AccountInviteButton({ portalRole, clientId, partnerId, orgLabel }: Props) {
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const [url, setUrl] = useState('')
  const [open, setOpen] = useState(false)

  const generate = () =>
    startTransition(async () => {
      const r = await createAccountInvitation({
        portal_role: portalRole,
        client_id: clientId || null,
        partner_id: partnerId || null,
        label: orgLabel,
      })
      if (!r.token || r.error) {
        toast(r.error || '生成に失敗しました', 'warn')
        return
      }
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const link = `${origin}/account-invite/${r.token}`
      setUrl(link)
      setOpen(true)
      try {
        await navigator.clipboard.writeText(link)
        toast('ログイン招待リンクを生成してコピーしました')
      } catch {
        toast('ログイン招待リンクを生成しました')
      }
    })

  return (
    <>
      <button
        type="button"
        onClick={generate}
        disabled={pending}
        className="rounded-full bg-[#351E28] text-[#C9A2B8] text-[11px] font-bold px-3 py-1.5 inline-flex items-center gap-1 disabled:opacity-40 hover:brightness-95"
        title={`${orgLabel} のポータルログインを発行`}
      >
        <KeyRound className="w-3 h-3" />
        {pending ? '生成中…' : 'ログイン招待'}
      </button>

      {open && url && (
        <div className="fixed inset-0 z-[1100] bg-black/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-[16px] shadow-2xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-[14px] font-semibold">ポータルログイン招待 — {orgLabel}</h3>
              <button type="button" onClick={() => setOpen(false)} className="p-1 text-[#84787D] hover:bg-[#FBFAF6] rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-[#351E28] mb-3">
              このリンクを先方の担当者に送ってください。開くとアカウント作成画面になり、
              作成と同時に {orgLabel} の{portalRole === 'client' ? 'クライアント' : '物流パートナー'}ページが使えるようになります(有効期限7日・1回使い切り)。
            </p>
            <div className="flex items-center gap-2 bg-[#FBFAF6] border border-[#E2E1DA] rounded-[12px] px-3 py-2">
              <input value={url} readOnly onFocus={(e) => e.currentTarget.select()} className="flex-1 bg-transparent border-none outline-none text-[11px]" />
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(url)
                    toast('コピーしました')
                  } catch {
                    toast('コピーに失敗しました', 'warn')
                  }
                }}
                className="text-[11px] px-2.5 py-1 bg-[#351E28] text-[#C9A2B8] rounded-full inline-flex items-center gap-1 hover:brightness-95"
              >
                <Copy className="w-3 h-3" /> コピー
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
