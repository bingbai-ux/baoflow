// 再設計 工程9: 検収（受領の確認）と納品書の内容の型。金額は含めない。

export interface ReceiptSnapshot {
  delivery_note_number: string; arrived_on: string; shipped_on: string | null
  deal_name: string | null; deal_code: string | null; client_name: string | null; brand: string | null
  lines: Array<{ name: string; quantity: number }>
  ship_to: { name: string | null; postal_code: string | null; address: string | null }
  carton_count: number | null; carrier: string | null; tracking_number: string | null
  issuer: { id?: string; name: string; postal_code?: string | null; address: string | null; phone: string | null; email: string | null; registration_number: string | null }
}
