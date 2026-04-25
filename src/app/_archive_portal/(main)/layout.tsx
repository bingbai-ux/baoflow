import { createClient } from '@/lib/supabase/server'
import { PortalHeader } from '@/components/portal/header'

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let clientName = ''

  if (user) {
    // Get client info through profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('client_id')
      .eq('id', user.id)
      .single()

    if (profile?.client_id) {
      const { data: client } = await supabase
        .from('clients')
        .select('company_name')
        .eq('id', profile.client_id)
        .single()

      if (client) {
        clientName = client.company_name
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#f2f2f0]">
      <PortalHeader clientName={clientName} />
      <main className="px-[26px] py-5">{children}</main>
    </div>
  )
}
