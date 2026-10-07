'use client'

// Sprint 12: アカウント招待の受け取り UI。
// 未ログイン: 新規登録 or ログイン → 招待受け取り → ポータルへ。
// ログイン済み: そのまま受け取りボタン。

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { claimAccountInvite } from '@/lib/actions/account-invites'
import { accountInviteScope, normalizeAccountInviteEmail } from '@/lib/utils/account-invites'

interface Props {
  token: string
  valid: boolean
  error?: string
  portalRole?: 'client' | 'logistics' | 'factory'
  orgName?: string
  recipientEmail?: string
  loggedInEmail: string | null
}

const ROLE_LABEL = { client: 'クライアント', logistics: '物流パートナー', factory: '工場 / Factory' } as const
const ROLE_HOME = { client: '/portal', logistics: '/logistics', factory: '/factory' } as const

export function AccountInviteClient({
  token,
  valid,
  error,
  portalRole,
  orgName,
  recipientEmail,
  loggedInEmail,
}: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<'signup' | 'login'>('signup')
  const [name, setName] = useState('')
  const [email, setEmail] = useState(recipientEmail || '')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false)
  const [pending, startTransition] = useTransition()
  const submitting = useRef(false)
  const recipient = normalizeAccountInviteEmail(recipientEmail)
  const wrongAccount = !!loggedInEmail && normalizeAccountInviteEmail(loggedInEmail) !== recipient

  const receive = async () => {
    const r = await claimAccountInvite(token)
    if (!r.success) {
      setMsg(r.error || '受け取りに失敗しました')
      return
    }
    router.push(ROLE_HOME[r.portalRole || 'client'])
    router.refresh()
  }

  const claimAndGo = () => {
    if (submitting.current || wrongAccount || !recipient) return
    submitting.current = true
    startTransition(async () => {
      try { await receive() }
      catch { setMsg('招待を受け取れませんでした。通信状態を確認して、もう一度お試しください。') }
      finally { submitting.current = false }
    })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting.current) return
    setMsg(null)
    const loginEmail = normalizeAccountInviteEmail(email)
    if (!recipient || loginEmail !== recipient) {
      setMsg('招待先のメールアドレスで登録・ログインしてください')
      return
    }
    submitting.current = true
    startTransition(async () => {
      try {
        const supabase = createClient()
        if (mode === 'signup') {
          const { data, error } = await supabase.auth.signUp({
            email: loginEmail,
            password,
            options: { data: { display_name: name || email.split('@')[0] } },
          })
          if (error) {
            setMsg(error.message)
            return
          }
          if (!data.session) {
            // メール確認が必要な設定の場合
            setNeedsEmailConfirm(true)
            setPassword('')
            return
          }
        } else {
          const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password })
          if (error) {
            setMsg(error.message)
            return
          }
        }
        await receive()
      } catch { setMsg('招待を受け取れませんでした。通信状態を確認して、もう一度お試しください。') }
      finally { submitting.current = false }
    })
  }

  const inputCls =
    'w-full bg-[#EFEFEA] rounded-[12px] px-[14px] py-[10px] text-[13px] font-body text-[#351E28] border border-transparent outline-none focus:border-[#E2E1DA]'

  return (
    <div className="min-h-screen flex items-center justify-center px-4 font-body" style={{ background: '#FBFAF6', color: '#351E28' }}>
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/bao-logo.png" alt="(bao)" className="h-[44px] w-auto mx-auto" />
          <p className="text-[11px] text-[#84787D] mt-2">Packaging procurement service</p>
        </div>

        <div className="bg-white rounded-[16px] border p-8" style={{ borderColor: 'rgba(229,163,46,0.25)' }}>
          {!valid ? (
            <div className="text-center">
              <p className="font-display text-[17px] font-bold mb-2">招待リンクを開けません</p>
              <p className="text-[13px]">{error}</p>
              <p className="text-[11px] text-[#84787D] mt-3">(bao) の担当者に新しいリンクを依頼してください。</p>
            </div>
          ) : (
            <>
              <div className="text-center mb-5">
                <h1 className="font-display text-[18px] font-bold">
                  {ROLE_LABEL[portalRole || 'client']}ページへの招待
                </h1>
                {orgName && <p className="text-[13px] mt-1">{orgName} さま</p>}
                <p className="text-[11.5px] text-[#84787D] mt-1">
                  招待先の確認済みメールアドレスで受け取ると、専用ページが使えるようになります。
                </p>
                <p className="text-[12px] mt-2">招待先: <b>{recipientEmail}</b></p>
                <p className="text-[11.5px] text-[#84787D] mt-2">{accountInviteScope(portalRole || 'client', orgName || '招待先会社')}</p>
              </div>

              {needsEmailConfirm ? (
                <div className="text-center">
                  <p className="text-[13px] leading-relaxed">
                    確認メールを <b>{email}</b> に送りました。
                    メール内のリンクで確認したあと、<b>もう一度この招待リンクを開いて</b>「ログイン」してください。
                  </p>
                </div>
              ) : loggedInEmail ? (
                <div className="text-center">
                  <p className="text-[13px] mb-4">
                    <b>{loggedInEmail}</b> としてログイン中です。
                  </p>
                  {wrongAccount && <p role="alert" className="text-[12px] mb-3">招待先と異なるアカウントです。ログアウトして、招待先のメールアドレスでログインしてください。</p>}
                  {msg && <p className="text-[12px] text-[#B03616] bg-[#FFD8C2] rounded-[12px] px-3 py-2 mb-3">{msg}</p>}
                  <button
                    type="button"
                    onClick={claimAndGo}
                    disabled={pending || wrongAccount || !recipient}
                    className="w-full bg-[#E9F056] text-[#666C14] rounded-full py-[10px] text-[13px] font-extrabold hover:brightness-95 disabled:opacity-50"
                  >
                    {pending ? '…' : 'この招待を受け取る'}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={async () => {
                      await createClient().auth.signOut()
                      router.refresh()
                    }}
                    className="mt-3 text-[11.5px] text-[#84787D] underline"
                  >
                    別のアカウントを使う (ログアウト)
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex rounded-full bg-[#EFEFEA] p-1 mb-4">
                    {(['signup', 'login'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        disabled={pending}
                        onClick={() => setMode(m)}
                        className={`flex-1 rounded-full py-1.5 text-[12px] font-bold ${
                          mode === m ? 'bg-white text-[#351E28]' : 'text-[#84787D]'
                        }`}
                      >
                        {m === 'signup' ? '新規登録' : 'ログイン'}
                      </button>
                    ))}
                  </div>
                  <form onSubmit={submit} className="flex flex-col gap-3.5">
                    {mode === 'signup' && (
                      <div>
                        <label htmlFor="account-invite-name" className="block text-[12px] text-[#84787D] mb-[6px]">お名前</label>
                        <input id="account-invite-name" disabled={pending} value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="山田 太郎" />
                      </div>
                    )}
                    <div>
                      <label htmlFor="account-invite-login-email" className="block text-[12px] text-[#84787D] mb-[6px]">メールアドレス</label>
                      <input id="account-invite-login-email" disabled={pending} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="email@example.com" />
                    </div>
                    <div>
                      <label htmlFor="account-invite-password" className="block text-[12px] text-[#84787D] mb-[6px]">パスワード (8文字以上)</label>
                      <input id="account-invite-password" disabled={pending} type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="••••••••" />
                    </div>
                    {msg && <p className="text-[12px] text-[#B03616] bg-[#FFD8C2] rounded-[12px] px-3 py-2">{msg}</p>}
                    <button
                      type="submit"
                      disabled={pending}
                      className="w-full bg-[#E9F056] text-[#666C14] rounded-full py-[10px] text-[13px] font-extrabold hover:brightness-95 disabled:opacity-50"
                    >
                      {pending ? '…' : mode === 'signup' ? 'アカウントを作成して招待を受け取る' : 'ログインして招待を受け取る'}
                    </button>
                  </form>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
