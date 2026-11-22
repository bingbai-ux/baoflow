'use client'

// 再設計 工程4: 原価 → 提示単価（原価率と相互に計算）→ お見積を送る → 承認 / 差し戻し。全ての回を残す。

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { recordOfferDecision, saveOfferPrices, sendPriceOffer, type FactoryExtras, type OfferRow } from '@/lib/actions/price-offer'
import { yen } from '@/lib/process/offer-format'
import { useUi } from '@/components/ui/ui-store'

export interface OfferLine { quoteId: string; productId: string; quantity: number; unitUsd: number | null; feesUsd: number; freightUsd: number; sellJpy: number | null; status: string | null; locked: boolean }
export interface OfferProduct { id: string; name: string; productionDays: number | null }
interface Draft { unit: string; fees: string; freight: string; sell: string }
const EMPTY: Draft = { unit: '', fees: '', freight: '', sell: '' }

const ghost = 'min-h-[44px] inline-flex items-center justify-center rounded-full border border-[#E2E1DA] bg-white px-4 text-[12px] font-bold text-[#351E28] hover:bg-[#FBFAF6] disabled:opacity-40'
const dark = 'min-h-[44px] inline-flex items-center justify-center rounded-full bg-[#351E28] px-4 text-[12px] font-bold text-[#C9A2B8] hover:brightness-95 disabled:opacity-40'
const main = 'min-h-[44px] inline-flex items-center justify-center rounded-full bg-[#E9F056] px-5 text-[12.5px] font-extrabold text-[#666C14] hover:brightness-95 disabled:opacity-40'
const danger = 'min-h-[44px] inline-flex items-center justify-center rounded-full border border-[#FF5C34] bg-white px-4 text-[12px] font-bold text-[#B03616] disabled:opacity-40'
const pill = 'rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap'
const cell = 'h-[36px] w-full min-w-[72px] rounded-[12px] border border-transparent bg-[#EFEFEA] px-2 text-right text-[12.5px] tabular-nums text-[#351E28] outline-none focus:border-[#351E28] disabled:opacity-60'
const num = (s: string) => { const n = Number(s); return s.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : null }
const day = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric' }) : ''
const str = (n: number | null) => n == null ? '' : String(Number(n))

/** 1行ぶんの計算（表示用。保存時はDB側で同じ式で計算し直す） */
export function calcLine(quantity: number, d: Draft, fx: number | null, tax: number) {
  const unit = num(d.unit), fees = num(d.fees) ?? 0, freight = num(d.freight) ?? 0, sell = num(d.sell)
  if (!unit || !fx || quantity <= 0) return { costJpy: null, ratio: null, net: null, taxIn: null, profit: null }
  const costJpy = (quantity * unit + fees + freight) / quantity * fx
  if (!sell) return { costJpy, ratio: null, net: null, taxIn: null, profit: null }
  const net = Math.ceil(sell * quantity - 1e-9)
  return { costJpy, ratio: costJpy / sell, net, taxIn: Math.ceil(net * (1 + tax / 100) - 1e-9), profit: net - Math.ceil(costJpy * quantity - 1e-9) }
}

