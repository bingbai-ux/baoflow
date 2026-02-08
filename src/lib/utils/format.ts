/**
 * フォーマットユーティリティ
 * BAO Flow - Format Utilities
 */

import { format, formatDistance, formatRelative, parseISO, isValid } from 'date-fns'
import { ja } from 'date-fns/locale'

// ============================================
// 金額フォーマット
// ============================================

/**
 * JPY金額フォーマット
 * @param amount 金額（数値）
 * @returns フォーマットされた金額文字列 (例: "¥1,240,000")
 */
export function formatJPY(amount: number | null | undefined): string {
  if (amount == null) return '—'
  const rounded = Math.round(amount)
  const formatted = rounded.toLocaleString('ja-JP')
  return `¥${formatted}`
}

/**
 * USD金額フォーマット
 * @param amount 金額（数値）
 * @returns フォーマットされた金額文字列 (例: "$1,240.00")
 */
export function formatUSD(amount: number | null | undefined): string {
  if (amount == null) return '—'
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * 金額フォーマット（通貨指定）
 */
export function formatCurrency(
  amount: number | null | undefined,
  currency: 'JPY' | 'USD' = 'JPY'
): string {
  if (currency === 'USD') return formatUSD(amount)
  return formatJPY(amount)
}

/**
 * 金額をコンパクト表示 (K, M)
 * @param amount 金額
 * @returns コンパクト表示 (例: "1.2M", "340K")
 */
export function formatCompactAmount(amount: number | null | undefined): string {
  if (amount == null) return '—'

  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}M`
  }
  if (amount >= 1_000) {
    return `${(amount / 1_000).toFixed(0)}K`
  }
  return amount.toLocaleString('ja-JP')
}

// ============================================
// パーセント・数値フォーマット
// ============================================

/**
 * パーセントフォーマット
 * @param rate パーセント値
 * @param decimals 小数点以下の桁数（デフォルト: 1）
 * @returns フォーマットされたパーセント文字列 (例: "71.7%")
 */
export function formatPercent(rate: number | null | undefined, decimals: number = 1): string {
  if (rate == null) return '—'
  return `${rate.toFixed(decimals)}%`
}

/**
 * 数値フォーマット（カンマ区切り）
 * @param num 数値
 * @returns フォーマットされた数値文字列 (例: "10,000")
 */
export function formatNumber(num: number | null | undefined): string {
  if (num == null) return '—'
  return num.toLocaleString('ja-JP')
}

/**
 * 小数点付き数値フォーマット
 */
export function formatDecimal(num: number | null | undefined, decimals: number = 2): string {
  if (num == null) return '—'
  return num.toFixed(decimals)
}

/**
 * 為替レートフォーマット
 * @param rate 為替レート
 * @returns フォーマットされた為替レート文字列 (例: "155.00")
 */
export function formatExchangeRate(rate: number | null | undefined): string {
  if (rate == null) return '—'
  return rate.toFixed(2)
}

// ============================================
// 日付フォーマット
// ============================================

/**
 * 日付をパース
 */
function parseDate(date: Date | string | null | undefined): Date | null {
  if (!date) return null
  const d = typeof date === 'string' ? parseISO(date) : date
  return isValid(d) ? d : null
}

/**
 * 日付フォーマット (YYYY/MM/DD)
 */
export function formatDate(date: Date | string | null | undefined): string {
  const d = parseDate(date)
  if (!d) return '—'
  return format(d, 'yyyy/MM/dd', { locale: ja })
}

/**
 * 日付フォーマット (短縮: M/D)
 */
export function formatDateShort(date: Date | string | null | undefined): string {
  const d = parseDate(date)
  if (!d) return '—'
  return format(d, 'M/d', { locale: ja })
}

/**
 * 日付フォーマット (年月: YYYY年M月)
 */
export function formatYearMonth(date: Date | string | null | undefined): string {
  const d = parseDate(date)
  if (!d) return '—'
  return format(d, 'yyyy年M月', { locale: ja })
}

/**
 * 日時フォーマット (YYYY/MM/DD HH:mm)
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  const d = parseDate(date)
  if (!d) return '—'
  return format(d, 'yyyy/MM/dd HH:mm', { locale: ja })
}

/**
 * 日時フォーマット (短縮: M/D HH:mm)
 */
export function formatDateTimeShort(date: Date | string | null | undefined): string {
  const d = parseDate(date)
  if (!d) return '—'
  return format(d, 'M/d HH:mm', { locale: ja })
}

/**
 * 相対日時 (例: "3日前", "2時間後")
 */
export function formatRelativeDate(date: Date | string | null | undefined): string {
  const d = parseDate(date)
  if (!d) return '—'
  return formatDistance(d, new Date(), { addSuffix: true, locale: ja })
}

/**
 * 相対日付 (今日、昨日、明日、または日付)
 */
export function formatRelativeDateFull(date: Date | string | null | undefined): string {
  const d = parseDate(date)
  if (!d) return '—'
  return formatRelative(d, new Date(), { locale: ja })
}

// ============================================
// 案件番号・ID フォーマット
// ============================================

/**
 * 案件番号フォーマット確認
 * @param dealCode 案件番号
 * @returns 有効な案件番号かどうか (PF-YYYYMM-NNN)
 */
export function isValidDealCode(dealCode: string): boolean {
  return /^PF-\d{6}-\d{3}$/.test(dealCode)
}

/**
 * UUID を短縮表示
 * @param uuid UUID
 * @returns 短縮UUID (例: "abc12...")
 */
export function formatShortId(uuid: string | null | undefined): string {
  if (!uuid) return '—'
  return uuid.substring(0, 5) + '...'
}

// ============================================
// 重量・体積フォーマット
// ============================================

/**
 * 重量フォーマット
 * @param weightKg 重量（kg）
 * @returns フォーマットされた重量文字列 (例: "1.50 kg")
 */
export function formatWeight(weightKg: number | null | undefined): string {
  if (weightKg == null) return '—'
  return `${weightKg.toFixed(2)} kg`
}

/**
 * 体積フォーマット
 * @param volumeCbm 体積（cbm）
 * @returns フォーマットされた体積文字列 (例: "0.050 CBM")
 */
export function formatVolume(volumeCbm: number | null | undefined): string {
  if (volumeCbm == null) return '—'
  return `${volumeCbm.toFixed(3)} CBM`
}

// ============================================
// テキストフォーマット
// ============================================

/**
 * テキストを省略
 * @param text テキスト
 * @param maxLength 最大長
 * @returns 省略されたテキスト
 */
export function truncate(text: string | null | undefined, maxLength: number = 20): string {
  if (!text) return '—'
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

/**
 * 電話番号フォーマット
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—'
  // 日本の電話番号をハイフン区切りに
  const cleaned = phone.replace(/[^\d]/g, '')
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`
  }
  return phone
}

/**
 * 郵便番号フォーマット
 */
export function formatPostalCode(code: string | null | undefined): string {
  if (!code) return '—'
  const cleaned = code.replace(/[^\d]/g, '')
  if (cleaned.length === 7) {
    return `〒${cleaned.slice(0, 3)}-${cleaned.slice(3)}`
  }
  return code
}
