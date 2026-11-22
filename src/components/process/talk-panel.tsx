'use client'

// 案件のトーク欄: 顧客・工場とのやり取りを吹き出しで並べ、返信の下書き（AI）・顧客へのメール送信・受け取った連絡の記録をここで行う。

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { draftTalkReply, postTalk, type TalkContext, type TalkParty } from '@/lib/actions/deal-talk'
import type { CommChannel, DealCommunication } from '@/lib/types'
import { useUi } from '@/components/ui/ui-store'

const ghost = 'min-h-[44px] inline-flex items-center justify-center rounded-full border border-[#E2E1DA] bg-white px-3 text-[12px] font-bold text-[#351E28] hover:bg-[#FBFAF6] disabled:opacity-40'
const dark = 'min-h-[44px] inline-flex items-center justify-center rounded-full bg-[#351E28] px-4 text-[12px] font-bold text-[#C9A2B8] hover:brightness-95 disabled:opacity-40'
const seg = (on: boolean) => 'min-h-[44px] flex-1 rounded-full border px-2 text-[12px] font-bold ' + (on ? 'border-[#351E28] bg-[#351E28] text-[#C9A2B8]' : 'border-[#E2E1DA] bg-white text-[#351E28]')
const field = 'w-full min-h-[44px] rounded-[12px] border border-transparent bg-[#EFEFEA] px-3 text-[13px] text-[#351E28] outline-none focus:border-[#351E28]'
const CHANNEL: Record<CommChannel, string> = { email: 'メール', wechat: 'WeChat', phone: '電話', memo: '社内メモ', meeting: '打合せ' }
const when = (iso: string) => new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

