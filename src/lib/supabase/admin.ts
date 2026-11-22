import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// 管理用の鍵（SUPABASE_SERVICE_ROLE_KEY）でつなぐ。ログインしている人がいない処理（届いたメールの受信口）だけで使う。
// 画面やふつうの操作からは使わない。鍵が無いときは null を返す（呼ぶ側が理由を返して止まる）。
export function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
