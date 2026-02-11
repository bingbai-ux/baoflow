'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface DealData {
  id: string
  deal_code: string
  deal_name: string
  shipping?: {
    packing_info?: {
      weight_kg?: number
      carton_count?: number
      cbm?: number
    }
  }[]
  specifications?: {
    product_category?: string
  }[]
}

interface LogisticsAgent {
  id: string
  name: string
  services: string[]
  is_primary: boolean
}

export default function ShipmentWizardPage() {
  const router = useRouter()
  const params = useParams()
  const dealId = params.id as string

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deal, setDeal] = useState<DealData | null>(null)
  const [agents, setAgents] = useState<LogisticsAgent[]>([])

  const [formData, setFormData] = useState({
    weightKg: '',
    cartonCount: '',
    cbm: '',
    agentId: '',
    deliveryMethod: '',
    requiresInspection: false,
    estimatedInspectionCost: 0,
    estimatedShippingCost: 0,
    estimatedDeliveryDays: 0,
  })

  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient()

      // Get deal
      const { data: dealData } = await supabase
        .from('deals')
        .select(`
          id,
          deal_code,
          deal_name,
          shipping:deal_shipping(packing_info),
          specifications:deal_specifications(product_category)
        `)
        .eq('id', dealId)
        .single()

      if (dealData) {
        setDeal(dealData)
        const packingInfo = dealData.shipping?.[0]?.packing_info as Record<string, number> | undefined
        if (packingInfo) {
          setFormData((prev) => ({
            ...prev,
            weightKg: packingInfo.weight_kg?.toString() || '',
            cartonCount: packingInfo.carton_count?.toString() || '',
            cbm: packingInfo.cbm?.toString() || '',
          }))
        }
      }

      // Get logistics agents
      const { data: agentsData } = await supabase
        .from('logistics_agents')
        .select('*')
        .eq('is_active', true)
        .order('is_primary', { ascending: false })

      if (agentsData) {
        setAgents(agentsData)
      }

      setLoading(false)
    }

    loadData()
  }, [dealId])

  const handleNext = () => {
    if (step < 4) setStep(step + 1)
  }

  const handleBack = () => {
    if (step > 1) setStep(step - 1)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    const supabase = createClient()

    // Update shipping info
    const { data: existing } = await supabase
      .from('deal_shipping')
      .select('id')
      .eq('deal_id', dealId)
      .single()

    const shippingData = {
      packing_info: {
        weight_kg: parseFloat(formData.weightKg) || 0,
        carton_count: parseInt(formData.cartonCount) || 0,
        cbm: parseFloat(formData.cbm) || 0,
      },
      logistics_agent_id: formData.agentId,
      delivery_method: formData.deliveryMethod,
      estimated_shipping_cost: formData.estimatedShippingCost,
      estimated_delivery_days: formData.estimatedDeliveryDays,
    }

    if (existing) {
      await supabase
        .from('deal_shipping')
        .update(shippingData)
        .eq('id', existing.id)
    } else {
      await supabase.from('deal_shipping').insert({
        deal_id: dealId,
        ...shippingData,
      })
    }

    // Update deal status to M22
    await supabase
      .from('deals')
      .update({ master_status: 'M22' })
      .eq('id', dealId)

    router.push(`/deals/${dealId}`)
    router.refresh()
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
        <h1 className="text-[20px] font-display font-semibold text-[#0a0a0a]">
          出荷ウィザード
        </h1>
        <span className="text-[12px] font-display tabular-nums text-[#888]">
          {deal?.deal_code}
        </span>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-display font-semibold ${
                s < step
                  ? 'bg-[#22c55e] text-white'
                  : s === step
                  ? 'bg-[#0a0a0a] text-white'
                  : 'bg-[#e8e8e6] text-[#888]'
              }`}
            >
              {s < step ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                s
              )}
            </div>
            {s < 4 && <div className={`w-20 h-[2px] mx-2 ${s < step ? 'bg-[#22c55e]' : 'bg-[#e8e8e6]'}`} />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
        {step === 1 && (
          <div>
            <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a] mb-4">
              Step 1: 重量・サイズ確認
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-[12px] text-[#888] font-body mb-[6px]">
                  総重量 (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.weightKg}
                  onChange={(e) => setFormData({ ...formData, weightKg: e.target.value })}
                  className="w-full bg-[#f2f2f0] rounded-[10px] px-[14px] py-[10px] text-[13px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6]"
                />
              </div>
              <div>
                <label className="block text-[12px] text-[#888] font-body mb-[6px]">
                  カートン数
                </label>
                <input
                  type="number"
                  value={formData.cartonCount}
                  onChange={(e) => setFormData({ ...formData, cartonCount: e.target.value })}
                  className="w-full bg-[#f2f2f0] rounded-[10px] px-[14px] py-[10px] text-[13px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6]"
                />
              </div>
              <div>
                <label className="block text-[12px] text-[#888] font-body mb-[6px]">
                  CBM
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.cbm}
                  onChange={(e) => setFormData({ ...formData, cbm: e.target.value })}
                  className="w-full bg-[#f2f2f0] rounded-[10px] px-[14px] py-[10px] text-[13px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6]"
                />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a] mb-4">
              Step 2: 配送方法選択
            </h2>
            <div className="space-y-3">
              {agents.map((agent) => (
                <label
                  key={agent.id}
                  className={`flex items-center justify-between p-4 rounded-[12px] border cursor-pointer ${
                    formData.agentId === agent.id
                      ? 'border-[#0a0a0a] bg-[#f2f2f0]'
                      : 'border-[rgba(0,0,0,0.06)]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="agent"
                      value={agent.id}
                      checked={formData.agentId === agent.id}
                      onChange={(e) => setFormData({ ...formData, agentId: e.target.value })}
                      className="w-4 h-4"
                    />
                    <div>
                      <p className="text-[13px] text-[#0a0a0a] font-body font-medium">{agent.name}</p>
                      <p className="text-[11px] text-[#888] font-body">{agent.services?.join(' / ')}</p>
                    </div>
                  </div>
                  {agent.is_primary && (
                    <span className="text-[10px] text-[#22c55e] font-body">推奨</span>
                  )}
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a] mb-4">
              Step 3: 食品届出確認
            </h2>
            <div className="space-y-4">
              <div className="p-4 bg-[#f2f2f0] rounded-[12px]">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${formData.requiresInspection ? 'bg-[#e5a32e]' : 'bg-[#22c55e]'}`} />
                  <span className="text-[13px] text-[#0a0a0a] font-body font-medium">
                    {formData.requiresInspection ? '要検査' : '検査不要'}
                  </span>
                </div>
                <p className="text-[12px] text-[#888] font-body">
                  {formData.requiresInspection
                    ? '未登録品目のため、検査が必要です。'
                    : '品目登録済みのため、検査は不要です。'}
                </p>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.requiresInspection}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      requiresInspection: e.target.checked,
                      estimatedInspectionCost: e.target.checked ? 30000 : 0,
                    })
                  }
                  className="w-4 h-4"
                />
                <span className="text-[13px] text-[#0a0a0a] font-body">検査が必要</span>
              </label>

              {formData.requiresInspection && (
                <div className="p-4 bg-[rgba(229,163,46,0.1)] rounded-[12px]">
                  <p className="text-[12px] text-[#e5a32e] font-body">
                    推定検査費用: ¥{formData.estimatedInspectionCost.toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a] mb-4">
              Step 4: コスト確認・手配開始
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-[#f2f2f0] rounded-[12px]">
                  <p className="text-[11px] text-[#888] font-body mb-1">総重量</p>
                  <p className="text-[16px] font-display tabular-nums text-[#0a0a0a]">
                    {formData.weightKg || '-'} kg
                  </p>
                </div>
                <div className="p-4 bg-[#f2f2f0] rounded-[12px]">
                  <p className="text-[11px] text-[#888] font-body mb-1">カートン数</p>
                  <p className="text-[16px] font-display tabular-nums text-[#0a0a0a]">
                    {formData.cartonCount || '-'}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-[#f2f2f0] rounded-[12px]">
                <p className="text-[11px] text-[#888] font-body mb-2">配送業者</p>
                <p className="text-[13px] text-[#0a0a0a] font-body">
                  {agents.find((a) => a.id === formData.agentId)?.name || '-'}
                </p>
              </div>

              {formData.requiresInspection && (
                <div className="p-4 bg-[rgba(229,163,46,0.1)] rounded-[12px]">
                  <p className="text-[11px] text-[#888] font-body mb-1">検査費用</p>
                  <p className="text-[16px] font-display tabular-nums text-[#e5a32e]">
                    ¥{formData.estimatedInspectionCost.toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={handleBack}
          disabled={step === 1}
          className="px-6 py-[10px] text-[13px] text-[#888] font-body disabled:opacity-30"
        >
          戻る
        </button>
        {step < 4 ? (
          <button
            onClick={handleNext}
            className="bg-[#0a0a0a] text-white rounded-[8px] px-6 py-[10px] text-[13px] font-medium font-body"
          >
            次へ
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-[#0a0a0a] text-white rounded-[8px] px-6 py-[10px] text-[13px] font-medium font-body disabled:opacity-50"
          >
            {submitting ? '処理中...' : '手配開始'}
          </button>
        )}
      </div>
    </div>
  )
}
