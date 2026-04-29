'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface QuoteConditions {
  productCategory: string
  material: string
  size?: string
  printing?: string
  quantity: number
}

interface FactoryEstimate {
  factoryId: string
  factoryName: string
  estimatedUnitPrice: number
  estimatedShipping: number
  estimatedTotal: number
  confidence: 'high' | 'medium' | 'low'
  confidenceReason: string
  dataPoints: number
}

export async function searchPriceRecords(conditions: QuoteConditions) {
  const supabase = await createClient()

  // Search for matching price records
  let query = supabase
    .from('price_records')
    .select(`
      *,
      factory:factories(id, factory_name)
    `)

  if (conditions.productCategory) {
    query = query.eq('product_category', conditions.productCategory)
  }

  if (conditions.material) {
    query = query.eq('material', conditions.material)
  }

  const { data: records, error } = await query

  if (error) {
    console.error('Error searching price records:', error)
    return []
  }

  return records || []
}

export async function estimatePrice(conditions: QuoteConditions): Promise<FactoryEstimate[]> {
  const supabase = await createClient()

  // Get all factories
  const { data: factories } = await supabase
    .from('factories')
    .select('id, factory_name, specialties')
    .eq('is_active', true)

  if (!factories) return []

  // Get price records
  const records = await searchPriceRecords(conditions)

  // Group by factory
  const factoryEstimates: FactoryEstimate[] = []

  for (const factory of factories) {
    const factoryRecords = records.filter((r) => {
      const recordFactory = Array.isArray(r.factory) ? r.factory[0] : r.factory
      return recordFactory?.id === factory.id
    })

    // Calculate estimate based on records
    if (factoryRecords.length > 0) {
      // Find closest quantity match
      const sortedByQuantity = [...factoryRecords].sort(
        (a, b) => Math.abs(a.quantity - conditions.quantity) - Math.abs(b.quantity - conditions.quantity)
      )
      const closestMatch = sortedByQuantity[0]

      // Calculate confidence
      let confidence: 'high' | 'medium' | 'low' = 'low'
      let confidenceReason = ''

      const exactMatch = factoryRecords.find(
        (r) =>
          r.quantity === conditions.quantity &&
          r.product_category === conditions.productCategory &&
          r.material === conditions.material
      )

      if (exactMatch) {
        confidence = 'high'
        confidenceReason = '同一条件のデータあり'
      } else if (factoryRecords.length >= 3) {
        confidence = 'medium'
        confidenceReason = '類似データあり'
      } else {
        confidence = 'low'
        confidenceReason = 'データ少ない（工場に確認を推奨）'
      }

      // Estimate price (simple linear interpolation)
      const avgUnitPrice = factoryRecords.reduce((sum, r) => sum + r.unit_price_usd, 0) / factoryRecords.length
      const avgShipping = factoryRecords.reduce((sum, r) => sum + (r.shipping_usd || 0), 0) / factoryRecords.length

      const estimatedUnitPrice = avgUnitPrice * (1 + (conditions.quantity < closestMatch.quantity ? 0.1 : -0.05))
      const estimatedTotal = estimatedUnitPrice * conditions.quantity + avgShipping

      factoryEstimates.push({
        factoryId: factory.id,
        factoryName: factory.factory_name,
        estimatedUnitPrice: Math.round(estimatedUnitPrice * 100) / 100,
        estimatedShipping: Math.round(avgShipping * 100) / 100,
        estimatedTotal: Math.round(estimatedTotal * 100) / 100,
        confidence,
        confidenceReason,
        dataPoints: factoryRecords.length,
      })
    } else {
      // No data for this factory, check if specialties match
      const specialties = factory.specialties || []
      if (specialties.includes(conditions.productCategory)) {
        factoryEstimates.push({
          factoryId: factory.id,
          factoryName: factory.factory_name,
          estimatedUnitPrice: 0,
          estimatedShipping: 0,
          estimatedTotal: 0,
          confidence: 'low',
          confidenceReason: '価格データなし（専門分野一致）',
          dataPoints: 0,
        })
      }
    }
  }

  // Sort by confidence and price
  return factoryEstimates.sort((a, b) => {
    const confidenceOrder = { high: 0, medium: 1, low: 2 }
    if (confidenceOrder[a.confidence] !== confidenceOrder[b.confidence]) {
      return confidenceOrder[a.confidence] - confidenceOrder[b.confidence]
    }
    if (a.estimatedTotal === 0) return 1
    if (b.estimatedTotal === 0) return -1
    return a.estimatedTotal - b.estimatedTotal
  })
}

interface DraftData {
  factoryId: string
  conditions: QuoteConditions
  clientId?: string
}

export async function createDraftFromSmartQuote(data: DraftData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  try {
    // Generate deal code
    const date = new Date()
    const month = date.toISOString().slice(0, 7).replace('-', '')
    const { count } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`)

    const dealCode = `BAO-${month}-${String((count || 0) + 1).padStart(3, '0')}`

    // Create deal
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .insert({
        deal_code: dealCode,
        deal_name: `${data.conditions.productCategory} - Smart Quote`,
        client_id: data.clientId,
        sales_rep_id: user.id,
        master_status: 'M01',
        probability: 'medium',
      })
      .select()
      .single()

    if (dealError) throw dealError

    // Create specification
    await supabase.from('deal_specifications').insert({
      deal_id: deal.id,
      product_category: data.conditions.productCategory,
      material_category: data.conditions.material,
    })

    // Create factory assignment
    await supabase.from('deal_factory_assignments').insert({
      deal_id: deal.id,
      factory_id: data.factoryId,
      status: 'requesting',
    })

    // Create quote draft
    await supabase.from('deal_quotes').insert({
      deal_id: deal.id,
      factory_id: data.factoryId,
      quantity: data.conditions.quantity,
      status: 'draft',
    })

    revalidatePath('/deals')
    revalidatePath('/smart-quote')

    return { success: true, dealId: deal.id }
  } catch (error) {
    console.error('Create draft error:', error)
    return { error: 'Failed to create draft' }
  }
}
