// 単体検証: logistics-engine + quote-engine が Excel 行 47 と一致するか確認
// 仕様書 §2: Hot Coffee Cup 5000 個 → CTNS=5, 容積=105kg, 実=325kg, 送料計算=325kg

import { calculateFreight } from '../src/lib/calc/logistics-engine.ts'
import { calculateFullQuote } from '../src/lib/calc/quote-engine.ts'

function assert(label, actual, expected) {
  const ok = actual === expected
  const mark = ok ? '✅' : '❌'
  console.log(`  ${mark} ${label}: ${actual}${ok ? '' : `  (expected ${expected})`}`)
  if (!ok) process.exitCode = 1
}

// === Test 1: Excel 行 47 ===
console.log('--- Test 1: Excel 行 47 (Hot Coffee Cup 5000 個) ---')
const r1 = calculateFreight(
  5000,
  { pcsPerCarton: 1000, cartonWidthCm: 69, cartonHeightCm: 45, cartonDepthCm: 33, grossWeightKg: 65 },
  7.0, // 元/kg
  7.2  // 元/USD
)
assert('cartonCount', r1.cartonCount, 5)
assert('volumetricWeightPerCarton', r1.volumetricWeightPerCarton, 21) // ceil(69*45*33/5000) = ceil(20.493) = 21
assert('volumetricWeightKg', r1.volumetricWeightKg, 105)
assert('actualWeightTotalKg', r1.actualWeightTotalKg, 325)
assert('shippingWeightKg', r1.shippingWeightKg, 325)
assert('chinaFreightYuan', r1.chinaFreightYuan, 2275) // 325 * 7
assert('chinaFreightUsd', Math.round(r1.chinaFreightUsd * 100) / 100, Math.round((2275 / 7.2) * 100) / 100)

// === Test 2: 注文数量がカートン入数の倍数でないケース ===
console.log('\n--- Test 2: 端数 (1500 / 1000 = 2 CTN) ---')
const r2 = calculateFreight(
  1500,
  { pcsPerCarton: 1000, cartonWidthCm: 50, cartonHeightCm: 40, cartonDepthCm: 30, grossWeightKg: 20 },
  7.0,
  7.2
)
assert('cartonCount', r2.cartonCount, 2) // ceil(1500/1000)=2
assert('volumetricWeightPerCarton', r2.volumetricWeightPerCarton, 12) // ceil(50*40*30/5000)=12
assert('volumetricWeightKg', r2.volumetricWeightKg, 24)
assert('actualWeightTotalKg', r2.actualWeightTotalKg, 40)
assert('shippingWeightKg', r2.shippingWeightKg, 40)

// === Test 3: 容積重量が実重量を上回るケース ===
console.log('\n--- Test 3: 軽量大型 (容積>実重量) ---')
const r3 = calculateFreight(
  10000,
  { pcsPerCarton: 100, cartonWidthCm: 80, cartonHeightCm: 60, cartonDepthCm: 50, grossWeightKg: 5 },
  7.0,
  7.2
)
assert('cartonCount', r3.cartonCount, 100)
assert('volumetricWeightPerCarton', r3.volumetricWeightPerCarton, 48) // ceil(80*60*50/5000)=48
assert('volumetricWeightKg', r3.volumetricWeightKg, 4800)
assert('actualWeightTotalKg', r3.actualWeightTotalKg, 500)
assert('shippingWeightKg', r3.shippingWeightKg, 4800)

// === Test 4: calculateFullQuote 統合 ===
console.log('\n--- Test 4: calculateFullQuote 統合 (行 47 相当) ---')
const full = calculateFullQuote({
  orderQty: 5000,
  factoryUnitPriceUsd: 0.50,
  physics: { pcsPerCarton: 1000, cartonWidthCm: 69, cartonHeightCm: 45, cartonDepthCm: 33, grossWeightKg: 65 },
  chinaFreightRateYuanPerKg: 7.0,
  yuanToUsdRate: 7.2,
  exchangeRate: 155,
  costRatio: 0.55,
  taxRate: 10,
  plateFeeUsd: 100,
  pantoneColorFeeUsd: 50,
  domesticChinaFreightUsd: 30,
})
console.log(`  cartonCount=${full.cartonCount}, shipping=${full.shippingWeightKg}kg, china_freight_usd=${full.chinaFreightUsd.toFixed(2)}`)
console.log(`  totalShippingUsd=${full.totalShippingUsd.toFixed(2)}, additionalFees=${full.additionalFeesUsd.toFixed(2)}`)
console.log(`  totalCostUsd=${full.totalCostUsd.toFixed(2)}, sellingPriceJpy=${full.sellingPriceJpy}`)
console.log(`  totalBillingTaxJpy=${full.totalBillingTaxJpy.toLocaleString()}`)
assert('cartonCount in full', full.cartonCount, 5)
assert('shippingWeight in full', full.shippingWeightKg, 325)

if (process.exitCode === 1) {
  console.error('\n❌ 検証失敗')
  process.exit(1)
} else {
  console.log('\n✅ 全ての検証パス')
}
