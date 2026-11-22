'use server'

// 再設計 工程7: サンプル製造（写真・動画 → 顧客の確認 → 修正なら次の回）と本製造（完成予定日・到着目安）。

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSalesAccess } from './deal-access'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export interface SampleRound { id: string; round: number; expectedOn: string | null; completedAt: string | null; sharedAt: string | null; result: 'approved' | 'revise' | null; feedback: string | null; decidedAt: string | null }
export interface DealProduction { rounds: SampleRound[]; startedOn: string | null; dueOn: string | null; transitDays: number | null; finishedAt: string | null }
export type ProductionAction = 'sample_start' | 'sample_done' | 'sample_shared' | 'sample_result' | 'production_start' | 'production_update' | 'production_finish'

export async function getDealProduction(dealId: string): Promise<DealProduction> {
  const supabase = await createClient()
  const [rounds, production] = await Promise.all([
    supabase.from('sample_rounds').select('id, round, expected_on, completed_at, shared_at, result, feedback, decided_at').eq('deal_id', dealId).order('round'),
    supabase.from('deal_productions').select('started_on, due_on, transit_days, finished_at').eq('deal_id', dealId).limit(1),
  ])
  if (rounds.error || production.error) throw new Error('Production could not be loaded')
  const p = production.data?.[0]
  return {
    rounds: (rounds.data || []).map(r => ({ id: r.id, round: r.round, expectedOn: r.expected_on, completedAt: r.completed_at, sharedAt: r.shared_at, result: r.result, feedback: r.feedback, decidedAt: r.decided_at })),
    startedOn: p?.started_on || null, dueOn: p?.due_on || null, transitDays: p?.transit_days ?? null, finishedAt: p?.finished_at || null,
  }
}

export async function saveProduction(dealId: string, action: ProductionAction, payload: Record<string, unknown> = {}): Promise<{ error: string | null }> {
  if (!UUID.test(dealId || '')) return { error: '案件が見つかりません' }
  const supabase = await createClient()
  const accessError = await requireSalesAccess(supabase)
  if (accessError) return { error: accessError }
  const { data, error } = await supabase.rpc('save_deal_production', { p_deal_id: dealId, p_action: action, p_payload: payload })
  if (error || !data?.success) return { error: error?.message || '記録できませんでした' }
  revalidatePath(`/deals/${dealId}`); revalidatePath('/deals')
  return { error: null }
}
