import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { StatusDot } from '@/components/status-dot'
import { ChevronLeft } from 'lucide-react'

interface Props {
  params: Promise<{ id: string }>
}

export default async function FactoryDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: factory } = await supabase
    .from('factories')
    .select('*')
    .eq('id', id)
    .single()

  if (!factory) {
    notFound()
  }

  // Get deals for this factory via deal_factory_assignments
  const { data: assignments } = await supabase
    .from('deal_factory_assignments')
    .select(`
      deal:deals(id, deal_code, deal_name, master_status)
    `)
    .eq('factory_id', id)
    .order('created_at', { ascending: false })

  // 型定義
  interface DealData {
    id: string
    deal_code: string
    deal_name?: string
    master_status?: string
  }

  // deal は単一オブジェクトまたは配列の可能性がある
  const deals: DealData[] = assignments?.flatMap(a => {
    if (!a.deal) return []
    if (Array.isArray(a.deal)) return a.deal as DealData[]
    return [a.deal as DealData]
  }) || []

  return (
    <>
      {/* Back Link */}
      <Link
        href="/factories"
        className="inline-flex items-center gap-1 text-[13px] text-[#888] font-body no-underline hover:text-[#555] mt-4 mb-2"
      >
        <ChevronLeft className="w-4 h-4" />
        工場一覧
      </Link>

      {/* Page Header */}
      <div className="flex justify-between items-center py-3">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-[22px] font-semibold text-[#0a0a0a]">
            {factory.factory_name}
          </h1>
          {factory.rating && (
            <span className="font-display text-[14px] text-[#22c55e] font-medium tabular-nums">
              {factory.rating.toFixed(1)}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            href={`/factories/${id}/edit`}
            className="bg-[#0a0a0a] text-white rounded-[8px] px-4 py-2 text-[13px] font-medium font-body no-underline"
          >
            編集
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Factory Info Card */}
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5">
          <h2 className="text-[14px] font-medium text-[#0a0a0a] mb-4 font-body">
            工場情報
          </h2>

          <div className="flex border-b border-[rgba(0,0,0,0.06)] py-3">
            <div className="w-[100px] text-[12px] text-[#888] font-body shrink-0">工場名</div>
            <div className="text-[13px] text-[#0a0a0a] font-body">{factory.factory_name}</div>
          </div>
          <div className="flex border-b border-[rgba(0,0,0,0.06)] py-3">
            <div className="w-[100px] text-[12px] text-[#888] font-body shrink-0">所在地</div>
            <div className="text-[13px] text-[#0a0a0a] font-body">{factory.address || '-'}</div>
          </div>
          <div className="flex border-b border-[rgba(0,0,0,0.06)] py-3">
            <div className="w-[100px] text-[12px] text-[#888] font-body shrink-0">専門分野</div>
            <div className="text-[13px] text-[#0a0a0a] font-body">
              {factory.specialties && factory.specialties.length > 0 ? (
                <div className="flex gap-1 flex-wrap">
                  {factory.specialties.map((s: string, i: number) => (
                    <span
                      key={i}
                      className="bg-[#f2f2f0] px-2 py-[2px] rounded-full text-[11px] text-[#555]"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              ) : (
                '-'
              )}
            </div>
          </div>
          <div className="flex border-b border-[rgba(0,0,0,0.06)] py-3">
            <div className="w-[100px] text-[12px] text-[#888] font-body shrink-0">担当者</div>
            <div className="text-[13px] text-[#0a0a0a] font-body">{factory.contact_name || '-'}</div>
          </div>
          <div className="flex border-b border-[rgba(0,0,0,0.06)] py-3">
            <div className="w-[100px] text-[12px] text-[#888] font-body shrink-0">メール</div>
            <div className="text-[13px] text-[#0a0a0a] font-body">{factory.contact_email || '-'}</div>
          </div>
          <div className="flex border-b border-[rgba(0,0,0,0.06)] py-3">
            <div className="w-[100px] text-[12px] text-[#888] font-body shrink-0">WeChat</div>
            <div className="text-[13px] text-[#0a0a0a] font-body">{factory.contact_wechat || '-'}</div>
          </div>
          <div className="flex py-3">
            <div className="w-[100px] text-[12px] text-[#888] font-body shrink-0">備考</div>
            <div className="text-[13px] text-[#0a0a0a] font-body">{factory.notes || '-'}</div>
          </div>
        </div>

        {/* Factory Deals Card */}
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5">
          <h2 className="text-[14px] font-medium text-[#0a0a0a] mb-4 font-body">
            案件一覧
          </h2>

          {deals.length > 0 ? (
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
