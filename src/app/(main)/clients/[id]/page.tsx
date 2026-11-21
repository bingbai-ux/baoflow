import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ClientDetail } from '@/components/process/client-detail'
import { ProcessCell, DaysLeftBadge } from '@/components/process/process-bar'
import { daysLeft, todayInJapan } from '@/lib/process/stages'
import { formatDate } from '@/lib/utils/format'

// 再設計 工程1: 取引先マスター（詳細: 基本情報・担当者（複数）・ブランド・これまでの案件）。

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const [client, contacts, brands, deals] = await Promise.all([
    supabase.from('clients').select('id, company_name, short_name, address, notes').eq('id', id).maybeSingle(),
    supabase.from('client_contacts').select('id, name, email, phone, role, notes, is_primary').eq('client_id', id).order('is_primary', { ascending: false }).order('created_at'),
    supabase.from('brands').select('id, name').eq('client_id', id).order('name'),
    supabase.from('deals').select('id, deal_code, deal_name, brand_text, process_stage, desired_delivery_date, archived_at, created_at').eq('client_id', id).order('created_at', { ascending: false }),
  ])
  if (client.error || contacts.error || brands.error || deals.error) throw new Error('Client could not be loaded')
  if (!client.data) notFound()
  const today = todayInJapan()
  return (
    <div className="mx-auto max-w-[920px] space-y-4 py-4">
      <Link href="/clients" className="inline-flex min-h-[44px] items-center text-[12.5px] text-[#84787D] no-underline hover:text-[#351E28]">← 取引先一覧にもどる</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[21px] font-extrabold">{client.data.company_name}</h1>
        <Link href={`/deals/new?client=${id}`} className="inline-flex min-h-[44px] items-center rounded-full bg-[#E9F056] px-4 text-[12.5px] font-extrabold text-[#666C14] no-underline hover:brightness-95">この取引先で新規プロジェクト</Link>
      </div>
      <ClientDetail
        client={{ id, companyName: client.data.company_name, shortName: client.data.short_name, address: client.data.address, notes: client.data.notes }}
        contacts={(contacts.data || []).map(c => ({ id: c.id, name: c.name, email: c.email, phone: c.phone, role: c.role, isPrimary: c.is_primary }))}
        brands={brands.data || []}
      />
      <section aria-label="これまでの案件">
        <h2 className="mb-2 text-[15px] font-bold">これまでの案件 <span className="text-[12.5px] font-normal text-[#84787D] tabular-nums">{(deals.data || []).length}件</span></h2>
        <div className="overflow-hidden rounded-card border border-[#E2E1DA] bg-white">
          {(deals.data || []).map(d => (
            <div key={d.id} className="grid grid-cols-2 items-center gap-x-3 gap-y-1 border-b border-[#E2E1DA] p-3 last:border-0 sm:grid-cols-[minmax(0,1.6fr)_176px_minmax(0,1fr)]">
              <div className="col-span-2 min-w-0 sm:col-span-1"><Link href={`/deals/${d.id}`} className="block truncate text-[13px] font-bold underline-offset-4 hover:underline">{d.deal_name || '案件名未設定'}</Link>
                <span className="block text-[11px] text-[#84787D] tabular-nums">{d.deal_code}{d.brand_text ? ` · ${d.brand_text}` : ''}{d.archived_at ? ' · アーカイブ済み' : ''}</span></div>
              <div><ProcessCell stage={d.process_stage} /></div>
              <div className="text-[12px] tabular-nums">{d.desired_delivery_date && <span className="mr-2">{formatDate(d.desired_delivery_date)}</span>}<DaysLeftBadge value={daysLeft(d.desired_delivery_date, today, d.process_stage)} /></div>
            </div>
          ))}
          {!(deals.data || []).length && <p className="p-6 text-center text-[13px]">まだ案件がありません。</p>}
        </div>
      </section>
    </div>
  )
}
