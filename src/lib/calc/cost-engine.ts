/**
 * 原価計算エンジン (USD基準)
 * BAO Flow - Cost Calculation Engine
 */

export type PaymentMethod = 'wise' | 'alibaba_cc' | 'bank_transfer'

export interface WiseFeeConfig {
  conversion_fee_rate: number  // 例: 0.0045 (0.45%)
  swift_fee_usd: number        // 例: 5.0
}

export interface QuoteCalculationParams {
  factoryUnitPriceUsd: number    // 工場単価 USD
  quantity: number               // 数量
  shippingCostUsd: number        // 配送コスト USD
  plateFeeUsd: number            // 版代 USD
  otherFeesUsd: number           // その他費用 USD
  exchangeRate: number           // USD→JPY レート (例: 155)
  costRatio: number              // 掛率 (例: 0.55 → 原価率55%)
  taxRate: number                // 消費税率 (例: 10)
  paymentMethod?: PaymentMethod
  wiseFeeConfig?: WiseFeeConfig
  alibabaCcFeeRate?: number      // 例: 0.03 (3%)
}

export interface QuoteCalculationResult {
  // 入力パラメータ
  params: QuoteCalculationParams

  // コスト内訳 (USD)
  productCostUsd: number         // 商品代金 USD (単価 × 数量)
  shippingCostUsd: number        // 配送コスト USD
  plateFeeUsd: number            // 版代 USD
  otherFeesUsd: number           // その他費用 USD
  totalCostUsd: number           // 原価合計 USD
  unitCostUsd: number            // 1個あたり原価 USD

  // 販売価格 (USD / JPY)
  sellingPriceUsd: number        // 販売単価 USD (unitCost / costRatio)
  sellingPriceJpy: number        // 販売単価 JPY (ceil)
  totalBillingJpy: number        // 請求合計 JPY (税抜)
  totalBillingTaxJpy: number     // 請求合計 JPY (税込)

  // 利益
  grossProfitUsd: number         // 粗利 USD
  grossProfitMargin: number      // 粗利率 %

  // 決済手数料 (オプション)
  paymentFeeUsd?: number         // 決済手数料 USD
  netProfitUsd?: number          // 純利益 USD (粗利 - 決済手数料)
}

/**
 * 見積計算メイン関数
 *
 * 計算ロジック:
 * a) 商品代金 USD = 工場単価 × 数量
 * b) 原価合計 USD = 商品代金 + 配送 + 版代 + その他
 * c) 1個あたり原価 USD = 原価合計 / 数量
 * d) 販売単価 USD = 1個あたり原価 / 掛率
 * e) 販売単価 JPY = ceil(販売単価USD × 為替レート)
 * f) 請求合計 JPY (税抜) = 販売単価JPY × 数量
 * g) 請求合計 JPY (税込) = 請求合計 × (1 + 消費税率/100)
 * h) 粗利 USD = 請求合計JPY / 為替レート - 原価合計USD
 * i) 粗利率 = 粗利 / (請求合計 / 為替レート) × 100
 */
export function calculateQuote(params: QuoteCalculationParams): QuoteCalculationResult {
  const {
    factoryUnitPriceUsd,
    quantity,
    shippingCostUsd,
    plateFeeUsd,
    otherFeesUsd,
    exchangeRate,
    costRatio,
    taxRate,
    paymentMethod,
    wiseFeeConfig,
    alibabaCcFeeRate,
  } = params

  // (a) 商品代金 USD
  const productCostUsd = factoryUnitPriceUsd * quantity

  // (b) 原価合計 USD
  const totalCostUsd = productCostUsd + shippingCostUsd + plateFeeUsd + otherFeesUsd

  // (c) 1個あたり原価 USD
  const unitCostUsd = totalCostUsd / quantity

  // (d) 販売単価 USD (掛率で逆算)
  // costRatio = 原価 / 販売価格 → 販売価格 = 原価 / costRatio
  const sellingPriceUsd = unitCostUsd / costRatio

  // (e) 販売単価 JPY (切り上げ)
  const sellingPriceJpy = Math.ceil(sellingPriceUsd * exchangeRate)

  // (f) 請求合計 JPY (税抜)
  const totalBillingJpy = sellingPriceJpy * quantity

  // (g) 請求合計 JPY (税込)
  const totalBillingTaxJpy = Math.ceil(totalBillingJpy * (1 + taxRate / 100))

  // (h) 粗利 USD
  const revenueUsd = totalBillingJpy / exchangeRate
  const grossProfitUsd = revenueUsd - totalCostUsd

  // (i) 粗利率
  const grossProfitMargin = revenueUsd > 0 ? (grossProfitUsd / revenueUsd) * 100 : 0

  // 決済手数料計算 (オプション)
  let paymentFeeUsd: number | undefined
  let netProfitUsd: number | undefined

  if (paymentMethod) {
    paymentFeeUsd = calculatePaymentFee(
      productCostUsd,
      paymentMethod,
      wiseFeeConfig,
      alibabaCcFeeRate
    )
    netProfitUsd = grossProfitUsd - paymentFeeUsd
  }

  return {
    params,
    productCostUsd,
    shippingCostUsd,
    plateFeeUsd,
    otherFeesUsd,
    totalCostUsd,
    unitCostUsd,
    sellingPriceUsd,
    sellingPriceJpy,
    totalBillingJpy,
    totalBillingTaxJpy,
    grossProfitUsd,
    grossProfitMargin,
    paymentFeeUsd,
    netProfitUsd,
  }
}

