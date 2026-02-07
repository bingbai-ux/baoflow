/**
 * 原価計算エンジン
 * BAO Flow - Cost Calculation Engine
 */

export type ShippingMethod = 'sea_d2d' | 'air_ocs'
export type PaymentMethod = 'wise' | 'alibaba'

export interface CostParams {
  unitPriceCny: number        // 工場単価 CNY
  quantity: number            // 数量
  exchangeRate: number        // CNY→JPY レート (例: 21.5)
  shippingMethod: ShippingMethod
  productWeightKg: number     // 1個あたり重量 kg
  productVolumeCbm?: number   // 1個あたり体積 cbm（オプション）
  tariffRate?: number         // 関税率 % (デフォルト 0)
  paymentMethod: PaymentMethod
  markupRate: number          // 掛率 (例: 1.8)
}

export interface CostResult {
  // 入力パラメータ（参照用）
  params: CostParams

  // 商品代金
  productCostCny: number      // 商品代金 CNY
  productCostJpy: number      // 商品代金 JPY

  // 送料
  shippingCostJpy: number     // 送料 JPY
  shippingUnitCost: number    // 送料単価（/kg or /cbm）
  shippingWeight: number      // 総重量 kg
  shippingVolume: number      // 総体積 cbm

  // CIF価格
  cifJpy: number              // CIF価格 JPY (商品代金 + 送料)

  // 関税・消費税
  tariffJpy: number           // 関税 JPY
  consumptionTaxJpy: number   // 消費税 JPY (10%)

  // 決済手数料
  paymentFeeJpy: number       // 決済手数料 JPY
  paymentFeeRate: number      // 手数料率 %

  // 原価
  totalCostJpy: number        // 原価合計 JPY
  unitCostJpy: number         // 1個あたり原価 JPY

  // 販売価格
  unitSellingPrice: number    // 1個あたり販売価格 JPY
  totalSellingPrice: number   // 販売合計 JPY

  // 粗利
  grossProfit: number         // 粗利 JPY
  grossProfitRate: number     // 粗利率 %
}

// 配送料金テーブル
const SHIPPING_RATES = {
  sea_d2d: {
    unit: 'cbm',
    minRate: 30000,  // 円/CBM
    maxRate: 50000,
    defaultRate: 40000,
  },
  air_ocs: {
    unit: 'kg',
    minRate: 1500,   // 円/kg
    maxRate: 2500,
    defaultRate: 2000,
  },
}

// 決済手数料テーブル
const PAYMENT_FEES = {
  wise: {
    rate: 0.006,      // 0.6%
    fixedFee: 150,    // 固定手数料 150円
  },
  alibaba: {
    rate: 0.03,       // 3.0%
    fixedFee: 0,
  },
}

/**
 * 原価計算メイン関数
 */
