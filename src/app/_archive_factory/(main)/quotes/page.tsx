import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function FactoryQuotesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('factory_id')
    .eq('id', user.id)
    .single()

  if (!profile?.factory_id) return null

  // Get all quote requests for this factory
  const { data: assignments } = await supabase
    .from('deal_factory_assignments')
    .select(`
      id,
      status,
      created_at,
      deal:deals(
        id,
        deal_code,
        deal_name,
        master_status,
        specifications:deal_specifications(
          product_name,
          product_category,
          material_category,
          height_mm,
          width_mm,
          depth_mm
        ),
        quotes:deal_quotes(quantity)
      )
    `)
    .eq('factory_id', profile.factory_id)
    .in('status', ['requesting', 'responded'])
    .order('created_at', { ascending: false })

  const pending = assignments?.filter((a) => a.status === 'requesting') || []
  const responded = assignments?.filter((a) => a.status === 'responded') || []

  return (
    <div className="space-y-5">
      <h1 className="text-[20px] font-display font-semibold text-[#0a0a0a]">
        見積もり依頼
      </h1>

      {/* Pending Requests */}
      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)]">
        <div className="p-5 border-b border-[rgba(0,0,0,0.06)]">
          <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a]">
            未回答 ({pending.length})
          </h2>
        </div>
        {pending.length > 0 ? (
          <div className="divide-y divide-[rgba(0,0,0,0.06)]">
            {pending.map((item) => {
              const deal = Array.isArray(item.deal) ? item.deal[0] : item.deal
              const spec = deal?.specifications?.[0]
              return (
                <Link
                  key={item.id}
                  href={`/factory/quotes/${deal?.id}`}
                  className="flex items-center justify-between p-4 hover:bg-[#fcfcfb] transition-colors no-underline"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[12px] font-display tabular-nums text-[#888]">
                        {deal?.deal_code}
                      </span>
                      <span className="text-[10px] text-[#888] font-body">
                        {new Date(item.created_at).toLocaleDateString('ja-JP')}
                      </span>
                    </div>
                    <p className="text-[13px] font-body text-[#0a0a0a] mb-1">
                      {spec?.product_name || deal?.deal_name}
                    </p>
                    <div className="flex gap-3 text-[11px] text-[#888] font-body">
                      {spec?.product_category && <span>{spec.product_category}</span>}
                      {spec?.material_category && <span>{spec.material_category}</span>}
                      {spec?.height_mm && spec?.width_mm && (
                        <span>{spec.height_mm}×{spec.width_mm}mm</span>
                      )}
                    </div>
                  </div>
                  <span className="text-[12px] text-white bg-[#0a0a0a] px-3 py-1.5 rounded-[8px] font-body font-medium">
                    回答する
                  </span>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-[13px] text-[#888] font-body">
              未回答の見積もり依頼はありません
            </p>
          </div>
        )}
      </div>

      {/* Responded */}
      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)]">
        <div className="p-5 border-b border-[rgba(0,0,0,0.06)]">
          <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a]">
            回答済み ({responded.length})
          </h2>
        </div>
        {responded.length > 0 ? (
          <div className="divide-y divide-[rgba(0,0,0,0.06)]">
            {responded.map((item) => {
              const deal = Array.isArray(item.deal) ? item.deal[0] : item.deal
              const spec = deal?.specifications?.[0]
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[12px] font-display tabular-nums text-[#888]">
                        {deal?.deal_code}
                      </span>
                    </div>
                    <p className="text-[13px] font-body text-[#0a0a0a]">
                      {spec?.product_name || deal?.deal_name}
                    </p>
                  </div>
                  <span className="text-[11px] text-[#888] font-body">
                    選定結果待ち
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-[13px] text-[#888] font-body">
              回答済みの案件はありません
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
