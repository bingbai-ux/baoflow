"use client"

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LogoutButton() {
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="transition-opacity hover:opacity-80"
      style={{
        backgroundColor: '#ffffff',
        color: '#888888',
        border: '1px solid #e8e8e6',
        borderRadius: '8px',
        padding: '5px 13px',
        fontSize: '12px',
        fontWeight: 500,
        fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
      }}
    >
      ログアウト
    </button>
  )
}
