'use client'

import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createSample } from '@/lib/actions/samples'

interface Props {
  params: Promise<{ id: string }>
}

export default function NewSamplePage({ params }: Props) {
  const { id } = use(params)
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const productionFee = formData.get('production_fee') as string
    const shippingFee = formData.get('shipping_fee') as string
    const plateFee = formData.get('plate_fee') as string

    const result = await createSample({
      deal_id: id,
      sample_production_fee_usd: productionFee ? parseFloat(productionFee) : undefined,
      sample_shipping_fee_usd: shippingFee ? parseFloat(shippingFee) : undefined,
      plate_fee_usd: plateFee ? parseFloat(plateFee) : undefined,
    })

    if (result.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      router.push(`/deals/${id}`)
    }
  }

  const inputClassName = "w-full bg-[#f2f2f0] rounded-[10px] px-[14px] py-[10px] text-[13px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6] transition-all"

  return (
    <>
      <div className="py-[18px]">
        <Link
          href={`/deals/${id}`}
          className="text-[13px] text-[#888] hover:text-[#555] font-body mb-2 inline-block"
        >
          ← 案件詳細
        </Link>
        <h1 className="font-display text-[22px] font-semibold text-[#0a0a0a]">
          サンプル依頼
        </h1>
        <p className="text-[13px] text-[#888] font-body mt-1">
          工場にサンプル製造を依頼します
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
          <h2 className="text-[14px] font-medium text-[#0a0a0a] mb-4 font-body">
            サンプル費用（オプション）
          </h2>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-[12px] text-[#888] mb-1 font-body">
                製造費用 (USD)
              </label>
              <input
                type="number"
                name="production_fee"
                step="0.01"
                min="0"
                className={inputClassName}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-[12px] text-[#888] mb-1 font-body">
                送料 (USD)
              </label>
              <input
                type="number"
                name="shipping_fee"
                step="0.01"
                min="0"
                className={inputClassName}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-[12px] text-[#888] mb-1 font-body">
                版代 (USD)
              </label>
              <input
                type="number"
                name="plate_fee"
                step="0.01"
                min="0"
                className={inputClassName}
                placeholder="0.00"
              />
            </div>
          </div>

          <p className="text-[11px] text-[#888] mt-3 font-body">
            費用は工場からの回答後に更新できます
          </p>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-[#fef3c7] rounded-[10px] text-[12px] text-[#92400e] font-body">
            {error}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 bg-[#0a0a0a] text-white rounded-[8px] py-3 text-[13px] font-medium font-body disabled:opacity-50 transition-opacity"
          >
            {submitting ? '送信中...' : 'サンプルを依頼する'}
          </button>
          <Link
            href={`/deals/${id}`}
            className="px-6 py-3 bg-white border border-[#e8e8e6] rounded-[8px] text-[13px] text-[#555] font-body no-underline text-center"
          >
            キャンセル
          </Link>
        </div>
      </form>
    </>
  )
}
