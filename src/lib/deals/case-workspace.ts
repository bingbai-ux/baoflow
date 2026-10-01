import type { SimpleStatus } from '@/lib/types'

export interface CaseEvidence {
  products: number
  variants: number
  rfqs: number
  pricedQuotes: number
  approvedQuotes: number
  missingAmounts: number
  quotationDocs: number
  invoiceDocs: number
  incompleteProducts?: number
  missingQuantities?: number
  invalidApprovedQuotes?: number
}

/** Navigation guidance only. A stage never substitutes for a document/payment fact. */
export function caseAction(status: SimpleStatus, e: CaseEvidence) {
  if (status === 'quoting') {
    if (!e.products || !e.variants || e.incompleteProducts || e.missingQuantities) return { label: '商品仕様・数量を入力', step: 2, reason: '仕様または数量パターンが未登録' }
    if (!e.pricedQuotes) return e.rfqs
      ? { label: '工場回答を確認', step: 4, reason: '工場単価の確認が必要' }
      : { label: '工場へ見積を依頼', step: 3, reason: '工場単価が未登録' }
    if (!e.approvedQuotes) return { label: '売値を比較して採用', step: 6, reason: '採用見積が未登録' }
    if (e.missingAmounts || e.invalidApprovedQuotes) return { label: '採用見積の金額を確認', step: 6, reason: '採用見積の数量・金額の確認が必要' }
    return e.quotationDocs
      ? { label: '見積書・顧客承認を確認', step: 7, reason: '発行と顧客承認は別の確認' }
      : { label: '顧客向け見積書を作成', step: 7, reason: '見積書が未発行' }
  }
  if (status === 'quote_confirmed') {
    if (!e.approvedQuotes) return { label: '採用見積を確認', step: 6, reason: '見積確定の記録はありますが、採用見積がありません' }
    if (e.missingAmounts || e.invalidApprovedQuotes) return { label: '採用見積の金額を確認', step: 6, reason: '請求の元になる数量・金額を確認してください' }
    return e.invoiceDocs
      ? { label: '請求書・入金を確認', step: 8, reason: '発行済み。送付・着金はそれぞれ確認してください' }
      : { label: '請求書を作成', step: 8, reason: '請求書が未発行' }
  }
  if (status === 'paid') return { label: '最終入稿データを確認', step: 9, reason: '工場発注と製作条件を確認' }
  if (status === 'data_confirmed') return { label: '工場発注・製作開始を確認', step: 10, reason: '正式な発注内容を確認' }
  if (status === 'in_production') return { label: '製作・発送状況を確認', step: 10, reason: '工場の進捗を確認' }
  if (status === 'shipped') return { label: '到着・検品・入庫を確認', step: 12, reason: '到着確認と在庫の記録は別の作業' }
  return { label: '納品記録・過去書類を確認', step: 13, reason: '納品完了の記録があります' }
}

/** Same quantity and pre-tax total prerequisites as issueDocument's server guard. */
export function invalidDocumentQuotes(quotes: Array<{ status?: string | null; quantity?: unknown; total_billing_jpy?: unknown }>) {
  return quotes.filter(q => q.status === 'approved' && (!Number.isInteger(Number(q.quantity)) || Number(q.quantity) <= 0 || q.total_billing_jpy == null || q.total_billing_jpy === '' || !Number.isFinite(Number(q.total_billing_jpy)) || Number(q.total_billing_jpy) < 0)).length
}

export function approvedAmount(quotes: Array<{ status?: string | null; total_billing_tax_jpy?: unknown }>) {
  let count = 0, missing = 0, total = 0
  for (const q of quotes) {
    if (q.status !== 'approved') continue
    count++
    const value = q.total_billing_tax_jpy
    if (value == null || value === '' || !Number.isFinite(Number(value)) || Number(value) < 0) missing++
    else total += Number(value)
  }
  return { count, missing, total, label: !count ? '未採用' : missing ? '金額未登録' : null }
}

export function waitingLabel(value: string | null | undefined) {
  return value === 'us' ? '営業対応' : value === 'client' ? '顧客の返答待ち' : value === 'factory' ? '工場の返答待ち' : value === 'none' ? '待ち先なし' : '待ち先未設定'
}

export function safeCaseReturn(value: string | null | undefined) {
  if (!value) return '/deals'
  try {
    const url = new URL(value, 'https://case.invalid')
    return url.origin === 'https://case.invalid' && url.pathname === '/deals' ? url.pathname + url.search : '/deals'
  } catch { return '/deals' }
}
