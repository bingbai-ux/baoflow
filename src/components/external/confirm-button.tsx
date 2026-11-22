'use client'

import { useState, useTransition } from 'react'
import { confirmByCustomer } from '@/lib/actions/customer-confirmation'

export function ConfirmButton({ token }: { token: string }) {
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (done) return <p role="status" className="rounded-[16px] bg-[#D7EFFF] p-4 text-[14px] font-bold text-[#33566F]">確認を受け付けました。ありがとうございます。</p>
  return (
    <div>
      {error && <p role="alert" className="mb-3 rounded-[16px] border-[1.5px] border-[#FF5C34] bg-[#FFD8C2] p-3 text-[13px] text-[#B03616]">{error}</p>}
      <button type="button" disabled={pending} onClick={() => { setError(null); startTransition(async () => { const r = await confirmByCustomer(token); if (r.success) setDone(true); else setError(r.error || '確認を記録できませんでした') }) }}
        className="min-h-[48px] w-full rounded-full bg-[#E9F056] px-6 text-[15px] font-extrabold text-[#666C14] hover:brightness-95 disabled:opacity-60 sm:w-auto">{pending ? '送信しています…' : 'この内容で進める'}</button>
      <p className="mt-2 text-[12.5px] text-[#84787D]">修正がある場合は、届いたメールにご返信ください。</p>
    </div>
  )
}
