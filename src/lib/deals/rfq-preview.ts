export interface RfqSelection { product_id: string; variant_id: string; quantities: number[] }
export interface RfqLine extends RfqSelection {
  product_description: string; product_no: number; variant_label: string
  width_mm: number | null; height_mm: number | null; depth_mm: number | null
  material: string | null; print_color_count: string | null; print_method: string | null
  color_description: string | null; pantone_colors: string | null; processing: string | null
}
export interface RfqPreview {
  schema_version: 2; deal_id: string; requested_lines: RfqLine[]
  recipients: Array<{ factory_id: string | null; name: string; email: string }>
  response_deadline: string | null; request_message: string | null
}
export interface RfqV2Input {
  dealId: string; selection: RfqSelection[]; factoryIds: string[]
  pendingFactories: Array<{ name: string; email?: string }>
  responseDeadline: string | null; requestMessage: string
}
/** Order-insensitive selection; content changes always invalidate confirmation. */
export function canonicalRfqInput(input: RfqV2Input) {
  return { ...input, selection: input.selection.map(l => ({ ...l, quantities: [...l.quantities].sort((a, b) => a - b) })).sort((a, b) => `${a.product_id}/${a.variant_id}`.localeCompare(`${b.product_id}/${b.variant_id}`)), factoryIds: [...input.factoryIds].sort(), pendingFactories: input.pendingFactories.map(p => ({ name: p.name.trim(), email: (p.email || '').trim() })).sort((a, b) => a.name.localeCompare(b.name)), requestMessage: input.requestMessage.trim() }
}
export function rfqDimensions(l: Pick<RfqLine, 'width_mm' | 'height_mm' | 'depth_mm'>) {
  return [['W', l.width_mm], ['H', l.height_mm], ['D', l.depth_mm]].filter(([, n]) => n != null).map(([axis, n]) => `${axis}${n}`).join(' × ') || 'サイズ未登録'
}
export function rfqEmailStatus(status: string | null) {
  return status === 'accepted' ? 'メール受付済み（到達未確認）' : status === 'attempting' ? '送信予約済み・再送停止' : status === 'unknown' ? '送信結果不明・再送停止' : status === 'rejected' ? 'メール事業者が拒否・再送停止' : status ? '送信履歴を確認・再送停止' : 'メール受付記録なし'
}
