'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  updateDealStatus,
  sendQuoteRequest,
  presentQuoteToClient,
  issueInvoice,
  confirmPayment,
  payFactoryAdvance,
  confirmArrival,
  completeDelivery,
  duplicateDeal,
} from '@/lib/actions/deals'
import type { MasterStatus } from '@/lib/types'

interface DealActionPanelProps {
  dealId: string
  currentStatus: MasterStatus
  hasFactoryAssignment: boolean
  hasQuote: boolean
}

interface ShippingInfo {
  tracking_number?: string | null
  tracking_url?: string | null
}

export function DealActionPanel({
  dealId,
  currentStatus,
  hasFactoryAssignment,
  hasQuote,
}: DealActionPanelProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shippingInfo, setShippingInfo] = useState<ShippingInfo | null>(null)

  // Fetch shipping info for M22 status
  useEffect(() => {
    if (currentStatus === 'M22') {
      const fetchShipping = async () => {
        const supabase = createClient()
        const { data } = await supabase
          .from('deal_shipping')
          .select('tracking_number, tracking_url')
          .eq('deal_id', dealId)
          .single()
        if (data) {
          setShippingInfo(data)
        }
      }
      fetchShipping()
    }
  }, [dealId, currentStatus])

  const handleAction = async (functionName: string) => {
    setLoading(true)
    setError(null)

    let result: { error: string | null } = { error: null }

    switch (functionName) {
      case 'sendQuoteRequest':
        result = await sendQuoteRequest(dealId)
        break
      case 'presentQuoteToClient':
        result = await presentQuoteToClient(dealId)
        break
      case 'startRevision':
        result = await updateDealStatus(dealId, 'M09', '見積もり再調整開始')
        break
      case 'resubmitQuote':
        result = await updateDealStatus(dealId, 'M10', '見積もり再提示')
        break
      case 'issueInvoice':
        result = await issueInvoice(dealId)
        break
      case 'confirmPayment':
        result = await confirmPayment(dealId)
        break
      case 'payFactoryAdvance':
        result = await payFactoryAdvance(dealId)
        break
      case 'waitForProduction':
        result = await updateDealStatus(dealId, 'M16', '製造開始待ち')
        break
      case 'prepareShipping':
        result = await updateDealStatus(dealId, 'M21', '発送準備開始')
        break
      case 'payBalance':
        result = await updateDealStatus(dealId, 'M21', '残金支払い完了')
        break
      case 'confirmArrival':
        result = await confirmArrival(dealId)
        break
      case 'completeDelivery':
        result = await completeDelivery(dealId)
        break
      case 'repeatOrder':
        const repeatResult = await duplicateDeal(dealId)
        if (repeatResult.data) {
          router.push(`/deals/${repeatResult.data.id}`)
        }
        result = { error: repeatResult.error }
        break
      default:
        result = { error: 'Unknown action' }
    }

    if (result.error) {
      setError(result.error)
    } else {
      router.refresh()
    }
    setLoading(false)
  }

  // Get label style
  const getLabelStyle = (label: string) => {
    if (label === '待機中') return 'bg-[#f2f2f0] text-[#888]'
    if (label === '対応必要') return 'bg-[rgba(229,163,46,0.1)] text-[#e5a32e]'
    if (label === '完了') return 'bg-[rgba(34,197,94,0.1)] text-[#22c55e]'
    return 'bg-[#f2f2f0] text-[#0a0a0a]'
  }

  // Render content based on status
  const renderContent = () => {
    switch (currentStatus) {
      case 'M01':
        return (
          <>
            <div className="mb-4">
              <span className={`text-[11px] font-body px-2 py-0.5 rounded-full ${getLabelStyle('次のステップ')}`}>
                次のステップ
              </span>
              <p className="text-[13px] text-[#555] font-body mt-2">
                工場を選定して見積もり依頼を送信
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/deals/${dealId}/smart-quote`}
                className="flex-1 text-center bg-[#22c55e] text-white rounded-[8px] px-4 py-[10px] text-[13px] font-medium font-body no-underline"
              >
                Smart Quote
              </Link>
              <Link
                href={`/deals/${dealId}/quotes/new`}
                className="flex-1 text-center bg-white text-[#0a0a0a] border border-[#e8e8e6] rounded-[8px] px-4 py-[10px] text-[13px] font-medium font-body no-underline"
              >
                工場に依頼
              </Link>
              <Link
                href={`/deals/${dealId}/excel-import`}
                className="bg-white text-[#888] border border-[#e8e8e6] rounded-[8px] px-3 py-[10px] text-[11px] font-medium font-body no-underline hover:border-[#0a0a0a] hover:text-[#0a0a0a]"
              >
                Excel取込
              </Link>
            </div>
          </>
        )

      case 'M05':
        return (
          <>
            <div className="mb-4">
              <span className={`text-[11px] font-body px-2 py-0.5 rounded-full ${getLabelStyle('次のステップ')}`}>
                次のステップ
              </span>
              <p className="text-[13px] text-[#555] font-body mt-2">
                工場から回答が届きました。見積もりを確認してください
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/deals/${dealId}/quotes/new`}
                className="flex-1 text-center bg-[#0a0a0a] text-white rounded-[8px] px-4 py-[10px] text-[13px] font-medium font-body no-underline"
              >
                見積もり作成
              </Link>
              <Link
                href={`/deals/${dealId}/chat`}
                className="bg-white text-[#0a0a0a] border border-[#e8e8e6] rounded-[8px] px-4 py-[10px] text-[13px] font-medium font-body no-underline hover:border-[#0a0a0a]"
              >
                チャット
              </Link>
            </div>
          </>
        )

      case 'M06':
      case 'M07':
      case 'M10':
        return (
          <>
            <div className="mb-4">
              <span className={`text-[11px] font-body px-2 py-0.5 rounded-full ${getLabelStyle('待機中')}`}>
                待機中
              </span>
              <p className="text-[13px] text-[#555] font-body mt-2">
                クライアントの承認を待っています
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/deals/${dealId}/chat`}
                className="flex-1 text-center bg-white text-[#0a0a0a] border border-[#e8e8e6] rounded-[8px] px-4 py-[10px] text-[13px] font-medium font-body no-underline hover:border-[#0a0a0a]"
              >
                チャットで確認
              </Link>
            </div>
          </>
        )

      case 'M11':
        return (
          <>
            <div className="mb-4">
              <span className={`text-[11px] font-body px-2 py-0.5 rounded-full ${getLabelStyle('次のステップ')}`}>
                次のステップ
              </span>
              <p className="text-[13px] text-[#555] font-body mt-2">
                承認されました。請求書を発行してください
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleAction('issueInvoice')}
                disabled={loading}
                className="flex-1 bg-[#0a0a0a] text-white rounded-[8px] px-4 py-[10px] text-[13px] font-medium font-body disabled:opacity-50"
              >
                {loading ? '処理中...' : '請求書発行'}
              </button>
            </div>
          </>
        )

      case 'M13':
        return (
          <>
            <div className="mb-4">
              <span className={`text-[11px] font-body px-2 py-0.5 rounded-full ${getLabelStyle('対応必要')}`}>
                対応必要
              </span>
              <p className="text-[13px] text-[#555] font-body mt-2">
                入金を待っています
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleAction('confirmPayment')}
                disabled={loading}
                className="flex-1 bg-[#e5a32e] text-white rounded-[8px] px-4 py-[10px] text-[13px] font-medium font-body disabled:opacity-50"
              >
                {loading ? '処理中...' : '入金確認'}
              </button>
            </div>
          </>
        )

      case 'M14':
        return (
          <>
            <div className="mb-4">
              <span className={`text-[11px] font-body px-2 py-0.5 rounded-full ${getLabelStyle('次のステップ')}`}>
                次のステップ
              </span>
              <p className="text-[13px] text-[#555] font-body mt-2">
                入金確認済み。工場に前払いしてください
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleAction('payFactoryAdvance')}
                disabled={loading}
                className="flex-1 bg-[#0a0a0a] text-white rounded-[8px] px-4 py-[10px] text-[13px] font-medium font-body disabled:opacity-50"
              >
                {loading ? '処理中...' : '工場前払い'}
              </button>
            </div>
          </>
        )

      case 'M16':
      case 'M17':
      case 'M18':
      case 'M19':
        return (
          <>
            <div className="mb-4">
              <span className={`text-[11px] font-body px-2 py-0.5 rounded-full ${getLabelStyle('進行中')}`}>
                進行中
              </span>
              <p className="text-[13px] text-[#555] font-body mt-2">
                製造中です。完了報告を待っています
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/deals/${dealId}/chat`}
                className="flex-1 text-center bg-white text-[#0a0a0a] border border-[#e8e8e6] rounded-[8px] px-4 py-[10px] text-[13px] font-medium font-body no-underline hover:border-[#0a0a0a]"
              >
                工場にメッセージ
              </Link>
            </div>
          </>
        )

      case 'M21':
        return (
          <>
            <div className="mb-4">
              <span className={`text-[11px] font-body px-2 py-0.5 rounded-full ${getLabelStyle('次のステップ')}`}>
                次のステップ
              </span>
              <p className="text-[13px] text-[#555] font-body mt-2">
                発送準備に進みます
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/deals/${dealId}/shipment-wizard`}
                className="flex-1 text-center bg-[#0a0a0a] text-white rounded-[8px] px-4 py-[10px] text-[13px] font-medium font-body no-underline"
              >
                出荷ウィザード
              </Link>
            </div>
          </>
        )

      case 'M22':
        const trackingUrl = shippingInfo?.tracking_url ||
          (shippingInfo?.tracking_number
            ? `https://t.17track.net/ja#nums=${encodeURIComponent(shippingInfo.tracking_number)}`
            : null)
        return (
          <>
            <div className="mb-4">
              <span className={`text-[11px] font-body px-2 py-0.5 rounded-full ${getLabelStyle('進行中')}`}>
                進行中
              </span>
              <p className="text-[13px] text-[#555] font-body mt-2">
                発送済み。輸送中です
              </p>
            </div>
            <div className="flex gap-2">
              {shippingInfo?.tracking_number ? (
                <a
                  href={trackingUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center bg-[#0a0a0a] text-white rounded-[8px] px-4 py-[10px] text-[13px] font-medium font-body no-underline flex items-center justify-center gap-2"
                >
                  <span>トラッキング: {shippingInfo.tracking_number}</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              ) : (
                <Link
                  href={`/deals/${dealId}/shipment-wizard`}
                  className="flex-1 text-center bg-[#e5a32e] text-white rounded-[8px] px-4 py-[10px] text-[13px] font-medium font-body no-underline"
                >
                  トラッキング登録
                </Link>
              )}
            </div>
          </>
        )

      case 'M23':
        return (
          <>
            <div className="mb-4">
              <span className={`text-[11px] font-body px-2 py-0.5 rounded-full ${getLabelStyle('進行中')}`}>
                進行中
              </span>
              <p className="text-[13px] text-[#555] font-body mt-2">
                輸送中です
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleAction('confirmArrival')}
                disabled={loading}
                className="flex-1 bg-[#0a0a0a] text-white rounded-[8px] px-4 py-[10px] text-[13px] font-medium font-body disabled:opacity-50"
              >
                {loading ? '処理中...' : '到着確認'}
              </button>
            </div>
          </>
        )

      case 'M24':
        return (
          <>
            <div className="mb-4">
              <span className={`text-[11px] font-body px-2 py-0.5 rounded-full ${getLabelStyle('次のステップ')}`}>
                次のステップ
              </span>
              <p className="text-[13px] text-[#555] font-body mt-2">
                到着しました。検品してください
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleAction('completeDelivery')}
                disabled={loading}
                className="flex-1 bg-[#22c55e] text-white rounded-[8px] px-4 py-[10px] text-[13px] font-medium font-body disabled:opacity-50"
              >
                {loading ? '処理中...' : '納品完了'}
              </button>
            </div>
          </>
        )

      case 'M25':
        return (
          <>
            <div className="mb-4">
              <span className={`text-[11px] font-body px-2 py-0.5 rounded-full ${getLabelStyle('完了')}`}>
                完了
              </span>
              <p className="text-[13px] text-[#555] font-body mt-2">
                納品完了です
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleAction('repeatOrder')}
                disabled={loading}
                className="flex-1 bg-[#22c55e] text-white rounded-[8px] px-4 py-[10px] text-[13px] font-medium font-body disabled:opacity-50"
              >
                {loading ? '処理中...' : 'リピート注文'}
              </button>
            </div>
          </>
        )

      // Default fallback for other statuses
      default:
        return (
          <>
            <div className="mb-4">
              <span className={`text-[11px] font-body px-2 py-0.5 rounded-full ${getLabelStyle('待機中')}`}>
                待機中
              </span>
              <p className="text-[13px] text-[#555] font-body mt-2">
                処理中です
              </p>
            </div>
            <div className="flex justify-center py-2">
              <span className="text-[12px] text-[#888] font-body">アクション待機中...</span>
            </div>
          </>
        )
    }
  }

  return (
    <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
      {error && (
        <div className="mb-4 text-[12px] py-2 px-3 rounded-[8px] bg-[rgba(229,163,46,0.1)] text-[#e5a32e] font-body">
          {error}
        </div>
      )}
      {renderContent()}
    </div>
  )
}
