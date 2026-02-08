/**
 * ステータスユーティリティ
 * BAO Flow - Status Utilities
 */

import { MasterStatus, MASTER_STATUS_CONFIG } from '@/lib/types'

// ============================================
// ステータス変換・取得
// ============================================

/**
 * マスターステータスのラベルを取得
 */
export function getStatusLabel(status: MasterStatus): string {
  return MASTER_STATUS_CONFIG[status]?.label ?? status
}

/**
 * マスターステータスのフェーズを取得
 */
export function getStatusPhase(status: MasterStatus): string {
  return MASTER_STATUS_CONFIG[status]?.phase ?? 'unknown'
}

/**
 * マスターステータスの色を取得 (CSS変数名)
 */
export function getStatusColor(status: MasterStatus): string {
  return MASTER_STATUS_CONFIG[status]?.color ?? 'var(--text-sub)'
}

/**
 * マスターステータスの次のアクションを取得
 */
export function getNextAction(status: MasterStatus): string | null {
  return MASTER_STATUS_CONFIG[status]?.nextAction ?? null
}

/**
 * ステータス番号を取得 (M01 → 1)
 */
export function getStatusNumber(status: MasterStatus): number {
  const match = status.match(/^M(\d{2})$/)
  return match ? parseInt(match[1], 10) : 0
}

// ============================================
// ステータス比較・判定
// ============================================

/**
 * ステータスが指定フェーズかどうか
 */
export function isInPhase(status: MasterStatus, phase: string): boolean {
  return getStatusPhase(status) === phase
}

/**
 * ステータスが完了しているかどうか
 */
export function isCompleted(status: MasterStatus): boolean {
  return status === 'M25'
}

/**
 * ステータスがキャンセルされているかどうか
 * Note: Current schema (M01-M25) does not include cancel statuses
 */
export function isCancelled(_status: MasterStatus): boolean {
  // No cancel status in current M01-M25 schema
  return false
}

/**
 * ステータスがアクティブかどうか (進行中)
 */
export function isActive(status: MasterStatus): boolean {
  const num = getStatusNumber(status)
  return num >= 1 && num <= 24
}

/**
 * ステータスA が ステータスB より後かどうか
 */
export function isAfter(statusA: MasterStatus, statusB: MasterStatus): boolean {
  return getStatusNumber(statusA) > getStatusNumber(statusB)
}

/**
 * ステータスA が ステータスB より前かどうか
 */
export function isBefore(statusA: MasterStatus, statusB: MasterStatus): boolean {
  return getStatusNumber(statusA) < getStatusNumber(statusB)
}

// ============================================
// ステータスリスト・フィルタリング
// ============================================

/**
 * 全マスターステータスを取得 (順序付き)
 */
export function getAllStatuses(): MasterStatus[] {
  return Object.keys(MASTER_STATUS_CONFIG) as MasterStatus[]
}

/**
 * 指定フェーズのステータスを取得
 */
export function getStatusesByPhase(phase: string): MasterStatus[] {
  return getAllStatuses().filter(status => getStatusPhase(status) === phase)
}

/**
 * アクティブなステータスのみ取得
 */
export function getActiveStatuses(): MasterStatus[] {
  return getAllStatuses().filter(isActive)
}

// ============================================
// 進捗計算
// ============================================

/**
 * ステータスから進捗率を計算 (0-100)
 */
export function calculateProgress(status: MasterStatus): number {
  if (isCompleted(status)) return 100
  if (isCancelled(status)) return 0

  const num = getStatusNumber(status)
  // M01-M24 を 0-96% にマッピング
  return Math.min((num / 25) * 100, 96)
}

/**
 * 進捗ステップ数を計算 (25ステップ中)
 */
export function calculateProgressSteps(status: MasterStatus): { current: number; total: number } {
  if (isCompleted(status)) return { current: 25, total: 25 }
  if (isCancelled(status)) return { current: 0, total: 25 }

  const num = getStatusNumber(status)
  return { current: num, total: 25 }
}

// ============================================
// クライアント向けステータス (7ステップ)
// ============================================

export type ClientStatus =
  | 'inquiry'      // お問い合わせ
  | 'quoting'      // 見積中
  | 'confirmed'    // ご発注
  | 'producing'    // 製造中
  | 'shipping'     // 配送中
  | 'delivered'    // お届け完了
  | 'completed'    // 完了

export const CLIENT_STATUS_MAP: Record<ClientStatus, { label: string; color: string }> = {
  inquiry: { label: 'お問い合わせ', color: 'var(--status-pending)' },
  quoting: { label: '見積中', color: 'var(--status-pending)' },
  confirmed: { label: 'ご発注', color: 'var(--status-confirmed)' },
  producing: { label: '製造中', color: 'var(--status-active)' },
  shipping: { label: '配送中', color: 'var(--status-shipping)' },
  delivered: { label: 'お届け完了', color: 'var(--status-confirmed)' },
  completed: { label: '完了', color: 'var(--status-confirmed)' },
}

/**
 * マスターステータスをクライアント向けステータスに変換
 */
export function toClientStatus(status: MasterStatus): ClientStatus {
  const num = getStatusNumber(status)

  if (num <= 2) return 'inquiry'
  if (num <= 6) return 'quoting'
  if (num <= 10) return 'confirmed'
  if (num <= 16) return 'producing'
  if (num <= 20) return 'shipping'
  if (num <= 23) return 'delivered'
  return 'completed'
}

/**
 * クライアント向けステータスの進捗を計算 (1-7)
 */
export function calculateClientProgress(status: MasterStatus): { current: number; total: number } {
  const clientStatus = toClientStatus(status)
  const order: ClientStatus[] = ['inquiry', 'quoting', 'confirmed', 'producing', 'shipping', 'delivered', 'completed']
  const current = order.indexOf(clientStatus) + 1
  return { current, total: 7 }
}

// ============================================
// 工場向けステータス (6ステップ)
// ============================================

export type FactoryStatus =
  | 'sample_requested'  // サンプル依頼
  | 'sample_confirmed'  // サンプル確認
  | 'production'        // 量産中
  | 'inspection'        // 検品中
  | 'shipped'           // 出荷済み
  | 'completed'         // 完了

export const FACTORY_STATUS_MAP: Record<FactoryStatus, { label: string; color: string }> = {
  sample_requested: { label: 'サンプル依頼', color: 'var(--status-pending)' },
  sample_confirmed: { label: 'サンプル確認', color: 'var(--status-confirmed)' },
  production: { label: '量産中', color: 'var(--status-active)' },
  inspection: { label: '検品中', color: 'var(--status-active)' },
  shipped: { label: '出荷済み', color: 'var(--status-shipping)' },
  completed: { label: '完了', color: 'var(--status-confirmed)' },
}

/**
 * マスターステータスを工場向けステータスに変換
 */
export function toFactoryStatus(status: MasterStatus): FactoryStatus {
  const num = getStatusNumber(status)

  if (num <= 8) return 'sample_requested'
  if (num <= 12) return 'sample_confirmed'
  if (num <= 16) return 'production'
  if (num <= 18) return 'inspection'
  if (num <= 21) return 'shipped'
  return 'completed'
}

/**
 * 工場向けステータスの進捗を計算 (1-6)
 */
export function calculateFactoryProgress(status: MasterStatus): { current: number; total: number } {
  const factoryStatus = toFactoryStatus(status)
  const order: FactoryStatus[] = ['sample_requested', 'sample_confirmed', 'production', 'inspection', 'shipped', 'completed']
  const current = order.indexOf(factoryStatus) + 1
  return { current, total: 6 }
}
