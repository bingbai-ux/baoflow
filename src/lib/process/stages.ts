// 再設計: 9工程の定義はここ1箇所だけに置く（画面・DB関数の表記はこれに合わせる）。
export const PROCESS_STAGES = [
  { n: 1, label: 'プロジェクト作成', short: '作成' },
  { n: 2, label: '商品登録', short: '商品' },
  { n: 3, label: '工場見積', short: '工場見積' },
  { n: 4, label: '価格提示', short: '価格提示' },
  { n: 5, label: '請求・契約', short: '請求' },
  { n: 6, label: '入稿', short: '入稿' },
  { n: 7, label: '製造', short: '製造' },
  { n: 8, label: '発送', short: '発送' },
  { n: 9, label: '検収', short: '検収' },
] as const

export const PROCESS_STAGE_COUNT = PROCESS_STAGES.length

export function stageLabel(stage: number | null | undefined): string {
  return PROCESS_STAGES.find(s => s.n === stage)?.label || '工程未設定'
}

export function clampStage(stage: number | null | undefined): number {
  const n = Number(stage)
  return Number.isInteger(n) && n >= 1 && n <= PROCESS_STAGE_COUNT ? n : 1
}

export type DaysLeftTone = 'none' | 'ok' | 'soon' | 'over' | 'done'
export interface DaysLeft { tone: DaysLeftTone; days: number | null; text: string }

/** 希望納期までの残り日数。today / dueDate は 'YYYY-MM-DD'（日本時間の日付）。 */
export function daysLeft(dueDate: string | null | undefined, today: string, stage?: number | null): DaysLeft {
  if (!dueDate) return { tone: 'none', days: null, text: '納期未設定' }
  const due = Date.parse(dueDate + 'T00:00:00Z'), now = Date.parse(today + 'T00:00:00Z')
  if (!Number.isFinite(due) || !Number.isFinite(now)) return { tone: 'none', days: null, text: '納期未設定' }
  const days = Math.round((due - now) / 86400000)
  if (stage === PROCESS_STAGE_COUNT) return { tone: 'done', days, text: '検収まで進行' }
  if (days < 0) return { tone: 'over', days, text: `${-days}日 超過` }
  if (days === 0) return { tone: 'soon', days, text: '今日が納期' }
  return { tone: days <= 7 ? 'soon' : 'ok', days, text: `残り ${days}日` }
}

export function todayInJapan(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

// 9工程 → 従来の13ステップ（作業欄、0始まり）の対応。工程バーを押すと、その工程の作業欄へ切り替わる。
export const STAGE_STEPS: number[][] = [[0], [1], [2, 3], [4, 5, 6], [7], [8], [9], [10], [11, 12]]
/** 13ステップの番号（0始まり）が属する工程（1〜9）。 */
export const stageOfStep = (i: number) => Math.max(1, STAGE_STEPS.findIndex(g => g.includes(i)) + 1)
/**
 * 画面に出す「現在の工程」。保存値と、記録から分かる次の作業（1始まりのステップ番号）の工程のうち、進んでいる方。
 * 案件を開いただけでは保存値を書き換えないので、一覧と案件画面はどちらもこの関数で同じ値を出す。
 */
export function shownStage(stored: number | null | undefined, nextActionStep?: number | null): number {
  const base = clampStage(stored)
  return nextActionStep ? Math.max(base, stageOfStep(nextActionStep - 1)) : base
}
