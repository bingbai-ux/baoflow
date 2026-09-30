/** Quantities are whole units; never silently round customer requests. */
export function isValidQuantity(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && value <= 2147483647
}

export function validateQuantities(values: number[]): string | null {
  if (!values.length) return '数量を1つ以上入力してください'
  if (values.some((value) => !isValidQuantity(value))) return '数量は1以上の整数で入力してください'
  if (new Set(values).size !== values.length) return '同じ数量が重複しています'
  return null
}

export function validateQuoteNumbers(input: {
  quantity: number; factory_unit_price_usd: number; moq?: number | null
  exchange_rate?: number | null; cost_ratio?: number | null; yuan_to_usd_rate?: number | null
  china_freight_rate_yuan_per_kg?: number | null
  plate_fee_usd?: number | null; pantone_color_fee_usd?: number | null
  domestic_china_freight_usd?: number | null; sample_cost_usd?: number | null
  sample_shipping_usd?: number | null; food_inspection_fee_yuan?: number | null; other_fees_usd?: number | null
}): string | null {
  const quantityError = validateQuantities([input.quantity])
  if (quantityError) return quantityError
  if (!Number.isFinite(input.factory_unit_price_usd) || input.factory_unit_price_usd <= 0) return '工場単価は0より大きい有限の値で入力してください'
  if (input.moq != null && !isValidQuantity(input.moq)) return 'MOQは1以上の整数で入力してください'
  for (const value of [input.exchange_rate, input.yuan_to_usd_rate]) {
    if (value != null && (!Number.isFinite(value) || value <= 0)) return '為替レートは0より大きい値で入力してください'
  }
  if (input.cost_ratio != null && (!Number.isFinite(input.cost_ratio) || input.cost_ratio <= 0 || input.cost_ratio > 1)) return '掛け率は0より大きく1以下で入力してください'
  for (const value of [input.china_freight_rate_yuan_per_kg, input.plate_fee_usd, input.pantone_color_fee_usd, input.domestic_china_freight_usd, input.sample_cost_usd, input.sample_shipping_usd, input.food_inspection_fee_yuan, input.other_fees_usd]) {
    if (value != null && (!Number.isFinite(value) || value < 0)) return '費用は0以上の有限の値で入力してください'
  }
  return null
}

/** Deleting a quote must not cause its version to be reused. */
export function nextQuoteVersion(rows: Array<{ version: number | null }>): number {
  return Math.max(0, ...rows.map((row) => row.version || 0)) + 1
}
