// Pure types for user_preferences action. Kept outside the 'use server' file
// so client components can import them without confusing the RSC bundler.

export interface UserPreferencesPayload {
  deals_table_column_widths: Record<string, number>
  deals_table_visible_columns: string[] | null
  pinned_deal_ids: string[]
}
