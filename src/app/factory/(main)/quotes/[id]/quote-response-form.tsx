'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { submitQuoteResponse } from '@/lib/actions/factory'

interface QuoteResponseFormProps {
  dealId: string
}

export function QuoteResponseForm({ dealId }: QuoteResponseFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    unitPriceUsd: '',
    shippingCostUsd: '',
    plateCostUsd: '',
    productionDays: '',
    moq: '',
    notes: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await submitQuoteResponse({
      dealId,
      unitPriceUsd: parseFloat(formData.unitPriceUsd) || 0,
      shippingCostUsd: parseFloat(formData.shippingCostUsd) || 0,
      plateCostUsd: parseFloat(formData.plateCostUsd) || 0,
      productionDays: parseInt(formData.productionDays) || 0,
      moq: parseInt(formData.moq) || undefined,
      notes: formData.notes || undefined,
    })

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    router.push('/factory/quotes')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
      <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a] mb-4">
        見積もり回答
      </h2>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Unit Price */}
        <div>
          <label className="block text-[12px] text-[#888] font-body mb-[6px]">
            単価 (USD) <span className="text-[#e5a32e]">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            required
            value={formData.unitPriceUsd}
            onChange={(e) => setFormData({ ...formData, unitPriceUsd: e.target.value })}
            className="w-full bg-[#f2f2f0] rounded-[10px] px-[14px] py-[10px] text-[13px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6]"
            placeholder="0.00"
          />
        </div>

        {/* Shipping Cost */}
        <div>
          <label className="block text-[12px] text-[#888] font-body mb-[6px]">
            送料 (USD) <span className="text-[#e5a32e]">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            required
            value={formData.shippingCostUsd}
            onChange={(e) => setFormData({ ...formData, shippingCostUsd: e.target.value })}
            className="w-full bg-[#f2f2f0] rounded-[10px] px-[14px] py-[10px] text-[13px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6]"
            placeholder="0.00"
          />
        </div>

        {/* Plate Cost */}
        <div>
          <label className="block text-[12px] text-[#888] font-body mb-[6px]">
            版代 (USD)
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.plateCostUsd}
            onChange={(e) => setFormData({ ...formData, plateCostUsd: e.target.value })}
            className="w-full bg-[#f2f2f0] rounded-[10px] px-[14px] py-[10px] text-[13px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6]"
            placeholder="0.00"
          />
        </div>

        {/* Production Days */}
        <div>
          <label className="block text-[12px] text-[#888] font-body mb-[6px]">
            製造日数 <span className="text-[#e5a32e]">*</span>
          </label>
          <input
            type="number"
            required
            value={formData.productionDays}
            onChange={(e) => setFormData({ ...formData, productionDays: e.target.value })}
            className="w-full bg-[#f2f2f0] rounded-[10px] px-[14px] py-[10px] text-[13px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6]"
            placeholder="日"
          />
        </div>

        {/* MOQ */}
        <div>
          <label className="block text-[12px] text-[#888] font-body mb-[6px]">
            最小ロット (MOQ)
          </label>
          <input
            type="number"
            value={formData.moq}
            onChange={(e) => setFormData({ ...formData, moq: e.target.value })}
            className="w-full bg-[#f2f2f0] rounded-[10px] px-[14px] py-[10px] text-[13px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6]"
            placeholder="個"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="mb-4">
        <label className="block text-[12px] text-[#888] font-body mb-[6px]">
          備考
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          className="w-full bg-[#f2f2f0] rounded-[10px] px-[14px] py-[10px] text-[13px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6] resize-none"
          placeholder="その他の条件や注意事項があれば記入してください"
        />
      </div>

      {error && (
        <div className="mb-4 text-[12px] py-2 px-3 rounded-[8px] bg-[rgba(229,163,46,0.1)] text-[#e5a32e] font-body">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#0a0a0a] text-white rounded-[8px] px-4 py-[10px] text-[13px] font-medium font-body disabled:opacity-50"
      >
        {loading ? '送信中...' : '見積もりを回答する'}
      </button>
    </form>
  )
}