export function calculateCost(params: CostParams): CostResult {
  const {
    unitPriceCny,
    quantity,
    exchangeRate,
    shippingMethod,
    productWeightKg,
    productVolumeCbm = 0,
    tariffRate = 0,
    paymentMethod,
    markupRate,
  } = params

  // (a) 商品代金
  const productCostCny = unitPriceCny * quantity
  const productCostJpy = productCostCny * exchangeRate

  // (b) 送料計算
  const totalWeightKg = productWeightKg * quantity
  const totalVolumeCbm = (productVolumeCbm || 0) * quantity

  let shippingCostJpy: number
  let shippingUnitCost: number

  if (shippingMethod === 'sea_d2d') {
    // 海上輸送 (D2D): CBM単位
    shippingUnitCost = SHIPPING_RATES.sea_d2d.defaultRate
    // 最小0.1 CBM
    const effectiveCbm = Math.max(totalVolumeCbm, 0.1)
    shippingCostJpy = effectiveCbm * shippingUnitCost
  } else {
    // 航空輸送 (OCS): kg単位
    shippingUnitCost = SHIPPING_RATES.air_ocs.defaultRate
    // 容積重量と実重量の大きい方
    const volumetricWeight = totalVolumeCbm * 167 // 航空の容積重量換算
    const chargeableWeight = Math.max(totalWeightKg, volumetricWeight)
    shippingCostJpy = chargeableWeight * shippingUnitCost
  }

  // CIF価格
  const cifJpy = productCostJpy + shippingCostJpy

  // (c) 関税
  const tariffJpy = cifJpy * (tariffRate / 100)

  // (d) 消費税 (10%)
  const consumptionTaxJpy = (cifJpy + tariffJpy) * 0.1

  // (e) 決済手数料
  const feeConfig = PAYMENT_FEES[paymentMethod]
  const paymentFeeJpy = productCostJpy * feeConfig.rate + feeConfig.fixedFee
  const paymentFeeRate = feeConfig.rate * 100

  // (f) 原価合計
  const totalCostJpy = productCostJpy + shippingCostJpy + tariffJpy + consumptionTaxJpy + paymentFeeJpy

  // (g) 1個あたり原価
  const unitCostJpy = totalCostJpy / quantity

  // (h) 販売単価
  const unitSellingPrice = unitCostJpy * markupRate

  // 販売合計
  const totalSellingPrice = unitSellingPrice * quantity

  // (i) 粗利
  const grossProfit = totalSellingPrice - totalCostJpy

  // (j) 粗利率
  const grossProfitRate = (grossProfit / totalSellingPrice) * 100

  return {
    params,
    productCostCny,
    productCostJpy,
    shippingCostJpy,
    shippingUnitCost,
    shippingWeight: totalWeightKg,
    shippingVolume: totalVolumeCbm,
    cifJpy,
    tariffJpy,
    consumptionTaxJpy,
    paymentFeeJpy,
    paymentFeeRate,
    totalCostJpy,
    unitCostJpy,
    unitSellingPrice,
    totalSellingPrice,
    grossProfit,
    grossProfitRate,
  }
}

/**
 * 複数数量での比較計算
 */
export function calculateMultipleQuantities(
  baseParams: Omit<CostParams, 'quantity'>,
  quantities: number[]
): CostResult[] {
  return quantities.map(quantity =>
    calculateCost({ ...baseParams, quantity })
  )
}

/**
 * 支払い方法比較
 */
export interface PaymentComparison {
  wise: CostResult
  alibaba: CostResult
  recommendation: PaymentMethod
  savingsJpy: number
}

export function comparePaymentMethods(
  params: Omit<CostParams, 'paymentMethod'>
): PaymentComparison {
  const wiseResult = calculateCost({ ...params, paymentMethod: 'wise' })
  const alibabaResult = calculateCost({ ...params, paymentMethod: 'alibaba' })

  const recommendation: PaymentMethod =
    wiseResult.totalCostJpy < alibabaResult.totalCostJpy ? 'wise' : 'alibaba'

  const savingsJpy = Math.abs(wiseResult.totalCostJpy - alibabaResult.totalCostJpy)

  return {
    wise: wiseResult,
    alibaba: alibabaResult,
    recommendation,
    savingsJpy,
  }
}

/**
 * 配送方法比較
 */
export interface ShippingComparison {
  sea_d2d: CostResult
  air_ocs: CostResult
  recommendation: ShippingMethod
  savingsJpy: number
  deliveryDaysDiff: number
}

export function compareShippingMethods(
  params: Omit<CostParams, 'shippingMethod'>
): ShippingComparison {
  const seaResult = calculateCost({ ...params, shippingMethod: 'sea_d2d' })
  const airResult = calculateCost({ ...params, shippingMethod: 'air_ocs' })

  const recommendation: ShippingMethod =
    seaResult.totalCostJpy < airResult.totalCostJpy ? 'sea_d2d' : 'air_ocs'

  const savingsJpy = Math.abs(seaResult.totalCostJpy - airResult.totalCostJpy)

  // 海上は約30日、航空は約5日
  const deliveryDaysDiff = 25

  return {
    sea_d2d: seaResult,
    air_ocs: airResult,
    recommendation,
    savingsJpy,
    deliveryDaysDiff,
  }
}
