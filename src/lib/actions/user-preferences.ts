'use server'

// Sprint 7-3-3 (仕様書 §2-1, §2-5): user_preferences テーブル経由の表示設定保存。
// migration 027 で作成済 (RLS auth.uid() = user_id)。

import { createClient } from '@/lib/supabase/server'
import type { UserPreferencesPayload } from './user-preferences-types'

export async function getUserPreferences(): Promise<UserPreferencesPayload | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('user_preferences')
    .select('deals_table_column_widths, deals_table_visible_columns, pinned_deal_ids')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!data) {
    return {
      deals_table_column_widths: {},
      deals_table_visible_columns: null,
      pinned_deal_ids: [],
    }
  }

  return {
    deals_table_column_widths:
      (data.deals_table_column_widths as Record<string, number>) || {},
    deals_table_visible_columns:
      (data.deals_table_visible_columns as string[] | null) || null,
    pinned_deal_ids: (data.pinned_deal_ids as string[]) || [],
  }
}

/**
 * 列幅の upsert。Sprint 7-3-3 ではこれだけ使う。
 * 列の表示/非表示 (deals_table_visible_columns) や pinned_deal_ids は
 * Sprint 7-3 のスコープ外なので触らない。
 */
export async function setDealsTableColumnWidths(
  widths: Record<string, number>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { error } = await supabase
    .from('user_preferences')
    .upsert(
      {
        user_id: user.id,
        deals_table_column_widths: widths,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (error) return { success: false, error: error.message }
  return { success: true }
}
