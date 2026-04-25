'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const BUCKET = 'deal-images'

export interface DesignFileRow {
  id: string
  deal_id: string
  file_url: string
  storage_path: string | null
  file_name: string | null
  file_type: string | null
  comment: string | null
  category: string | null
  created_at: string
}

export async function listDesignFiles(dealId: string): Promise<DesignFileRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('deal_design_files')
    .select('id, deal_id, file_url, storage_path, file_name, file_type, comment, category, created_at')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false })
  return (data || []) as DesignFileRow[]
}

export async function uploadDesignImage(
  dealId: string,
  file: File,
  comment?: string | null,
  category?: string | null
): Promise<{ data: DesignFileRow | null; error: string | null }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Unauthorized' }

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (file.type && !allowed.includes(file.type)) {
    return { data: null, error: '対応形式: JPEG / PNG / WebP / GIF' }
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${dealId}/${Date.now()}_${safeName}`
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (uploadError) {
    return { data: null, error: `Storage エラー: ${uploadError.message}` }
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)

  // version_number は NOT NULL なので max+1 を計算
  const { data: existing } = await supabase
    .from('deal_design_files')
    .select('version_number')
    .eq('deal_id', dealId)
    .order('version_number', { ascending: false })
    .limit(1)
  const nextVersion = existing && existing.length > 0 ? (existing[0].version_number || 0) + 1 : 1

  const { data: row, error: insertError } = await supabase
    .from('deal_design_files')
    .insert({
      deal_id: dealId,
      file_url: publicUrl,
      storage_path: storagePath,
      file_name: file.name,
      file_type: file.type || null,
      version_number: nextVersion,
      comment: comment?.trim() || null,
      category: category || null,
      uploaded_by_user_id: user.id,
    })
    .select('id, deal_id, file_url, storage_path, file_name, file_type, comment, category, created_at')
    .single()

  if (insertError) {
    // ロールバック: Storage から消す
    await supabase.storage.from(BUCKET).remove([storagePath])
    return { data: null, error: insertError.message }
  }

  revalidatePath(`/deals/${dealId}`)
  revalidatePath(`/deals/${dealId}/designs`)
  return { data: row as DesignFileRow, error: null }
}

export async function deleteDesignImage(
  fileId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('deal_design_files')
    .select('id, deal_id, storage_path')
    .eq('id', fileId)
    .single()

  if (!existing) return { success: false, error: '対象が見つかりません' }

  if (existing.storage_path) {
    await supabase.storage.from(BUCKET).remove([existing.storage_path])
  }

  const { error } = await supabase.from('deal_design_files').delete().eq('id', fileId)
  if (error) return { success: false, error: error.message }

  revalidatePath(`/deals/${existing.deal_id}`)
  revalidatePath(`/deals/${existing.deal_id}/designs`)
  return { success: true }
}

export async function updateDesignComment(
  fileId: string,
  comment: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const trimmed = comment.trim().slice(0, 300)

  const { data, error } = await supabase
    .from('deal_design_files')
    .update({ comment: trimmed || null })
    .eq('id', fileId)
    .select('deal_id')
    .single()

  if (error) return { success: false, error: error.message }
  if (data?.deal_id) {
    revalidatePath(`/deals/${data.deal_id}`)
    revalidatePath(`/deals/${data.deal_id}/designs`)
  }
  return { success: true }
}

export async function updateDesignCategory(
  fileId: string,
  category: string | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('deal_design_files')
    .update({ category: category || null })
    .eq('id', fileId)
    .select('deal_id')
    .single()
  if (error) return { success: false, error: error.message }
  if (data?.deal_id) {
    revalidatePath(`/deals/${data.deal_id}`)
    revalidatePath(`/deals/${data.deal_id}/designs`)
  }
  return { success: true }
}
