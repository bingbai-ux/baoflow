'use client'

// Sprint 13: パスワード再設定 (メール送信)。全ロール共通。

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })
    setLoading(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 font-body" style={{ background: '#FBFAF6', color: '#351E28' }}>
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-6">
          <span className="font-display font-bold text-[32px] tracking-tight" style={{ color: '#B03616' }}>(bao)</span>
        </div>
        <div className="bg-white rounded-[16px] border p-8" style={{ borderColor: 'rgba(229,163,46,0.25)' }}>
          <h1 className="text-[17px] font-bold font-display text-center mb-2">パスワード再設定</h1>
          {sent ? (
            <p className="text-[13px] leading-relaxed text-center">
              再設定用のリンクを <b>{email}</b> に送りました。
              メール内のリンクから新しいパスワードを設定してください。
            </p>
          ) : (
            <>
              <p className="text-[12px] text-[#84787D] text-center mb-4">
                登録済みのメールアドレスに再設定リンクを送ります。
              </p>
              <form onSubmit={submit} className="flex flex-col gap-4">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full bg-[#EFEFEA] rounded-[12px] px-[14px] py-[10px] text-[13px] border border-transparent outline-none focus:border-[#E2E1DA]"
                />
                {error && (
                  <p className="text-[12px] py-2 px-3 rounded-[12px] bg-[#FFD8C2] text-[#B03616]">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#E9F056] text-[#666C14] rounded-full py-[10px] text-[13px] font-extrabold hover:brightness-95 disabled:opacity-50"
                >
                  {loading ? '送信中…' : '再設定リンクを送る'}
                </button>
              </form>
            </>
          )}
          <p className="text-center mt-4">
            <Link href="/login" className="text-[11.5px] text-[#84787D] underline">
              ログイン画面へ戻る
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
