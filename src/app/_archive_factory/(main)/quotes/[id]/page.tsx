import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { QuoteResponseForm } from './quote-response-form'

interface Props {
  params: Promise<{ id: string }>
}

export default async function FactoryQuoteDetailPage({ params }: Props) {
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

  // Check if this factory has an assignment for this deal
  const { data: assignment } = await supabase
    .from('deal_factory_assignments')
    .select('id, status')
    .eq('deal_id', dealId)
    .eq('factory_id', profile.factory_id)
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
      specifications:deal_specifications(
        product_name,
        product_category,
        material_category,
        height_mm,
        width_mm,
        depth_mm,
        print_method,
        print_colors,
        processing,
        notes
      ),
      shipping:deal_shipping(
        delivery_address
      )
    `)
    .eq('id', dealId)
    .single()

  if (!deal) {
    notFound()
  }

  const spec = deal.specifications?.[0]
  const shipping = deal.shipping?.[0]

  return (
    <div className="space-y-5">
      {/* Back Link */}
      <Link
        href="/factory/quotes"
        className="inline-flex items-center gap-1 text-[12px] text-[#888] font-body hover:text-[#0a0a0a] no-underline"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        見積もり依頼一覧に戻る
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-display font-semibold text-[#0a0a0a]">
          見積もり回答
        </h1>
        <span className="text-[12px] font-display tabular-nums text-[#888]">
          {deal.deal_code}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Product Specifications */}
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5">
          <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a] mb-4">
            商品仕様
          </h2>
          <div className="space-y-3">
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
            {spec?.material_category && (
              <div>
                <p className="text-[11px] text-[#888] font-body mb-1">素材</p>
                <p className="text-[13px] text-[#0a0a0a] font-body">{spec.material_category}</p>
              </div>
            )}
            {(spec?.height_mm || spec?.width_mm || spec?.depth_mm) && (
              <div>
                <p className="text-[11px] text-[#888] font-body mb-1">サイズ</p>
                <p className="text-[13px] text-[#0a0a0a] font-body">
                  {[spec?.height_mm, spec?.width_mm, spec?.depth_mm].filter(Boolean).join(' × ')} mm
                </p>
              </div>
            )}
            {spec?.print_method && (
              <div>
                <p className="text-[11px] text-[#888] font-body mb-1">印刷</p>
                <p className="text-[13px] text-[#0a0a0a] font-body">
                  {spec.print_method} {spec?.print_colors && `(${spec.print_colors})`}
                </p>
              </div>
            )}
            {spec?.processing && (
              <div>
                <p className="text-[11px] text-[#888] font-body mb-1">加工</p>
                <p className="text-[13px] text-[#0a0a0a] font-body">{spec.processing}</p>
              </div>
            )}
            {spec?.notes && (
              <div>
                <p className="text-[11px] text-[#888] font-body mb-1">備考</p>
                <p className="text-[13px] text-[#0a0a0a] font-body whitespace-pre-wrap">{spec.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Delivery Info */}
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5">
          <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a] mb-4">
            配送先
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-[11px] text-[#888] font-body mb-1">配送先住所</p>
              <p className="text-[13px] text-[#0a0a0a] font-body whitespace-pre-wrap">
                {shipping?.delivery_address || '未設定'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quote Response Form */}
      {assignment.status === 'requesting' ? (
        <QuoteResponseForm dealId={dealId} />
      ) : (
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-8 text-center">
          <p className="text-[13px] text-[#888] font-body">
            この見積もりは既に回答済みです
          </p>
        </div>
      )}
    </div>
  )
}
