import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ClientDirectory, type DirectoryClient } from '@/components/process/client-directory'

// 再設計 工程1: 取引先マスター（一覧）。

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const [clients, contacts, brands, deals] = await Promise.all([
    supabase.from('clients').select('id, company_name, short_name, industry, address, created_at').order('company_name'),
    supabase.from('client_contacts').select('client_id, name, is_primary').order('is_primary', { ascending: false }).order('created_at'),
    supabase.from('brands').select('client_id, name').order('name'),
    supabase.from('deals').select('client_id, created_at, process_stage, archived_at').not('client_id', 'is', null),
  ])
  if (clients.error || contacts.error || brands.error || deals.error) throw new Error('Clients could not be loaded')
  const rows: DirectoryClient[] = (clients.data || []).map(c => {
    const ds = (deals.data || []).filter(d => d.client_id === c.id)
    return {
      id: c.id, name: c.company_name, shortName: c.short_name, industry: c.industry, address: c.address,
      contacts: (contacts.data || []).filter(x => x.client_id === c.id).map(x => x.name),
      brands: (brands.data || []).filter(x => x.client_id === c.id).map(x => x.name),
      dealCount: ds.length,
      activeCount: ds.filter(d => !d.archived_at && d.process_stage < 9).length,
      lastDealAt: ds.reduce<string | null>((m, d) => !m || d.created_at > m ? d.created_at : m, null),
    }
  })
  return <ClientDirectory clients={rows} />
}
