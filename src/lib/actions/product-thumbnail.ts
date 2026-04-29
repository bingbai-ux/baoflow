'use server'

// Sprint 7-4-2-A: 商品サムネイル (deal_products.thumbnail_url) のアップロード/設定。
// スプレッド表の画像列で「クリック → ファイル選択 → サムネ即表示」の動線。
//
// MIME 制限なし (migration 028)、サイズは 50 MB 上限。
// 商品サムネは画像形式のみを推奨 (image/*) — 拡張子で軽くチェック。

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { classifyFile, getExtension } from '@/lib/utils/file-classify'

const BUCKET = 'deal-images'

export async function uploadProductThumbnail(
  productId: string,
  file: File
): Promise<{ url: string | null; error: string | null }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { url: null, error: 'Unauthorized' }

  if (file.size > 52428800) {
    return { url: null, error: 'ファイルサイズが大きすぎます (上限 50 MB)' }
  }

  const ext = getExtension(file.name)
  const cat = classifyFile(ext)
  if (cat !== 'image') {
    return {
      url: null,
      error: '商品サムネイルは画像形式 (jpg / png / webp / gif 等) のみ対応',
    }
  }

  // 既存サムネを削除して入れ替え
  const { data: prod } = await supabase
    .from('deal_products')
    .select('deal_id, thumbnail_url')
    .eq('id', productId)
    .single()
  if (!prod) return { url: null, error: '商品が見つかりません' }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${prod.deal_id}/thumb_${productId}_${Date.now()}_${safeName}`

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (uploadError) return { url: null, error: `Storage エラー: ${uploadError.message}` }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)

  const { error: updError } = await supabase
    .from('deal_products')
    .update({ thumbnail_url: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', productId)

  if (updError) {
    await supabase.storage.from(BUCKET).remove([storagePath])
    return { url: null, error: updError.message }
  }

  // 旧サムネを Storage から削除 (ベストエフォート、エラーは無視)
  if (prod.thumbnail_url) {
    const m = String(prod.thumbnail_url).match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/)
    if (m) {
      void supabase.storage.from(BUCKET).remove([m[1]]).catch(() => {})
    }
  }

  revalidatePath('/deals')
  revalidatePath(`/deals/${prod.deal_id}`)
  return { url: publicUrl, error: null }
}

export async function clearProductThumbnail(
  productId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: prod } = await supabase
    .from('deal_products')
    .select('deal_id, thumbnail_url')
    .eq('id', productId)
    .single()
  if (!prod) return { success: false, error: '商品が見つかりません' }

  if (prod.thumbnail_url) {
    const m = String(prod.thumbnail_url).match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/)
    if (m) {
      void supabase.storage.from(BUCKET).remove([m[1]]).catch(() => {})
    }
  }

  const { error } = await supabase
    .from('deal_products')
    .update({ thumbnail_url: null, updated_at: new Date().toISOString() })
    .eq('id', productId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/deals')
  revalidatePath(`/deals/${prod.deal_id}`)
  return { success: true }
}
