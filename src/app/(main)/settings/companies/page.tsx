import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { listIssuerCompanies } from '@/lib/actions/issuer-companies'
import { IssuerCompanies } from '@/components/process/issuer-companies'

// 設定 > 発行元の会社。帳票に載せる会社情報・ロゴ・角印・インボイス登録番号・振込先を登録する。

export default async function IssuerCompaniesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return (
    <div className="mx-auto max-w-[920px] space-y-4 py-4">
      <Link href="/settings" className="inline-flex min-h-[44px] items-center text-[12.5px] text-[#84787D] no-underline hover:text-[#351E28]">← 設定にもどる</Link>
      <div><h1 className="text-[21px] font-extrabold">発行元の会社</h1></div>
      <IssuerCompanies companies={await listIssuerCompanies()} />
    </div>
  )
}
