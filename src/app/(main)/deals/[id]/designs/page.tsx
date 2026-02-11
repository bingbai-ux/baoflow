import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { DesignFilesList } from './designs-list'

interface Props {
  params: Promise<{ id: string }>
}

export default async function DesignsPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: deal } = await supabase
    .from('deals')
    .select('id, deal_number, product_name')
    .eq('id', id)
    .single()

  if (!deal) {
    notFound()
  }

  // Get design files
  const { data: designFiles } = await supabase
    .from('design_files')
    .select(`
      *,
      profiles (id, display_name)
    `)
    .eq('deal_id', id)
    .order('version', { ascending: false })

  return (
    <div style={{ minHeight: '100vh', background: '#f2f2f0', padding: '24px 26px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, color: '#888888', marginBottom: 2 }}>
            {deal.deal_number}
          </div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 600 }}>
            デザインデータ管理
          </h1>
        </div>
        <Link
          href={`/deals/${id}`}
          style={{
            backgroundColor: '#ffffff',
            color: '#888888',
            border: '1px solid #e8e8e6',
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          案件に戻る
        </Link>
      </div>

      <DesignFilesList dealId={id} initialFiles={designFiles || []} userId={user.id} />
    </div>
  )
}
