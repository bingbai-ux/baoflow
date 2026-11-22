'use client'

// 再設計 工程3: 顧客への商品内容の確認（送る・状態を見る・電話などで確認できたら記録する）。

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { recordCustomerConfirmed, sendCustomerConfirmation, type ConfirmationState } from '@/lib/actions/customer-confirmation'
import { useUi } from '@/components/ui/ui-store'

const ghost = 'min-h-[44px] inline-flex items-center justify-center rounded-full border border-[#E2E1DA] bg-white px-4 text-[12px] font-bold text-[#351E28] hover:bg-[#FBFAF6] disabled:opacity-40'
const dark = 'min-h-[44px] inline-flex items-center justify-center rounded-full bg-[#351E28] px-4 text-[12px] font-bold text-[#C9A2B8] hover:brightness-95 disabled:opacity-40'
const pill = 'rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap'
const day = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric' }) : ''

export function CustomerConfirmPanel({ dealId, state, hasProducts, readOnly }: { dealId: string; state: ConfirmationState; hasProducts: boolean; readOnly?: boolean }) {
  const router = useRouter()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const [ask, setAsk] = useState<'send' | 'record' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)

  const send = () => { setAsk(null); setError(null); startTransition(async () => {
    const r = await sendCustomerConfirmation(dealId)
    setLink(r.link); setError(r.error)
    if (r.sent) toast(`${r.to} へ確認メールを送りました`)
    router.refresh()
  }) }
  const record = () => { setAsk(null); setError(null); startTransition(async () => {
    const r = await recordCustomerConfirmed(dealId)
    if (r.error) { setError(r.error); return }
    toast('確認済みとして記録しました'); router.refresh()
  }) }

  const badge = state.status === 'confirmed' ? <span className={pill + ' bg-[#D7EFFF] text-[#33566F]'}>確認済み {day(state.confirmedAt)}{state.via === 'staff' ? '（営業が記録）' : ''}</span>
    : state.status === 'pending' ? <span className={pill + ' bg-[#FFD8C2] text-[#B03616]'}>{state.sendStatus === 'accepted' ? `返事待ち（${day(state.sentAt)} 送信）` : '返事待ち（メール未送信）'}</span>
    : <span className={pill + ' border border-[#E2E1DA] bg-[#EFEFEA] text-[#351E28]'}>未依頼</span>

  return (
    <section aria-label="顧客の確認" className="rounded-[16px] border border-[#E2E1DA] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-2 text-[15px] font-bold"><span className="tabular-nums text-[#84787D]">1</span>顧客に内容を確認 {badge}</h3>
          {state.status !== 'none' && <p className="mt-1 break-all text-[12.5px] text-[#84787D]">宛先: {state.contactName || '担当者未登録'}{state.contactEmail ? ` <${state.contactEmail}>` : ''}</p>}
        </div>
        {!readOnly && <div className="flex flex-wrap gap-2">
          <button type="button" disabled={pending || !hasProducts} onClick={() => setAsk('send')} className={state.status === 'none' ? dark : ghost}>{state.status === 'none' ? '確認メールを送る' : '送り直す'}</button>
          {state.status !== 'confirmed' && <button type="button" disabled={pending || !hasProducts} onClick={() => setAsk('record')} className={ghost}>確認済みとして記録</button>}
        </div>}
      </div>
      {error && <p role="alert" className="mt-3 rounded-[16px] border-[1.5px] border-[#FF5C34] bg-[#FFD8C2] p-3 text-[12.5px] text-[#B03616]">{error}</p>}
      {link && <p className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px]"><span className="text-[#84787D]">確認ページ</span><a href={link} target="_blank" rel="noreferrer" className="break-all underline">{link}</a>
        <button type="button" className={ghost} onClick={() => navigator.clipboard?.writeText(link).then(() => toast('リンクをコピーしました'))}>コピー</button></p>}

      {ask && (
        <div role="dialog" aria-modal="true" aria-label={ask === 'send' ? '確認メールを送る' : '確認済みとして記録'} className="fixed inset-0 z-[70] flex items-center justify-center bg-[#351E28]/40 p-4">
          <div className="w-full max-w-[420px] rounded-[16px] border border-[#E2E1DA] bg-white p-4 shadow-[0_20px_50px_rgba(53,30,40,.12)]">
            <p className="text-[15px] font-bold">{ask === 'send' ? '商品内容の確認メールを送りますか？' : '顧客の確認が取れましたか？'}</p>
            <p className="mt-1 text-[12.5px] text-[#84787D]">{ask === 'send' ? '明細PDFと確認ページのリンクを送ります。' : '履歴に残ります。'}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={ghost} onClick={() => setAsk(null)}>やめる</button>
              <button type="button" className={dark} onClick={ask === 'send' ? send : record}>{ask === 'send' ? '送る' : '記録する'}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
