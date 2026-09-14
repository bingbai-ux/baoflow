// Sprint 10 (D): ボール管理の共有定義。
// サーバー/クライアント両方から使うため 'use client' を付けない。

export type WaitingOn = 'us' | 'client' | 'factory' | 'none'

export const WAITING_ON_CONFIG: Record<
  WaitingOn,
  { label: string; bg: string; ink: string; border?: string }
> = {
  // 自分の番 = 「今ここ」なので Wasabi 面
  us: { label: '自分の番', bg: '#E9F056', ink: '#666C14' },
  // 相手待ち = 情報 → Cool Blue 面
  client: { label: 'クライアント待ち', bg: '#D7EFFF', ink: '#33566F' },
  factory: { label: '工場待ち', bg: '#D7EFFF', ink: '#33566F' },
  // 待ちなし = 無彩
  none: { label: '待ちなし', bg: '#EFEFEA', ink: '#84787D', border: '#E2E1DA' },
}

export function normalizeWaitingOn(v: string | null | undefined): WaitingOn {
  return v === 'client' || v === 'factory' || v === 'none' ? v : 'us'
}
