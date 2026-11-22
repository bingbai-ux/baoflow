'use server'

// 再設計 工程6: 入稿（BAO が受け取って相手へ渡す。受け渡しを記録）と、工場への前払いの記録。

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSalesAccess } from './deal-access'
import { getExtension } from '@/lib/utils/file-classify'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const BUCKET = 'deal-images'
const MAX_BYTES = 52428800
export type IntakeStep = 'template_received' | 'template_sent' | 'artwork_received' | 'artwork_sent' | 'factory_ok'
export type IntakeKind = 'template' | 'artwork'
export interface DealIntake {
  pattern: 'customer' | 'template' | null
  done: Record<IntakeStep, string | null>
  prepayRate: number | null; prepayAmountUsd: number | null; prepayPaidOn: string | null; prepayNote: string | null
  startedAt: string | null
}

export async function getDealIntake(dealId: string): Promise<DealIntake> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('deal_intakes')
    .select('pattern, template_received_at, template_sent_at, artwork_received_at, artwork_sent_at, factory_ok_at, prepay_rate, prepay_amount_usd, prepay_paid_on, prepay_note, production_started_at')
    .eq('deal_id', dealId).limit(1)
  if (error) throw new Error('Intake could not be loaded')
  const r = data?.[0]
  return {
    pattern: r?.pattern || null,
    done: { template_received: r?.template_received_at || null, template_sent: r?.template_sent_at || null, artwork_received: r?.artwork_received_at || null, artwork_sent: r?.artwork_sent_at || null, factory_ok: r?.factory_ok_at || null },
    prepayRate: r?.prepay_rate ?? null, prepayAmountUsd: r?.prepay_amount_usd == null ? null : Number(r.prepay_amount_usd), prepayPaidOn: r?.prepay_paid_on || null, prepayNote: r?.prepay_note || null,
    startedAt: r?.production_started_at || null,
  }
}

export async function saveIntake(dealId: string, action: 'pattern' | 'step' | 'prepay_rate' | 'prepay_paid' | 'prepay_unpaid' | 'start', payload: Record<string, unknown> = {}): Promise<{ error: string | null }> {
  if (!UUID.test(dealId || '')) return { error: '案件が見つかりません' }
  const supabase = await createClient()
  const accessError = await requireSalesAccess(supabase)
  if (accessError) return { error: accessError }
  const { data, error } = await supabase.rpc('save_deal_intake', { p_deal_id: dealId, p_action: action, p_payload: payload })
  if (error || !data?.success) return { error: error?.message || '記録できませんでした' }
  revalidatePath(`/deals/${dealId}`); revalidatePath('/deals')
  return { error: null }
}

/** ブラウザから保管場所へ直接アップロードしたファイルを、入稿のファイルとして登録する（大きなファイルを扱うため、本体はこの関数を通さない）。 */
export async function registerIntakeFile(dealId: string, kind: IntakeKind, file: { storagePath: string; name: string; size: number; type: string }): Promise<{ error: string | null }> {
  if (!['template', 'artwork'].includes(kind)) return { error: 'ファイルの種類を確認してください' }
  return registerProcessFile(dealId, `intake_${kind}`, file)
}

/** 工程の作業で使うファイルの登録（入稿: intake_template / intake_artwork、サンプル: sample_r<回> / sample_fix_r<回>、発送: ship_done / ship_pack / ship_label）。 */
export async function registerProcessFile(dealId: string, category: string, file: { storagePath: string; name: string; size: number; type: string }): Promise<{ error: string | null }> {
  if (!UUID.test(dealId || '')) return { error: '案件が見つかりません' }
  if (!/^(intake_(template|artwork)|sample(_fix)?_r[1-9]\d?|ship_(done|pack|label))$/.test(category || '')) return { error: 'ファイルの種類を確認してください' }
  // 保管場所は「案件ID/ランダムな名前」の形だけを受け付ける（他の案件のファイルを登録させない）
  if (typeof file?.storagePath !== 'string' || !new RegExp(`^${dealId}/[0-9a-f-]{36}_[A-Za-z0-9._-]{1,200}$`, 'i').test(file.storagePath)) return { error: 'ファイルの保存先が正しくありません' }
  if (!file.name?.trim() || !Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_BYTES) return { error: 'ファイルを確認してください（50MB まで）' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const accessError = await requireSalesAccess(supabase)
  if (!user || accessError) return { error: accessError || 'ログインし直してください' }
  const { data: versions, error: versionError } = await supabase.from('deal_design_files').select('version_number').eq('deal_id', dealId).order('version_number', { ascending: false }).limit(1)
  if (versionError) return { error: 'ファイルを登録できませんでした。もう一度お試しください' }
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(file.storagePath)
  const { error } = await supabase.from('deal_design_files').insert({
    deal_id: dealId, file_url: publicUrl, storage_path: file.storagePath, file_name: file.name.slice(0, 200), file_type: file.type || null, file_extension: getExtension(file.name) || null,
    file_size_bytes: Math.round(file.size), thumbnail_generated: false, version_number: (versions?.[0]?.version_number || 0) + 1, category, uploaded_by_user_id: user.id,
  })
  if (error) {
    const cleanup = await supabase.storage.from(BUCKET).remove([file.storagePath])
    return { error: cleanup.error ? 'ファイルを登録できず、アップロードの取り消しにも失敗しました。管理者へ確認してください' : 'ファイルを登録できませんでした。もう一度お試しください' }
  }
  revalidatePath(`/deals/${dealId}`)
  return { error: null }
}
