/** Stored quotation totals already include production, freight and inspection costs. */
export interface PricedQuote {
  status: string | null
  variant_id: string | null
  spec_id: string | null
  quantity: number | null
  total_billing_jpy: number | null
  total_billing_tax_jpy: number | null
}
export interface AdditionalFee {
  variant_id: string | null
  spec_id: string | null
  amount_jpy: number | null
}
export function documentTotals<Q extends PricedQuote, F extends AdditionalFee>(quotes: Q[], fees: F[]) {
  const lineItems = quotes.filter(q => q.status === 'approved')
  const includedFees = fees.filter(f => (!f.variant_id && !f.spec_id) || lineItems.some(q =>
    f.variant_id ? q.variant_id === f.variant_id : q.spec_id === f.spec_id))
  const subtotal = lineItems.reduce((sum, q) => sum + Number(q.total_billing_jpy ?? 0), 0)
  const feesTotal = includedFees.reduce((sum, f) => sum + Number(f.amount_jpy ?? 0), 0)
  const tax = lineItems.reduce((sum, q) => sum + (q.total_billing_tax_jpy == null
    ? Math.ceil(Number(q.total_billing_jpy ?? 0) * .1)
    : Number(q.total_billing_tax_jpy) - Number(q.total_billing_jpy ?? 0)), 0) + Math.ceil(feesTotal * .1)
  return { lineItems, includedFees, subtotal, feesTotal, taxableSubtotal: subtotal + feesTotal, tax, grandTotal: subtotal + feesTotal + tax }
}
