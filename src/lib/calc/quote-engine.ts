/**
 * Sprint 5: Variant 単位の総合見積計算
 *
 * 物流計算 (logistics-engine) と価格計算 (cost-engine) を統合。
 * deal_quotes に保存する全フィールドの値をここで一括算出する。
 */

import {
  calculateFreight,
  type VariantPhysics,
  type FreightCalcResult,
} from './logistics-engine'
import { calculateQuote, type QuoteCalculationResult } from './cost-engine'

// re-export for downstream consumers
export type { VariantPhysics, FreightCalcResult }

export interface FullQuoteInput {
  // 注文情報
  orderQty: number
  factoryUnitPriceUsd: number

  // バリエーション物理情報
  physics: VariantPhysics

  // 設定 (settings 由来)
  chinaFreightRateYuanPerKg: number
  yuanToUsdRate: number
  exchangeRate: number     // USD → JPY
  costRatio: number        // 0 < x ≦ 1
  taxRate: number          // 例: 10

  // 追加費用
  plateFeeUsd?: number
  pantoneColorFeeUsd?: number
  domesticChinaFreightUsd?: number  // 中国国内送料
  sampleCostUsd?: number
  sampleShippingUsd?: number
  otherFeesUsd?: number             // その他
}

export type FullQuoteResult = FreightCalcResult &
  QuoteCalculationResult & {
    totalShippingUsd: number          // 中国送料 + 国内送料
    additionalFeesUsd: number         // パントン + サンプル + その他
  }

export function calculateFullQuote(input: FullQuoteInput): FullQuoteResult {
  const freight = calculateFreight(
    input.orderQty,
    input.physics,
    input.chinaFreightRateYuanPerKg,
    input.yuanToUsdRate
  )

  const totalShippingUsd =
    freight.chinaFreightUsd + (input.domesticChinaFreightUsd ?? 0)

  const additionalFeesUsd =
    (input.pantoneColorFeeUsd ?? 0) +
    (input.sampleCostUsd ?? 0) +
    (input.sampleShippingUsd ?? 0) +
    (input.otherFeesUsd ?? 0)

  const cost = calculateQuote({
    factoryUnitPriceUsd: input.factoryUnitPriceUsd,
    quantity: input.orderQty,
    shippingCostUsd: totalShippingUsd,
    plateFeeUsd: input.plateFeeUsd ?? 0,
    otherFeesUsd: additionalFeesUsd,
    exchangeRate: input.exchangeRate,
    costRatio: input.costRatio,
    taxRate: input.taxRate,
  })

  return {
    ...freight,
    ...cost,
    totalShippingUsd,
    additionalFeesUsd,
  }
}
