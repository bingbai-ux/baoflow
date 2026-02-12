'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { estimatePrice } from '@/lib/actions/smart-quote'

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

interface DealData {
  id: string
  deal_code: string
  deal_name: string
  master_status: string
  specifications?: {
    product_category?: string
    material_category?: string
  }[]
}

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

export default function DealSmartQuotePage() {
  const router = useRouter()
  const params = useParams()
  const dealId = params.id as string

  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deal, setDeal] = useState<DealData | null>(null)
  const [estimates, setEstimates] = useState<FactoryEstimate[]>([])
  const [formData, setFormData] = useState({
    productCategory: '',
    material: '',
    size: '',
    printing: '',
    quantity: '',
  })

  useEffect(() => {
    const loadDeal = async () => {
      const supabase = createClient()
      const { data: dealData } = await supabase
        .from('deals')
        .select(`
          id,
          deal_code,
          deal_name,
          master_status,
          specifications:deal_specifications(product_category, material_category)
        `)
        .eq('id', dealId)
        .single()

      if (dealData) {
        setDeal(dealData)
        const spec = dealData.specifications?.[0]
        if (spec) {
          setFormData((prev) => ({
            ...prev,
            productCategory: spec.product_category || '',
            material: spec.material_category || '',
          }))
        }
      }
      setLoading(false)
    }

    loadDeal()
  }, [dealId])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setSearching(true)

    const results = await estimatePrice({
      productCategory: formData.productCategory,
      material: formData.material,
      size: formData.size,
      printing: formData.printing,
      quantity: parseInt(formData.quantity) || 0,
    })

    setEstimates(results)
    setSearching(false)
  }

  const handleAdoptEstimate = async (estimate: FactoryEstimate) => {
    setCreating(true)
    const supabase = createClient()

    try {
      // Create deal_quote from the estimate
      await supabase.from('deal_quotes').insert({
        deal_id: dealId,
        factory_id: estimate.factoryId,
        quantity: parseInt(formData.quantity) || 0,
        factory_unit_price_usd: estimate.estimatedUnitPrice,
        status: 'drafting',
        source_type: 'smart_quote',
      })

      // Create factory assignment
      await supabase.from('deal_factory_assignments').upsert({
        deal_id: dealId,
        factory_id: estimate.factoryId,
        status: 'requesting',
      })

      // Update deal status to M06 (quote created)
      await supabase
        .from('deals')
        .update({ master_status: 'M06' })
        .eq('id', dealId)

      router.push(`/deals/${dealId}`)
      router.refresh()
    } catch (error) {
      console.error('Failed to adopt estimate:', error)
      setCreating(false)
    }
  }

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

  if (loading) {
    return (
      <div className="px-[26px] py-5">
        <p className="text-[13px] text-[#888] font-body">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="px-[26px] py-5 space-y-5">
      <Link
        href={`/deals/${dealId}`}
        className="inline-flex items-center gap-1 text-[12px] text-[#888] font-body hover:text-[#0a0a0a] no-underline"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        案件詳細に戻る
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-display font-semibold text-[#0a0a0a]">
            スマート見積もり
          </h1>
          <p className="text-[12px] text-[#888] font-body mt-1">
            過去データに基づく価格推定
          </p>
        </div>
        <span className="text-[12px] font-display tabular-nums text-[#888]">
          {deal?.deal_code}
        </span>
      </div>

      {/* Info Banner */}
      <div className="bg-[rgba(34,197,94,0.1)] rounded-[12px] p-4">
        <p className="text-[12px] text-[#22c55e] font-body">
          この案件の仕様に基づいて、過去の価格データから推定価格を算出します。
          推定結果を採用すると、見積もりドラフトが自動作成されます。
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5">
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
          disabled={searching}
          className="bg-[#0a0a0a] text-white rounded-[8px] px-6 py-[10px] text-[13px] font-medium font-body disabled:opacity-50"
        >
          {searching ? '検索中...' : '見積もり検索'}
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
                      onClick={() => handleAdoptEstimate(est)}
                      disabled={creating}
                      className="text-[11px] text-white bg-[#22c55e] px-3 py-1.5 rounded-[6px] font-body disabled:opacity-50"
                    >
                      {creating ? '処理中...' : 'この見積もりを採用'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {estimates.length === 0 && !searching && (
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-10 text-center">
          <p className="text-[13px] text-[#888] font-body">
            条件を入力して「見積もり検索」をクリックしてください
          </p>
        </div>
      )}
    </div>
  )
}
