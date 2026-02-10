import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CustomsInvoicePreview } from './customs-invoice-preview'

interface Props {
  params: Promise<{ id: string }>
}

export default async function CustomsInvoicePage({ params }: Props) {
  const { id: dealId } = await params
  const supabase = await createClient()

  // Get deal with all necessary data
  const { data: deal } = await supabase
    .from('deals')
    .select(`
      id,
      deal_code,
      deal_name,
      client:clients(company_name, address),
      factory_assignments:deal_factory_assignments(
        factory:factories(
          factory_name,
          address,
          bank_info
        ),
        status
      ),
      specifications:deal_specifications(
        product_category,
        product_name,
        material_category,
        height_mm,
        width_mm,
        depth_mm
      ),
      quotes:deal_quotes(
        quantity,
        factory_unit_price_usd,
        total_cost_usd
      ),
      shipping:deal_shipping(
        packing_info
      )
    `)
    .eq('id', dealId)
    .single()

  if (!deal) {
    notFound()
  }

  // Get system settings for company info
  const { data: settings } = await supabase
    .from('system_settings')
    .select('company_info, invoice_registration_number')
    .limit(1)
    .single()

  // Get product registry for HS code
  const spec = deal.specifications?.[0]
  let hsCode = ''
  let tariffRate = 0

  if (spec?.product_category) {
    const { data: registry } = await supabase
      .from('product_registry')
      .select('hs_code, tariff_rate')
      .eq('category', spec.product_category)
      .limit(1)
      .single()

    if (registry) {
      hsCode = registry.hs_code || ''
      tariffRate = registry.tariff_rate || 0
    }
  }

  // Get factory info
  const selectedFactory = deal.factory_assignments?.find((a) => a.status === 'selected')
  const factoryData = selectedFactory?.factory
  const factory = Array.isArray(factoryData) ? factoryData[0] : factoryData

  const quote = deal.quotes?.[0]
  const shipping = deal.shipping?.[0]
  const packingInfo = shipping?.packing_info as {
    weight_kg?: number
    carton_count?: number
    cbm?: number
  } | null

  const invoiceData = {
    // Seller (Factory)
    sellerName: factory?.factory_name || '',
    sellerAddress: factory?.address || '',

    // Buyer (Our company)
    buyerName: settings?.company_info?.name || 'BAO株式会社',
    buyerAddress: settings?.company_info?.address || '',

    // Importer (Same as buyer)
    importerName: settings?.company_info?.name || 'BAO株式会社',
    importerAddress: settings?.company_info?.address || '',

    // Product Info
    productName: spec?.product_name || deal.deal_name || '',
    productCategory: spec?.product_category || '',
    material: spec?.material_category || '',
    usage: 'Packaging',

    // Quantity & Price
    quantity: quote?.quantity || 0,
    unitPriceUsd: quote?.factory_unit_price_usd || 0,
    totalUsd: quote?.total_cost_usd || 0,

    // Packaging Info
    cartonCount: packingInfo?.carton_count || 0,
    weightKg: packingInfo?.weight_kg || 0,
    cbm: packingInfo?.cbm || 0,

    // Customs
    hsCode,
    tariffRate,

    // Reference
    dealCode: deal.deal_code,
    invoiceDate: new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  }

  return (
    <div className="px-[26px] py-5">
      {/* Back Link */}
      <Link
        href={`/deals/${dealId}`}
        className="inline-flex items-center gap-1 text-[12px] text-[#888] font-body hover:text-[#0a0a0a] no-underline mb-4"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        案件詳細に戻る
      </Link>

      <div className="flex items-center justify-between mb-5">
        <h1 className="text-[20px] font-display font-semibold text-[#0a0a0a]">
          通関Invoice
        </h1>
        <span className="text-[12px] font-display tabular-nums text-[#888]">
          {deal.deal_code}
        </span>
      </div>

      <CustomsInvoicePreview data={invoiceData} />
    </div>
  )
}
