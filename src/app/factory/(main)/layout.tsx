import { createClient } from '@/lib/supabase/server'
import { FactoryHeader } from '@/components/factory/header'

export default async function FactoryMainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let factoryName = ''

  if (user) {
    // Get factory info through profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('factory_id')
      .eq('id', user.id)
      .single()

    if (profile?.factory_id) {
      const { data: factory } = await supabase
        .from('factories')
        .select('factory_name')
        .eq('id', profile.factory_id)
        .single()

      if (factory) {
        factoryName = factory.factory_name
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#f2f2f0]">
      <FactoryHeader factoryName={factoryName} />
      <main className="px-[26px] py-5">{children}</main>
    </div>
  )
}
