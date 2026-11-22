'use client'

import { useState, useTransition } from 'react'
import { confirmReceiptByCustomer } from '@/lib/actions/deal-receipt'

export function ReceiveButton({ token }: { token: string }) {
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (done) return <div role="status" className="rounded-[16px] bg-[#D7EFFF] p-4 text-[#33566F]"><p className="text-[14px] font-bold">受領のご確認ありがとうございました。</p>
    <a href={`/external/receipt/${token}/delivery-note`} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-[44px] items-center text-[13px] font-bold underline">納品書を開く</a></div>
  return (
    <div>
      {error && <p role="alert" className="mb-3 rounded-[16px] border-[1.5px] border-[#FF5C34] bg-[#FFD8C2] p-3 text-[13px] text-[#B03616]">{error}</p>}
      <button type="button" disabled={pending} onClick={() => { setError(null); startTransition(async () => { const r = await confirmReceiptByCustomer(token); if (r.success) setDone(true); else setError(r.error || '記録できませんでした') }) }}
        className="min-h-[48px] w-full rounded-full bg-[#E9F056] px-6 text-[15px] font-extrabold text-[#666C14] hover:brightness-95 disabled:opacity-60 sm:w-auto">{pending ? '送信しています…' : '受領しました'}</button>
      <p className="mt-2 text-[12.5px] text-[#84787D]">数量の不足や破損がある場合は、届いたメールにご返信ください。</p>
    </div>
  )
}
