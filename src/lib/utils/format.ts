/**
 * フォーマットユーティリティ
 * BAO Flow - Format Utilities
 */

/**
 * 金額フォーマット
 * @param amount 金額（数値）
 * @param currency 通貨記号（デフォルト: ¥）
 * @returns フォーマットされた金額文字列 (例: "¥1,240,000")
 */
export function formatCurrency(amount: number, currency: string = '¥'): string {
  const rounded = Math.round(amount)
  const formatted = rounded.toLocaleString('ja-JP')
  return `${currency}${formatted}`
}

/**
 * CNY金額フォーマット
 */
export function formatCurrencyCny(amount: number): string {
  return formatCurrency(amount, '¥') + ' CNY'
}

/**
 * パーセントフォーマット
 * @param rate パーセント値
 * @param decimals 小数点以下の桁数（デフォルト: 2）
 * @returns フォーマットされたパーセント文字列 (例: "71.74%")
 */
export function formatPercent(rate: number, decimals: number = 2): string {
  return `${rate.toFixed(decimals)}%`
}

/**
 * 数値フォーマット（カンマ区切り）
 * @param num 数値
 * @returns フォーマットされた数値文字列 (例: "10,000")
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('ja-JP')
}

/**
 * 小数点付き数値フォーマット
 */
export function formatDecimal(num: number, decimals: number = 2): string {
  return num.toFixed(decimals)
}

/**
 * 日付フォーマット
 * @param date 日付
 * @returns フォーマットされた日付文字列 (例: "2024/01/15")
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

/**
 * 日時フォーマット
 * @param date 日時
 * @returns フォーマットされた日時文字列 (例: "2024/01/15 14:30")
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * 重量フォーマット
 * @param weightKg 重量（kg）
 * @returns フォーマットされた重量文字列 (例: "1.5 kg")
 */
export function formatWeight(weightKg: number): string {
  return `${weightKg.toFixed(2)} kg`
}

/**
 * 体積フォーマット
 * @param volumeCbm 体積（cbm）
 * @returns フォーマットされた体積文字列 (例: "0.05 CBM")
 */
export function formatVolume(volumeCbm: number): string {
  return `${volumeCbm.toFixed(3)} CBM`
}

/**
 * 為替レートフォーマット
 * @param rate 為替レート
 * @returns フォーマットされた為替レート文字列 (例: "21.50")
 */
export function formatExchangeRate(rate: number): string {
  return rate.toFixed(2)
}

/**
 * 案件番号フォーマット確認
 * @param dealNumber 案件番号
 * @returns 有効な案件番号かどうか
 */
export function isValidDealNumber(dealNumber: string): boolean {
  return /^BAO-\d{4}$/.test(dealNumber)
}
