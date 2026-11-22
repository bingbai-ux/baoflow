'use client'

// 再設計 工程9: 検収（到着を記録 → 顧客が受領 → 納品書を送って完了）と、同じ内容での次回オーダー。

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { recordReceiptDecision, repeatProject, requestReceipt, type ReceiptRow } from '@/lib/actions/deal-receipt'
import { useUi } from '@/components/ui/ui-store'

const ghost = 'min-h-[44px] inline-flex items-center justify-center rounded-full border border-[#E2E1DA] bg-white px-4 text-[12px] font-bold text-[#351E28] no-underline hover:bg-[#FBFAF6] disabled:opacity-40'
const dark = 'min-h-[44px] inline-flex items-center justify-center rounded-full bg-[#351E28] px-4 text-[12px] font-bold text-[#C9A2B8] hover:brightness-95 disabled:opacity-40'
const main = 'min-h-[44px] inline-flex items-center justify-center rounded-full bg-[#E9F056] px-5 text-[12.5px] font-extrabold text-[#666C14] hover:brightness-95 disabled:opacity-40'
const danger = 'min-h-[44px] inline-flex items-center justify-center rounded-full border border-[#FF5C34] bg-white px-4 text-[12px] font-bold text-[#B03616] disabled:opacity-40'
const pill = 'rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap'
const field = 'min-h-[44px] rounded-[12px] border border-transparent bg-[#EFEFEA] px-3 text-[14px] tabular-nums text-[#351E28] outline-none focus:border-[#351E28]'
const day = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric' }) : ''
const ymd = (d: string) => d.replace(/-/g, '/')

