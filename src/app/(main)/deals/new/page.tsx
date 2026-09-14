import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { DealForm } from '@/components/deals/deal-form'

export default async function NewDealPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name')
    .order('display_name', { ascending: true })

  return (
    <>
      <Link
        href="/deals"
        className="inline-flex items-center gap-1 text-[12.5px] text-[#84787D] font-body no-underline hover:text-[#351E28] mt-4 mb-2"
      >
        ← 案件一覧
      </Link>

      <div className="py-3">
        <h1 className="font-display text-[21px] font-extrabold text-[#351E28]">新しい案件をつくる</h1>
        <p className="text-[12.5px] font-body text-[#84787D] mt-1">
          基本情報だけで作成できます。商品仕様・見積・画像は作成後に追加してください。
        </p>
      </div>

      <div className="bg-white rounded-[16px] border border-[#E2E1DA] p-5 mt-2 max-w-[720px]">
        <DealForm
          initial={{ sales_user_id: user.id }}
          salesUsers={profiles || []}
          cancelHref="/deals"
        />
      </div>
    </>
  )
}
