// Sprint 12: 出荷依頼ステータスの表示定義 ('use server' ファイルから分離)。

import type { RequestStatus } from '@/lib/actions/shipment-requests'

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  requested: '依頼受付',
  confirmed: '確認済み',
  shipped: '出荷済み',
  delivered: '納品完了',
  cancelled: 'キャンセル',
}

// バッジ(ピル)5種ルール: 新着=Wasabi / 情報=Cool Blue / 弱=Sauge / 警告=Orange Tint / 無彩=BG+Line
export const REQUEST_STATUS_BADGE: Record<RequestStatus, string> = {
  requested: 'bg-[#E9F056] text-[#666C14]',
  confirmed: 'bg-[#D7EFFF] text-[#33566F]',
  shipped: 'bg-[#D7EFFF] text-[#33566F]',
  delivered: 'bg-[#AEB8A0] text-[#4C5544]',
  cancelled: 'bg-[#EFEFEA] border border-[#E2E1DA] text-[#84787D]',
}
