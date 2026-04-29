'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { classifyFile, getExtension, type FileType } from '@/lib/utils/file-classify'

const BUCKET = 'deal-images'  // Sprint 7-4-2-A: bucket は引き続き 'deal-images'。
                              // migration 028 で MIME 制限解除 + 50MB に拡張済み。

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
  // Sprint 7-4-2-A (migration 027 で追加): 添付ファイルメタデータ
  file_extension: string | null
  file_size_bytes: number | null
  thumbnail_generated: boolean
  // Sprint 7-4-2-A: classifyFile() で計算したカテゴリ (DB 列ではなく派生値、一覧で使う)
  file_category: FileType
}

export async function listDesignFiles(dealId: string): Promise<DesignFileRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('deal_design_files')
    .select(
      'id, deal_id, file_url, storage_path, file_name, file_type, comment, category, created_at, file_extension, file_size_bytes, thumbnail_generated'
    )
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false })
  // file_category を派生フィールドとして付加
  return (data || []).map((r) => ({
    ...r,
    file_category: classifyFile(r.file_extension as string | null),
  })) as DesignFileRow[]
}

/**
 * Sprint 7-4-2-A (§0.5-1): 全形式 attachment アップロード。
 *
 * 旧 uploadDesignImage は image のみ受け付けていた。今は MIME 制限なし
 * (migration 028 でバケット側が NULL = 全許可)、拡張子から file_category
 * (image / pdf / zip / design / document / other) を判定して保存。
 *
 * 保存される追加メタデータ (migration 027 で追加されたカラム):
 *   - file_extension: 'jpg' / 'pdf' / 'zip' 等 (lowercase)
 *   - file_size_bytes: file.size
 *   - thumbnail_generated: false (Sprint 7-4-2-B で PDF サムネ生成が入った時に true)
 */
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

  // Sprint 7-4-2-A: MIME による事前 reject は削除。サイズだけクライアント側で簡易チェック。
  // 50MB 超は migration 028 でバケット側が拒否する (Storage エラー)。
  if (file.size > 52428800) {
    return { data: null, error: 'ファイルサイズが大きすぎます (上限 50 MB)' }
  }

  const ext = getExtension(file.name)
  const fileCategory = classifyFile(ext)

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
      file_type: file.type || null,                  // 元の MIME 型 (例 'application/pdf')
      file_extension: ext || null,                   // 拡張子 (例 'pdf')
      file_size_bytes: file.size,
      thumbnail_generated: false,                    // Sprint 7-4-2-B で PDF サムネ実装後に更新
      version_number: nextVersion,
      comment: comment?.trim() || null,
      category: category || null,
      uploaded_by_user_id: user.id,
    })
    .select(
      'id, deal_id, file_url, storage_path, file_name, file_type, comment, category, created_at, file_extension, file_size_bytes, thumbnail_generated'
    )
    .single()

  if (insertError) {
    // ロールバック: Storage から消す
    await supabase.storage.from(BUCKET).remove([storagePath])
    return { data: null, error: insertError.message }
  }

  revalidatePath(`/deals/${dealId}`)
  revalidatePath(`/deals/${dealId}/designs`)
  return {
    data: { ...(row as Record<string, unknown>), file_category: fileCategory } as DesignFileRow,
    error: null,
  }
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
