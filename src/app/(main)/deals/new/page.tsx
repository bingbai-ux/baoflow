import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
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
        className="inline-flex items-center gap-1 text-[13px] text-[#888] font-body no-underline hover:text-[#555] mt-4 mb-2"
      >
        <ChevronLeft className="w-4 h-4" />
        案件一覧
      </Link>

      <div className="py-3">
        <h1 className="font-display text-[24px] font-semibold text-[#0a0a0a]">新規案件</h1>
        <p className="text-[12px] font-body text-[#888] mt-1">
          基本情報を入力してください。商品仕様・見積・画像は作成後に追加できます。
        </p>
      </div>

      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5 mt-2">
        <DealForm
          initial={{ sales_user_id: user.id }}
          salesUsers={profiles || []}
          cancelHref="/deals"
        />
      </div>
    </>
  )
}
