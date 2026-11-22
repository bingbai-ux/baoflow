'use server'

// 案件のトーク欄: 顧客・工場とのやり取り（メール・WeChat・電話）を1本の流れで見る。
// 中身は既存の「連絡記録」（deal_communications）をそのまま使う。顧客へのメール送信と、AIによる返信の下書きを足した。

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSalesAccess } from './deal-access'
import { createCommunication } from './communications'
import { defaultIssuerName } from './issuer-companies'
import { askClaude, aiReady, AI_NOT_CONFIGURED } from '@/lib/ai/claude'
import { stageLabel } from '@/lib/process/stages'
import { replyDomain, replyToField } from '@/lib/process/reply-address'
import type { CommChannel, DealCommunication } from '@/lib/types'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CHANNELS: CommChannel[] = ['email', 'wechat', 'phone', 'memo', 'meeting']
export type TalkParty = 'client' | 'factory'
export interface TalkFactory { id: string; name: string; email: string | null; wechat: string | null }
export interface TalkContext { clientEmail: string | null; clientContact: string | null; mailReady: boolean; aiReady: boolean; factories: TalkFactory[]; replyReady: boolean }
const TRANSLATION = /\n?-{3}\s*日本語訳\s*-{3}[\s\S]*$/ // AIの下書きに付く日本語訳（工場へは送らない）

/** トーク欄を開くときに要る情報（顧客の宛先と、メール・AIが使える状態か）。 */
export async function getTalkContext(dealId: string): Promise<TalkContext> {
  const supabase = await createClient()
  const [contact, factories] = await Promise.all([clientContact(supabase, dealId), dealFactories(supabase, dealId)])
  return { clientEmail: contact?.email || null, clientContact: contact?.name || null, mailReady: !!process.env.RESEND_API_KEY && !!process.env.RFQ_MAIL_FROM, aiReady: aiReady(), factories, replyReady: !!replyDomain() }
}

/** この案件で見積をもらっている工場（トーク欄からメールを送れる相手）。 */
async function dealFactories(supabase: Awaited<ReturnType<typeof createClient>>, dealId: string): Promise<TalkFactory[]> {
  const quotes = await supabase.from('deal_quotes').select('factory_id').eq('deal_id', dealId).not('factory_id', 'is', null)
  if (quotes.error) throw new Error('Factories could not be loaded')
  const ids = [...new Set((quotes.data || []).map(q => q.factory_id as string))]
  if (!ids.length) return []
  const rows = await supabase.from('factories').select('id, factory_name, contact_email, wechat').in('id', ids)
  if (rows.error) throw new Error('Factories could not be loaded')
  return (rows.data || []).map(f => ({ id: f.id, name: f.factory_name, email: (f.contact_email || '').trim() || null, wechat: (f.wechat || '').trim() || null })).sort((a, b) => a.name.localeCompare(b.name))
}

async function clientContact(supabase: Awaited<ReturnType<typeof createClient>>, dealId: string): Promise<{ name: string | null; email: string | null } | null> {
  const deal = await supabase.from('deals').select('client_id, contact_id').eq('id', dealId).limit(1)
  if (deal.error) throw new Error('Deal could not be loaded')
  const d = deal.data?.[0]
  if (!d?.client_id) return null
  const contacts = await supabase.from('client_contacts').select('id, name, email, is_primary, created_at').eq('client_id', d.client_id)
  if (contacts.error) throw new Error('Contacts could not be loaded')
  const rows = (contacts.data || []).filter(c => !d.contact_id || c.id === d.contact_id).sort((a, b) => Number(!!b.is_primary) - Number(!!a.is_primary) || String(a.created_at).localeCompare(String(b.created_at)))
  const c = rows[0]
  return c ? { name: c.name, email: (c.email || '').trim() || null } : null
}

/**
 * トークを1件足す。
 * - from 'staff' + send=true: 顧客（または factoryId の工場）へメールで送り、送れたときだけ記録する（送れなかったら何も残さずエラーを返す）
 * - from 'staff' + send=false: 自分が送った・話した内容の記録だけ
 * - from 'client' / 'factory': 相手から受け取った連絡の記録
 */
