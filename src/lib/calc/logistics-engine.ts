/**
 * Logistics calculation engine (Sprint 5)
 *
 * Excel の容積重量・送料計算ロジックを完全再現する純関数群。
 * 入力単位は Excel と同一 (cm / kg / 元 / USD)。
 */

export interface VariantPhysics {
  pcsPerCarton: number      // PCS/CTN: 1 カートン入数
  cartonWidthCm: number     // CARTONMEAS 縦
  cartonHeightCm: number    // CARTONMEAS 横
  cartonDepthCm: number     // CARTONMEAS 高さ
  grossWeightKg: number     // G.W: 1 カートン総重量
}

export interface FreightCalcResult {
  cartonCount: number
  volumetricWeightPerCarton: number  // ceil(W×H×D/5000) per carton
  volumetricWeightKg: number         // 容積重量合計
  actualWeightTotalKg: number        // 実重量合計
  shippingWeightKg: number           // 送料計算重量 = max(容積, 実)
  chinaFreightYuan: number
  chinaFreightUsd: number
}

/**
 * Excel 例 (行 47 Hot Coffee Cup 5000 個):
 *   PCS/CTN: 1000, CARTONMEAS: 69×45×33 cm, G.W: 65 kg, Order QTY: 5000
 *   → CTNS = 5
 *   → 容積重量/CTN = ceil(69×45×33/5000) = ceil(20.493) = 21
 *   → 容積重量合計 = 21 × 5 = 105 kg
 *   → 実重量合計 = 65 × 5 = 325 kg
 *   → 送料計算重量 = max(105, 325) = 325 kg
 */
export function calculateFreight(
  orderQty: number,
  physics: VariantPhysics,
  chinaFreightRateYuanPerKg: number,
  yuanToUsdRate: number
): FreightCalcResult {
  if (
    !Number.isFinite(orderQty) ||
    orderQty <= 0 ||
    !Number.isFinite(physics.pcsPerCarton) ||
    physics.pcsPerCarton <= 0
  ) {
    return {
      cartonCount: 0,
      volumetricWeightPerCarton: 0,
      volumetricWeightKg: 0,
      actualWeightTotalKg: 0,
      shippingWeightKg: 0,
      chinaFreightYuan: 0,
      chinaFreightUsd: 0,
    }
  }

  const cartonCount = Math.ceil(orderQty / physics.pcsPerCarton)

  const volPerCartonRaw =
    (physics.cartonWidthCm * physics.cartonHeightCm * physics.cartonDepthCm) / 5000
  const volumetricWeightPerCarton = Number.isFinite(volPerCartonRaw)
    ? Math.ceil(volPerCartonRaw)
    : 0
  const volumetricWeightKg = volumetricWeightPerCarton * cartonCount

  const actualWeightTotalKg =
    (Number.isFinite(physics.grossWeightKg) ? physics.grossWeightKg : 0) * cartonCount

  const shippingWeightKg = Math.max(volumetricWeightKg, actualWeightTotalKg)

  const chinaFreightYuan =
    shippingWeightKg * (Number.isFinite(chinaFreightRateYuanPerKg) ? chinaFreightRateYuanPerKg : 0)
  const chinaFreightUsd =
    yuanToUsdRate > 0 && Number.isFinite(yuanToUsdRate) ? chinaFreightYuan / yuanToUsdRate : 0

  return {
    cartonCount,
    volumetricWeightPerCarton,
    volumetricWeightKg,
    actualWeightTotalKg,
    shippingWeightKg,
    chinaFreightYuan,
    chinaFreightUsd,
  }
}
