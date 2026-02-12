/**
 * Exchange Rate API Utility
 * Uses ExchangeRate-API (free tier: 1500 requests/month)
 * https://www.exchangerate-api.com/
 */

const API_URL = 'https://open.er-api.com/v6/latest/USD'

export interface ExchangeRateResult {
  rate: number
  source: string
  timestamp: string
  success: boolean
  error?: string
}

/**
 * Fetch current exchange rate from API
 * @param from Source currency (default: USD)
 * @param to Target currency (default: JPY)
 * @returns Exchange rate result with metadata
 */
export async function getExchangeRate(
  from: string = 'USD',
  to: string = 'JPY'
): Promise<ExchangeRateResult> {
  try {
    const res = await fetch(API_URL, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    })

    if (!res.ok) {
      throw new Error(`API returned ${res.status}`)
    }

    const data = await res.json()

    if (data.result === 'success' && data.rates && data.rates[to]) {
      return {
        rate: data.rates[to],
        source: 'ExchangeRate-API',
        timestamp: data.time_last_update_utc || new Date().toISOString(),
        success: true,
      }
    }

    throw new Error('Invalid API response')
  } catch (error) {
    console.error('[ExchangeRate] API fetch failed:', error)
    return {
      rate: 0,
      source: 'error',
      timestamp: new Date().toISOString(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get exchange rate with fallback to system_settings
 * @param fallbackRate Fallback rate from system_settings
 * @returns Exchange rate (API value or fallback)
 */
export async function getExchangeRateWithFallback(
  fallbackRate: number = 150
): Promise<ExchangeRateResult> {
  const result = await getExchangeRate('USD', 'JPY')

  if (result.success && result.rate > 0) {
    return result
  }

  // Return fallback
  return {
    rate: fallbackRate,
    source: 'system_settings (fallback)',
    timestamp: new Date().toISOString(),
    success: true,
  }
}
