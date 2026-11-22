'use client'

// 再設計 工程5: 請求書を発行して送る → 顧客の承認で契約成立。

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { issueOrderInvoice, recordAgreementDecision, type AgreementRow } from '@/lib/actions/order-agreement'
import { yen } from '@/lib/process/offer-format'
import { jpDate } from '@/lib/process/invoice-format'
import { useUi } from '@/components/ui/ui-store'

export interface InvoiceDraftLine { name: string; quantity: number; unitJpy: number; netJpy: number }

const ghost = 'min-h-[44px] inline-flex items-center justify-center rounded-full border border-[#E2E1DA] bg-white px-4 text-[12px] font-bold text-[#351E28] hover:bg-[#FBFAF6] disabled:opacity-40'
const dark = 'min-h-[44px] inline-flex items-center justify-center rounded-full bg-[#351E28] px-4 text-[12px] font-bold text-[#C9A2B8] hover:brightness-95 disabled:opacity-40'
const main = 'min-h-[44px] inline-flex items-center justify-center rounded-full bg-[#E9F056] px-5 text-[12.5px] font-extrabold text-[#666C14] hover:brightness-95 disabled:opacity-40'
const danger = 'min-h-[44px] inline-flex items-center justify-center rounded-full border border-[#FF5C34] bg-white px-4 text-[12px] font-bold text-[#B03616] disabled:opacity-40'
const pill = 'rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap'
const dateInput = 'min-h-[44px] rounded-[12px] border border-transparent bg-[#EFEFEA] px-3 text-[14px] tabular-nums text-[#351E28] outline-none focus:border-[#351E28]'
const day = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric' }) : ''
const addDays = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)