export function TalkPanel({ dealId, talks, context }: { dealId: string; talks: DealCommunication[]; context: TalkContext }) {
  const router = useRouter()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const [drafting, setDrafting] = useState(false)
  const [party, setParty] = useState<TalkParty>('client')
  const [mode, setMode] = useState<'out' | 'in'>('out') // out: こちらから / in: 相手から受け取った連絡を記録
  const [channel, setChannel] = useState<CommChannel>('email')
  const [body, setBody] = useState('')
  const [hint, setHint] = useState('')
  const [factoryId, setFactoryId] = useState(context.factories[0]?.id || '')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const list = [...talks].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }) }, [list.length])

  const factory = context.factories.find(f => f.id === factoryId) || null
  const canMail = mode === 'out' && channel === 'email'
  const mailTo = party === 'client' ? context.clientEmail : factory?.email || null
  // 工場あての下書きは「中国語 → --- 日本語訳 ---」の形。工場へ渡すのは中国語の部分だけ
  const forFactory = body.replace(/\n?-{3}\s*日本語訳\s*-{3}[\s\S]*$/, '').trim()
  const copy = async () => { setError(null); try { await navigator.clipboard.writeText(forFactory); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { setError('コピーできませんでした。本文を選んでコピーしてください。') } }
  const submit = (send: boolean) => { setError(null); startTransition(async () => {
    const r = await postTalk(dealId, { from: mode === 'out' ? 'staff' : party, party, channel, body, send, factoryId: party === 'factory' ? factoryId : undefined })
    if (r.error) { setError(r.error); return }
    setBody(''); setHint(''); toast(send ? 'メールを送りました' : '記録しました'); router.refresh()
  }) }
  const draft = async () => {
    setError(null); setDrafting(true)
    try { const r = await draftTalkReply(dealId, party, hint); if (r.error) setError(r.error); else if (r.draft) { setBody(r.draft); setMode('out') } }
    catch { setError('AIで下書きをつくれませんでした。時間をおいてもう一度お試しください。') } finally { setDrafting(false) }
  }

  return (
    <section aria-label="トーク" className="min-w-0">
      <h2 className="text-[15px] font-bold">トーク <span className="text-[12.5px] font-normal text-[#84787D] tabular-nums">{list.length}件</span></h2>
      <ol aria-label="やり取り" className="mt-2 max-h-[420px] space-y-2 overflow-y-auto rounded-[12px] bg-[#EFEFEA] p-2">
        {list.map(t => {
          const mine = t.author_role === 'staff' || t.author_role == null, memo = t.channel === 'memo'
          return (
            <li key={t.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[88%] rounded-[16px] px-3 py-2 text-[12.5px] ${memo ? 'border border-[#E2E1DA] bg-[#FBFAF6]' : mine ? 'bg-[#D7EFFF] text-[#33566F]' : 'border border-[#E2E1DA] bg-white'}`}>
                <p className="text-[11px] tabular-nums opacity-80">{mine ? 'BAO' : t.author_role === 'client' ? '顧客' : '工場'} ・ {CHANNEL[t.channel] || t.channel} ・ {when(t.occurred_at)}</p>
                {t.subject && <p className="break-words font-bold">{t.subject}</p>}
                <p className="whitespace-pre-wrap break-words">{t.body}</p>
              </div>
            </li>
          )
        })}
        {!list.length && <li className="py-6 text-center text-[12.5px] text-[#84787D]">やり取りはまだありません</li>}
        <div ref={end} />
      </ol>

      {error && <p role="alert" className="mt-2 rounded-[16px] border-[1.5px] border-[#FF5C34] bg-[#FFD8C2] p-3 text-[12.5px] text-[#B03616] break-words">{error}</p>}
      <div className="mt-2 space-y-2">
        <div role="group" aria-label="相手" className="flex gap-1">
          <button type="button" aria-pressed={party === 'client'} className={seg(party === 'client')} onClick={() => setParty('client')}>顧客</button>
          <button type="button" aria-pressed={party === 'factory'} className={seg(party === 'factory')} onClick={() => { setParty('factory'); if (channel === 'email' && !context.factories.some(f => f.email)) setChannel('wechat') }}>工場</button>
        </div>
        <div role="group" aria-label="記録の向き" className="flex gap-1">
          <button type="button" aria-pressed={mode === 'out'} className={seg(mode === 'out')} onClick={() => setMode('out')}>こちらから</button>
          <button type="button" aria-pressed={mode === 'in'} className={seg(mode === 'in')} onClick={() => setMode('in')}>相手から届いた</button>
        </div>
        <label className="block text-[11px] text-[#84787D]">手段
          <select value={channel} onChange={e => setChannel(e.target.value as CommChannel)} className={field}>{(['email', 'wechat', 'phone', 'meeting', 'memo'] as CommChannel[]).map(c => <option key={c} value={c}>{CHANNEL[c]}</option>)}</select></label>
        <label className="block text-[11px] text-[#84787D]">本文
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={5} maxLength={4000} className={field + ' py-2'} /></label>
        {party === 'factory' && mode === 'out' && context.factories.length > 1 && <label className="block text-[11px] text-[#84787D]">送り先の工場
          <select value={factoryId} onChange={e => setFactoryId(e.target.value)} className={field}>{context.factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>}
        {canMail && party === 'client' && <p className="break-all text-[11px] text-[#84787D]">宛先: {context.clientEmail ? `${context.clientContact || '担当者'} <${context.clientEmail}>` : '担当者のメールアドレスが未登録'}</p>}
        {canMail && party === 'factory' && <p className="break-all text-[11px] text-[#84787D]">宛先: {!factory ? 'この案件で見積をもらっている工場がありません' : factory.email ? `${factory.name} <${factory.email}>（中国語の部分だけ送ります）` : `${factory.name} のメールアドレスが未登録`}</p>}
        {canMail && <p className="text-[11px] text-[#84787D]">{context.replyReady ? '相手がこのメールに返信すると、ここに自動で入ります' : '返信の自動取り込みは未設定です（届いた返信は「相手から届いた」で記録してください）'}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" disabled={pending || !body.trim()} className={ghost} onClick={() => submit(false)}>記録する</button>
          {party === 'factory' && mode === 'out' && channel === 'wechat' && <button type="button" disabled={!forFactory} className={ghost} onClick={copy}>{copied ? 'コピーしました' : '中国語の部分をコピー'}</button>}
          {canMail && <button type="button" disabled={pending || !body.trim() || !mailTo || !context.mailReady} className={dark} onClick={() => submit(true)}>メールで送る</button>}
        </div>
        {canMail && !context.mailReady && <p><span className="inline-block rounded-full bg-[#FFD8C2] px-2.5 py-1 text-[11px] font-bold text-[#B03616]">メール送信の設定がありません</span></p>}
        <div className="rounded-[12px] border border-[#E2E1DA] p-2">
          <label className="block text-[11px] text-[#84787D]">AIへの指示（空でも可）
            <input value={hint} onChange={e => setHint(e.target.value)} maxLength={500} className={field} /></label>
          <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
            {!context.aiReady && <p className="mr-auto"><span className="inline-block rounded-full bg-[#FFD8C2] px-2.5 py-1 text-[11px] font-bold text-[#B03616]">AIの設定がありません</span></p>}
            <button type="button" disabled={drafting || pending || !context.aiReady} className={ghost} onClick={draft}>{drafting ? '下書き中…' : `${party === 'client' ? '顧客' : '工場'}あての下書きをAIでつくる`}</button>
          </div>
        </div>
      </div>
    </section>
  )
}