/**
 * 決済手数料計算
 */
function calculatePaymentFee(
  amountUsd: number,
  method: PaymentMethod,
  wiseFeeConfig?: WiseFeeConfig,
  alibabaCcFeeRate?: number
): number {
  switch (method) {
    case 'wise':
      if (wiseFeeConfig) {
        // Wise: 為替手数料 + SWIFT手数料
        return amountUsd * wiseFeeConfig.conversion_fee_rate + wiseFeeConfig.swift_fee_usd
      }
      // デフォルト: 0.45% + $5
      return amountUsd * 0.0045 + 5

    case 'alibaba_cc':
      // Alibaba クレジットカード: 通常3%
      const rate = alibabaCcFeeRate ?? 0.03
      return amountUsd * rate

    case 'bank_transfer':
      // 銀行振込: 固定手数料 (概算)
      return 25 // $25 程度

    default:
      return 0
  }
}

/**
 * 複数数量での比較計算
 */
export function calculateMultipleQuantities(
  baseParams: Omit<QuoteCalculationParams, 'quantity'>,
  quantities: number[]
): QuoteCalculationResult[] {
  return quantities.map(quantity =>
    calculateQuote({ ...baseParams, quantity })
  )
}

/**
 * 支払い方法比較
 */
export interface PaymentComparison {
  wise: QuoteCalculationResult
  alibabaCc: QuoteCalculationResult
  bankTransfer: QuoteCalculationResult
  recommendation: PaymentMethod
  savingsUsd: number
}

export function comparePaymentMethods(
  params: Omit<QuoteCalculationParams, 'paymentMethod'>
): PaymentComparison {
  const wiseResult = calculateQuote({ ...params, paymentMethod: 'wise' })
  const alibabaResult = calculateQuote({ ...params, paymentMethod: 'alibaba_cc' })
  const bankResult = calculateQuote({ ...params, paymentMethod: 'bank_transfer' })

  // 決済手数料が最も安い方法を推奨
  const fees = [
    { method: 'wise' as PaymentMethod, fee: wiseResult.paymentFeeUsd ?? 0, result: wiseResult },
    { method: 'alibaba_cc' as PaymentMethod, fee: alibabaResult.paymentFeeUsd ?? 0, result: alibabaResult },
    { method: 'bank_transfer' as PaymentMethod, fee: bankResult.paymentFeeUsd ?? 0, result: bankResult },
  ]

  fees.sort((a, b) => a.fee - b.fee)
  const recommendation = fees[0].method
  const savingsUsd = fees[fees.length - 1].fee - fees[0].fee

  return {
    wise: wiseResult,
    alibabaCc: alibabaResult,
    bankTransfer: bankResult,
    recommendation,
    savingsUsd,
  }
}

/**
 * 配送オプション付き見積計算
 */
export interface ShippingOption {
  method: string
  costUsd: number
  deliveryDays: number
}

export interface QuoteWithShippingOptions {
  baseQuote: QuoteCalculationResult
  shippingOptions: Array<{
    option: ShippingOption
    quote: QuoteCalculationResult
  }>
  cheapestOption: ShippingOption
  fastestOption: ShippingOption
}

export function calculateQuoteWithShippingOptions(
  baseParams: Omit<QuoteCalculationParams, 'shippingCostUsd'>,
  shippingOptions: ShippingOption[]
): QuoteWithShippingOptions {
  const results = shippingOptions.map(option => ({
    option,
    quote: calculateQuote({
      ...baseParams,
      shippingCostUsd: option.costUsd,
    }),
  }))

  // 最安オプション
  const cheapestOption = [...shippingOptions].sort((a, b) => a.costUsd - b.costUsd)[0]

  // 最速オプション
  const fastestOption = [...shippingOptions].sort((a, b) => a.deliveryDays - b.deliveryDays)[0]

  // ベース見積は最安オプションで計算
  const baseQuote = calculateQuote({
    ...baseParams,
    shippingCostUsd: cheapestOption.costUsd,
  })

  return {
    baseQuote,
    shippingOptions: results,
    cheapestOption,
    fastestOption,
  }
}

/**
 * 簡易見積計算 (最小パラメータ)
 */
export function calculateSimpleQuote(
  factoryUnitPriceUsd: number,
  quantity: number,
  exchangeRate: number = 155,
  costRatio: number = 0.55
): { sellingPriceJpy: number; totalBillingJpy: number } {
  const unitCostUsd = factoryUnitPriceUsd
  const sellingPriceUsd = unitCostUsd / costRatio
  const sellingPriceJpy = Math.ceil(sellingPriceUsd * exchangeRate)
  const totalBillingJpy = sellingPriceJpy * quantity

  return {
    sellingPriceJpy,
    totalBillingJpy,
  }
}
