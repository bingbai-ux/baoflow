import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { DealForm } from '@/components/deals/deal-form'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditDealPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: deal }, { data: profiles }] = await Promise.all([
    supabase
      .from('deals')
      .select('id, deal_name, client_name_text, desired_delivery_date, sales_user_id, memo')
      .eq('id', id)
      .single(),
    supabase
      .from('profiles')
      .select('id, display_name')
      .order('display_name', { ascending: true }),
  ])

  if (!deal) notFound()

  return (
    <>
      <Link
        href={`/deals/${id}`}
        className="inline-flex items-center gap-1 text-[13px] text-[#888] font-body no-underline hover:text-[#555] mt-4 mb-2"
      >
        <ChevronLeft className="w-4 h-4" />
        案件詳細に戻る
      </Link>

      <div className="py-3">
        <h1 className="font-display text-[24px] font-semibold text-[#0a0a0a]">案件編集</h1>
      </div>

      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5 mt-2">
        <DealForm
          initial={deal}
          salesUsers={profiles || []}
          cancelHref={`/deals/${id}`}
        />
      </div>
    </>
  )
}
