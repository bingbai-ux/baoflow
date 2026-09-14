import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { QuoteBuilder } from '@/components/deals/quote-builder'

// Sprint 10 (C): 見積ビルダー。
// 数量パターン×掛率を1画面で比較し、採用パターンを決めて見積書へつなぐ。
export default async function QuoteBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: deal } = await supabase
    .from('deals')
    .select('id, deal_code, deal_name, client_name_text, simple_status')
    .eq('id', id)
    .single()
  if (!deal) notFound()

  const [{ data: products }, { data: variantsRaw }, { data: quotes }] = await Promise.all([
    supabase
      .from('deal_products')
      .select('id, product_no, description')
      .eq('deal_id', id)
      .order('product_no'),
    supabase
      .from('deal_product_variants')
      .select('id, product_id, variant_label, material, width_mm, height_mm, depth_mm, deal_products!inner(deal_id)')
      .eq('deal_products.deal_id', id),
    supabase
      .from('deal_quotes')
      .select(
        'id, deal_id, variant_id, version, quantity, moq, factory_unit_price_usd, factory_calculated_freight_usd, domestic_china_freight_usd, china_freight_usd, plate_fee_usd, pantone_color_fee_usd, sample_cost_usd, sample_shipping_usd, other_fees_usd, exchange_rate, cost_ratio, unit_cost_usd, total_cost_usd, selling_price_jpy, total_billing_jpy, total_billing_tax_jpy, status'
      )
      .eq('deal_id', id)
      .order('quantity'),
  ])

  const variants = (variantsRaw || []).map((v) => ({
    id: v.id,
    product_id: v.product_id,
    variant_label: v.variant_label,
    material: v.material,
    width_mm: v.width_mm,
    height_mm: v.height_mm,
    depth_mm: v.depth_mm,
  }))

  return (
    <>
      <Link
        href={`/deals/${id}`}
        className="inline-flex items-center gap-1 text-[12.5px] text-[#84787D] font-body no-underline hover:text-[#351E28] mt-4 mb-2"
      >
        ← {deal.deal_name || deal.deal_code}
      </Link>
      <QuoteBuilder
        deal={deal}
        products={products || []}
        variants={variants}
        quotes={(quotes || []) as never[]}
      />
    </>
  )
}
