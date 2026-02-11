import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { FactoryProgressBar } from '@/components/factory/progress-bar'
import { ProductionActions } from './production-actions'

interface Props {
  params: Promise<{ id: string }>
}

export default async function FactoryProductionDetailPage({ params }: Props) {
  const { id: dealId } = await params
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

  // Verify factory has access
  const { data: assignment } = await supabase
    .from('deal_factory_assignments')
    .select('id, status')
    .eq('deal_id', dealId)
    .eq('factory_id', profile.factory_id)
    .eq('status', 'selected')
    .single()

  if (!assignment) {
    notFound()
  }

  // Get deal details
  const { data: deal } = await supabase
    .from('deals')
    .select(`
      id,
      deal_code,
      deal_name,
      master_status,
      specifications:deal_specifications(product_name, product_category),
      quotes:deal_quotes(quantity),
      shipping:deal_shipping(
        packing_info,
        tracking_number,
        tracking_url
      )
    `)
    .eq('id', dealId)
    .single()

  if (!deal) {
    notFound()
  }

  const spec = deal.specifications?.[0]
  const quote = deal.quotes?.[0]
  const shipping = deal.shipping?.[0]
  const packingInfo = shipping?.packing_info as {
    carton_count?: number
    weight_kg?: number
    cbm?: number
  } | null

  return (
    <div className="space-y-5">
      {/* Back Link */}
      <Link
        href="/factory/production"
        className="inline-flex items-center gap-1 text-[12px] text-[#888] font-body hover:text-[#0a0a0a] no-underline"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        製造一覧に戻る
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-display font-semibold text-[#0a0a0a]">
          製造進捗
        </h1>
        <span className="text-[12px] font-display tabular-nums text-[#888]">
          {deal.deal_code}
        </span>
      </div>

      {/* Progress Bar */}
      <FactoryProgressBar status={deal.master_status} />

      {/* Product Info */}
      <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
        <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a] mb-4">
          商品情報
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-[11px] text-[#888] font-body mb-1">商品名</p>
            <p className="text-[13px] text-[#0a0a0a] font-body">
              {spec?.product_name || deal.deal_name}
            </p>
          </div>
          {spec?.product_category && (
            <div>
              <p className="text-[11px] text-[#888] font-body mb-1">カテゴリ</p>
              <p className="text-[13px] text-[#0a0a0a] font-body">{spec.product_category}</p>
            </div>
          )}
          {quote?.quantity && (
            <div>
              <p className="text-[11px] text-[#888] font-body mb-1">数量</p>
              <p className="text-[13px] text-[#0a0a0a] font-display tabular-nums">
                {quote.quantity.toLocaleString()}個
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Packing Info */}
      {packingInfo && (
        <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
          <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a] mb-4">
            梱包情報
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {packingInfo.carton_count && (
              <div>
                <p className="text-[11px] text-[#888] font-body mb-1">カートン数</p>
                <p className="text-[13px] text-[#0a0a0a] font-display tabular-nums">
                  {packingInfo.carton_count}
                </p>
              </div>
            )}
            {packingInfo.weight_kg && (
              <div>
                <p className="text-[11px] text-[#888] font-body mb-1">総重量</p>
                <p className="text-[13px] text-[#0a0a0a] font-display tabular-nums">
                  {packingInfo.weight_kg} kg
                </p>
              </div>
            )}
            {packingInfo.cbm && (
              <div>
                <p className="text-[11px] text-[#888] font-body mb-1">CBM</p>
                <p className="text-[13px] text-[#0a0a0a] font-display tabular-nums">
                  {packingInfo.cbm}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tracking Info */}
      {shipping?.tracking_number && (
        <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
          <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a] mb-4">
            発送情報
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] text-[#888] font-body mb-1">トラッキング番号</p>
              <p className="text-[13px] text-[#0a0a0a] font-display tabular-nums">
                {shipping.tracking_number}
              </p>
            </div>
            {shipping.tracking_url && (
              <div>
                <p className="text-[11px] text-[#888] font-body mb-1">トラッキングURL</p>
                <a
                  href={shipping.tracking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] text-[#0a0a0a] font-body underline"
                >
                  確認する
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <ProductionActions
        dealId={dealId}
        status={deal.master_status}
        hasPackingInfo={!!packingInfo}
        hasTracking={!!shipping?.tracking_number}
      />
    </div>
  )
}
