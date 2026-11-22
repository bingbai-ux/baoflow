import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { cleanInboundBody, parseReplyAddress, replyDomain, verifyWebhook } from '@/lib/process/reply-address'

// 届いたメールの受信口。メール配信サービス（Resend）が、返信用アドレスにメールが届くたびにここを呼ぶ。
// 流れ: 本物の知らせか確かめる → 宛先から案件と相手を読む → 本文を取りに行く → トーク欄に入れる → 添付を案件のファイルに保存。
// 設定が欠けているとき・途中で失敗したときは、成功を装わずエラーを返す（Resend が後でもう一度知らせてくれる）。

export const dynamic = 'force-dynamic'
export const maxDuration = 60
const API = () => (process.env.RESEND_API_BASE || 'https://api.resend.com').replace(/\/$/, '')
const MAX_FILES = 10, MAX_BYTES = 26214400 // 添付は10件・1件25MBまで保存する
const json = (body: object, status = 200) => NextResponse.json(body, { status })
const list = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : typeof v === 'string' ? [v] : []

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET, apiKey = process.env.RESEND_API_KEY, admin = createAdminClient()
  if (!secret || !apiKey || !admin || !replyDomain()) return json({ error: 'メール受信の設定がありません' }, 503)
  const payload = await request.text()
  const ok = verifyWebhook(secret, { id: request.headers.get('svix-id'), timestamp: request.headers.get('svix-timestamp'), signature: request.headers.get('svix-signature') }, payload)
  if (!ok) return json({ error: '署名を確認できませんでした' }, 401)
  let event: { type?: string; data?: Record<string, unknown> }
  try { event = JSON.parse(payload) } catch { return json({ error: '内容を読めませんでした' }, 400) }
  if (event.type !== 'email.received' || !event.data) return json({ ignored: 'not_email_received' })
  const data = event.data, emailId = typeof data.email_id === 'string' ? data.email_id : ''
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(emailId)) return json({ error: 'メールの番号がありません' }, 400)
  const recipients = [...list(data.to), ...list(data.received_for), ...list(data.cc)]
  const hit = recipients.map(r => ({ raw: r, parsed: parseReplyAddress(r) })).find(x => x.parsed)
  if (!hit?.parsed) return json({ ignored: 'not_reply_address' }) // うちの返信用アドレスあてでないメールは取り込まない

  // 知らせには本文が入っていないので、取りに行く
  const headers = { Authorization: `Bearer ${apiKey}` }
  const mailRes = await fetch(`${API()}/emails/receiving/${emailId}`, { headers }).catch(() => null)
  if (!mailRes?.ok) return json({ error: 'メールの本文を取得できませんでした' }, 502)
  const mail = await mailRes.json().catch(() => null) as { text?: string | null; html?: string | null; subject?: string | null; from?: string | null } | null
  if (!mail) return json({ error: 'メールの本文を読めませんでした' }, 502)
  const meta = Array.isArray(data.attachments) ? (data.attachments as Array<Record<string, unknown>>).filter(a => a && a.content_disposition !== 'inline') : []
  const from = typeof data.from === 'string' ? data.from : mail.from || ''
  const subject = typeof data.subject === 'string' ? data.subject : mail.subject || ''

  const rec = await admin.rpc('record_inbound_mail', {
    p_email_id: emailId, p_deal_id: hit.parsed.dealId, p_party: hit.parsed.party, p_from: from, p_to: hit.raw, p_subject: subject,
    p_body: cleanInboundBody(mail.text, mail.html), p_attachments: meta.map(a => ({ name: String(a.filename || 'file'), type: String(a.content_type || '') })),
  })
  if (rec.error) { console.error('[inbound-mail] トーク欄に入れられませんでした', rec.error.message); return json({ error: 'トーク欄に入れられませんでした' }, 500) }
  const out = rec.data as { success?: boolean; already?: boolean; reason?: string } | null
  if (!out?.success) return json({ ignored: out?.reason || 'not_recorded' }) // 案件が無い（消された）ときは取り込まない
  if (!meta.length) return json({ ok: true, already: !!out.already })
  if (out.already) { // 2回目の知らせ: 添付の保存まで済んでいれば何もしない（前回、添付の途中で失敗していたら続きをやる）
    const prev = await admin.from('inbound_mails').select('attachments').eq('email_id', emailId).limit(1)
    if (prev.error) return json({ error: '取り込み済みのメールを確認できませんでした' }, 500)
    const done = ((prev.data?.[0]?.attachments || []) as Array<Record<string, unknown>>).some(a => 'saved' in a)
    if (done) return json({ ok: true, already: true })
  }

  // 添付を案件のファイルに保存する。保存できなかったものは、トークの本文に書き足される
  const listRes = await fetch(`${API()}/emails/receiving/${emailId}/attachments`, { headers }).catch(() => null)
  const listed = listRes?.ok ? ((await listRes.json().catch(() => null)) as { data?: Array<{ filename?: string; content_type?: string; size?: number; download_url?: string; content_disposition?: string }> } | null)?.data || [] : null
  const files: Array<{ name: string; type: string; size: number | null; storage_path: string | null; url: string | null; saved: boolean }> = []
  for (const [i, a] of (listed || meta.map(m => ({ filename: String(m.filename || 'file'), content_type: String(m.content_type || '') }) as { filename?: string; content_type?: string; size?: number; download_url?: string; content_disposition?: string })).filter(a => a.content_disposition !== 'inline').entries()) {
    const name = a.filename || 'file', type = a.content_type || 'application/octet-stream'
    const failed = { name, type, size: a.size ?? null, storage_path: null, url: null, saved: false }
    if (i >= MAX_FILES || !a.download_url || (a.size ?? 0) > MAX_BYTES) { files.push(failed); continue }
    try {
      const bin = await fetch(a.download_url)
      if (!bin.ok) throw new Error('download')
      const bytes = Buffer.from(await bin.arrayBuffer())
      if (!bytes.length || bytes.length > MAX_BYTES) throw new Error('size')
      const storagePath = `${hit.parsed.dealId}/${randomUUID()}_${name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'file'}`
      const up = await admin.storage.from('deal-images').upload(storagePath, bytes, { contentType: type, upsert: false })
      if (up.error) throw new Error('upload')
      files.push({ name, type, size: bytes.length, storage_path: storagePath, url: admin.storage.from('deal-images').getPublicUrl(storagePath).data.publicUrl, saved: true })
    } catch { files.push(failed) }
  }
  const reg = await admin.rpc('add_inbound_mail_files', { p_email_id: emailId, p_files: files })
  if (reg.error) { console.error('[inbound-mail] 添付を登録できませんでした', reg.error.message); return json({ error: '添付を登録できませんでした' }, 500) }
  return json({ ok: true, files: files.filter(f => f.saved).length, failed: files.filter(f => !f.saved).length })
}
