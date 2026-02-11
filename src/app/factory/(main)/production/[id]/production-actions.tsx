'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateProductionStatus, submitPackingInfo, submitTrackingInfo } from '@/lib/actions/factory'

interface ProductionActionsProps {
  dealId: string
  status: string
  hasPackingInfo: boolean
  hasTracking: boolean
}

export function ProductionActions({ dealId, status, hasPackingInfo, hasTracking }: ProductionActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showPackingForm, setShowPackingForm] = useState(false)
  const [showTrackingForm, setShowTrackingForm] = useState(false)

  const [packingData, setPackingData] = useState({
    cartonCount: '',
    weightKg: '',
    cbm: '',
  })

  const [trackingData, setTrackingData] = useState({
    trackingNumber: '',
    trackingUrl: '',
  })

  const handleStatusUpdate = async (newStatus: 'started' | 'in_progress' | 'completed') => {
    setLoading(true)
    await updateProductionStatus({ dealId, status: newStatus })
    router.refresh()
    setLoading(false)
  }

  const handlePackingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await submitPackingInfo({
      dealId,
      cartonCount: parseInt(packingData.cartonCount) || 0,
      weightKg: parseFloat(packingData.weightKg) || 0,
      cbm: parseFloat(packingData.cbm) || 0,
    })
    router.refresh()
    setLoading(false)
    setShowPackingForm(false)
  }

  const handleTrackingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await submitTrackingInfo({
      dealId,
      trackingNumber: trackingData.trackingNumber,
      trackingUrl: trackingData.trackingUrl || undefined,
    })
    router.refresh()
    setLoading(false)
    setShowTrackingForm(false)
  }

  return (
    <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
      <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a] mb-4">
        アクション
      </h2>

      <div className="space-y-3">
        {/* Status Update Buttons */}
        {status === 'M16' && (
          <button
            onClick={() => handleStatusUpdate('started')}
            disabled={loading}
            className="w-full bg-[#0a0a0a] text-white rounded-[8px] px-4 py-[10px] text-[13px] font-medium font-body disabled:opacity-50"
          >
            {loading ? '更新中...' : '製造開始を記録'}
          </button>
        )}

        {['M17', 'M18'].includes(status) && (
          <button
            onClick={() => handleStatusUpdate('completed')}
            disabled={loading}
            className="w-full bg-[#0a0a0a] text-white rounded-[8px] px-4 py-[10px] text-[13px] font-medium font-body disabled:opacity-50"
          >
            {loading ? '更新中...' : '製造完了を記録'}
          </button>
        )}

        {/* Packing Info */}
        {['M19', 'M20'].includes(status) && !hasPackingInfo && (
          <>
            {!showPackingForm ? (
              <button
                onClick={() => setShowPackingForm(true)}
                className="w-full bg-[#0a0a0a] text-white rounded-[8px] px-4 py-[10px] text-[13px] font-medium font-body"
              >
                パッキングリスト提出
              </button>
            ) : (
              <form onSubmit={handlePackingSubmit} className="space-y-3 p-4 bg-[#f2f2f0] rounded-[12px]">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-[#888] font-body mb-1">カートン数</label>
                    <input
                      type="number"
                      required
                      value={packingData.cartonCount}
                      onChange={(e) => setPackingData({ ...packingData, cartonCount: e.target.value })}
                      className="w-full bg-white rounded-[8px] px-3 py-2 text-[12px] font-body border border-[rgba(0,0,0,0.06)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#888] font-body mb-1">総重量 (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={packingData.weightKg}
                      onChange={(e) => setPackingData({ ...packingData, weightKg: e.target.value })}
                      className="w-full bg-white rounded-[8px] px-3 py-2 text-[12px] font-body border border-[rgba(0,0,0,0.06)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#888] font-body mb-1">CBM</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={packingData.cbm}
                      onChange={(e) => setPackingData({ ...packingData, cbm: e.target.value })}
                      className="w-full bg-white rounded-[8px] px-3 py-2 text-[12px] font-body border border-[rgba(0,0,0,0.06)]"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-[#0a0a0a] text-white rounded-[8px] px-4 py-2 text-[12px] font-medium font-body disabled:opacity-50"
                  >
                    {loading ? '送信中...' : '提出'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPackingForm(false)}
                    className="px-4 py-2 text-[12px] text-[#888] font-body"
                  >
                    キャンセル
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        {/* Tracking Info */}
        {status === 'M21' && !hasTracking && (
          <>
            {!showTrackingForm ? (
              <button
                onClick={() => setShowTrackingForm(true)}
                className="w-full bg-[#0a0a0a] text-white rounded-[8px] px-4 py-[10px] text-[13px] font-medium font-body"
              >
                トラッキング番号入力
              </button>
            ) : (
              <form onSubmit={handleTrackingSubmit} className="space-y-3 p-4 bg-[#f2f2f0] rounded-[12px]">
                <div>
                  <label className="block text-[11px] text-[#888] font-body mb-1">
                    トラッキング番号 <span className="text-[#e5a32e]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={trackingData.trackingNumber}
                    onChange={(e) => setTrackingData({ ...trackingData, trackingNumber: e.target.value })}
                    className="w-full bg-white rounded-[8px] px-3 py-2 text-[12px] font-body border border-[rgba(0,0,0,0.06)]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#888] font-body mb-1">トラッキングURL</label>
                  <input
                    type="url"
                    value={trackingData.trackingUrl}
                    onChange={(e) => setTrackingData({ ...trackingData, trackingUrl: e.target.value })}
                    className="w-full bg-white rounded-[8px] px-3 py-2 text-[12px] font-body border border-[rgba(0,0,0,0.06)]"
                    placeholder="https://..."
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-[#0a0a0a] text-white rounded-[8px] px-4 py-2 text-[12px] font-medium font-body disabled:opacity-50"
                  >
                    {loading ? '送信中...' : '発送完了'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTrackingForm(false)}
                    className="px-4 py-2 text-[12px] text-[#888] font-body"
                  >
                    キャンセル
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        {/* Completed Status */}
        {['M22', 'M23', 'M24', 'M25'].includes(status) && (
          <div className="text-center py-4">
            <div className="inline-flex items-center gap-2 text-[#22c55e]">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-[13px] font-body font-medium">発送完了</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
