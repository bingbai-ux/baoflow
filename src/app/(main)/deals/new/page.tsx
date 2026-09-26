import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { listCatalog } from '@/lib/actions/catalog'
import { NewDealWizard } from '@/components/deals/new-deal-wizard'

// Sprint 14: 新規案件ウィザード。
// クライアント / ブランド / 何を作るか(複数) / 希望納期 / 担当。案件名は自動生成。

export default async function NewDealPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profiles }, { data: clients }, catalog] = await Promise.all([
    supabase.from('profiles').select('id, display_name, role').in('role', ['admin', 'sales']).order('display_name'),
    supabase
      .from('clients')
      .select('id, company_name, short_name, brand_name')
      .order('company_name'),
    listCatalog(),
  ])

  return (
    <>
      <Link
        href="/deals"
        className="inline-flex items-center gap-1 text-[12.5px] text-[#84787D] font-body no-underline hover:text-[#351E28] mt-4 mb-2"
      >
        ← 案件一覧
      </Link>

      <div className="py-2">
        <h1 className="font-display text-[21px] font-extrabold text-[#351E28]">新しい案件をつくる</h1>
        <p className="text-[12.5px] font-body text-[#84787D] mt-1">
          最低限の入力だけで作成できます。仕様の詳細は作成後の「仕様を固める」で選んでいきます。
        </p>
      </div>

      <NewDealWizard
        clients={(clients || []).map((c) => ({
          id: c.id,
          name: c.short_name || c.company_name,
          fullName: c.company_name,
          brand: c.brand_name,
        }))}
        staff={(profiles || []).map((p) => ({ id: p.id, name: p.display_name || '担当' }))}
        selfId={user.id}
        itemPresets={catalog.filter((n) => n.level === 1).map((n) => n.name)}
      />
    </>
  )
}
