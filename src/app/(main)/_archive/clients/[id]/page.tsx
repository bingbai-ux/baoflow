import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/lib/utils/format'
import { StatusDot } from '@/components/status-dot'
import { ChevronLeft } from 'lucide-react'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ClientDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()

  if (!client) {
    notFound()
  }

  // Get deals for this client with master_status
  const { data: deals } = await supabase
    .from('deals')
    .select('id, deal_code, deal_name, master_status')
    .eq('client_id', id)
    .order('created_at', { ascending: false })

  return (
    <>
      {/* Back Link */}
      <Link
        href="/clients"
        className="inline-flex items-center gap-1 text-[13px] text-[#888] font-body no-underline hover:text-[#555] mt-4 mb-2"
      >
        <ChevronLeft className="w-4 h-4" />
        顧客一覧
      </Link>

      {/* Page Header */}
      <div className="flex justify-between items-center py-3">
        <h1 className="font-display text-[22px] font-semibold text-[#0a0a0a]">
          {client.company_name}
        </h1>
        <div className="flex gap-2">
          <Link
            href={`/clients/${id}/edit`}
            className="bg-[#0a0a0a] text-white rounded-[8px] px-4 py-2 text-[13px] font-medium font-body no-underline"
          >
            編集
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Client Info Card */}
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5">
          <h2 className="text-[14px] font-medium text-[#0a0a0a] mb-4 font-body">
            顧客情報
          </h2>

          <div className="flex border-b border-[rgba(0,0,0,0.06)] py-3">
            <div className="w-[100px] text-[12px] text-[#888] font-body shrink-0">会社名</div>
            <div className="text-[13px] text-[#0a0a0a] font-body">{client.company_name}</div>
          </div>
          <div className="flex border-b border-[rgba(0,0,0,0.06)] py-3">
            <div className="w-[100px] text-[12px] text-[#888] font-body shrink-0">担当者</div>
            <div className="text-[13px] text-[#0a0a0a] font-body">{client.contact_name || '-'}</div>
          </div>
          <div className="flex border-b border-[rgba(0,0,0,0.06)] py-3">
            <div className="w-[100px] text-[12px] text-[#888] font-body shrink-0">メール</div>
            <div className="text-[13px] text-[#0a0a0a] font-body">{client.email || '-'}</div>
          </div>
          <div className="flex border-b border-[rgba(0,0,0,0.06)] py-3">
            <div className="w-[100px] text-[12px] text-[#888] font-body shrink-0">電話</div>
            <div className="text-[13px] text-[#0a0a0a] font-body">{client.phone || '-'}</div>
          </div>
          <div className="flex border-b border-[rgba(0,0,0,0.06)] py-3">
            <div className="w-[100px] text-[12px] text-[#888] font-body shrink-0">住所</div>
            <div className="text-[13px] text-[#0a0a0a] font-body">{client.address || '-'}</div>
          </div>
          <div className="flex border-b border-[rgba(0,0,0,0.06)] py-3">
            <div className="w-[100px] text-[12px] text-[#888] font-body shrink-0">登録日</div>
            <div className="text-[13px] text-[#0a0a0a] font-display tabular-nums">{formatDate(client.created_at)}</div>
          </div>
          <div className="flex py-3">
            <div className="w-[100px] text-[12px] text-[#888] font-body shrink-0">備考</div>
            <div className="text-[13px] text-[#0a0a0a] font-body">{client.notes || '-'}</div>
          </div>
        </div>

        {/* Client Deals Card */}
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5">
          <h2 className="text-[14px] font-medium text-[#0a0a0a] mb-4 font-body">
            案件一覧
          </h2>

          {deals && deals.length > 0 ? (
            <div className="flex flex-col gap-2">
              {deals.map((deal) => (
                <Link
                  key={deal.id}
                  href={`/deals/${deal.id}`}
                  className="flex justify-between items-center p-3 bg-[#f2f2f0] rounded-[10px] no-underline hover:bg-[#eaeae8] transition-colors"
                >
                  <div>
                    <div className="font-display text-[13px] font-medium text-[#0a0a0a] mb-1">
                      {deal.deal_code}
                    </div>
                    <div className="text-[12px] text-[#555] font-body">
                      {deal.deal_name || '-'}
                    </div>
                  </div>
                  <StatusDot status={deal.master_status || 'M01'} size={6} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-5 text-center text-[#888] text-[13px] font-body">
              案件がありません
            </div>
          )}
        </div>
      </div>
    </>
  )
}