export function InvoicePanel({ dealId, lines, taxRate, agreements, issuerGaps, today, readOnly }: {
  dealId: string; lines: InvoiceDraftLine[]; taxRate: number; agreements: AgreementRow[]; issuerGaps: string[]; today: string; readOnly?: boolean
}) {
  const router = useRouter()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const [issueDate, setIssueDate] = useState(today)
  const [dueDate, setDueDate] = useState(addDays(today, 30))
  const [ask, setAsk] = useState<'issue' | 'agree' | 'cancel' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)

  const agreed = agreements.find(a => a.status === 'agreed') || null
  const open = agreements.find(a => a.status === 'sent') || null
  const shown = agreed || open
  const rows: InvoiceDraftLine[] = shown ? shown.snapshot.lines.map(l => ({ name: l.name, quantity: l.quantity, unitJpy: l.unit_jpy, netJpy: l.net_jpy })) : lines
  const subtotal = shown ? shown.snapshot.subtotal_jpy : lines.reduce((s, l) => s + l.netJpy, 0)
  const total = shown ? shown.snapshot.total_jpy : Math.ceil(subtotal * (1 + taxRate / 100) - 1e-9)

  const issue = () => { setAsk(null); setError(null); startTransition(async () => {
    const r = await issueOrderInvoice(dealId, issueDate, dueDate)
    setLink(r.link); setError(r.error)
    if (r.sent) toast(`${r.to} へ請求書を送りました`)
    router.refresh()
  }) }
  const decide = (decision: 'agree' | 'cancel') => { setAsk(null); setError(null); startTransition(async () => {
    const r = await recordAgreementDecision(dealId, decision)
    if (r.error) { setError(r.error); return }
    toast(decision === 'agree' ? '契約成立として記録しました' : '請求書を取り消しました'); router.refresh()
  }) }

  const badge = agreed ? <span className={pill + ' bg-[#D7EFFF] text-[#33566F]'}>契約成立 {day(agreed.agreedAt)}{agreed.agreedVia === 'staff' ? '（営業が記録）' : ''}</span>
    : open ? <span className={pill + ' bg-[#FFD8C2] text-[#B03616]'}>{open.sendStatus === 'accepted' ? `承認待ち（${day(open.sentAt)} 送信）` : '承認待ち（メール未送信）'}</span>
    : <span className={pill + ' border border-[#E2E1DA] bg-[#EFEFEA] text-[#351E28]'}>未発行</span>

  return (
    <section aria-label="請求書と契約" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex flex-wrap items-center gap-2 text-[15px] font-bold"><span className="sr-only">請求書と契約</span>{badge}{shown && <span className="text-[12.5px] font-normal text-[#84787D] tabular-nums">{shown.invoiceNumber} ・ 発行日 {jpDate(shown.issueDate)} ・ 振込期限 {jpDate(shown.dueDate)}</span>}</h3>
        {agreed && !readOnly && <Link href={`/deals/${dealId}?step=9`} className={main + ' no-underline'}>入稿に進む</Link>}
      </div>
      {issuerGaps.length > 0 && !shown && <p role="alert" className="rounded-[16px] border-[1.5px] border-[#FF5C34] bg-[#FFD8C2] p-3 text-[12.5px] text-[#B03616]">請求書に載せる情報が設定にありません: {issuerGaps.join('・')}<Link href="/settings" className="ml-2 underline">設定を開く</Link></p>}
      {error && <p role="alert" className="rounded-[16px] border-[1.5px] border-[#FF5C34] bg-[#FFD8C2] p-3 text-[12.5px] text-[#B03616]">{error}</p>}
      {link && <p className="flex flex-wrap items-center gap-2 text-[12.5px]"><span className="text-[#84787D]">請求書ページ</span><a href={link} target="_blank" rel="noreferrer" className="break-all underline">{link}</a>
        <button type="button" className={ghost} onClick={() => navigator.clipboard?.writeText(link).then(() => toast('リンクをコピーしました'))}>コピー</button></p>}

      {rows.length === 0 ? <p className="text-[13px] text-[#84787D]">承認済みのお見積がありません<Link href={`/deals/${dealId}?step=6`} className="ml-2 underline">価格提示を開く</Link></p> : (
        <div className="overflow-x-auto rounded-[16px] border border-[#E2E1DA] bg-white">
          <table aria-label="請求の明細" className="w-full text-[12.5px] tabular-nums">
            <thead><tr className="bg-[#FBFAF6] text-[11px] text-[#84787D]"><th className="px-4 py-2 text-left font-normal">商品</th><th className="px-2 py-2 text-right font-normal">数量</th><th className="px-2 py-2 text-right font-normal">単価</th><th className="px-4 py-2 text-right font-normal">金額</th></tr></thead>
            <tbody>
              {rows.map((l, i) => <tr key={i} className={`border-t border-[#E2E1DA] ${i % 2 ? 'bg-[#FBFAF6]' : ''}`}><td className="px-4 py-2 break-words">{l.name}</td><td className="whitespace-nowrap px-2 py-2 text-right">{l.quantity.toLocaleString('ja-JP')}個</td><td className="whitespace-nowrap px-2 py-2 text-right">{yen(l.unitJpy)}</td><td className="whitespace-nowrap px-4 py-2 text-right">{yen(l.netJpy)}</td></tr>)}
              <tr className="border-t border-[#E2E1DA]"><td colSpan={3} className="px-4 py-2 text-right text-[#84787D]">小計 {yen(subtotal)} ・ 消費税 {yen(total - subtotal)} ・ 合計（税込）</td><td className="whitespace-nowrap px-4 py-2 text-right text-[15px] font-extrabold">{yen(total)}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {!readOnly && !agreed && rows.length > 0 && (
        <div className="flex flex-wrap items-end justify-end gap-2">
          {open ? <>
            <button type="button" disabled={pending} className={danger} onClick={() => setAsk('cancel')}>請求書を取り消す</button>
            <button type="button" disabled={pending} className={ghost} onClick={() => setAsk('agree')}>承認済みとして記録</button>
          </> : <>
            <label className="text-[11px] text-[#84787D]">発行日<br /><input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className={dateInput} /></label>
            <label className="text-[11px] text-[#84787D]">振込期限<br /><input type="date" value={dueDate} min={issueDate} onChange={e => setDueDate(e.target.value)} className={dateInput} /></label>
            <button type="button" disabled={pending || issuerGaps.length > 0 || !issueDate || !dueDate || dueDate < issueDate} className={main} onClick={() => setAsk('issue')}>請求書を発行して送る</button>
          </>}
        </div>
      )}

      {agreements.length > 1 && (
        <ul aria-label="請求書の履歴" className="rounded-[16px] border border-[#E2E1DA] bg-white text-[12.5px] tabular-nums">
          {agreements.map(a => <li key={a.id} className="flex flex-wrap items-center gap-2 border-b border-[#E2E1DA] px-4 py-2 last:border-b-0"><span className="font-bold">{a.invoiceNumber}</span><span className="text-[#84787D]">{day(a.createdAt)}</span>
            <span className={pill + (a.status === 'agreed' ? ' bg-[#D7EFFF] text-[#33566F]' : a.status === 'cancelled' ? ' bg-[#AEB8A0] text-[#4C5544]' : ' bg-[#FFD8C2] text-[#B03616]')}>{a.status === 'agreed' ? '契約成立' : a.status === 'cancelled' ? '取り消し' : '承認待ち'}</span><span className="ml-auto">{yen(a.snapshot.total_jpy)}</span></li>)}
        </ul>
      )}

      {ask && (
        <div role="dialog" aria-modal="true" aria-label={{ issue: '請求書を発行して送る', agree: '承認済みとして記録', cancel: '請求書を取り消す' }[ask]} className="fixed inset-0 z-[70] flex items-center justify-center bg-[#351E28]/40 p-4">
          <div className="w-full max-w-[420px] rounded-[16px] border border-[#E2E1DA] bg-white p-4 shadow-[0_20px_50px_rgba(53,30,40,.12)]">
            <p className="text-[15px] font-bold">{{ issue: '請求書を発行して送りますか？', agree: '顧客の承認が取れましたか？', cancel: '請求書を取り消しますか？' }[ask]}</p>
            <p className="mt-1 text-[12.5px] text-[#84787D] tabular-nums">{{ issue: `合計 ${yen(total)} ・ 振込期限 ${jpDate(dueDate)}`, agree: '契約成立として履歴に残ります。', cancel: '送ったリンクは使えなくなります。' }[ask]}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={ghost} onClick={() => setAsk(null)}>やめる</button>
              {ask === 'issue' && <button type="button" className={dark} onClick={issue}>発行して送る</button>}
              {ask === 'agree' && <button type="button" className={dark} onClick={() => decide('agree')}>記録する</button>}
              {ask === 'cancel' && <button type="button" className={danger} onClick={() => decide('cancel')}>取り消す</button>}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