export function ReceiptPanel({ dealId, receipts, shippedOn, lines, today, readOnly }: {
  dealId: string; receipts: ReceiptRow[]; shippedOn: string | null; /** 納品する内容（承認済みの数量） */ lines: Array<{ name: string; quantity: number }>; today: string; readOnly?: boolean
}) {
  const router = useRouter()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const [arrivedOn, setArrivedOn] = useState(today)
  const [ask, setAsk] = useState<'request' | 'received' | 'cancel' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [repeatId] = useState(() => crypto.randomUUID()) // やり直しても同じ要求として扱われ、案件が2つできない

  const received = receipts.find(r => r.status === 'received') || null
  const open = receipts.find(r => r.status === 'sent') || null
  const shown = received || open
  const rows = shown ? shown.snapshot.lines : lines

  const request = () => { setAsk(null); setError(null); startTransition(async () => {
    const r = await requestReceipt(dealId, arrivedOn)
    setLink(r.link); setError(r.error)
    if (r.sent) toast(`${r.to} へ確認を依頼しました`)
    router.refresh()
  }) }
  const decide = (decision: 'received' | 'cancel') => { setAsk(null); setError(null); startTransition(async () => {
    const r = await recordReceiptDecision(dealId, decision)
    if (r.error) { setError(r.error); return }
    setNotice(r.notice); toast(decision === 'received' ? '受領済みとして記録しました' : '確認依頼を取り消しました'); router.refresh()
  }) }
  const repeat = () => { setError(null); startTransition(async () => {
    const r = await repeatProject(repeatId, dealId)
    if (r.error || !r.dealId) { setError(r.error || '新しい案件をつくれませんでした'); return }
    router.push(`/deals/${r.dealId}?step=2`)
  }) }

  const badge = received ? <span className={pill + ' bg-[#D7EFFF] text-[#33566F]'}>受領済み {day(received.receivedAt)}{received.receivedVia === 'staff' ? '（営業が記録）' : ''} ・ 案件完了</span>
    : open ? <span className={pill + ' bg-[#FFD8C2] text-[#B03616]'}>{open.sendStatus === 'accepted' ? `顧客の確認待ち（${day(open.sentAt)} 送信）` : '顧客の確認待ち（メール未送信）'}</span>
    : <span className={pill + ' border border-[#E2E1DA] bg-[#EFEFEA] text-[#351E28]'}>到着の記録前</span>

  return (
    <section aria-label="検収" className="space-y-3">
      {!shippedOn && <p className="rounded-[16px] border border-[#E2E1DA] bg-[#FBFAF6] p-3 text-[12.5px]">発送完了を記録すると始められます<Link href={`/deals/${dealId}?step=11`} className="ml-2 underline">発送を開く</Link></p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex flex-wrap items-center gap-2 text-[15px] font-bold"><span className="sr-only">検収</span>{badge}{shown && <span className="text-[12.5px] font-normal text-[#84787D] tabular-nums">納品書 {shown.deliveryNoteNumber} ・ 到着日 {ymd(shown.arrivedOn)}</span>}</h3>
        {received && <a href={`/deals/${dealId}/delivery-note`} target="_blank" rel="noreferrer" className={ghost}>納品書を開く</a>}
      </div>
      {error && <p role="alert" className="rounded-[16px] border-[1.5px] border-[#FF5C34] bg-[#FFD8C2] p-3 text-[12.5px] text-[#B03616] break-words">{error}</p>}
      {notice && <p role="alert" className="rounded-[16px] border-[1.5px] border-[#FF5C34] bg-[#FFD8C2] p-3 text-[12.5px] text-[#B03616] break-words">{notice}</p>}
      {link && <p className="flex flex-wrap items-center gap-2 text-[12.5px]"><span className="text-[#84787D]">確認ページ</span><a href={link} target="_blank" rel="noreferrer" className="break-all underline">{link}</a>
        <button type="button" className={ghost} onClick={() => navigator.clipboard?.writeText(link).then(() => toast('リンクをコピーしました'))}>コピー</button></p>}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-[16px] border border-[#E2E1DA] bg-white">
          <table aria-label="納品の内容" className="w-full text-[12.5px] tabular-nums">
            <thead><tr className="bg-[#FBFAF6] text-[11px] text-[#84787D]"><th className="px-4 py-2 text-left font-normal">商品</th><th className="px-4 py-2 text-right font-normal">数量</th></tr></thead>
            <tbody>{rows.map((l, i) => <tr key={i} className={`border-t border-[#E2E1DA] ${i % 2 ? 'bg-[#FBFAF6]' : ''}`}><td className="px-4 py-2 break-words">{l.name}</td><td className="whitespace-nowrap px-4 py-2 text-right">{Number(l.quantity).toLocaleString('ja-JP')}個</td></tr>)}</tbody>
          </table>
        </div>
      )}

      {!readOnly && shippedOn && !received && (
        <div className="flex flex-wrap items-end justify-end gap-2">
          {open ? <>
            <button type="button" disabled={pending} className={danger} onClick={() => setAsk('cancel')}>確認依頼を取り消す</button>
            <button type="button" disabled={pending} className={ghost} onClick={() => setAsk('received')}>受領済みとして記録</button>
          </> : <>
            <label className="text-[11px] text-[#84787D]">到着日<br /><input type="date" value={arrivedOn} min={shippedOn} max={today} onChange={e => setArrivedOn(e.target.value)} className={field} /></label>
            <button type="button" disabled={pending || !arrivedOn || arrivedOn < shippedOn || arrivedOn > today} className={main} onClick={() => setAsk('request')}>到着を記録して確認を依頼</button>
          </>}
        </div>
      )}
      {!readOnly && received && <div className="flex justify-end"><button type="button" disabled={pending} className={main} onClick={repeat}>同じ内容で次の案件をつくる</button></div>}

      {ask && (
        <div role="dialog" aria-modal="true" aria-label={{ request: '到着を記録して確認を依頼', received: '受領済みとして記録', cancel: '確認依頼を取り消す' }[ask]} className="fixed inset-0 z-[70] flex items-center justify-center bg-[#351E28]/40 p-4">
          <div className="w-full max-w-[420px] rounded-[16px] border border-[#E2E1DA] bg-white p-4 shadow-[0_20px_50px_rgba(53,30,40,.12)]">
            <p className="text-[15px] font-bold">{{ request: `到着日 ${ymd(arrivedOn)} で顧客へ確認を依頼しますか？`, received: '顧客から受領の連絡がありましたか？', cancel: '確認依頼を取り消しますか？' }[ask]}</p>
            <p className="mt-1 text-[12.5px] text-[#84787D]">{{ request: '確認ページのリンクをメールで送ります。', received: '納品書を顧客へ送り、案件完了になります。', cancel: '送ったリンクは使えなくなります。' }[ask]}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={ghost} onClick={() => setAsk(null)}>やめる</button>
              {ask === 'request' && <button type="button" className={dark} onClick={request}>依頼する</button>}
              {ask === 'received' && <button type="button" className={dark} onClick={() => decide('received')}>記録する</button>}
              {ask === 'cancel' && <button type="button" className={danger} onClick={() => decide('cancel')}>取り消す</button>}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
