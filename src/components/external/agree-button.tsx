'use client'

import { useState, useTransition } from 'react'
import { agreeByCustomer } from '@/lib/actions/order-agreement'

export function AgreeButton({ token }: { token: string }) {
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (done) return <p role="status" className="rounded-[16px] bg-[#D7EFFF] p-4 text-[14px] font-bold text-[#33566F]">ご発注を承りました。ご契約成立です。ありがとうございます。</p>
  return (
    <div>
      {error && <p role="alert" className="mb-3 rounded-[16px] border-[1.5px] border-[#FF5C34] bg-[#FFD8C2] p-3 text-[13px] text-[#B03616]">{error}</p>}
      <button type="button" disabled={pending} onClick={() => { setError(null); startTransition(async () => { const r = await agreeByCustomer(token); if (r.success) setDone(true); else setError(r.error || '記録できませんでした') }) }}
        className="min-h-[48px] w-full rounded-full bg-[#E9F056] px-6 text-[15px] font-extrabold text-[#666C14] hover:brightness-95 disabled:opacity-60 sm:w-auto">{pending ? '送信しています…' : 'この内容で発注する'}</button>
      <p className="mt-2 text-[12.5px] text-[#84787D]">ボタンを押した時点でご契約成立となります。</p>
    </div>
  )
}
