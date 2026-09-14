import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { listInventory } from '@/lib/actions/inventory'
import { InventoryClient } from '@/components/inventory/inventory-client'

// Sprint 10: 在庫(社内MVP)。物流センター切替対応。
export default async function InventoryPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ items }, { data: clients }, { data: deals }] = await Promise.all([
    listInventory(),
    supabase.from('clients').select('id, company_name, short_name').order('company_name'),
    supabase
      .from('deals')
      .select('id, deal_code, deal_name')
      .is('archived_at', null)
      .order('last_activity_at', { ascending: false })
      .limit(100),
  ])

  return (
    <InventoryClient
      items={items}
      clients={clients || []}
      deals={deals || []}
    />
  )
}