export async function postTalk(dealId: string, input: { from: 'staff' | TalkParty; party: TalkParty; channel: CommChannel; body: string; subject?: string; send?: boolean; factoryId?: string }): Promise<{ error: string | null; row?: DealCommunication }> {
  if (!UUID.test(dealId || '')) return { error: '案件が見つかりません' }
  const body = (input.body || '').trim()
  if (!body) return { error: '本文を入力してください' }
  if (body.length > 4000) return { error: '本文は4,000文字までです' }
  if (!CHANNELS.includes(input.channel) || !['staff', 'client', 'factory'].includes(input.from) || !['client', 'factory'].includes(input.party)) return { error: '入力を確認してください' }
  const supabase = await createClient()
  const accessError = await requireSalesAccess(supabase)
  if (accessError) return { error: accessError }
  const deal = await supabase.from('deals').select('deal_name, deal_code, client_name_text').eq('id', dealId).limit(1)
  if (deal.error || !deal.data?.[0]) return { error: '案件が見つかりません' }
  let subject = (input.subject || '').trim().slice(0, 200) || null
  let factoryName: string | null = null

  if (input.from === 'staff' && input.send) {
    if (input.channel !== 'email') return { error: 'メールで送るときは、手段をメールにしてください' }
    if (!process.env.RESEND_API_KEY || !process.env.RFQ_MAIL_FROM) return { error: 'メール送信の設定がありません。管理者に連絡してください。' }
    const issuerName = await defaultIssuerName()
    let to: string, text: string
    if (input.party === 'client') {
      const contact = await clientContact(supabase, dealId)
      if (!contact?.email) return { error: '顧客の担当者のメールアドレスが未登録です。取引先の画面で登録してください。' }
      to = contact.email
      subject = subject || `${deal.data[0].deal_name || deal.data[0].deal_code || ''} の件`
      text = `${deal.data[0].client_name_text || ''} ${contact.name || 'ご担当者'} 様\n\n${body}\n\n(bao) ${issuerName}`
    } else {
      // 工場あて: この案件で見積をもらっている工場にだけ送れる。顧客名は件名・本文に入れない（案件番号だけ）
      const factory = (await dealFactories(supabase, dealId)).find(f => f.id === input.factoryId)
      if (!factory) return { error: '送り先の工場を選んでください' }
      if (!factory.email) return { error: `${factory.name} のメールアドレスが未登録です。工場の画面で登録してください。` }
      const cn = body.replace(TRANSLATION, '').trim()
      if (!cn) return { error: '本文を入力してください' }
      to = factory.email
      subject = subject || `[BAO] ${deal.data[0].deal_code || ''}`
      text = `${cn}\n\n(bao) ${issuerName}`
      factoryName = factory.name
    }
    let sent = false
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: process.env.RFQ_MAIL_FROM, to: [to], subject, text, ...replyToField(dealId, input.party) }),
      })
      if (res.ok) { const out = await res.json(); sent = typeof out.id === 'string' && !!out.id }
    } catch { /* 下で送れなかった扱いにする */ }
    if (!sent) return { error: 'メールを送れませんでした。宛先を確認して、もう一度お試しください。' }
  }
  const r = await createCommunication(dealId, { channel: input.channel, author_role: input.from === 'staff' ? 'staff' : input.from, subject: factoryName ? `${factoryName} あて${subject ? `「${subject}」` : ''}` : subject ?? (input.from === 'staff' ? `${input.party === 'client' ? '顧客' : '工場'}あて` : null), body })
  if (r.error || !r.data) return { error: input.send ? `メールは送りましたが、トーク欄に残せませんでした（${r.error || '不明'}）` : r.error || '記録できませんでした' }
  revalidatePath(`/deals/${dealId}`)
  return { error: null, row: r.data }
}

/** これまでのやり取りと案件の状況から、返信の下書きをAIがつくる。送信はしない（下書きを欄に入れるだけ）。 */
export async function draftTalkReply(dealId: string, party: TalkParty, hint: string): Promise<{ error: string | null; draft?: string }> {
  if (!UUID.test(dealId || '') || !['client', 'factory'].includes(party)) return { error: '案件が見つかりません' }
  const supabase = await createClient()
  const accessError = await requireSalesAccess(supabase)
  if (accessError) return { error: accessError }
  if (!aiReady()) return { error: AI_NOT_CONFIGURED }
  const [deal, products, talk] = await Promise.all([
    supabase.from('deals').select('deal_name, deal_code, client_name_text, process_stage, desired_delivery_date').eq('id', dealId).limit(1),
    supabase.from('deal_products').select('description, sort_order').eq('deal_id', dealId).order('sort_order').limit(20),
    supabase.from('deal_communications').select('author_role, channel, subject, body, occurred_at').eq('deal_id', dealId).order('occurred_at', { ascending: false }).limit(20),
  ])
  if (deal.error || products.error || talk.error || !deal.data?.[0]) return { error: '案件の内容を読み込めませんでした' }
  const d = deal.data[0]
  const who = (r: string | null) => r === 'client' ? '顧客' : r === 'factory' ? '工場' : 'BAO'
  // 相手に見せてはいけない内容が混ざらないよう、下書きの相手と BAO のやり取りだけを渡す（顧客あてに工場とのやり取りは渡さない）
  const history = (talk.data || []).filter(t => t.channel !== 'memo' && (t.author_role === party || t.author_role === 'staff' || t.author_role == null)).reverse()
    .map(t => `[${String(t.occurred_at).slice(0, 10)} ${who(t.author_role)}${t.subject ? `「${t.subject}」` : ''}] ${String(t.body).slice(0, 1200)}`).join('\n')
  const system = party === 'client'
    ? 'あなたは包装資材の輸入を扱う (bao) の営業担当です。顧客あての返信の本文だけを、日本語の丁寧なビジネス文で書いてください。宛名・署名・件名は書かないでください（仕組みが付けます）。分からない事実（価格・納期・数量など）を作らず、確認が要る点は「確認のうえご連絡します」と書いてください。原価・工場名・工場とのやり取りには触れないでください。200〜400字。'
    : 'あなたは包装資材の輸入を扱う (bao) の営業担当です。中国の工場あての返信を書いてください。まず簡体字の中国語の本文、その下に「--- 日本語訳 ---」と書いて日本語訳を付けてください。宛名・署名は不要です。分からない事実（価格・納期・数量など）を作らないでください。顧客の社名や販売価格には触れないでください。簡潔に。'
  const content = `案件: ${d.deal_name || ''}（${d.deal_code || ''}）\n今の工程: ${stageLabel(d.process_stage)}\n希望納期: ${d.desired_delivery_date || '未設定'}\n商品: ${(products.data || []).map(p => p.description).filter(Boolean).join(' ／ ') || '未登録'}\n\nこれまでのやり取り（古い順）:\n${history || '（まだありません）'}\n\n営業からの指示: ${hint.trim().slice(0, 500) || '直近の連絡に対する返信を書いてください。'}`
  try { return { error: null, draft: await askClaude({ system, content, maxTokens: 1200 }) } } catch (e) { return { error: e instanceof Error && /AI/.test(e.message) ? e.message : 'AIで下書きをつくれませんでした。時間をおいてもう一度お試しください。' } }
}
