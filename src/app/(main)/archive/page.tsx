// Sprint 9-3: 案件履歴ページ。
// archived_at IS NOT NULL の案件を一覧表示し、検索・ソート・フィルタ・リオーダーを提供。

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ArchiveListClient } from '@/components/archive/archive-list-client'

interface SearchParams {
  q?: string
  reason?: 'all' | 'completed' | 'cancelled' | 'lost' | 'other'
  sortBy?: 'archived_at' | 'created_at' | 'deal_name'
  sortOrder?: 'asc' | 'desc'
}

interface Props {
  searchParams: Promise<SearchParams>
}

export default async function ArchivePage({ searchParams }: Props) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let query = supabase
    .from('deals')
    .select(
      'id, deal_code, deal_name, client_name_text, simple_status, archived_at, archive_reason, archive_note, tags, created_at, archived_by'
    )
    .not('archived_at', 'is', null)

  if (params.reason && params.reason !== 'all') {
    query = query.eq('archive_reason', params.reason)
  }
  if (params.q) {
    const escaped = params.q.replace(/[%_]/g, (m) => `\\${m}`)
    query = query.or(
      `deal_name.ilike.%${escaped}%,client_name_text.ilike.%${escaped}%,deal_code.ilike.%${escaped}%`
    )
  }

  const sortBy = params.sortBy || 'archived_at'
  const ascending = params.sortOrder === 'asc'
  query = query.order(sortBy, { ascending })

  const { data: deals } = await query

  // 各案件の採用見積合計
  const dealIds = (deals || []).map((d) => d.id)
  let approvedTotalsByDeal = new Map<string, number>()
  if (dealIds.length > 0) {
    const { data: quotes } = await supabase
      .from('deal_quotes')
      .select('deal_id, total_billing_tax_jpy, status')
      .in('deal_id', dealIds)
      .eq('status', 'approved')
    for (const q of quotes || []) {
      const cur = approvedTotalsByDeal.get(q.deal_id) || 0
      approvedTotalsByDeal.set(q.deal_id, cur + (q.total_billing_tax_jpy || 0))
    }
  }

  const rows = (deals || []).map((d) => ({
    ...d,
    approved_total_jpy: approvedTotalsByDeal.get(d.id) || 0,
  }))

  return (
    <div className="px-6 py-5">
      <div className="mb-4">
        <h1 className="font-display text-[20px] font-semibold tracking-tight">案件履歴</h1>
        <p className="text-[12px] text-[#888] mt-0.5">
          アーカイブ済みの案件。リオーダーで複製して新規案件として再開できます。
        </p>
      </div>
      <ArchiveListClient
        rows={rows}
        currentQ={params.q || ''}
        currentReason={params.reason || 'all'}
        currentSortBy={sortBy}
        currentSortOrder={ascending ? 'asc' : 'desc'}
      />
    </div>
  )
}
