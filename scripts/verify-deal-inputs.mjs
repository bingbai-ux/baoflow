// Pure offline regression checks: no environment files, network or database access.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
const output = mkdtempSync(join(tmpdir(), 'baoflow-deal-input-'))
try {
  execFileSync('node_modules/.bin/tsc', ['src/lib/validation/deal-input.ts', 'src/lib/calc/quote-engine.ts', 'src/lib/utils/request-key.ts', '--outDir', output, '--module', 'commonjs', '--target', 'es2020', '--skipLibCheck'], { stdio: 'inherit' })
  const require = createRequire(import.meta.url)
  const { validateQuantities, validateQuoteNumbers, nextQuoteVersion } = require(join(output, 'validation/deal-input.js'))
  const { stableRequestId } = require(join(output, 'utils/request-key.js'))
  const request = { current: null }
  const requestId = stableRequestId(request, { quantity: 100 })
  assert.equal(stableRequestId(request, { quantity: 100 }), requestId)
  assert.notEqual(stableRequestId(request, { quantity: 200 }), requestId)
  const { calculateFullQuote } = require(join(output, 'calc/quote-engine.js'))
  assert.equal(nextQuoteVersion([]), 1)
  assert.equal(nextQuoteVersion([{ version: 1 }, { version: 4 }]), 5)
  assert.equal(validateQuantities([1000, 2000]), null)
  for (const values of [[], [1.5], [0], [-1], [NaN], [Infinity], [2147483648], [1000, 1000]]) assert.ok(validateQuantities(values), String(values))
  const quote = { quantity: 1000, factory_unit_price_usd: 1 }
  assert.equal(validateQuoteNumbers(quote), null)
  for (const input of [{ quantity: 1.5 }, { factory_unit_price_usd: NaN }, { exchange_rate: 0 }, { cost_ratio: 1.1 }, { plate_fee_usd: -1 }, { food_inspection_fee_yuan: Infinity }]) assert.ok(validateQuoteNumbers({ ...quote, ...input }), JSON.stringify(input))
  assert.equal(validateQuoteNumbers({ ...quote, china_freight_rate_yuan_per_kg: 0, other_fees_usd: 0 }), null)
  const base = { orderQty: 100, factoryUnitPriceUsd: 1, physics: { pcsPerCarton: 0, cartonWidthCm: 0, cartonHeightCm: 0, cartonDepthCm: 0, grossWeightKg: 0 }, chinaFreightRateYuanPerKg: 7, yuanToUsdRate: 7.2, exchangeRate: 150, costRatio: 0.5, taxRate: 10 }
  const withoutInspection = calculateFullQuote(base)
  const withInspection = calculateFullQuote({ ...base, foodInspectionFeeYuan: 720 })
  assert.equal(withInspection.totalCostUsd - withoutInspection.totalCostUsd, 100)
  assert.equal(withInspection.totalBillingJpy - withoutInspection.totalBillingJpy, 30000)
  assert.equal(withInspection.totalBillingTaxJpy, Math.round(withInspection.totalBillingJpy * 1.1))
  console.log('PASS: quantity boundaries, quote validation, CNY inspection cost and billing regression checks')
} finally { rmSync(output, { recursive: true, force: true }) }
