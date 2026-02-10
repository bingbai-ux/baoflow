import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { FoodImportPreview } from './food-import-preview'

interface Props {
  params: Promise<{ id: string }>
}

export default async function FoodImportPage({ params }: Props) {
  const { id: dealId } = await params
  const supabase = await createClient()

  // Get deal with all necessary data
  const { data: deal } = await supabase
    .from('deals')
    .select(`
      id,
      deal_code,
      deal_name,
      client:clients(company_name),
      factory_assignments:deal_factory_assignments(
        factory:factories(
          id,
          factory_name,
          address
        ),
        status
      ),
      specifications:deal_specifications(
        product_category,
        product_name,
        material_category
      ),
      quotes:deal_quotes(
        quantity
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
    .select('company_info')
    .limit(1)
    .single()

  // Get factory info
  const selectedFactory = deal.factory_assignments?.find((a) => a.status === 'selected')
  const factoryData = selectedFactory?.factory
  const factory = Array.isArray(factoryData) ? factoryData[0] : factoryData

  const spec = deal.specifications?.[0]
  const quote = deal.quotes?.[0]
  const shipping = deal.shipping?.[0]
  const packingInfo = shipping?.packing_info as {
    weight_kg?: number
  } | null

  // Check product registry for this product
  let registryStatus: 'registered' | 'not_registered' | 'unknown' = 'unknown'
  let testReport = null
  let estimatedInspectionCost = 0

  if (spec?.product_name && factory?.id) {
    const { data: registry } = await supabase
      .from('product_registry')
      .select(`
        *,
        test_report:test_reports(*)
      `)
      .eq('product_name', spec.product_name)
      .eq('factory_id', factory.id)
      .single()

    if (registry) {
      registryStatus = registry.is_registered ? 'registered' : 'not_registered'
      testReport = registry.test_report
    } else {
      registryStatus = 'not_registered'
      // Estimate inspection cost
      estimatedInspectionCost = 30000 // Default estimate
    }
  }

  const importData = {
    // Applicant (our company)
    applicantName: settings?.company_info?.name || 'BAO株式会社',
    applicantAddress: settings?.company_info?.address || '',

    // Product Info
    productName: spec?.product_name || deal.deal_name || '',
    productCategory: spec?.product_category || '',
    material: spec?.material_category || '',

    // Manufacturer
    manufacturerName: factory?.factory_name || '',
    manufacturerAddress: factory?.address || '',

    // Quantity & Weight
    quantity: quote?.quantity || 0,
    weightKg: packingInfo?.weight_kg || 0,

    // Registry Status
    registryStatus,
    testReport,
    estimatedInspectionCost,

    // Reference
    dealCode: deal.deal_code,
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
          食品等輸入届出
        </h1>
        <span className="text-[12px] font-display tabular-nums text-[#888]">
          {deal.deal_code}
        </span>
      </div>

      <FoodImportPreview data={importData} />
    </div>
  )
}
