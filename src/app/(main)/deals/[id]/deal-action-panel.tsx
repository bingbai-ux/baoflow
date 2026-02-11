'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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

// Define what action is available for each status
const STATUS_ACTIONS: Record<MasterStatus, {
  label: string
  description: string
  buttonText: string
  action?: 'link' | 'function'
  href?: string
  functionName?: string
  buttonColor?: 'primary' | 'success' | 'warning'
} | null> = {
  M01: {
    label: '次のステップ',
    description: '工場を選定して見積もり依頼を送信',
    buttonText: '工場選定・見積もり依頼',
    action: 'link',
    href: '/quotes/new',
  },
  M02: {
    label: '次のステップ',
    description: '工場に見積もり依頼を送信します',
    buttonText: '工場に見積もり依頼を送信',
    action: 'function',
    functionName: 'sendQuoteRequest',
  },
  M03: {
    label: '待機中',
    description: '工場からの回答を待っています',
    buttonText: '',
  },
  M04: {
    label: '待機中',
    description: '工場からの回答を待っています',
    buttonText: '',
  },
  M05: {
    label: '次のステップ',
    description: 'クライアントに見積もりを提示',
    buttonText: 'クライアントに見積もりを提示',
    action: 'function',
    functionName: 'presentQuoteToClient',
    buttonColor: 'success',
  },
  M06: {
    label: '待機中',
    description: 'クライアントの回答を待っています',
    buttonText: '',
  },
  M07: {
    label: '待機中',
    description: 'クライアントの回答を待っています',
    buttonText: '',
  },
  M08: {
    label: '対応必要',
    description: 'クライアントから修正依頼があります',
    buttonText: '見積もりを再調整',
    action: 'function',
    functionName: 'startRevision',
    buttonColor: 'warning',
  },
  M09: {
    label: '対応中',
    description: '見積もりを再調整中です',
    buttonText: '見積もりを再提示',
    action: 'function',
    functionName: 'resubmitQuote',
  },
  M10: {
    label: '待機中',
    description: 'クライアントの承認を待っています',
    buttonText: '',
  },
  M11: {
    label: '次のステップ',
    description: 'クライアント承認済み。請求書を発行してください',
    buttonText: '請求書を発行',
    action: 'function',
    functionName: 'issueInvoice',
    buttonColor: 'success',
  },
  M12: {
    label: '待機中',
    description: 'クライアントの入金を待っています',
    buttonText: '',
    buttonColor: 'warning',
  },
  M13: {
    label: '待機中',
    description: 'クライアントの入金を待っています',
    buttonText: '入金を確認',
    action: 'function',
    functionName: 'confirmPayment',
    buttonColor: 'warning',
  },
  M14: {
    label: '次のステップ',
    description: '入金確認済み。工場に前払いを行ってください',
    buttonText: '工場に前払い',
    action: 'function',
    functionName: 'payFactoryAdvance',
    buttonColor: 'warning',
  },
  M15: {
    label: '待機中',
    description: '工場の入金確認・製造開始を待っています',
    buttonText: '製造開始待ちへ',
    action: 'function',
    functionName: 'waitForProduction',
  },
  M16: {
    label: '待機中',
    description: '工場側で製造開始を待っています',
    buttonText: '',
  },
  M17: {
    label: '進行中',
    description: '製造開始しました',
    buttonText: '',
  },
  M18: {
    label: '進行中',
    description: '製造中です',
    buttonText: '',
  },
  M19: {
    label: '次のステップ',
    description: '製造完了。残金支払いまたは発送準備へ',
    buttonText: '発送準備へ',
    action: 'function',
    functionName: 'prepareShipping',
  },
  M20: {
    label: '対応必要',
    description: '残金支払いが必要です',
    buttonText: '残金支払い完了',
    action: 'function',
    functionName: 'payBalance',
    buttonColor: 'warning',
  },
  M21: {
    label: '次のステップ',
    description: '発送準備中。出荷ウィザードへ進んでください',
    buttonText: '出荷ウィザードへ',
    action: 'link',
    href: '/shipment-wizard',
  },
  M22: {
    label: '進行中',
    description: '発送済み。輸送中です',
    buttonText: '',
  },
  M23: {
    label: '進行中',
    description: '輸送中です',
    buttonText: '到着確認',
    action: 'function',
    functionName: 'confirmArrival',
  },
  M24: {
    label: '次のステップ',
    description: '到着・検品中。納品完了へ',
    buttonText: '納品完了',
    action: 'function',
    functionName: 'completeDelivery',
    buttonColor: 'success',
  },
  M25: {
    label: '完了',
    description: '納品完了しました',
    buttonText: 'リピート注文',
    action: 'function',
    functionName: 'repeatOrder',
    buttonColor: 'success',
  },
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

  const actionConfig = STATUS_ACTIONS[currentStatus]

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

  if (!actionConfig) return null

  const buttonColorClass = {
    primary: 'bg-[#0a0a0a] text-white',
    success: 'bg-[#22c55e] text-white',
    warning: 'bg-[#e5a32e] text-white',
  }[actionConfig.buttonColor || 'primary']

  return (
    <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-body px-2 py-0.5 rounded-full ${
              actionConfig.label === '待機中' ? 'bg-[#f2f2f0] text-[#888]' :
              actionConfig.label === '対応必要' ? 'bg-[rgba(229,163,46,0.1)] text-[#e5a32e]' :
              actionConfig.label === '完了' ? 'bg-[rgba(34,197,94,0.1)] text-[#22c55e]' :
              'bg-[#f2f2f0] text-[#0a0a0a]'
            }`}>
              {actionConfig.label}
            </span>
          </div>
          <p className="text-[13px] text-[#555] font-body mt-2">{actionConfig.description}</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-[12px] py-2 px-3 rounded-[8px] bg-[rgba(229,163,46,0.1)] text-[#e5a32e] font-body">
          {error}
        </div>
      )}

      {actionConfig.buttonText && (
        <div className="flex gap-2">
          {actionConfig.action === 'link' && actionConfig.href && (
            <Link
              href={`/deals/${dealId}${actionConfig.href}`}
              className={`flex-1 text-center ${buttonColorClass} rounded-[8px] px-4 py-[10px] text-[13px] font-medium font-body no-underline`}
            >
              {actionConfig.buttonText}
            </Link>
          )}

          {actionConfig.action === 'function' && actionConfig.functionName && (
            <button
              onClick={() => handleAction(actionConfig.functionName!)}
              disabled={loading}
              className={`flex-1 ${buttonColorClass} rounded-[8px] px-4 py-[10px] text-[13px] font-medium font-body disabled:opacity-50`}
            >
              {loading ? '処理中...' : actionConfig.buttonText}
            </button>
          )}

          {/* Chat link */}
          <Link
            href={`/deals/${dealId}/chat`}
            className="bg-white text-[#0a0a0a] border border-[#e8e8e6] rounded-[8px] px-4 py-[10px] text-[13px] font-medium font-body no-underline hover:border-[#0a0a0a]"
          >
            チャット
          </Link>
        </div>
      )}

      {!actionConfig.buttonText && actionConfig.label === '待機中' && (
        <div className="flex justify-center py-2">
          <span className="text-[12px] text-[#888] font-body">アクション待機中...</span>
        </div>
      )}
    </div>
  )
}
