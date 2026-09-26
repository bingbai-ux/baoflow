'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
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

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#EFEFEA]">
      <div className="w-full max-w-[380px] bg-white rounded-[16px] border border-[rgba(53,30,40,0.06)] p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="flex items-center justify-center gap-2 mb-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/bao-logo.png" alt="(bao)" className="h-[38px] w-auto" />
            <span className="text-[22px] font-bold font-display text-[#583F25] tracking-[-0.02em] mt-1.5">flow</span>
          </h1>
          <p className="text-[13px] text-[#84787D] font-body">
            パッケージ受発注管理
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          {/* Email */}
          <div>
            <label className="block text-[12px] text-[#84787D] font-body mb-[6px]">
              メールアドレス
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-[#EFEFEA] rounded-[12px] px-[14px] py-[10px] text-[13px] font-body text-[#351E28] border border-transparent outline-none focus:border-[#E2E1DA] transition-all"
              placeholder="email@example.com"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-[12px] text-[#84787D] font-body mb-[6px]">
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-[#EFEFEA] rounded-[12px] px-[14px] py-[10px] text-[13px] font-body text-[#351E28] border border-transparent outline-none focus:border-[#E2E1DA] transition-all"
              placeholder="••••••••"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-[12px] py-2 px-3 rounded-[12px] bg-[rgba(229,163,46,0.1)] text-[#B03616] font-body">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#E9F056] text-[#666C14] rounded-full px-4 py-[10px] text-[13px] font-extrabold font-body hover:brightness-95 disabled:opacity-50 transition-all cursor-pointer"
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
        <p className="text-center mt-4">
          <a href="/forgot-password" className="text-[11.5px] text-[#84787D] underline">
            パスワードを忘れた方はこちら
          </a>
        </p>
      </div>
    </div>
  )
}
