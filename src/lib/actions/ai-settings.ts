'use server'

// 設定 > AIの使い分け: 返信の下書き・カタログの読み取りで使うAIを選ぶ。

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSalesAccess } from './deal-access'
import { loadAiModels } from '@/lib/ai/claude'
import { AI_MODEL_CHOICES, type AiModels } from '@/lib/ai/models'

export async function getAiModels(): Promise<AiModels> { return loadAiModels(await createClient()) }

export async function saveAiModels(input: AiModels): Promise<{ error: string | null }> {
  const ids: string[] = AI_MODEL_CHOICES.map(c => c.id)
  if (!ids.includes(input?.draft) || !ids.includes(input?.catalog)) return { error: 'AIの種類を選んでください' }
  const supabase = await createClient()
  const accessError = await requireSalesAccess(supabase)
  if (accessError) return { error: accessError }
  const { error } = await supabase.rpc('save_ai_settings', { p_draft_model: input.draft, p_catalog_model: input.catalog })
  if (error) return { error: error.message || '保存できませんでした' }
  revalidatePath('/settings/ai')
  return { error: null }
}
