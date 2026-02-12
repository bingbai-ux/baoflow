'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function FactoryLoginPage() {
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

    const { error: authError, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    // Check if user is a factory user
    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()

      if (profile?.role !== 'factory') {
        await supabase.auth.signOut()
        setError('このアカウントは工場ポータルへのアクセス権がありません')
        setLoading(false)
        return
      }
    }

    router.push('/factory')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#f2f2f0]">
      <div className="w-full max-w-[380px] bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-[28px] font-bold font-display text-[#0a0a0a] tracking-[-0.02em] mb-1">
            (bao) flow
          </h1>
          <p className="text-[13px] text-[#888] font-body">
            工場ポータル
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          {/* Email */}
          <div>
            <label className="block text-[12px] text-[#888] font-body mb-[6px]">
              メールアドレス
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-[#f2f2f0] rounded-[10px] px-[14px] py-[10px] text-[13px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6] transition-all"
              placeholder="email@example.com"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-[12px] text-[#888] font-body mb-[6px]">
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-[#f2f2f0] rounded-[10px] px-[14px] py-[10px] text-[13px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6] transition-all"
              placeholder="--------"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-[12px] py-2 px-3 rounded-[8px] bg-[rgba(229,163,46,0.1)] text-[#e5a32e] font-body">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0a0a0a] text-white rounded-[8px] px-4 py-[10px] text-[13px] font-medium font-body disabled:opacity-50 transition-opacity cursor-pointer"
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  )
}
