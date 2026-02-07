import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LogoutButton from './logout-button'

export default async function HomePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get profile from profiles table
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: '#f2f2f0' }}
    >
      {/* Header */}
      <header
        className="h-[52px] flex items-center justify-between px-6"
        style={{ backgroundColor: '#ffffff' }}
      >
        <h1
          className="text-lg font-semibold"
          style={{
            fontFamily: "'Fraunces', serif",
            color: '#0a0a0a',
          }}
        >
          (bao) flow
        </h1>
        <div className="flex items-center gap-4">
          <span
            className="text-sm"
            style={{
              fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
              color: '#555555',
            }}
          >
            {profile?.display_name || user.email}
          </span>
          <LogoutButton />
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        <div
          className="p-6"
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            border: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          <h2
            className="text-xl font-semibold mb-4"
            style={{
              fontFamily: "'Fraunces', serif",
              color: '#0a0a0a',
            }}
          >
            Overview Panel
          </h2>
          <div
            className="text-sm"
            style={{
              fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
              color: '#555555',
            }}
          >
            <p className="mb-2">ようこそ、{profile?.display_name || user.email} さん</p>
            <p className="mb-2">
              <span style={{ color: '#888888' }}>ロール:</span>{' '}
              <span style={{ color: '#0a0a0a' }}>{profile?.role || 'sales'}</span>
            </p>
            <p>
              <span style={{ color: '#888888' }}>メール:</span>{' '}
              <span style={{ color: '#0a0a0a' }}>{user.email}</span>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
