import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { DealsTable } from '@/components/deals/deals-table'

export default async function DealsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: deals } = await supabase
    .from('deals')
    .select(`
      *,
      clients (id, company_name),
      factories (id, name),
      profiles (id, display_name)
    `)
    .order('updated_at', { ascending: false })

  return (
    <div style={{ padding: '24px 26px' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <h1
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: '24px',
            fontWeight: 600,
            color: '#0a0a0a',
          }}
        >
          Orders
        </h1>
        <Link
          href="/deals/new"
          style={{
            backgroundColor: '#0a0a0a',
            color: '#ffffff',
            borderRadius: '8px',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 500,
            fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
            textDecoration: 'none',
          }}
        >
          + 新規案件
        </Link>
      </div>

      {/* Table */}
      <DealsTable deals={deals || []} />
    </div>
  )
}
