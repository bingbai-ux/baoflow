'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { listFactoriesForRfq, type CreatedRfq } from '@/lib/actions/rfq'
import { getRfqSelectionOptions, previewRfq, createConfirmedRfq, previewRfqEmail, sendConfirmedRfqEmail, type RfqMailPreview } from '@/lib/actions/rfq-v2'
import { canonicalRfqInput, rfqDimensions, rfqEmailStatus, type RfqPreview } from '@/lib/deals/rfq-preview'
import { useWorkflowRequest } from '@/lib/hooks/use-workflow-request'
import { useUi } from '@/components/ui/ui-store'
import type { ProductRow } from './deals-nested-table'

const btn = 'min-h-[44px] rounded-full border border-[#E2E1DA] px-4 text-[12px] disabled:opacity-50'
const primary = btn + ' bg-[#E9F056] text-[#666C14] font-bold'
export function RfqConfirmFlow({ dealId, products, onClose }: { dealId: string; products: ProductRow[]; onClose: () => void }) {
  const router = useRouter(), { toast, mailReady } = useUi()
  const [busy, start] = useTransition()
  const recovery = useWorkflowRequest(`rfq/${dealId}`, 'rfq', dealId)
  const [options, setOptions] = useState<Awaited<ReturnType<typeof getRfqSelectionOptions>>>([])
  const [factories, setFactories] = useState<Awaited<ReturnType<typeof listFactoriesForRfq>>>([])
  const [loading, setLoading] = useState(true), [error, setError] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set()), [factoryIds, setFactoryIds] = useState<Set<string>>(new Set())
  const [name, setName] = useState(''), [email, setEmail] = useState(''), [deadline, setDeadline] = useState(''), [message, setMessage] = useState('')
  const [preview, setPreview] = useState<RfqPreview | null>(null), [recipient, setRecipient] = useState(0)
  const [created, setCreated] = useState<CreatedRfq['invitations']>([]), [mail, setMail] = useState<RfqMailPreview | null>(null)
  const [statuses, setStatuses] = useState<Record<string, string>>({})
  const [factorySearch, setFactorySearch] = useState('')
  const toggleGroup = (keys: string[]) => setSelected(previous => { const next = new Set(previous), all = keys.every(k => next.has(k)); keys.forEach(k => all ? next.delete(k) : next.add(k)); return next })
  useEffect(() => { Promise.all([getRfqSelectionOptions(dealId), listFactoriesForRfq()]).then(([rows, fs]) => { setOptions(rows); setFactories(fs); setSelected(new Set(rows.flatMap(v => v.quantities.map(q => `${v.id}/${q}`)))) }).catch(() => setError('仕様・数量・工場を取得できませんでした。閉じて再度開いてください')).finally(() => setLoading(false)) }, [dealId])
  useEffect(() => {
    const invites = recovery.recovered?.invitations
    if (Array.isArray(invites)) setCreated(invites.map(i => ({ ...i, factoryId: null, formUrl: `/external/${i.formToken}` })))
  }, [recovery.recovered])
  const input = canonicalRfqInput({ dealId, selection: options.map(v => ({ product_id: v.product_id, variant_id: v.id, quantities: v.quantities.filter(q => selected.has(`${v.id}/${q}`)) })).filter(v => v.quantities.length), factoryIds: [...factoryIds], pendingFactories: name.trim() ? [{ name: name.trim(), email: email.trim() }] : [], responseDeadline: deadline || null, requestMessage: message })
  const signature = JSON.stringify(input)
  useEffect(() => { setPreview(null); setRecipient(0) }, [signature])
  const toggle = (key: string, factory = false) => (factory ? setFactoryIds : setSelected)(previous => { const next = new Set(previous); if (next.has(key)) next.delete(key); else next.add(key); return next })
  const close = () => { if (busy) return; if (created.length) recovery.complete(); onClose(); router.refresh() }
  const review = () => start(async () => { setError(''); try { const r = await previewRfq(input); if (r.error || !r.preview) setError(r.error || '依頼内容を確認できませんでした'); else setPreview(r.preview) } catch { setError('依頼内容を取得できませんでした。再試行してください') } })
  const confirm = () => start(async () => {
    if (!preview) return
    setError('')
    try {
      const id = await recovery.requestId({ input, preview })
      const r = await createConfirmedRfq(input, preview, id)
      if (!r.data || r.error) { setError(r.error || '保存できませんでした。同じ内容で再試行してください'); if (r.error?.includes('もう一度確認')) { recovery.complete(); setPreview(null) } return }
      setCreated(r.data.invitations); toast(`${r.data.rfqNumber} の回答リンクを作成しました`)
    } catch { setError('保存結果を確認できません。同じ内容で再試行してください') }
  })
  const reviewMail = (id: string) => start(async () => { setError(''); try { const r = await previewRfqEmail(id); if (r.error) setError(r.error); else { setMail(r.preview || null); if (r.preview?.status) setStatuses(s => ({ ...s, [id]: r.preview!.status! })) } } catch { setError('送信内容を取得できませんでした。再試行してください') } })
  const send = () => start(async () => { if (!mail) return; setError(''); try { const r = await sendConfirmedRfqEmail(mail.invitationId, mail.fingerprint); if (r.status) setStatuses(s => ({ ...s, [mail.invitationId]: r.status! })); if (r.error) { setError(r.error); setMail(null) } else { setMail(null); toast('メール事業者が受け付けました。到達は別途確認してください') } } catch { setError('送信結果が不明です。再送せず履歴を確認してください'); setStatuses(s => ({ ...s, [mail.invitationId]: 'unknown' })); setMail(null) } })
  const title = created.length ? '見積依頼を作成しました' : preview ? '工場別の依頼内容を確認' : '見積依頼を作成'
  const reason = loading ? '仕様・工場を読込中' : !input.selection.length ? '商品仕様の数量を1件以上選択してください' : !factoryIds.size && !name.trim() ? '依頼先工場を選択してください' : email && (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ? '未登録工場名と有効なメールアドレスを入力してください' : !recovery.ready ? '前回の保存結果を確認中' : ''
  return <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[1100] bg-black/40 flex items-center justify-center p-3">
<div className="bg-white rounded-card shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto p-4 md:p-5" onClick={e => e.stopPropagation()}>
    <div className="flex justify-between items-center gap-3 mb-3">
<h2 className="font-bold text-[16px]">{title}</h2>
<button type="button" aria-label="見積依頼を閉じる" onClick={close} disabled={busy} className={btn}>閉じる</button>
</div>
    {error && <p role="alert" className="text-[12px] text-[#B03616] mb-3">{error}</p>}{recovery.error && <p role="alert">{recovery.error}</p>}
    {created.length ? <div className="space-y-3">
<p className="text-[12px]">各工場の回答リンクを保存しました。回答リンク作成ではメールを送信しません。メール受付・到達・回答は別の状態です。</p>
      {created.map(i => <section key={i.invitationId} className="rounded-card border border-[#E2E1DA] p-3 space-y-2">
<h3 className="font-bold text-[13px]">{i.factoryName}</h3>
<input aria-label={`${i.factoryName} の回答リンク`} readOnly value={new URL(i.formUrl, typeof window === 'undefined' ? 'https://placeholder.invalid' : window.location.origin).href} className="w-full text-[11px] border rounded p-2" />
<div className="flex gap-2 flex-wrap">
<button type="button" className={btn} onClick={async () => { try { await navigator.clipboard.writeText(new URL(i.formUrl, window.location.origin).href); toast('回答リンクをコピーしました') } catch { setError('コピーできませんでした。回答リンクを選択してください') } }}>回答リンクをコピー</button>
<button type="button" className={btn} disabled={!mailReady || busy} onClick={() => reviewMail(i.invitationId)}>工場へのメール内容を確認</button>
</div>{!mailReady && <p className="text-[12px]">メール設定が未完了です。管理者に設定を依頼するか回答リンクを共有してください。</p>}{statuses[i.invitationId] && <p role="status" className="text-[12px]">送信状態: {rfqEmailStatus(statuses[i.invitationId])}</p>}</section>)}
      {mail && <section aria-label="メール送信内容の確認" className="border border-[#E2E1DA] rounded-card p-3 space-y-2">
<h3 className="font-bold">宛先: {mail.to}</h3>
<p className="text-[12px]">差出人: {mail.from}</p>
<p className="text-[12px]">件名: {mail.subject}</p>
<iframe title="工場向けメール本文" srcDoc={mail.html} sandbox="" className="w-full h-52 border" />
<p className="text-[12px]">確定するとこの内容で送信します。受付は到達と異なります。</p>
<div className="flex gap-2">
<button type="button" onClick={() => setMail(null)} className={btn}>送信をやめる</button>
<button type="button" onClick={send} disabled={busy || !!mail.status} className={primary}>この宛先・内容で送信を確定</button>
</div>{mail.status && <p className="text-[12px]">送信予約/履歴があるため新しい送信は行いません。</p>}</section>}
    </div> : preview ? <div className="space-y-3">
<nav aria-label="依頼先プレビュー" className="flex flex-wrap gap-2">{preview.recipients.map((r, i) => <button type="button" key={r.factory_id || r.name} aria-pressed={i === recipient} onClick={() => setRecipient(i)} className={btn + (i === recipient ? ' bg-[#351E28] text-[#C9A2B8]' : '')}>{r.name}</button>)}</nav>
<section aria-label="相手に見える依頼内容" className="border border-[#E2E1DA] rounded-card p-3 space-y-3">
<h3 className="font-bold">{preview.recipients[recipient]?.name}</h3>
<p className="text-[12px]">宛先: {preview.recipients[recipient]?.email || '未登録 — リンク共有のみ'}</p>
<p className="text-[12px]">回答期限: {preview.response_deadline || '指定なし'}</p>{preview.requested_lines.map(l => <div key={l.variant_id} className="text-[12px] border-t pt-2">
<p className="font-bold">商品{l.product_no} · {l.product_id.slice(0, 8)} · {l.product_description} / {l.variant_label}</p>
<p>{rfqDimensions(l)} mm · {l.material || '素材未登録'}</p>
<p>{[l.color_description, l.pantone_colors, l.print_color_count, l.print_method, l.processing].filter(Boolean).join(' / ')}</p>
<p>依頼数量: {l.quantities.map(q => q.toLocaleString()).join(' / ')} 個</p>
</div>)}<p className="text-[12px] whitespace-pre-wrap">工場へ伝える内容: {preview.request_message || 'なし'}</p>
</section>
<p className="text-[12px] text-[#84787D]">顧客・案件名、売値、他工場の情報は共有しません。ここでは回答リンクを作成するだけで、メールは送信しません。</p>
<div className="sticky bottom-0 bg-white border-t border-[#E2E1DA] py-3 flex flex-wrap gap-2">
<button type="button" disabled={busy} onClick={() => setPreview(null)} className={btn}>選択・内容を変更</button>
<button type="button" disabled={busy || !recovery.ready} onClick={confirm} className={primary}>{busy ? '保存中…' : 'この内容で回答リンクを作成'}</button>
</div>
</div> : <div className="space-y-4">
      <fieldset disabled={busy || !recovery.ready} className="space-y-4">
<section>
<h3 className="font-bold text-[13px]">対象商品・仕様・数量</h3>{loading ? <p role="status">読込中…</p> : products.map(p => <section key={p.id} className="border border-[#E2E1DA] rounded-card p-3 mt-2">
<button type="button" aria-label={`商品${p.product_no}の全仕様・数量を選択・解除`} onClick={() => toggleGroup(options.filter(v => v.product_id === p.id).flatMap(v => v.quantities.map(q => `${v.id}/${q}`)))} className={btn}>商品全体を選択 / 解除</button>
<h4 className="font-bold text-[13px]">商品{p.product_no} · {p.id.slice(0, 8)} · {p.description}</h4>{options.filter(v => v.product_id === p.id).map(v => <fieldset key={v.id} className="mt-2">
<legend className="text-[12px]">
<button type="button" disabled={!v.quantities.length} onClick={() => toggleGroup(v.quantities.map(q => `${v.id}/${q}`))} className="min-h-11 underline">仕様全体を選択 / 解除</button> 仕様{v.variant_label} · {rfqDimensions(v)} mm · {v.material || '素材未登録'}</legend>
<div className="flex flex-wrap gap-3">{v.quantities.map(q => <label key={q} className="min-h-11 inline-flex items-center gap-2 text-[12px]">
<input type="checkbox" aria-label={`${p.description} 仕様${v.variant_label} ${q}個`} checked={selected.has(`${v.id}/${q}`)} onChange={() => toggle(`${v.id}/${q}`)} />{q.toLocaleString()}個</label>)}</div>{!v.quantities.length && <p className="text-[12px]">数量未登録。商品仕様で数量候補を登録してください。</p>}</fieldset>)}{!options.some(v => v.product_id === p.id) && <p className="text-[12px]">仕様未登録。商品仕様に戻って登録してください。</p>}</section>)}{!products.length && <p>商品仕様を登録してください。</p>}</section>
      <section>
<h3 className="font-bold text-[13px]">依頼先工場</h3>
<label className="block text-[12px]">工場名で検索<input type="search" value={factorySearch} onChange={e => setFactorySearch(e.target.value)} className="min-h-11 w-full border rounded p-2" />
</label>
<div className="flex flex-col gap-1">{factories.filter(f => f.factory_name.toLowerCase().includes(factorySearch.toLowerCase())).map(f => <label key={f.id} className="min-h-11 inline-flex gap-2 items-center text-[12px]">
<input type="checkbox" checked={factoryIds.has(f.id)} disabled={!f.basic_info_completed} onChange={() => toggle(f.id, true)} />{f.factory_name}{!f.basic_info_completed ? ' — 基本情報を登録してから選択できます' : !f.contact_email ? ' — 宛先未登録（リンク共有可）' : ''}</label>)}</div>{!loading && !factories.length && <p className="text-[12px]">登録工場がありません。工場を登録するか、下の未登録工場を指定してください。</p>}</section>
      <details>
<summary className="min-h-11 text-[12px] cursor-pointer">未登録工場への依頼 (任意)</summary>
<p className="text-[12px]">回答は保存され、登録工場を選んだ後に明示的に取り込めます。</p>
<label className="block text-[12px]">未登録工場名<input value={name} maxLength={200} onChange={e => setName(e.target.value)} className="block min-h-11 w-full border rounded p-2" />
</label>
<label className="block text-[12px]">未登録工場メール (任意)<input value={email} maxLength={254} onChange={e => setEmail(e.target.value)} className="block min-h-11 w-full border rounded p-2" />
</label>
</details>
      <label className="block text-[12px]">回答期限 (任意)<input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="block min-h-11 border rounded p-2" />
</label>
<label className="block text-[12px]" htmlFor="rfq-request-message">工場へ伝える内容<textarea id="rfq-request-message" aria-label="工場へ伝える内容" value={message} maxLength={10000} onChange={e => setMessage(e.target.value)} className="block min-h-20 w-full border rounded p-2" />
</label>
</fieldset>
      {recovery.unfinished && !recovery.recovered && <p className="text-[12px]">前回保存結果が未確認です。同じ内容で再試行してください。<button type="button" onClick={recovery.complete} className="underline">既存RFQを確認済み・新しい入力を始める</button>
</p>}
      <div className="sticky bottom-0 bg-white border-t border-[#E2E1DA] py-3 flex flex-wrap items-center gap-3">{reason && <p id="rfq-review-reason" className="text-[12px]">{reason}</p>}<button type="button" disabled={!!reason || busy} aria-describedby={reason ? 'rfq-review-reason' : undefined} onClick={review} className={primary}>{busy ? '確認中…' : '依頼内容を確認'}</button>
</div>
    </div>}
  </div>
</div>
}
