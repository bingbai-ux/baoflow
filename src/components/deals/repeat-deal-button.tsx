'use client'

// Sprint 10 (E): リピート注文。商品・バリエ仕様を引き継いで新しい案件を作る。
// 見積(価格)は引き継がない — 価格は必ず再確認する(要件3.8)。

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { reorderDeal } from '@/lib/actions/deals'
import { useUi } from '@/components/ui/ui-store'

export function RepeatDealButton({ dealId, dealName }: { dealId: string; dealName: string | null }) {
  const router = useRouter()
  const { toast } = useUi()
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  const run = () => {
    startTransition(async () => {
      const r = await reorderDeal(dealId)
      if (r.data) {
        toast(`リピート案件を作成しました(${r.data.deal_code})`)
        router.push(`/deals/${r.data.id}`)
      } else {
        toast(r.error || 'リピート作成に失敗しました', 'warn')
        setConfirming(false)
      }
    })
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="text-[11px] text-[#84787D] font-body">仕様を引き継いで新規作成(見積は引き継ぎません):</span>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="rounded-full bg-[#351E28] text-[#C9A2B8] text-[12px] font-bold px-3.5 py-2 hover:brightness-95 disabled:opacity-50"
        >
          {pending ? '作成中…' : 'リピートを作る'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="rounded-full text-[#84787D] text-[12px] px-2.5 py-2 hover:bg-[#EFEFEA]"
        >
          やめる
        </button>
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      title={`「${dealName || 'この案件'}」の商品仕様を引き継いだ新しい案件を作る`}
      className="bg-white text-[#351E28] border border-[#E2E1DA] rounded-full px-3.5 py-2 text-[12px] font-medium font-body inline-flex items-center gap-1 hover:bg-[#FBFAF6]"
    >
      リピート注文
    </button>
  )
}
