'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { estimatePrice, createDraftFromSmartQuote } from '@/lib/actions/smart-quote'

const PRODUCT_CATEGORIES = [
  'コーヒーバッグ',
  'ギフトボックス',
  'ショッピングバッグ',
  'カップ',
  '蓋',
  'パウチ',
  '紙袋',
  'その他',
]

const MATERIALS = [
  'クラフト紙',
  'コート紙',
  'アイボリー紙',
  '段ボール',
  'PP',
  'PET',
  'アルミ',
  'スチール',
  '不織布',
  'その他',
]

const SIZES = ['S', 'M', 'L', 'カスタム']
const PRINTING = ['無地', '1色', '2色', 'フルカラー']

interface FactoryEstimate {
  factoryId: string
  factoryName: string
  estimatedUnitPrice: number
  estimatedShipping: number
  estimatedTotal: number
  confidence: 'high' | 'medium' | 'low'
  confidenceReason: string
  dataPoints: number
}

export default function SmartQuotePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [estimates, setEstimates] = useState<FactoryEstimate[]>([])
  const [formData, setFormData] = useState({
    productCategory: '',
    material: '',
    size: '',
    printing: '',
    quantity: '',
  })

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const results = await estimatePrice({
      productCategory: formData.productCategory,
      material: formData.material,
      size: formData.size,
      printing: formData.printing,
      quantity: parseInt(formData.quantity) || 0,
    })

    setEstimates(results)
    setLoading(false)
  }

  const handleCreateDraft = async (factoryId: string) => {
    setLoading(true)
    const result = await createDraftFromSmartQuote({
      factoryId,
      conditions: {
        productCategory: formData.productCategory,
        material: formData.material,
        size: formData.size,
        printing: formData.printing,
        quantity: parseInt(formData.quantity) || 0,
      },
    })

    if (result.success && result.dealId) {
      router.push(`/deals/${result.dealId}`)
    } else {
      alert(result.error || 'エラーが発生しました')
      setLoading(false)
    }
  }

  // Confidence indicator with dots
  const ConfidenceDots = ({ level }: { level: string }) => {
    const colors = {
      high: '#22c55e',
      medium: '#e5a32e',
      low: '#bbbbbb',
    }
    const color = colors[level as keyof typeof colors] || colors.low
    const count = level === 'high' ? 3 : level === 'medium' ? 2 : 1
    return (
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-[6px] h-[6px] rounded-full"
            style={{ backgroundColor: i < count ? color : '#e8e8e6' }}
          />
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="py-[18px]">
        <h1 className="font-display text-[22px] font-semibold text-[#0a0a0a]">
          スマート見積もり
        </h1>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5 mb-4">
        <h2 className="text-[14px] font-body font-medium text-[#0a0a0a] mb-4">
          条件入力
        </h2>
        <div className="grid grid-cols-5 gap-4 mb-4">
          <div>
            <label className="block text-[12px] text-[#888] font-body mb-[6px]">
              商品カテゴリ <span className="text-[#e5a32e]">*</span>
            </label>
            <select
              required
              value={formData.productCategory}
              onChange={(e) => setFormData({ ...formData, productCategory: e.target.value })}
              className="w-full bg-[#f2f2f0] rounded-[10px] px-[14px] py-[10px] text-[13px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6]"
            >
              <option value="">選択</option>
              {PRODUCT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[12px] text-[#888] font-body mb-[6px]">
              素材 <span className="text-[#e5a32e]">*</span>
            </label>
            <select
              required
              value={formData.material}
              onChange={(e) => setFormData({ ...formData, material: e.target.value })}
              className="w-full bg-[#f2f2f0] rounded-[10px] px-[14px] py-[10px] text-[13px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6]"
            >
              <option value="">選択</option>
              {MATERIALS.map((mat) => (
                <option key={mat} value={mat}>{mat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[12px] text-[#888] font-body mb-[6px]">
              サイズ
            </label>
            <select
              value={formData.size}
              onChange={(e) => setFormData({ ...formData, size: e.target.value })}
              className="w-full bg-[#f2f2f0] rounded-[10px] px-[14px] py-[10px] text-[13px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6]"
            >
              <option value="">選択</option>
              {SIZES.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[12px] text-[#888] font-body mb-[6px]">
              印刷
            </label>
            <select
              value={formData.printing}
              onChange={(e) => setFormData({ ...formData, printing: e.target.value })}
              className="w-full bg-[#f2f2f0] rounded-[10px] px-[14px] py-[10px] text-[13px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6]"
            >
              <option value="">選択</option>
              {PRINTING.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[12px] text-[#888] font-body mb-[6px]">
              数量 <span className="text-[#e5a32e]">*</span>
            </label>
            <input
              type="number"
              required
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              className="w-full bg-[#f2f2f0] rounded-[10px] px-[14px] py-[10px] text-[13px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6]"
              placeholder="個"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-[#0a0a0a] text-white rounded-[8px] px-6 py-[10px] text-[13px] font-medium font-body disabled:opacity-50"
        >
          {loading ? '検索中...' : '見積もり検索'}
        </button>
      </form>

      {/* Results */}
      {estimates.length > 0 && (
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] overflow-hidden">
          <div className="p-4 border-b border-[rgba(0,0,0,0.06)]">
            <h2 className="text-[14px] font-body font-medium text-[#0a0a0a]">
              工場別比較表 ({estimates.length}件)
            </h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-[#fafaf9] border-b border-[rgba(0,0,0,0.06)]">
                <th className="text-left py-3 px-4 text-[9px] font-medium text-[#b0b0b0] font-body uppercase tracking-wider">工場名</th>
                <th className="text-right py-3 px-4 text-[9px] font-medium text-[#b0b0b0] font-body uppercase tracking-wider">推定単価</th>
                <th className="text-right py-3 px-4 text-[9px] font-medium text-[#b0b0b0] font-body uppercase tracking-wider">推定送料</th>
                <th className="text-right py-3 px-4 text-[9px] font-medium text-[#b0b0b0] font-body uppercase tracking-wider">推定合計</th>
                <th className="text-center py-3 px-4 text-[9px] font-medium text-[#b0b0b0] font-body uppercase tracking-wider">信頼度</th>
                <th className="text-right py-3 px-4 text-[9px] font-medium text-[#b0b0b0] font-body uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody>
              {estimates.map((est, index) => (
                <tr key={est.factoryId} className={`${index < estimates.length - 1 ? 'border-b border-[rgba(0,0,0,0.06)]' : ''} hover:bg-[#fcfcfb]`}>
                  <td className="py-3 px-4 text-[13px] text-[#0a0a0a] font-body">{est.factoryName}</td>
                  <td className="py-3 px-4 text-right font-display tabular-nums text-[13px] text-[#0a0a0a]">
                    {est.estimatedUnitPrice > 0 ? `$${est.estimatedUnitPrice.toFixed(2)}` : '-'}
                  </td>
                  <td className="py-3 px-4 text-right font-display tabular-nums text-[13px] text-[#888]">
                    {est.estimatedShipping > 0 ? `$${est.estimatedShipping.toFixed(2)}` : '-'}
                  </td>
                  <td className="py-3 px-4 text-right font-display tabular-nums text-[13px] font-semibold text-[#0a0a0a]">
                    {est.estimatedTotal > 0 ? `$${est.estimatedTotal.toFixed(2)}` : '-'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col items-center gap-1">
                      <ConfidenceDots level={est.confidence} />
                      <p className="text-[10px] text-[#888] font-body">{est.confidenceReason}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleCreateDraft(est.factoryId)}
                      disabled={loading}
                      className="text-[11px] text-white bg-[#0a0a0a] px-3 py-1.5 rounded-[6px] font-body disabled:opacity-50"
                    >
                      ドラフト作成
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {estimates.length === 0 && !loading && (
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-10 text-center">
          <p className="text-[13px] text-[#888] font-body">
            条件を入力して「見積もり検索」をクリックしてください
          </p>
        </div>
      )}
    </>
  )
}
