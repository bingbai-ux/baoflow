import type { SupabaseClient } from '@supabase/supabase-js'

// 仕組みから顧客へ送ったメール（確認依頼・お見積・請求書・発送・受領の確認）を、案件のトーク欄に自動で残す。
// 残せなかったときも、メール送信そのものは成功しているので処理は止めない（戻り値で分かるようにする）。

export async function logSentMail(supabase: SupabaseClient, dealId: string, subject: string, body: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('deal_communications').insert({
    deal_id: dealId, author_user_id: user?.id || null, author_role: 'staff', channel: 'email', subject: subject.slice(0, 200), body: body.slice(0, 4000), occurred_at: new Date().toISOString(),
  })
  if (error) console.error('[talk-log] 送信メールをトーク欄に残せませんでした', error.message)
  return !error
}