export function PriceOfferPanel({ dealId, products, lines, offers, extras, defaults, readOnly }: {
  dealId: string; products: OfferProduct[]; lines: OfferLine[]; offers: OfferRow[]; extras: FactoryExtras[]
  defaults: { fx: number; tax: number; ratio: number | null }; readOnly?: boolean
}) {
  const router = useRouter()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const [fx, setFx] = useState(defaults.fx > 0 ? String(defaults.fx) : '')
  const [draft, setDraft] = useState<Record<string, Draft>>(() => Object.fromEntries(lines.map(l => [l.quoteId, { unit: str(l.unitUsd), fees: str(l.feesUsd || null), freight: str(l.freightUsd || null), sell: str(l.sellJpy) }])))
  const [days, setDays] = useState<Record<string, string>>(() => Object.fromEntries(products.map(p => [p.id, str(p.productionDays)])))
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [ask, setAsk] = useState<'send' | 'approve' | 'return' | 'cancel' | null>(null)
  const [choices, setChoices] = useState<Record<string, string>>({})
  const [comment, setComment] = useState('')

  const open = offers.find(o => o.status === 'sent') || null
  const approved = offers.find(o => o.status === 'approved') || null
  const lastReturned = !open && !approved && offers.find(o => o.status !== 'cancelled')?.status === 'returned' ? offers.find(o => o.status === 'returned')! : null
  const hasLegacy = lines.some(l => l.locked)
  const frozen = readOnly || !!open || !!approved || hasLegacy
  const fxN = num(fx)
  const active = useMemo(() => lines.filter(l => l.status !== 'rejected' || approved), [lines, approved])
  const complete = products.length > 0 && products.every(p => active.some(l => l.productId === p.id && num((draft[l.quoteId] || EMPTY).sell)))
  const nextRound = Math.max(0, ...offers.map(o => o.round)) + 1

  const edit = (id: string, patch: Partial<Draft>) => { setDraft(d => ({ ...d, [id]: { ...(d[id] || EMPTY), ...patch } })); setDirty(true) }
  // 原価率（%）を入れたら提示単価を出す。提示単価を入れたら原価率は表示側で出る。
  const setRatio = (l: OfferLine, percent: string) => {
    const p = num(percent), c = calcLine(l.quantity, draft[l.quoteId] || EMPTY, fxN, defaults.tax).costJpy
    if (!p || p > 100 || !c) return
    edit(l.quoteId, { sell: String(Math.ceil(c / (p / 100) * 100 - 1e-6) / 100) })
  }
  const run = (work: () => Promise<{ error: string | null }>, done: string) => { setAsk(null); setError(null); startTransition(async () => {
    const r = await work()
    if (r.error) { setError(r.error); return }
    toast(done); router.refresh()
  }) }
  const save = () => {
    if (!fxN) { setError('為替を入力してください'); return }
    const at = (id: string) => draft[id] || EMPTY
    const filled = active.filter(l => num(at(l.quoteId).unit) || num(at(l.quoteId).sell))
    if (!filled.length) { setError('工場単価と提示単価を入力してください'); return }
    run(async () => {
      const r = await saveOfferPrices(dealId, {
        exchangeRate: fxN, taxRate: defaults.tax,
        lines: filled.map(l => ({ quote_id: l.quoteId, factory_unit_price_usd: num(at(l.quoteId).unit) ?? 0, fees_usd: num(at(l.quoteId).fees) ?? 0, freight_usd: num(at(l.quoteId).freight) ?? 0, selling_price_jpy: num(at(l.quoteId).sell) ?? 0 })),
        productionDays: Object.fromEntries(products.map(p => [p.id, num(days[p.id] || '') || null])),
      })
      if (!r.error) setDirty(false)
      return r
    }, '価格を保存しました')
  }
  const send = () => { setAsk(null); setError(null); startTransition(async () => {
    const r = await sendPriceOffer(dealId)
    setLink(r.link); setError(r.error)
    if (r.sent) toast(`${r.to} へお見積を送りました`)
    router.refresh()
  }) }

  const badge = approved ? <span className={pill + ' bg-[#D7EFFF] text-[#33566F]'}>第{approved.round}回 承認済み {day(approved.decidedAt)}{approved.decidedVia === 'staff' ? '（営業が記録）' : ''}</span>
    : open ? <span className={pill + ' bg-[#FFD8C2] text-[#B03616]'}>第{open.round}回 {open.sendStatus === 'accepted' ? `返事待ち（${day(open.sentAt)} 送信）` : '返事待ち（メール未送信）'}</span>
    : lastReturned ? <span className={pill + ' bg-[#FFD8C2] text-[#B03616]'}>第{lastReturned.round}回 差し戻し</span>
    : <span className={pill + ' border border-[#E2E1DA] bg-[#EFEFEA] text-[#351E28]'}>未提示</span>

  return (
    <section aria-label="価格の提示" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex flex-wrap items-center gap-2 text-[15px] font-bold"><span className="sr-only">価格を決めて提示</span>{badge}</h3>
        <label className="flex items-center gap-2 text-[11px] text-[#84787D]">為替（円 / $）
          <input inputMode="decimal" aria-label="為替（円 / $）" value={fx} disabled={frozen} onChange={e => { setFx(e.target.value); setDirty(true) }} className={cell + ' !w-[88px]'} />
          <span className="tabular-nums">消費税 {defaults.tax}%</span></label>
      </div>
      {lastReturned?.returnComment && <p className="rounded-[16px] border-[1.5px] border-[#FF5C34] bg-[#FFD8C2] p-3 text-[12.5px] text-[#B03616] break-words"><span className="font-bold">顧客の要望: </span>{lastReturned.returnComment}</p>}
      {hasLegacy && <p className="rounded-[16px] border border-[#E2E1DA] bg-[#FBFAF6] p-3 text-[12.5px]">この案件は以前の画面で価格を確定しています。</p>}
      {error && <p role="alert" className="rounded-[16px] border-[1.5px] border-[#FF5C34] bg-[#FFD8C2] p-3 text-[12.5px] text-[#B03616]">{error}</p>}
      {link && <p className="flex flex-wrap items-center gap-2 text-[12.5px]"><span className="text-[#84787D]">お見積ページ</span><a href={link} target="_blank" rel="noreferrer" className="break-all underline">{link}</a>
        <button type="button" className={ghost} onClick={() => navigator.clipboard?.writeText(link).then(() => toast('リンクをコピーしました'))}>コピー</button></p>}

      {extras.length > 0 && (
        <details className="rounded-[16px] border border-[#E2E1DA] bg-[#FBFAF6] p-3 text-[12.5px]">
          <summary className="min-h-[32px] cursor-pointer font-bold">工場が回答した費用・送料・日数</summary>
          <ul className="mt-2 space-y-2">{extras.map((x, i) => (
            <li key={i} className="tabular-nums"><span className="font-bold">{x.factory}</span>
              {[...x.fees, ...x.shipping.map(s => ({ label: `送料 ${s.label}`, usd: s.usd }))].map(f => <span key={f.label} className="ml-3 inline-block">{f.label} ${f.usd}</span>)}
              {x.leadDays.map(l => <span key={l.label} className="ml-3 inline-block text-[#84787D]">{l.label} {l.text}</span>)}
            </li>))}</ul>
        </details>
      )}

      {products.length === 0 && <p className="text-[13px] text-[#84787D]">商品はまだありません</p>}
      {products.map(p => {
        const rows = active.filter(l => l.productId === p.id).sort((a, b) => a.quantity - b.quantity)
        return (
          <div key={p.id} className="rounded-[16px] border border-[#E2E1DA] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E1DA] px-4 py-2">
              <p className="min-w-0 break-words text-[13px] font-bold">{p.name}</p>
              <label className="flex items-center gap-2 text-[11px] text-[#84787D]">製造日数
                <input inputMode="numeric" aria-label={`${p.name} の製造日数`} value={days[p.id] || ''} disabled={frozen} onChange={e => { setDays(d => ({ ...d, [p.id]: e.target.value.replace(/\D/g, '').slice(0, 3) })); setDirty(true) }} className={cell + ' !w-[64px] !min-w-0'} />日</label>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-[12.5px] tabular-nums">
                <thead><tr className="bg-[#FBFAF6] text-[11px] text-[#84787D]">
                  {['数量', '工場単価 $', '諸費用 $', '送料 $', '原価 / 個', '原価率 %', '提示単価 ¥', '総額（税込）', '想定利益'].map((h, i) => <th key={h} className={`whitespace-nowrap px-2 py-2 font-normal ${i === 0 ? 'pl-4 text-left' : 'text-right'} ${i === 8 ? 'pr-4' : ''}`}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {rows.map((l, i) => {
                    const d = draft[l.quoteId] || EMPTY, c = calcLine(l.quantity, d, fxN, defaults.tax), below = c.ratio != null && c.ratio > 1
                    const label = `${p.name} ${l.quantity.toLocaleString('ja-JP')}個`
                    return (
                      <tr key={l.quoteId} className={`border-t border-[#E2E1DA] ${approved?.choices?.includes(l.quoteId) ? 'bg-[#D7EFFF]' : i % 2 ? 'bg-[#FBFAF6]' : 'bg-white'}`}>
                        <th scope="row" className="whitespace-nowrap py-2 pl-4 pr-2 text-left font-bold">{l.quantity.toLocaleString('ja-JP')}個{approved?.choices?.includes(l.quoteId) && <span className="ml-2 text-[11px] text-[#33566F]">承認</span>}</th>
                        <td className="px-1 py-1"><input inputMode="decimal" aria-label={`${label} 工場単価`} value={d.unit} disabled={frozen} onChange={e => edit(l.quoteId, { unit: e.target.value })} className={cell} /></td>
                        <td className="px-1 py-1"><input inputMode="decimal" aria-label={`${label} 諸費用`} value={d.fees} placeholder="0" disabled={frozen} onChange={e => edit(l.quoteId, { fees: e.target.value })} className={cell} /></td>
                        <td className="px-1 py-1"><input inputMode="decimal" aria-label={`${label} 送料`} value={d.freight} placeholder="0" disabled={frozen} onChange={e => edit(l.quoteId, { freight: e.target.value })} className={cell} /></td>
                        <td className="whitespace-nowrap px-2 py-2 text-right">{c.costJpy != null ? yen(Math.round(c.costJpy * 100) / 100) : '—'}</td>
                        <td className="px-1 py-1"><input type="number" min={1} max={100} step={1} aria-label={`${label} 原価率`} disabled={frozen || c.costJpy == null}
                          value={c.ratio != null ? String(Math.round(c.ratio * 1000) / 10) : ''} placeholder={defaults.ratio ? String(Math.round(defaults.ratio * 100)) : ''} onChange={e => setRatio(l, e.target.value)} className={cell + (below ? ' !border-[#FF5C34]' : '')} /></td>
                        <td className="px-1 py-1"><input inputMode="decimal" aria-label={`${label} 提示単価`} value={d.sell} disabled={frozen} onChange={e => edit(l.quoteId, { sell: e.target.value })} className={cell + ' font-bold' + (below ? ' !border-[#FF5C34]' : '')} /></td>
                        <td className="whitespace-nowrap px-2 py-2 text-right">{c.net != null ? <>{yen(c.net)}<span className="ml-1 text-[11px] text-[#84787D]">（{yen(c.taxIn!)}）</span></> : '—'}</td>
                        <td className={`whitespace-nowrap py-2 pl-2 pr-4 text-right font-bold ${below ? 'text-[#B03616]' : ''}`}>{c.profit != null ? yen(c.profit) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {!readOnly && !approved && !hasLegacy && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {open ? <>
            <button type="button" disabled={pending} className={danger} onClick={() => setAsk('cancel')}>提示を取り消す</button>
            <button type="button" disabled={pending} className={ghost} onClick={() => { setComment(''); setAsk('return') }}>差し戻しとして記録</button>
            <button type="button" disabled={pending} className={ghost} onClick={() => { setChoices(Object.fromEntries(open.snapshot.items.filter(i => i.options.length === 1).map(i => [i.product_id, i.options[0].quote_id]))); setAsk('approve') }}>承認として記録</button>
          </> : <>
            <button type="button" disabled={pending || !dirty} className={dark} onClick={save}>価格を保存する</button>
            <button type="button" disabled={pending || dirty || !complete} className={main} onClick={() => setAsk('send')}>第{nextRound}回お見積を送る</button>
          </>}
        </div>
      )}

      {offers.length > 0 && (
        <div className="rounded-[16px] border border-[#E2E1DA] bg-white">
          <h4 className="border-b border-[#E2E1DA] px-4 py-2 text-[12.5px] font-bold">お見積の履歴 <span className="font-normal text-[#84787D] tabular-nums">{offers.length}回</span></h4>
          <ul aria-label="お見積の履歴">
            {offers.map(o => (
              <li key={o.id} className="border-b border-[#E2E1DA] last:border-b-0">
                <details>
                  <summary className="flex min-h-[44px] cursor-pointer flex-wrap items-center gap-2 px-4 py-2 text-[12.5px] tabular-nums">
                    <span className="font-bold">第{o.round}回</span><span className="text-[#84787D]">{day(o.createdAt)}</span>
                    <span className={pill + (o.status === 'approved' ? ' bg-[#D7EFFF] text-[#33566F]' : o.status === 'cancelled' ? ' bg-[#AEB8A0] text-[#4C5544]' : ' bg-[#FFD8C2] text-[#B03616]')}>{o.status === 'approved' ? '承認' : o.status === 'returned' ? '差し戻し' : o.status === 'cancelled' ? '取り消し' : '返事待ち'}</span>
                    {o.contactName && <span className="text-[#84787D]">{o.contactName}</span>}
                  </summary>
                  <div className="px-4 pb-3 text-[12.5px]">
                    {o.returnComment && <p className="mb-2 break-words"><span className="text-[#84787D]">要望: </span>{o.returnComment}</p>}
                    {o.snapshot.items.map(i => (
                      <div key={i.product_id} className="mb-2"><p className="font-bold break-words">{i.name}{i.production_days ? <span className="ml-2 font-normal text-[#84787D]">製造 約{i.production_days}日</span> : null}</p>
                        {i.options.map(x => <p key={x.quote_id} className={`tabular-nums ${o.choices?.includes(x.quote_id) ? 'font-bold text-[#33566F]' : ''}`}>{Number(x.quantity).toLocaleString('ja-JP')}個 ・ 単価 {yen(x.unit_jpy)} ・ 税込 {yen(x.tax_jpy)}{o.choices?.includes(x.quote_id) ? ' ・ 承認' : ''}</p>)}
                      </div>
                    ))}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ask && (
        <div role="dialog" aria-modal="true" aria-label={{ send: 'お見積を送る', approve: '承認として記録', return: '差し戻しとして記録', cancel: '提示を取り消す' }[ask]} className="fixed inset-0 z-[70] flex items-center justify-center bg-[#351E28]/40 p-4">
          <div className="max-h-[90vh] w-full max-w-[460px] overflow-y-auto rounded-[16px] border border-[#E2E1DA] bg-white p-4 shadow-[0_20px_50px_rgba(53,30,40,.12)]">
            <p className="text-[15px] font-bold">{{ send: `第${nextRound}回お見積を送りますか？`, approve: '顧客の承認が取れましたか？', return: '顧客から変更の要望がありましたか？', cancel: '提示を取り消しますか？' }[ask]}</p>
            {ask === 'send' && <p className="mt-1 text-[12.5px] text-[#84787D]">お見積書PDFとページのリンクを送ります。</p>}
            {ask === 'cancel' && <p className="mt-1 text-[12.5px] text-[#84787D]">送ったリンクは使えなくなります。</p>}
            {ask === 'approve' && open && open.snapshot.items.filter(i => i.options.length > 1).map(i => (
              <fieldset key={i.product_id} className="mt-3"><legend className="text-[12.5px] font-bold break-words">{i.name}</legend>
                {i.options.map(x => <label key={x.quote_id} className="flex min-h-[44px] cursor-pointer items-center gap-2 text-[12.5px] tabular-nums">
                  <input type="radio" name={`choice-${i.product_id}`} checked={choices[i.product_id] === x.quote_id} onChange={() => setChoices(c => ({ ...c, [i.product_id]: x.quote_id }))} className="accent-[#351E28]" />
                  {Number(x.quantity).toLocaleString('ja-JP')}個 ・ 単価 {yen(x.unit_jpy)}</label>)}
              </fieldset>))}
            {ask === 'return' && <label className="mt-3 block text-[11px] text-[#84787D]">要望の内容
              <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} maxLength={2000} className="mt-1 w-full rounded-[12px] border border-transparent bg-[#EFEFEA] p-3 text-[14px] text-[#351E28] outline-none focus:border-[#351E28]" /></label>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={ghost} onClick={() => setAsk(null)}>やめる</button>
              {ask === 'send' && <button type="button" className={dark} onClick={send}>送る</button>}
              {ask === 'approve' && <button type="button" className={dark} disabled={!open || open.snapshot.items.some(i => !choices[i.product_id])} onClick={() => run(() => recordOfferDecision(dealId, 'approve', choices), '承認として記録しました')}>記録する</button>}
              {ask === 'return' && <button type="button" className={dark} disabled={!comment.trim()} onClick={() => run(() => recordOfferDecision(dealId, 'return', {}, comment), '差し戻しとして記録しました')}>記録する</button>}
              {ask === 'cancel' && <button type="button" className={danger} onClick={() => run(() => recordOfferDecision(dealId, 'cancel'), '提示を取り消しました')}>取り消す</button>}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
