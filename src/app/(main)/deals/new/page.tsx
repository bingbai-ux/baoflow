import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { NewProjectFlow, type PickerClient } from '@/components/process/new-project-flow'

// 再設計 工程1: 新規プロジェクト作成。
// 「新規取引先 / 既存取引先」のカード → 取引先 → 担当者・ブランド・希望納期 → 作成。

interface Props {
  searchParams: Promise<{ client?: string }>
}

export default async function NewProjectPage({ searchParams }: Props) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [clients, contacts, brands, deals] = await Promise.all([
    supabase.from('clients').select('id, company_name, short_name, industry, address').order('company_name'),
    supabase.from('client_contacts').select('id, client_id, name, email, phone, role, is_primary').order('is_primary', { ascending: false }).order('created_at'),
    supabase.from('brands').select('id, client_id, name').order('name'),
    supabase.from('deals').select('client_id, created_at').not('client_id', 'is', null),
  ])
  if (clients.error || contacts.error || brands.error || deals.error) throw new Error('New project options could not be loaded')

  const stats = new Map<string, { count: number; last: string | null }>()
  for (const d of deals.data || []) {
    const s = stats.get(d.client_id as string) || { count: 0, last: null }
    s.count += 1
    if (!s.last || d.created_at > s.last) s.last = d.created_at
    stats.set(d.client_id as string, s)
  }
  const rows: PickerClient[] = (clients.data || []).map(c => ({
    id: c.id,
    name: c.company_name,
    shortName: c.short_name,
    industry: c.industry,
    address: c.address,
    dealCount: stats.get(c.id)?.count || 0,
    lastDealAt: stats.get(c.id)?.last || null,
    contacts: (contacts.data || []).filter(x => x.client_id === c.id).map(x => ({ id: x.id, name: x.name, email: x.email, phone: x.phone, role: x.role, isPrimary: x.is_primary })),
    brands: (brands.data || []).filter(x => x.client_id === c.id).map(x => ({ id: x.id, name: x.name })),
  }))
  const initial = params.client ? rows.find(c => c.id === params.client || c.name === params.client || c.shortName === params.client)?.id || null : null

  return (
    <div className="mx-auto max-w-[920px] py-4">
      <Link href="/deals" className="inline-flex min-h-[44px] items-center text-[12.5px] text-[#84787D] no-underline hover:text-[#351E28]">← 案件一覧にもどる</Link>
      <h1 className="font-display text-[21px] font-extrabold text-[#351E28]">新しいプロジェクトをつくる</h1>
      <NewProjectFlow clients={rows} initialClientId={initial} today={new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })} />
    </div>
  )
}
