import { createHmac, timingSafeEqual } from 'node:crypto'

// 返信専用アドレス: 送るメールの「返信先」を案件ごとのアドレスにして、相手の返信を案件のトーク欄へ自動で入れる。
// 形: c-<案件IDの32文字>@<返信用ドメイン>（顧客）/ f-<案件IDの32文字>@<返信用ドメイン>（工場）
// 返信用ドメイン（MAIL_REPLY_DOMAIN）が未設定なら、返信先は付けない（これまでどおり送信元へ返信が届く）。

export type ReplyParty = 'client' | 'factory'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const replyDomain = (): string | null => { const d = (process.env.MAIL_REPLY_DOMAIN || '').trim().toLowerCase(); return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d) ? d : null }

export function replyAddress(dealId: string, party: ReplyParty): string | null {
  const domain = replyDomain()
  if (!domain || !UUID.test(dealId)) return null
  return `${party === 'client' ? 'c' : 'f'}-${dealId.replace(/-/g, '').toLowerCase()}@${domain}`
}
/** Resend へ渡す本体に足す（返信用ドメインが未設定なら何も足さない）。 */
export const replyToField = (dealId: string, party: ReplyParty): { reply_to?: string } => { const a = replyAddress(dealId, party); return a ? { reply_to: a } : {} }

/** 宛先（"名前 <a@b>" の形も可）から、案件と相手を読み取る。うちの返信用アドレスでなければ null。 */
export function parseReplyAddress(raw: string): { dealId: string; party: ReplyParty } | null {
  const domain = replyDomain()
  if (!domain || typeof raw !== 'string') return null
  const addr = (/<([^<>]+)>/.exec(raw)?.[1] || raw).trim().toLowerCase()
  const m = /^([cf])-([0-9a-f]{32})@(.+)$/.exec(addr)
  if (!m || m[3] !== domain) return null
  const h = m[2]
  return { dealId: `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`, party: m[1] === 'c' ? 'client' : 'factory' }
}

/** 返信メールの本文から、下に付いている「前のメールの引用」を落とす。HTML しか無いときはタグを外す。 */
export function cleanInboundBody(text: string | null | undefined, html: string | null | undefined): string {
  let body = (text || '').replace(/\r\n?/g, '\n')
  if (!body.trim() && html) {
    body = html.replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, '').replace(/<blockquote[\s\S]*$/i, '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n').replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
  }
  const lines = body.split('\n')
  const marker = lines.findIndex(l => /^\s*(-{2,}\s*(Original Message|元のメッセージ|原始邮件|转发的邮件).*|.{0,120}(wrote|書きました|のメッセージ|写道)[:：]\s*$|(From|差出人|发件人|送信者)\s*[:：].*)$/i.test(l))
  let kept = marker > 0 ? lines.slice(0, marker) : lines
  const before = kept.length
  while (kept.length && (/^\s*>/.test(kept[kept.length - 1]) || !kept[kept.length - 1].trim())) kept = kept.slice(0, -1)
  // 引用のすぐ上にある「2026年11月20日 10:00 BAO <a@b>:」のような見出し行も落とす
  if (kept.length < before && kept.length > 1 && /(@|\d{4}).*[:：]\s*$/.test(kept[kept.length - 1])) kept = kept.slice(0, -1)
  kept = kept.filter(l => !/^\s*>/.test(l))
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 8000)
}

/** 受信口に届いた知らせが本物（Resend から）かを確かめる。署名は Svix 方式（id.時刻.本文 を HMAC-SHA256）。 */
export function verifyWebhook(secret: string, headers: { id: string | null; timestamp: string | null; signature: string | null }, payload: string, nowMs = Date.now()): boolean {
  if (!secret || !headers.id || !headers.timestamp || !headers.signature) return false
  const ts = Number(headers.timestamp)
  if (!Number.isFinite(ts) || Math.abs(nowMs / 1000 - ts) > 300) return false // 5分より古い・先の知らせは受けない
  let key: Buffer
  try { key = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64') } catch { return false }
  if (!key.length) return false
  const expected = createHmac('sha256', key).update(`${headers.id}.${headers.timestamp}.${payload}`).digest()
  return headers.signature.split(' ').some(part => {
    const [version, value] = part.split(',')
    if (version !== 'v1' || !value) return false
    const got = Buffer.from(value, 'base64')
    return got.length === expected.length && timingSafeEqual(got, expected)
  })
}
