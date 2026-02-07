import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'

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
    <div className="min-h-screen">
      <Header userName={profile?.display_name || user.email || undefined} />

      {/* Main Content */}
      <main style={{ padding: '24px 26px' }}>
        <h1
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: '24px',
            fontWeight: 600,
            color: '#0a0a0a',
            marginBottom: '16px',
          }}
        >
          Overview
        </h1>
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            border: '1px solid rgba(0,0,0,0.06)',
            padding: '20px 22px',
          }}
        >
          <div
            style={{
              fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
              fontSize: '13px',
              color: '#555555',
            }}
          >
            <p style={{ marginBottom: '8px' }}>ようこそ、{profile?.display_name || user.email} さん</p>
            <p style={{ marginBottom: '8px' }}>
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
