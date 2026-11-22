'use client'

// 再設計 工程4: 顧客がお見積に返事をする（数量を選んで承認 / 要望を書いて変更を依頼）。

import { useState, useTransition } from 'react'
import { decideOfferByCustomer } from '@/lib/actions/price-offer'
import { yen, type OfferItem } from '@/lib/process/offer-format'

export function OfferDecision({ token, items }: { token: string; items: OfferItem[] }) {
  const [pending, startTransition] = useTransition()
  const [choices, setChoices] = useState<Record<string, string>>(() => Object.fromEntries(items.filter(i => i.options.length === 1).map(i => [i.product_id, i.options[0].quote_id])))
  const [mode, setMode] = useState<'choose' | 'return'>('choose')
  const [comment, setComment] = useState('')
  const [done, setDone] = useState<'approve' | 'return' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ready = items.every(i => choices[i.product_id])
  const total = items.reduce((sum, i) => sum + (i.options.find(o => o.quote_id === choices[i.product_id])?.tax_jpy || 0), 0)
  const submit = (decision: 'approve' | 'return') => { setError(null); startTransition(async () => {
    const r = await decideOfferByCustomer(token, decision, choices, comment)
    if (r.success) setDone(decision); else setError(r.error || '記録できませんでした')
  }) }

  if (done) return <p role="status" className="mt-4 rounded-[16px] bg-[#D7EFFF] p-4 text-[14px] font-bold text-[#33566F]">{done === 'approve' ? 'ご承認を受け付けました。ありがとうございます。' : '変更のご依頼を受け付けました。新しいお見積をお送りします。'}</p>
  return (
    <div className="mt-4">
      <ol aria-label="商品" className="space-y-2">
        {items.map((item, i) => (
          <li key={item.product_id} className="rounded-[16px] border border-[#E2E1DA] bg-white p-4">
            <p className="text-[14px] font-bold break-words"><span className="mr-2 tabular-nums text-[#84787D]">{i + 1}</span>{item.name}</p>
            {(item.production_days || item.shipping_mode) && <p className="mt-1 text-[12.5px] text-[#84787D] tabular-nums">{[item.production_days ? `製造日数 約${item.production_days}日` : null, item.shipping_mode === 'sea' ? '船便' : item.shipping_mode === 'air' ? '航空便' : null].filter(Boolean).join(' ・ ')}</p>}
            <fieldset className="mt-2 space-y-1">
              <legend className="sr-only">{item.name} の数量</legend>
              {item.options.map(o => {
                const on = choices[item.product_id] === o.quote_id
                return (
                  <label key={o.quote_id} className={`flex min-h-[44px] cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded-[12px] border px-3 py-2 text-[13px] tabular-nums ${on ? 'border-[#351E28] bg-[#FBFAF6] font-bold' : 'border-[#E2E1DA] bg-white'}`}>
                    <input type="radio" name={item.product_id} checked={on} onChange={() => setChoices(c => ({ ...c, [item.product_id]: o.quote_id }))} className="accent-[#351E28]" />
                    <span>{Number(o.quantity).toLocaleString('ja-JP')}個</span><span>単価 {yen(o.unit_jpy)}</span><span>小計 {yen(o.net_jpy)}</span><span className="ml-auto">税込 {yen(o.tax_jpy)}</span>
                  </label>
                )
              })}
            </fieldset>
          </li>
        ))}
      </ol>
      {error && <p role="alert" className="mt-3 rounded-[16px] border-[1.5px] border-[#FF5C34] bg-[#FFD8C2] p-3 text-[13px] text-[#B03616]">{error}</p>}
      {mode === 'choose' ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="mr-auto text-[14px]">合計（税込） <span className="text-[24px] font-extrabold tabular-nums">{ready ? yen(total) : '—'}</span></p>
          <button type="button" disabled={pending} onClick={() => setMode('return')} className="min-h-[48px] rounded-full border border-[#E2E1DA] bg-white px-5 text-[14px] font-bold text-[#351E28] hover:bg-[#FBFAF6] disabled:opacity-60">変更を依頼する</button>
          <button type="button" disabled={pending || !ready} onClick={() => submit('approve')} className="min-h-[48px] rounded-full bg-[#E9F056] px-6 text-[15px] font-extrabold text-[#666C14] hover:brightness-95 disabled:opacity-40">{pending ? '送信しています…' : 'この内容で承認する'}</button>
        </div>
      ) : (
        <div className="mt-4 rounded-[16px] border border-[#E2E1DA] bg-white p-4">
          <label className="block text-[12.5px] text-[#84787D]">変更したい内容（数量・仕様・価格など）
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={4} maxLength={2000} className="mt-1 w-full rounded-[12px] border border-transparent bg-[#EFEFEA] p-3 text-[14px] text-[#351E28] outline-none focus:border-[#351E28]" /></label>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button type="button" disabled={pending} onClick={() => setMode('choose')} className="min-h-[48px] rounded-full border border-[#E2E1DA] bg-white px-5 text-[14px] font-bold text-[#351E28]">もどる</button>
            <button type="button" disabled={pending || !comment.trim()} onClick={() => submit('return')} className="min-h-[48px] rounded-full bg-[#351E28] px-6 text-[14px] font-bold text-[#C9A2B8] hover:brightness-95 disabled:opacity-40">{pending ? '送信しています…' : 'この内容で変更を依頼する'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
