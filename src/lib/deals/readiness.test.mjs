import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { hasCarton, hasFactoryPrice, quoteAdoptionIssue, hasFactoryReplies } from './readiness.ts'

test('工場回答は正の整数の数量と正の単価が必要', () => {
  assert.equal(hasFactoryPrice({ quantity: 0, factory_unit_price_usd: 1 }), false)
  assert.equal(hasFactoryPrice({ quantity: 1.5, factory_unit_price_usd: 1 }), false)
  assert.equal(hasFactoryPrice({ quantity: 100, factory_unit_price_usd: NaN }), false)
  assert.equal(hasFactoryPrice({ quantity: 100, factory_unit_price_usd: 0.01 }), true)
})
test('物流の全項目が正数、入り数は整数が必要', () => {
  const carton = { pcs_per_carton: 100, carton_width_cm: 20, carton_height_cm: 30, carton_depth_cm: 40, gross_weight_kg: 5 }
  assert.equal(hasCarton(carton), true)
  assert.equal(hasCarton({ ...carton, gross_weight_kg: 0 }), false)
  assert.equal(hasCarton({ ...carton, pcs_per_carton: 0.5 }), false)
})
test('MOQ未達・掛率不正・未計算売値を採用できない', () => {
  const quote = { quantity: 100, factory_unit_price_usd: 1, moq: 100, exchange_rate: 150, cost_ratio: 0.65, selling_price_jpy: 231, total_billing_tax_jpy: 25410 }
  assert.equal(quoteAdoptionIssue(quote), null)
  assert.match(quoteAdoptionIssue({ ...quote, moq: 101 }), /MOQ/)
  assert.match(quoteAdoptionIssue({ ...quote, cost_ratio: 1.1 }), /掛率/)
  assert.match(quoteAdoptionIssue({ ...quote, total_billing_tax_jpy: 0 }), /再計算/)
})

test('別バリエのカートンと単価を組み合わせて完了にしない', () => {
  const carton = { pcs_per_carton: 100, carton_width_cm: 20, carton_height_cm: 30, carton_depth_cm: 40, gross_weight_kg: 5 }
  assert.equal(hasFactoryReplies([{ id: 'a', ...carton }], [{ variant_id: 'b', quantity: 100, factory_unit_price_usd: 1 }]), false)
  assert.equal(hasFactoryReplies([{ id: 'a', ...carton }], [{ variant_id: 'a', quantity: 100, factory_unit_price_usd: 1 }]), true)
  assert.equal(hasFactoryReplies([], []), false)
})
