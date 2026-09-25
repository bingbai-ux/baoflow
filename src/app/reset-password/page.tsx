'use client'

// Sprint 13: 新しいパスワードの設定 (メールの再設定リンクから遷移)。

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) return setError('パスワードは8文字以上にしてください')
    if (password !== confirm) return setError('確認用パスワードが一致しません')
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      setError(
        error.message.includes('session')
          ? 'セッションが切れています。もう一度「パスワード再設定」からやり直してください。'
          : error.message
      )
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 font-body" style={{ background: '#FBFAF6', color: '#351E28' }}>
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-6">
          <span className="font-display font-bold text-[32px] tracking-tight" style={{ color: '#B03616' }}>(bao)</span>
        </div>
        <div className="bg-white rounded-[16px] border p-8" style={{ borderColor: 'rgba(229,163,46,0.25)' }}>
          <h1 className="text-[17px] font-bold font-display text-center mb-4">新しいパスワードを設定</h1>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div>
              <label className="block text-[12px] text-[#84787D] mb-[6px]">新しいパスワード (8文字以上)</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#EFEFEA] rounded-[12px] px-[14px] py-[10px] text-[13px] border border-transparent outline-none focus:border-[#E2E1DA]"
              />
            </div>
            <div>
              <label className="block text-[12px] text-[#84787D] mb-[6px]">もう一度入力</label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full bg-[#EFEFEA] rounded-[12px] px-[14px] py-[10px] text-[13px] border border-transparent outline-none focus:border-[#E2E1DA]"
              />
            </div>
            {error && (
              <p className="text-[12px] py-2 px-3 rounded-[12px] bg-[#FFD8C2] text-[#B03616]">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#E9F056] text-[#666C14] rounded-full py-[10px] text-[13px] font-extrabold hover:brightness-95 disabled:opacity-50"
            >
              {loading ? '設定中…' : 'この内容で設定する'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
