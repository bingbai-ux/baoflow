'use server'

// 再設計 工程1: プロジェクト作成と工程変更。
// どちらもDB関数（create_project_v1 / set_process_stage）経由で、変更と履歴を一緒に残す。

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSalesAccess } from './deal-access'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/

export interface CreateProjectInput {
  request_id: string
  client_id: string
  contact_id?: string | null
  brand_id?: string | null
  deal_name?: string | null
  desired_delivery_date?: string | null
}

/** rejected=true は「DBがはっきり断った（何も保存されていない）」場合だけ。通信の失敗などは false のままにして、同じ要求IDでの再試行に任せる。 */
export async function createProject(input: CreateProjectInput): Promise<{ dealId: string | null; dealCode?: string; error: string | null; rejected?: boolean }> {
  if (!UUID.test(input.request_id || '')) return { dealId: null, error: '保存要求を作成できませんでした。画面を読み直してください' }
  if (!UUID.test(input.client_id || '')) return { dealId: null, error: '取引先を選んでください' }
  if (input.desired_delivery_date && !DATE.test(input.desired_delivery_date)) return { dealId: null, error: '希望納期の日付を確認してください' }
  const supabase = await createClient()
  const accessError = await requireSalesAccess(supabase)
  if (accessError) return { dealId: null, error: accessError }
  const payload = {
    client_id: input.client_id,
    contact_id: input.contact_id || null,
    brand_id: input.brand_id || null,
    deal_name: input.deal_name?.trim() || null,
    desired_delivery_date: input.desired_delivery_date || null,
  }
  const { data, error } = await supabase.rpc('create_project_v1', { p_request_id: input.request_id, p_payload: payload })
  if (error) return { dealId: null, rejected: /^(P0001|22[0-9A-Z]{3}|23[0-9A-Z]{3}|42501)$/.test(error.code || ''), error: error.code === 'PGRST202' ? 'プロジェクト作成のDB準備ができていません。管理者に連絡してください。保存されていません。' : error.message }
  if (!data?.success || !data.dealId) return { dealId: null, error: '保存を確認できませんでした。同じ内容でもう一度お試しください' }
  revalidatePath('/deals')
  revalidatePath('/clients')
  return { dealId: data.dealId as string, dealCode: data.dealCode as string, error: null }
}

export async function setProcessStage(dealId: string, stage: number): Promise<{ success: boolean; error?: string }> {
  if (!UUID.test(dealId || '') || !Number.isInteger(stage) || stage < 1 || stage > 9) return { success: false, error: '工程を選び直してください' }
  const supabase = await createClient()
  const accessError = await requireSalesAccess(supabase)
  if (accessError) return { success: false, error: accessError }
  const { data, error } = await supabase.rpc('set_process_stage', { p_deal_id: dealId, p_stage: stage })
  if (error) return { success: false, error: error.message }
  if (!data?.success) return { success: false, error: '工程の変更を確認できませんでした' }
  revalidatePath('/deals')
  revalidatePath(`/deals/${dealId}`)
  return { success: true }
}
