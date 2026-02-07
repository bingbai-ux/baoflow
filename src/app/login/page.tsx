"use client"

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
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: '#f2f2f0' }}
    >
      <div
        className="w-full max-w-sm p-8"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          border: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <h1
            className="text-2xl font-semibold mb-1"
            style={{
              fontFamily: "'Fraunces', serif",
              color: '#0a0a0a',
            }}
          >
            (bao) flow
          </h1>
          <p
            className="text-sm"
            style={{
              fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
              color: '#888888',
            }}
          >
            ログイン
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          {/* Email */}
          <div>
            <label
              className="block text-xs mb-1.5"
              style={{
                fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                color: '#888888',
              }}
            >
              メールアドレス
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full outline-none transition-all"
              style={{
                backgroundColor: '#f2f2f0',
                borderRadius: '10px',
                padding: '10px 14px',
                fontSize: '13px',
                fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                color: '#0a0a0a',
                border: '1px solid transparent',
              }}
              onFocus={(e) => e.target.style.border = '1px solid #e8e8e6'}
              onBlur={(e) => e.target.style.border = '1px solid transparent'}
              placeholder="email@example.com"
            />
          </div>

          {/* Password */}
          <div>
            <label
              className="block text-xs mb-1.5"
              style={{
                fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                color: '#888888',
              }}
            >
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full outline-none transition-all"
              style={{
                backgroundColor: '#f2f2f0',
                borderRadius: '10px',
                padding: '10px 14px',
                fontSize: '13px',
                fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                color: '#0a0a0a',
                border: '1px solid transparent',
              }}
              onFocus={(e) => e.target.style.border = '1px solid #e8e8e6'}
              onBlur={(e) => e.target.style.border = '1px solid transparent'}
              placeholder="••••••••"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div
              className="text-xs py-2 px-3 rounded-lg"
              style={{
                backgroundColor: 'rgba(229, 163, 46, 0.1)',
                color: '#e5a32e',
                fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
              }}
            >
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full transition-opacity disabled:opacity-50"
            style={{
              backgroundColor: '#0a0a0a',
              color: '#ffffff',
              borderRadius: '8px',
              padding: '10px 13px',
              fontSize: '13px',
              fontWeight: 500,
              fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
            }}
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  )
}
