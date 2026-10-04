'use client'

import { useState, useTransition } from 'react'
import { Copy, KeyRound, X } from 'lucide-react'
import { createAccountInvitation } from '@/lib/actions/account-invites'
import { accountInviteScope, normalizeAccountInviteEmail } from '@/lib/utils/account-invites'
import { useUi } from '@/components/ui/ui-store'

interface Props {
  portalRole: 'client' | 'logistics' | 'factory'
  clientId?: string
  partnerId?: string
  factoryId?: string
  orgLabel: string
}

export function AccountInviteButton({ portalRole, clientId, partnerId, factoryId, orgLabel }: Props) {
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const [url, setUrl] = useState('')
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const recipient = normalizeAccountInviteEmail(email)

  const generate = (e: React.FormEvent) => {
    e.preventDefault()
    if (pending || url || !recipient) return
    startTransition(async () => {
      const r = await createAccountInvitation({
        portal_role: portalRole, recipient_email: recipient,
        client_id: clientId || null, partner_id: partnerId || null,
        factory_id: factoryId || null, label: orgLabel,
      })
      if (!r.token || r.error) { toast(r.error || '生成に失敗しました', 'warn'); return }
      setEmail(recipient)
      setUrl(`${window.location.origin}/account-invite/${r.token}`)
      toast('指定したメールアドレス専用の招待リンクを生成しました')
    })
  }
  const close = () => { if (!pending) setOpen(false) }

  return (
    <>
      <button type="button" onClick={() => { setUrl(''); setEmail(''); setOpen(true) }} disabled={pending}
        className="rounded-full bg-[#351E28] text-[#C9A2B8] text-[11px] font-bold px-3 py-1.5 inline-flex items-center gap-1 disabled:opacity-40 hover:brightness-95"
        title={`${orgLabel} のポータルログインを発行`}>
        <KeyRound className="w-3 h-3" /> ログイン招待
      </button>
      {open && (
        <div className="fixed inset-0 z-[1100] bg-black/40 flex items-center justify-center p-4" onClick={close}>
          <div role="dialog" aria-modal="true" aria-labelledby="account-invite-title" className="bg-white rounded-[16px] max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 id="account-invite-title" className="font-display text-[14px] font-semibold">ポータルログイン招待 — {orgLabel}</h3>
              <button type="button" aria-label="招待画面を閉じる" disabled={pending} onClick={close} className="p-1 text-[#84787D] rounded"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-[12px] mb-3">{accountInviteScope(portalRole, orgLabel)}</p>
            <p className="text-[11px] text-[#84787D] mb-3">指定したメールアドレスを確認済みのアカウントだけが受け取れます。有効期限7日・1回使い切りです。</p>
            <form onSubmit={generate}>
              <label htmlFor="account-invite-email" className="block text-[12px] mb-1">招待先メールアドレス</label>
              <input id="account-invite-email" type="email" required autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} disabled={pending || !!url}
                className="w-full bg-[#EFEFEA] rounded-[12px] px-3 py-2 text-[13px] mb-3" />
              {!url && <button type="submit" disabled={pending || !recipient} className="w-full min-h-11 rounded-full bg-[#E9F056] text-[#666C14] text-[12px] font-bold disabled:opacity-40">{pending ? '生成中…' : 'この宛先と権限で招待リンクを生成'}</button>}
            </form>
            {url && <>
              <p className="text-[12px] my-3"><b>{email}</b> にこのリンクを渡してください。メールは自動送信されません。</p>
              <div className="flex items-center gap-2 bg-[#FBFAF6] border border-[#E2E1DA] rounded-[12px] px-3 py-2">
                <input aria-label="生成した招待リンク" value={url} readOnly onFocus={(e) => e.currentTarget.select()} className="flex-1 min-w-0 bg-transparent text-[11px]" />
                <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(url); toast('コピーしました') } catch { toast('コピーに失敗しました', 'warn') } }} className="text-[11px] min-h-11 px-3 rounded-full inline-flex items-center gap-1"><Copy className="w-3 h-4" /> コピー</button>
              </div>
            </>}
          </div>
        </div>
      )}
    </>
  )
}
