/** Shared UI prerequisites. Zero/negative/non-finite inputs are incomplete. */
export function isPositive(value: unknown): boolean {
  return value != null && value !== '' && Number.isFinite(Number(value)) && Number(value) > 0
}

export function hasFactoryPrice(quote: { quantity?: number | null; factory_unit_price_usd?: number | null }): boolean {
  return isPositive(quote.quantity) && Number.isInteger(Number(quote.quantity)) && isPositive(quote.factory_unit_price_usd)
}

export function hasCarton(variant: {
  pcs_per_carton?: number | null; carton_width_cm?: number | null;
  carton_height_cm?: number | null; carton_depth_cm?: number | null; gross_weight_kg?: number | null
}): boolean {
  return [variant.pcs_per_carton, variant.carton_width_cm, variant.carton_height_cm,
    variant.carton_depth_cm, variant.gross_weight_kg].every(isPositive)
    && Number.isInteger(Number(variant.pcs_per_carton))
}

export function quoteAdoptionIssue(q: {
  quantity?: number | null; factory_unit_price_usd?: number | null; moq?: number | null;
  exchange_rate?: number | null; cost_ratio?: number | null;
  selling_price_jpy?: number | null; total_billing_tax_jpy?: number | null
}): string | null {
  if (!hasFactoryPrice(q)) return '正の整数の数量と工場単価を入力してください'
  if (isPositive(q.moq) && Number(q.quantity) < Number(q.moq)) return '数量が工場の最低発注数量（MOQ）を下回っています'
  if (!isPositive(q.exchange_rate)) return '為替レートを設定してください'
  if (!isPositive(q.cost_ratio) || Number(q.cost_ratio) > 1) return '掛率は0より大きく1以下で入力してください'
  if (!isPositive(q.selling_price_jpy) || !isPositive(q.total_billing_tax_jpy)) return '売値の再計算が必要です。掛率と原価を確認してください'
  return null
}

export function hasFactoryReplies(
  variants: Array<Parameters<typeof hasCarton>[0] & { id: string }>,
  quotes: Array<Parameters<typeof hasFactoryPrice>[0] & { variant_id?: string | null; factory_response?: { line?: Record<string, unknown> } | null }>
): boolean {
  return variants.length > 0 && variants.every((variant) => quotes.some((quote) => {
    const line = quote.factory_response?.line
    const carton = line ? { pcs_per_carton: Number(line.pcs_per_carton), carton_width_cm: Number(line.carton_w_cm), carton_height_cm: Number(line.carton_h_cm), carton_depth_cm: Number(line.carton_d_cm), gross_weight_kg: Number(line.gross_weight_kg) } : variant
    return quote.variant_id === variant.id && hasFactoryPrice(quote) && hasCarton(carton)
  }))
}
