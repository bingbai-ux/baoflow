// 工程の作業で使うファイルを、ブラウザから保管場所へ直接アップロードして登録する（大きなファイルをサーバー経由にしないため）。
import { createClient } from '@/lib/supabase/client'
import { registerProcessFile } from '@/lib/actions/deal-intake'

export const PROCESS_FILE_MAX_BYTES = 52428800

/** 失敗したら例外（どのファイルで失敗したかをメッセージに入れる）。途中まで成功した分は登録済みのまま残る。 */
export async function uploadProcessFiles(dealId: string, category: string, files: File[]): Promise<number> {
  const supabase = createClient()
  for (const file of files) {
    if (file.size > PROCESS_FILE_MAX_BYTES) throw new Error(`${file.name}: ファイルが大きすぎます（50MB まで）`)
    if (file.size === 0) throw new Error(`${file.name}: 空のファイルです`)
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'file'
    const storagePath = `${dealId}/${crypto.randomUUID()}_${safe}`
    const up = await supabase.storage.from('deal-images').upload(storagePath, file, { cacheControl: '3600', upsert: false })
    if (up.error) throw new Error(`${file.name}: アップロードできませんでした`)
    const r = await registerProcessFile(dealId, category, { storagePath, name: file.name, size: file.size, type: file.type })
    if (r.error) throw new Error(`${file.name}: ${r.error}`)
  }
  return files.length
}
