// Simulate master page queries to find the failing one
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(url, key)

async function main() {
  console.log('--- listClients ---')
  const { data: clients, error: e1 } = await supabase
    .from('clients')
    .select('*')
    .order('company_name', { ascending: true })
  console.log('rows:', clients?.length, 'error:', e1?.message)

  console.log('--- listFactories ---')
  const { data: factories, error: e2 } = await supabase
    .from('factories')
    .select('*')
    .order('factory_name', { ascending: true })
  console.log('rows:', factories?.length, 'error:', e2?.message)

  console.log('--- listStaff (profiles) ---')
  const { data: staff, error: e3 } = await supabase
    .from('profiles')
    .select('*')
    .in('role', ['admin', 'sales'])
    .order('created_at', { ascending: true })
  console.log('rows:', staff?.length, 'error:', e3?.message)
  if (staff) console.log(staff.map((s) => `${s.display_name || s.email} (${s.role})`))

  console.log('--- deals query ---')
  const { data: deals, error: e4 } = await supabase
    .from('deals')
    .select('id, client_id, sales_user_id, simple_status')
  console.log('rows:', deals?.length, 'error:', e4?.message)
}

main().catch((e) => {
  console.error('CRASH:', e)
  process.exit(1)
})
