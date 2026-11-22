// 再設計 工程5: 請求書の内容の型と表示用の書式（画面・PDFの両方から使う）。

export interface InvoiceLine { name: string; quantity: number; unit_jpy: number; net_jpy: number }
export interface InvoiceSnapshot {
  invoice_number: string; issue_date: string; due_date: string
  deal_name: string | null; deal_code: string | null; client_name: string | null; brand: string | null
  lines: InvoiceLine[]; subtotal_jpy: number; tax_rate: number; tax_jpy: number; total_jpy: number
  issuer: { name: string; address: string; phone: string | null; email: string | null; registration_number: string | null }
  bank: { bank_name: string; branch_name: string; account_type: string; account_number: string; account_holder: string }
  notes: string | null
}
export const jpDate = (d: string) => d.replace(/-/g, '/')
export const bankLine = (b: InvoiceSnapshot['bank']) => `${b.bank_name} ${b.branch_name} ${b.account_type} ${b.account_number} ${b.account_holder}`
