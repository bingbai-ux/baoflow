// 再設計 工程4: お見積の内容の型と表示用の書式（画面・PDFの両方から使う）。

export interface OfferOption { quote_id: string; quantity: number; unit_jpy: number; net_jpy: number; tax_jpy: number }
export interface OfferItem { product_id: string; name: string; production_days: number | null; shipping_mode?: string | null; options: OfferOption[] }
export interface OfferSnapshot { deal_name: string | null; deal_code: string | null; client_name: string | null; brand: string | null; tax_rate: number | null; round: number; items: OfferItem[] }

export const yen = (n: number) => `¥${Number(n).toLocaleString('ja-JP', { maximumFractionDigits: 2 })}`
export const offerNumber = (s: OfferSnapshot) => `${s.deal_code || 'BAO'}-Q${s.round}`
export const optionLine = (o: OfferOption) => `${Number(o.quantity).toLocaleString('ja-JP')}個　単価 ${yen(o.unit_jpy)}　小計 ${yen(o.net_jpy)}（税込 ${yen(o.tax_jpy)}）`
