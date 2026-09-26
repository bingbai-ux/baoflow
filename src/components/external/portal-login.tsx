'use client'

// Sprint 11: 外部関係者 (クライアント / 工場 / 物流パートナー) 共通のログイン画面。
// アカウントは BAO が発行する (自己サインアップは無し)。

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  title: string
  subtitle: string
  redirectTo: string
  emailLabel?: string
  passwordLabel?: string
  buttonLabel?: string
  footnote?: string
}

export function PortalLogin({
  title,
  subtitle,
  redirectTo,
  emailLabel = 'メールアドレス',
  passwordLabel = 'パスワード',
  buttonLabel = 'ログイン',
  footnote = 'アカウントは (bao) が発行します。ログインできない場合は担当者にご連絡ください。',
}: Props) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.push(redirectTo)
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#FBFAF6' }}>
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/bao-logo.png" alt="(bao)" className="h-[44px] w-auto mx-auto" />
          <p className="text-[11px] text-[#84787D] font-body mt-2">Packaging procurement service</p>
        </div>
        <div className="bg-white rounded-[16px] border p-8" style={{ borderColor: 'rgba(229,163,46,0.25)' }}>
          <div className="text-center mb-6">
            <h1 className="text-[18px] font-bold font-display text-[#351E28]">{title}</h1>
            <p className="text-[12px] text-[#84787D] font-body mt-1">{subtitle}</p>
          </div>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="block text-[12px] text-[#84787D] font-body mb-[6px]">{emailLabel}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[#EFEFEA] rounded-[12px] px-[14px] py-[10px] text-[13px] font-body text-[#351E28] border border-transparent outline-none focus:border-[#E2E1DA]"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="block text-[12px] text-[#84787D] font-body mb-[6px]">{passwordLabel}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-[#EFEFEA] rounded-[12px] px-[14px] py-[10px] text-[13px] font-body text-[#351E28] border border-transparent outline-none focus:border-[#E2E1DA]"
                placeholder="••••••••"
              />
            </div>
            {error && (
              <div className="text-[12px] py-2 px-3 rounded-[12px] bg-[#FFD8C2] text-[#B03616] font-body">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#E9F056] text-[#666C14] rounded-full px-4 py-[10px] text-[13px] font-extrabold font-body hover:brightness-95 disabled:opacity-50"
            >
              {loading ? '…' : buttonLabel}
            </button>
          </form>
          <p className="text-center mt-4">
            <a href="/forgot-password" className="text-[11.5px] text-[#84787D] underline">
              パスワードを忘れた方はこちら / Forgot password
            </a>
          </p>
        </div>
        <p className="text-[10.5px] text-[#84787D] font-body text-center mt-4 leading-relaxed">{footnote}</p>
      </div>
    </div>
  )
}
