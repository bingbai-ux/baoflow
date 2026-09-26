'use client'

// Sprint 12: アカウント招待の受け取り UI。
// 未ログイン: 新規登録 or ログイン → 招待受け取り → ポータルへ。
// ログイン済み: そのまま受け取りボタン。

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { claimAccountInvite } from '@/lib/actions/account-invites'

interface Props {
  token: string
  valid: boolean
  error?: string
  portalRole?: 'client' | 'logistics' | 'factory'
  orgName?: string
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
  loggedInEmail,
}: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<'signup' | 'login'>('signup')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false)
  const [pending, startTransition] = useTransition()

  const claimAndGo = () =>
    startTransition(async () => {
      const r = await claimAccountInvite(token)
      if (!r.success) {
        setMsg(r.error || '受け取りに失敗しました')
        return
      }
      router.push(ROLE_HOME[r.portalRole || 'client'])
      router.refresh()
    })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    const supabase = createClient()
    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
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
        return
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setMsg(error.message)
        return
      }
    }
    claimAndGo()
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
                  アカウントを作成すると、専用ページが使えるようになります。
                </p>
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
                    <b>{loggedInEmail}</b> としてログイン中です。このアカウントで招待を受け取りますか?
                  </p>
                  {msg && <p className="text-[12px] text-[#B03616] bg-[#FFD8C2] rounded-[12px] px-3 py-2 mb-3">{msg}</p>}
                  <button
                    type="button"
                    onClick={claimAndGo}
                    disabled={pending}
                    className="w-full bg-[#E9F056] text-[#666C14] rounded-full py-[10px] text-[13px] font-extrabold hover:brightness-95 disabled:opacity-50"
                  >
                    {pending ? '…' : 'この招待を受け取る'}
                  </button>
                  <button
                    type="button"
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
                        <label className="block text-[12px] text-[#84787D] mb-[6px]">お名前</label>
                        <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="山田 太郎" />
                      </div>
                    )}
                    <div>
                      <label className="block text-[12px] text-[#84787D] mb-[6px]">メールアドレス</label>
                      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="email@example.com" />
                    </div>
                    <div>
                      <label className="block text-[12px] text-[#84787D] mb-[6px]">パスワード (8文字以上)</label>
                      <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="••••••••" />
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
