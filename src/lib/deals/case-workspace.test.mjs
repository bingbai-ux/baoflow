import { test } from 'node:test'
import assert from 'node:assert/strict'
import { approvedAmount, caseAction, safeCaseReturn, waitingLabel, invalidDocumentQuotes } from './case-workspace.ts'

const evidence = { products: 2, variants: 4, rfqs: 1, pricedQuotes: 4, approvedQuotes: 0, missingAmounts: 0, quotationDocs: 0, invoiceDocs: 0 }
test('confirmed status cannot manufacture adoption or invoice eligibility', () => {
  assert.equal(caseAction('quote_confirmed', evidence).step, 6)
  assert.equal(caseAction('quote_confirmed', { ...evidence, approvedQuotes: 1, missingAmounts: 1 }).step, 6)
  assert.equal(caseAction('quote_confirmed', { ...evidence, approvedQuotes: 1 }).label, '請求書を作成')
  assert.equal(caseAction('quote_confirmed', { ...evidence, approvedQuotes: 1, invoiceDocs: 1 }).label, '請求書・入金を確認')
})
test('partially entered products and variants stay in input instead of skipping to RFQ or prices', () => {
  assert.equal(caseAction('quoting', { ...evidence, incompleteProducts: 1 }).step, 2)
  assert.equal(caseAction('quoting', { ...evidence, missingQuantities: 1 }).step, 2)
  assert.equal(caseAction('quoting', evidence).step, 6)
})
test('unadopted, incomplete money and registered zero remain different', () => {
  assert.equal(approvedAmount([]).label, '未採用')
  const mixed = approvedAmount([{ status: 'approved', total_billing_tax_jpy: null }, { status: 'approved', total_billing_tax_jpy: 120 }, { status: 'drafting', total_billing_tax_jpy: 999 }])
  assert.deepEqual(mixed, { count: 2, missing: 1, total: 120, label: '金額未登録' })
  assert.deepEqual(approvedAmount([{ status: 'approved', total_billing_tax_jpy: 0 }]), { count: 1, missing: 0, total: 0, label: null })
})
test('return links preserve only internal case list context', () => {
  assert.equal(safeCaseReturn('/deals?q=LOCAL-001&scope=todo'), '/deals?q=LOCAL-001&scope=todo')
  for (const value of ['https://outside.test/deals', '//outside.test/deals', '/settings', '/deals/other', 'javascript:alert(1)']) assert.equal(safeCaseReturn(value), '/deals')
})
test('business waiting is not a claim that the logged-in user owns a case', () => {
  assert.equal(waitingLabel('us'), '営業対応')
  assert.equal(waitingLabel(null), '待ち先未設定')
})
test('invoice guidance checks the same quantity and pre-tax amount as the server issuer', () => {
  assert.equal(invalidDocumentQuotes([{ status: 'approved', quantity: null, total_billing_jpy: 120 }]), 1)
  assert.equal(invalidDocumentQuotes([{ status: 'approved', quantity: 100, total_billing_jpy: null }]), 1)
  assert.equal(invalidDocumentQuotes([{ status: 'approved', quantity: 100, total_billing_jpy: 0 }]), 0)
  assert.equal(caseAction('quote_confirmed', { ...evidence, approvedQuotes: 1, invalidApprovedQuotes: 1 }).step, 6)
})
