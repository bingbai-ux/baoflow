import test from 'node:test'
import assert from 'node:assert/strict'
import { documentTotals } from '../src/lib/calc/document-totals'
const quote = { status: 'approved', variant_id: 'a', spec_id: null, quantity: 100, total_billing_jpy: 10000, total_billing_tax_jpy: 10800 }
test('only accepted quotation amounts and their fees are billed, preserving stored tax', () => {
  const result = documentTotals([quote, { ...quote, status: 'drafting', variant_id: 'b', total_billing_jpy: 900000 }], [
    { variant_id: 'a', spec_id: null, amount_jpy: 1000 },
    { variant_id: 'b', spec_id: null, amount_jpy: 9000 },
    { variant_id: null, spec_id: null, amount_jpy: 500 },
  ])
  assert.equal(result.lineItems.length, 1)
  assert.equal(result.feesTotal, 1500)
  assert.equal(result.tax, 950)
  assert.equal(result.grandTotal, 12450)
})
test('draft and rejected quantities are never silently substituted for adopted quotes', () => {
  const result = documentTotals([{ ...quote, status: 'rejected' }], [])
  assert.equal(result.lineItems.length, 0)
  assert.equal(result.grandTotal, 0)
})
test('legacy quote without stored inclusive total uses ten percent fallback', () => {
  assert.equal(documentTotals([{ ...quote, total_billing_tax_jpy: null }], []).grandTotal, 11000)
})
