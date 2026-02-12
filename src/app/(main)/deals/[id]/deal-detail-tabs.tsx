'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { StatusDot } from '@/components/status-dot'
import { formatJPY, formatUSD, formatDate } from '@/lib/utils/format'
import { selectWinningFactory } from '@/lib/actions/factory-assignments'
import { receiveSample, approveSample, requestSampleRevision, createSample } from '@/lib/actions/samples'
import { submitDesignToClient, approveDesign, requestDesignRevision } from '@/lib/actions/designs'

interface DealDetailTabsProps {
  deal: {
    id: string
    deal_code: string
    master_status?: string
    specifications?: Array<{
      product_category?: string | null
      product_name?: string | null
      height_mm?: number | null
      width_mm?: number | null
      depth_mm?: number | null
      diameter_mm?: number | null
      bottom_diameter_mm?: number | null
      capacity_ml?: number | null
      material_category?: string | null
      material_thickness?: string | null
      material_notes?: string | null
      printing_method?: string | null
      print_colors?: number | null
      print_sides?: string | null
      processing_list?: string[] | null
      lamination?: string | null
      attachments_list?: string[] | null
      specification_memo?: string | null
    }>
    factory_assignments?: Array<{
      id: string
      is_comparison: boolean
      status: string
      factory?: {
        id: string
        factory_name: string
      }
    }>
    quotes?: Array<{
      id: string
      version: number
      quantity: number
      factory_unit_price_usd: number
      plate_fee_usd?: number | null
      other_fees_usd?: number | null
      cost_ratio: number
      total_cost_usd: number
      selling_price_usd: number
      selling_price_jpy: number
      total_billing_jpy: number
      total_billing_tax_jpy: number
      status: string
      factory?: {
        id: string
        factory_name: string
      }
      shipping_options?: Array<{
        id: string
        shipping_method: string
        incoterm: string
        shipping_cost_usd: number
        shipping_days: number
      }>
    }>
    samples?: Array<{
      id: string
      round_number: number
      sample_production_fee_usd?: number | null
      sample_shipping_fee_usd?: number | null
      sample_status: string
      feedback_memo?: string | null
      created_at: string
    }>
    design_files?: Array<{
      id: string
      file_name: string
      file_url: string
      version_number: number
      is_final: boolean
      status?: string | null
      submitted_at?: string | null
      reviewed_at?: string | null
      reviewer_notes?: string | null
      created_at: string
    }>
    payments?: Array<{
      id: string
      payment_type: string
      payment_method?: string | null
      amount_usd?: number | null
      amount_jpy?: number | null
      status: string
      paid_at?: string | null
    }>
    shipping?: Array<{
      id: string
      shipping_address?: string | null
      tracking_number?: string | null
      tracking_url?: string | null
      packing_list_url?: string | null
    }>
  }
  spec?: {
    product_category?: string | null
    product_name?: string | null
    height_mm?: number | null
    width_mm?: number | null
    depth_mm?: number | null
    diameter_mm?: number | null
    bottom_diameter_mm?: number | null
    capacity_ml?: number | null
    material_category?: string | null
    material_thickness?: string | null
    material_notes?: string | null
    printing_method?: string | null
    print_colors?: number | null
    print_sides?: string | null
    processing_list?: string[] | null
    lamination?: string | null
    attachments_list?: string[] | null
    specification_memo?: string | null
  }
  statusHistory: Array<{
    id: string
    from_status?: string | null
    to_status: string
    note?: string | null
    changed_at: string
    changer?: {
      display_name?: string | null
    }
  }>
}

const allTabs = [
  { id: 'overview', label: '概要', minStatus: 1 },
  { id: 'quotes', label: '見積もり', minStatus: 1 },
  { id: 'samples', label: 'サンプル', minStatus: 6 },
  { id: 'design', label: 'デザイン', minStatus: 6 },
  { id: 'payments', label: '支払い', minStatus: 11 },
  { id: 'shipping', label: '配送', minStatus: 20 },
  { id: 'chat', label: 'チャット', href: true, minStatus: 1 },
  { id: 'customs', label: '通関', href: true, minStatus: 20 },
  { id: 'food-import', label: '輸入届出', href: true, minStatus: 20 },
  { id: 'history', label: '履歴', minStatus: 1 },
]

// Get visible tabs based on master_status
const getVisibleTabs = (status?: string) => {
  if (!status) return allTabs
  const statusNum = parseInt(status.replace('M', ''), 10) || 1
  return allTabs.filter(tab => statusNum >= tab.minStatus)
}

const quoteStatusLabels: Record<string, string> = {
  drafting: '作成中',
  presented: '提示済み',
  approved: '承認',
  rejected: '却下',
  revising: '修正中',
}

const sampleStatusLabels: Record<string, string> = {
  requested: '依頼中',
  manufacturing: '製造中',
  shipping: '配送中',
  arrived: '到着',
  ok: 'OK',
  revision_needed: '修正要',
}

const paymentTypeLabels: Record<string, string> = {
  advance: '前払い',
  balance: '残金',
  full: '一括',
}

const paymentMethodLabels: Record<string, string> = {
  wise: 'Wise',
  alibaba_cc: 'Alibaba CC',
  bank_transfer: '銀行振込',
}

export function DealDetailTabs({ deal, spec, statusHistory }: DealDetailTabsProps) {
  const tabs = getVisibleTabs(deal.master_status)
  const [activeTab, setActiveTab] = useState('overview')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const [sampleFeedback, setSampleFeedback] = useState('')
  const [designFeedback, setDesignFeedback] = useState('')
  const [showSampleForm, setShowSampleForm] = useState(false)
  const [showFeedbackModal, setShowFeedbackModal] = useState<string | null>(null)
  const [showDesignFeedbackModal, setShowDesignFeedbackModal] = useState<string | null>(null)

  // Group quotes by factory for comparison
  type QuoteWithFactory = NonNullable<typeof deal.quotes>[number]
  const quotesByFactory = (deal.quotes || []).reduce((acc, quote) => {
    const factoryId = quote.factory?.id || 'unknown'
    const entry = acc[factoryId] ?? (acc[factoryId] = { factory: quote.factory, quotes: [] as QuoteWithFactory[] })
    entry.quotes.push(quote)
    return acc
  }, {} as Record<string, { factory?: { id: string; factory_name: string }; quotes: QuoteWithFactory[] }>)

  const handleSelectFactory = async (factoryId: string) => {
    startTransition(async () => {
      await selectWinningFactory(deal.id, factoryId)
      router.refresh()
    })
  }

  const handleReceiveSample = async (sampleId: string) => {
    startTransition(async () => {
      await receiveSample(sampleId)
      router.refresh()
    })
  }

  const handleApproveSample = async (sampleId: string) => {
    startTransition(async () => {
      await approveSample(sampleId)
      router.refresh()
    })
  }

  const handleRequestSampleRevision = async (sampleId: string) => {
    if (!sampleFeedback.trim()) return
    startTransition(async () => {
      await requestSampleRevision(sampleId, sampleFeedback)
      setSampleFeedback('')
      setShowFeedbackModal(null)
      router.refresh()
    })
  }

  const handleSubmitDesign = async (designId: string) => {
    startTransition(async () => {
      await submitDesignToClient(designId)
      router.refresh()
    })
  }

  const handleApproveDesign = async (designId: string) => {
    startTransition(async () => {
      await approveDesign(designId)
      router.refresh()
    })
  }

  const handleRequestDesignRevision = async (designId: string) => {
    if (!designFeedback.trim()) return
    startTransition(async () => {
      await requestDesignRevision(designId, designFeedback)
      setDesignFeedback('')
      setShowDesignFeedbackModal(null)
      router.refresh()
    })
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const renderOverviewTab = () => (
    <div className="grid grid-cols-2 gap-2">
      {/* Specification Card */}
      <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
        <h3 className="text-[14px] font-medium text-[#0a0a0a] mb-4 font-body">商品仕様</h3>
        {spec ? (
          <div className="space-y-3">
            <Row label="商品カテゴリ" value={spec.product_category} />
            <Row label="商品名" value={spec.product_name} />
            <Row label="サイズ" value={formatSize(spec)} />
            <Row label="素材" value={[spec.material_category, spec.material_thickness].filter(Boolean).join(' / ')} />
            <Row label="印刷" value={[spec.printing_method, spec.print_colors ? `${spec.print_colors}色` : null, spec.print_sides].filter(Boolean).join(' / ')} />
            <Row label="加工" value={spec.processing_list?.join(', ')} />
            <Row label="ラミネーション" value={spec.lamination} />
            <Row label="付属品" value={spec.attachments_list?.join(', ')} />
            <Row label="メモ" value={spec.specification_memo} />
          </div>
        ) : (
          <p className="text-[12px] text-[#888] font-body">仕様が登録されていません</p>
        )}
      </div>

      {/* Factory Assignment Card */}
      <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-[14px] font-medium text-[#0a0a0a] font-body">工場割り当て</h3>
          <Link
            href={`/deals/${deal.id}/assign-factories`}
            className="text-[12px] text-[#22c55e] font-body no-underline"
          >
            + 工場追加
          </Link>
        </div>
        {deal.factory_assignments && deal.factory_assignments.length > 0 ? (
          <div className="space-y-2">
            {deal.factory_assignments.map(assignment => (
              <div key={assignment.id} className="flex items-center justify-between py-2 border-b border-[rgba(0,0,0,0.06)]">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-[#0a0a0a] font-body">
                    {assignment.factory?.factory_name || '不明'}
                  </span>
                  {assignment.is_comparison && (
                    <span className="text-[10px] text-[#888] bg-[#f2f2f0] px-2 py-0.5 rounded-full font-body">
                      相見積
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-[#888] font-body">{assignment.status}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-[#888] font-body">工場が割り当てられていません</p>
        )}
      </div>
    </div>
  )

  const renderQuotesTab = () => {
    const factoryCount = Object.keys(quotesByFactory).length
    const hasMultipleFactories = factoryCount > 1
    const selectedAssignment = deal.factory_assignments?.find(a => a.status === 'selected')

    return (
      <div className="space-y-4">
        {/* Comparison Table (only if multiple factories) */}
        {hasMultipleFactories && (
          <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
            <h3 className="text-[14px] font-medium text-[#0a0a0a] mb-4 font-body">工場比較表</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-[rgba(0,0,0,0.06)]">
                    <th className="text-left py-2 px-3 text-[11px] text-[#888] font-body font-medium">項目</th>
                    {Object.values(quotesByFactory).map(({ factory }) => (
                      <th key={factory?.id || 'unknown'} className="text-center py-2 px-3 text-[11px] text-[#0a0a0a] font-body font-medium">
                        {factory?.factory_name || '不明'}
                        {selectedAssignment?.factory?.id === factory?.id && (
                          <span className="ml-1 text-[#22c55e]">●</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[rgba(0,0,0,0.06)]">
                    <td className="py-2 px-3 text-[#888] font-body">単価 (USD)</td>
                    {Object.values(quotesByFactory).map(({ factory, quotes }) => {
                      const latestQuote = quotes?.[0]
                      return (
                        <td key={factory?.id || 'unknown'} className="text-center py-2 px-3 font-display tabular-nums">
                          {latestQuote?.factory_unit_price_usd ? formatUSD(latestQuote.factory_unit_price_usd) : '-'}
                        </td>
                      )
                    })}
                  </tr>
                  <tr className="border-b border-[rgba(0,0,0,0.06)]">
                    <td className="py-2 px-3 text-[#888] font-body">合計 (USD)</td>
                    {Object.values(quotesByFactory).map(({ factory, quotes }) => {
                      const latestQuote = quotes?.[0]
                      return (
                        <td key={factory?.id || 'unknown'} className="text-center py-2 px-3 font-display tabular-nums font-semibold">
                          {latestQuote?.total_cost_usd ? formatUSD(latestQuote.total_cost_usd) : '-'}
                        </td>
                      )
                    })}
                  </tr>
                  <tr className="border-b border-[rgba(0,0,0,0.06)]">
                    <td className="py-2 px-3 text-[#888] font-body">数量</td>
                    {Object.values(quotesByFactory).map(({ factory, quotes }) => {
                      const latestQuote = quotes?.[0]
                      return (
                        <td key={factory?.id || 'unknown'} className="text-center py-2 px-3 font-display tabular-nums">
                          {latestQuote?.quantity?.toLocaleString() || '-'}
                        </td>
                      )
                    })}
                  </tr>
                  {!selectedAssignment && (
                    <tr>
                      <td className="py-3 px-3 text-[#888] font-body">選定</td>
                      {Object.values(quotesByFactory).map(({ factory }) => (
                        <td key={factory?.id || 'unknown'} className="text-center py-3 px-3">
                          <button
                            onClick={() => factory?.id && handleSelectFactory(factory.id)}
                            disabled={isPending || !factory?.id}
                            className="bg-[#22c55e] text-white px-3 py-1 rounded-[6px] text-[11px] font-body disabled:opacity-50"
                          >
                            {isPending ? '...' : '選定'}
                          </button>
                        </td>
                      ))}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Quote List */}
        <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[14px] font-medium text-[#0a0a0a] font-body">見積もり一覧</h3>
            <Link
              href={`/deals/${deal.id}/quotes/new`}
              className="bg-[#22c55e] text-white rounded-[8px] px-3 py-1.5 text-[12px] font-medium font-body no-underline"
            >
              + 見積もり追加
            </Link>
          </div>
          {deal.quotes && deal.quotes.length > 0 ? (
            <div className="space-y-4">
              {deal.quotes.map(quote => (
                <div key={quote.id} className="border border-[rgba(0,0,0,0.06)] rounded-[12px] p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="text-[13px] font-medium text-[#0a0a0a] font-body">
                        {quote.factory?.factory_name || '工場未選択'}
                      </span>
                      <span className="text-[11px] text-[#888] ml-2 font-body">v{quote.version}</span>
                    </div>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-body ${
                      quote.status === 'approved' ? 'bg-[#22c55e] text-white' : 'bg-[#f2f2f0] text-[#888]'
                    }`}>
                      {quoteStatusLabels[quote.status] || quote.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-[12px]">
                    <div>
                      <span className="text-[#888] font-body">数量</span>
                      <p className="font-display tabular-nums text-[#0a0a0a]">{quote.quantity?.toLocaleString() || '-'}</p>
                    </div>
                    <div>
                      <span className="text-[#888] font-body">単価USD</span>
                      <p className="font-display tabular-nums text-[#0a0a0a]">{quote.factory_unit_price_usd ? formatUSD(quote.factory_unit_price_usd) : '-'}</p>
                    </div>
                    <div>
                      <span className="text-[#888] font-body">掛率</span>
                      <p className="font-display tabular-nums text-[#0a0a0a]">{quote.cost_ratio ? `${(quote.cost_ratio * 100).toFixed(0)}%` : '-'}</p>
                    </div>
                    <div>
                      <span className="text-[#888] font-body">販売単価JPY</span>
                      <p className="font-display tabular-nums text-[#0a0a0a]">{quote.selling_price_jpy ? formatJPY(quote.selling_price_jpy) : '-'}</p>
                    </div>
                  </div>
                  {quote.total_billing_tax_jpy && (
                    <div className="mt-3 pt-3 border-t border-[rgba(0,0,0,0.06)] flex justify-between items-center">
                      <span className="text-[11px] text-[#888] font-body">請求合計（税込）</span>
                      <span className="font-display tabular-nums text-[16px] font-semibold text-[#0a0a0a]">
                        {formatJPY(quote.total_billing_tax_jpy)}
                      </span>
                    </div>
                  )}
                  {quote.shipping_options && quote.shipping_options.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[rgba(0,0,0,0.06)]">
                      <span className="text-[11px] text-[#888] font-body mb-2 block">配送オプション</span>
                      <div className="space-y-1">
                        {quote.shipping_options.map(opt => (
                          <div key={opt.id} className="flex justify-between text-[11px]">
                            <span className="font-body text-[#555]">
                              {opt.shipping_method} / {opt.incoterm}
                            </span>
                            <span className="font-display tabular-nums text-[#0a0a0a]">
                              {formatUSD(opt.shipping_cost_usd)} ({opt.shipping_days}日)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-[#888] font-body">見積もりがありません</p>
          )}
        </div>
      </div>
    )
  }

  const renderSamplesTab = () => {
    // Sample status progress steps
    const sampleSteps = ['requested', 'manufacturing', 'shipping', 'arrived', 'ok']

    const getStepIndex = (status: string) => {
      if (status === 'revision_needed') return 3 // Show at arrived position for revision
      return sampleSteps.indexOf(status)
    }

    return (
      <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-[14px] font-medium text-[#0a0a0a] font-body">サンプル一覧</h3>
          <Link
            href={`/deals/${deal.id}/samples/new`}
            className="bg-[#0a0a0a] text-white rounded-[8px] px-3 py-1.5 text-[12px] font-medium font-body no-underline"
          >
            + サンプル依頼
          </Link>
        </div>
        {deal.samples && deal.samples.length > 0 ? (
          <div className="space-y-4">
            {deal.samples.map(sample => {
              const currentStep = getStepIndex(sample.sample_status)

              return (
                <div key={sample.id} className="border border-[rgba(0,0,0,0.06)] rounded-[12px] p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[13px] font-medium text-[#0a0a0a] font-body">
                      ラウンド {sample.round_number}
                    </span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-body ${
                      sample.sample_status === 'ok' ? 'bg-[#22c55e] text-white' :
                      sample.sample_status === 'revision_needed' ? 'bg-[#e5a32e] text-white' :
                      'bg-[#f2f2f0] text-[#888]'
                    }`}>
                      {sampleStatusLabels[sample.sample_status] || sample.sample_status}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="flex items-center gap-1 mb-4">
                    {sampleSteps.map((step, index) => (
                      <div key={step} className="flex-1">
                        <div className={`h-1 rounded-full ${
                          index <= currentStep ? 'bg-[#22c55e]' : 'bg-[#e8e8e6]'
                        }`} />
                        <div className="text-[9px] text-center mt-1 text-[#888] font-body">
                          {sampleStatusLabels[step]}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-[12px] mb-3">
                    <div>
                      <span className="text-[#888] font-body">製造費用</span>
                      <p className="font-display tabular-nums text-[#0a0a0a]">
                        {sample.sample_production_fee_usd ? formatUSD(sample.sample_production_fee_usd) : '-'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[#888] font-body">送料</span>
                      <p className="font-display tabular-nums text-[#0a0a0a]">
                        {sample.sample_shipping_fee_usd ? formatUSD(sample.sample_shipping_fee_usd) : '-'}
                      </p>
                    </div>
                  </div>

                  {sample.feedback_memo && (
                    <div className="mb-3 p-2 bg-[#f2f2f0] rounded-[8px] text-[11px] text-[#555] font-body">
                      フィードバック: {sample.feedback_memo}
                    </div>
                  )}

                  {/* Action Buttons */}
                  {sample.sample_status === 'shipping' && (
                    <button
                      onClick={() => handleReceiveSample(sample.id)}
                      disabled={isPending}
                      className="w-full bg-[#0a0a0a] text-white rounded-[8px] py-2 text-[12px] font-medium font-body disabled:opacity-50"
                    >
                      {isPending ? '処理中...' : '受領確認'}
                    </button>
                  )}

                  {sample.sample_status === 'arrived' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveSample(sample.id)}
                        disabled={isPending}
                        className="flex-1 bg-[#22c55e] text-white rounded-[8px] py-2 text-[12px] font-medium font-body disabled:opacity-50"
                      >
                        {isPending ? '...' : '承認'}
                      </button>
                      <button
                        onClick={() => setShowFeedbackModal(sample.id)}
                        disabled={isPending}
                        className="flex-1 bg-[#e5a32e] text-white rounded-[8px] py-2 text-[12px] font-medium font-body disabled:opacity-50"
                      >
                        差し戻し
                      </button>
                    </div>
                  )}

                  {/* Feedback Modal */}
                  {showFeedbackModal === sample.id && (
                    <div className="mt-3 p-3 border border-[rgba(0,0,0,0.06)] rounded-[10px]">
                      <textarea
                        value={sampleFeedback}
                        onChange={(e) => setSampleFeedback(e.target.value)}
                        placeholder="修正内容を入力してください"
                        className="w-full bg-[#f2f2f0] rounded-[8px] px-3 py-2 text-[12px] font-body resize-none"
                        rows={3}
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleRequestSampleRevision(sample.id)}
                          disabled={isPending || !sampleFeedback.trim()}
                          className="flex-1 bg-[#e5a32e] text-white rounded-[6px] py-1.5 text-[11px] font-body disabled:opacity-50"
                        >
                          送信
                        </button>
                        <button
                          onClick={() => { setShowFeedbackModal(null); setSampleFeedback('') }}
                          className="flex-1 bg-[#f2f2f0] text-[#888] rounded-[6px] py-1.5 text-[11px] font-body"
                        >
                          キャンセル
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-[12px] text-[#888] font-body">サンプルがありません</p>
        )}
      </div>
    )
  }

  const designStatusLabels: Record<string, string> = {
    draft: '下書き',
    submitted: '確認依頼中',
    approved: '承認済み',
    revision_requested: '修正依頼',
  }

  const renderDesignTab = () => (
    <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-[14px] font-medium text-[#0a0a0a] font-body">デザインファイル</h3>
        <Link
          href={`/deals/${deal.id}/designs`}
          className="bg-[#0a0a0a] text-white rounded-[8px] px-3 py-1.5 text-[12px] font-medium font-body no-underline"
        >
          + ファイル追加
        </Link>
      </div>
      {deal.design_files && deal.design_files.length > 0 ? (
        <div className="space-y-4">
          {deal.design_files.map(file => (
            <div key={file.id} className="border border-[rgba(0,0,0,0.06)] rounded-[12px] p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-[#0a0a0a] font-body">
                    {file.file_name || 'デザインファイル'}
                  </span>
                  <span className="text-[11px] text-[#888] bg-[#f2f2f0] px-2 py-0.5 rounded-full font-body">
                    v{file.version_number}
                  </span>
                  {file.is_final && (
                    <span className="bg-[#22c55e] text-white text-[10px] px-2 py-0.5 rounded-full font-body">
                      最終確定
                    </span>
                  )}
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-body ${
                  file.status === 'approved' ? 'bg-[#22c55e] text-white' :
                  file.status === 'revision_requested' ? 'bg-[#e5a32e] text-white' :
                  file.status === 'submitted' ? 'bg-[#0a0a0a] text-white' :
                  'bg-[#f2f2f0] text-[#888]'
                }`}>
                  {designStatusLabels[file.status || 'draft'] || file.status}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#888] font-body mb-3">
                <span>作成日: {formatDate(file.created_at)}</span>
                {file.submitted_at && <span>提出日: {formatDate(file.submitted_at)}</span>}
                {file.reviewed_at && <span>確認日: {formatDate(file.reviewed_at)}</span>}
              </div>

              {file.reviewer_notes && (
                <div className="mb-3 p-2 bg-[#fef3c7] rounded-[8px] text-[11px] text-[#92400e] font-body">
                  修正依頼: {file.reviewer_notes}
                </div>
              )}

              <div className="flex items-center gap-2">
                <a
                  href={file.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center bg-[#f2f2f0] text-[#555] rounded-[6px] py-2 text-[11px] font-body no-underline hover:bg-[#e8e8e6]"
                >
                  ダウンロード
                </a>

                {file.status === 'draft' && (
                  <button
                    onClick={() => handleSubmitDesign(file.id)}
                    disabled={isPending}
                    className="flex-1 bg-[#0a0a0a] text-white rounded-[6px] py-2 text-[11px] font-body disabled:opacity-50"
                  >
                    {isPending ? '...' : 'クライアントに確認依頼'}
                  </button>
                )}

                {file.status === 'revision_requested' && (
                  <button
                    onClick={() => handleSubmitDesign(file.id)}
                    disabled={isPending}
                    className="flex-1 bg-[#22c55e] text-white rounded-[6px] py-2 text-[11px] font-body disabled:opacity-50"
                  >
                    {isPending ? '...' : '修正後に再提出'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-[#888] font-body">デザインファイルがありません</p>
      )}
    </div>
  )

  const renderPaymentsTab = () => (
    <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-[14px] font-medium text-[#0a0a0a] font-body">工場支払い</h3>
        <button className="bg-[#0a0a0a] text-white rounded-[8px] px-3 py-1.5 text-[12px] font-medium font-body">
          + 支払い記録
        </button>
      </div>
      {deal.payments && deal.payments.length > 0 ? (
        <div className="space-y-3">
          {deal.payments.map(payment => (
            <div key={payment.id} className="border border-[rgba(0,0,0,0.06)] rounded-[12px] p-4">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-[#0a0a0a] font-body">
                    {paymentTypeLabels[payment.payment_type] || payment.payment_type}
                  </span>
                  {payment.payment_method && (
                    <span className="text-[11px] text-[#888] bg-[#f2f2f0] px-2 py-0.5 rounded-full font-body">
                      {paymentMethodLabels[payment.payment_method] || payment.payment_method}
                    </span>
                  )}
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-body ${
                  payment.status === 'paid' ? 'bg-[#22c55e] text-white' : 'bg-[#e5a32e] text-white'
                }`}>
                  {payment.status === 'paid' ? '支払済' : '未払い'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-[12px]">
                <div>
                  <span className="text-[#888] font-body">金額 (USD)</span>
                  <p className="font-display tabular-nums text-[#0a0a0a]">
                    {payment.amount_usd ? formatUSD(payment.amount_usd) : '-'}
                  </p>
                </div>
                <div>
                  <span className="text-[#888] font-body">金額 (JPY)</span>
                  <p className="font-display tabular-nums text-[#0a0a0a]">
                    {payment.amount_jpy ? formatJPY(payment.amount_jpy) : '-'}
                  </p>
                </div>
              </div>
              {payment.paid_at && (
                <div className="mt-2 text-[11px] text-[#888] font-body">
                  支払日: {formatDate(payment.paid_at)}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-[#888] font-body">支払い記録がありません</p>
      )}
    </div>
  )

  const renderShippingTab = () => (
    <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
      <h3 className="text-[14px] font-medium text-[#0a0a0a] mb-4 font-body">配送情報</h3>
      {deal.shipping && deal.shipping.length > 0 ? (
        <div className="space-y-4">
          {deal.shipping.map(ship => (
            <div key={ship.id} className="space-y-3">
              <Row label="配送先住所" value={ship.shipping_address} />
              <Row label="トラッキング番号" value={ship.tracking_number} />
              {ship.tracking_url && (
                <Row label="追跡URL" value={
                  <a href={ship.tracking_url} target="_blank" rel="noopener noreferrer" className="text-[#22c55e] no-underline">
                    追跡を開く
                  </a>
                } />
              )}
              {ship.packing_list_url && (
                <Row label="パッキングリスト" value={
                  <a href={ship.packing_list_url} target="_blank" rel="noopener noreferrer" className="text-[#22c55e] no-underline">
                    ダウンロード
                  </a>
                } />
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-[#888] font-body">配送情報がありません</p>
      )}
    </div>
  )

  const renderHistoryTab = () => (
    <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
      <h3 className="text-[14px] font-medium text-[#0a0a0a] mb-4 font-body">ステータス履歴</h3>
      {statusHistory.length > 0 ? (
        <div className="space-y-3">
          {statusHistory.map(history => (
            <div key={history.id} className="flex items-start gap-3 py-3 border-b border-[rgba(0,0,0,0.06)]">
              <div className="flex-shrink-0 pt-0.5">
                <div className="w-2 h-2 rounded-full bg-[#22c55e]" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {history.from_status && (
                    <>
                      <StatusDot status={history.from_status} showLabel={false} />
                      <span className="text-[#888] text-[11px]">→</span>
                    </>
                  )}
                  <StatusDot status={history.to_status} />
                </div>
                {history.note && (
                  <p className="text-[12px] text-[#555] font-body mb-1">{history.note}</p>
                )}
                <p className="text-[11px] text-[#888] font-body">
                  {history.changer?.display_name || '不明'} · {formatDateTime(history.changed_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-[#888] font-body">履歴がありません</p>
      )}
    </div>
  )

  return (
    <div>
      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {tabs.map(tab => {
          if (tab.href) {
            const href = tab.id === 'chat'
              ? `/deals/${deal.id}/chat`
              : tab.id === 'customs'
              ? `/deals/${deal.id}/customs-invoice`
              : `/deals/${deal.id}/food-import`
            return (
              <Link
                key={tab.id}
                href={href}
                style={{
                  padding: '8px 16px',
                  borderRadius: '9999px',
                  fontSize: '13px',
                  textDecoration: 'none',
                  fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                  fontWeight: 400,
                  backgroundColor: 'transparent',
                  color: '#888888',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </Link>
            )
          }
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 16px',
                borderRadius: '9999px',
                fontSize: '13px',
                border: 'none',
                cursor: 'pointer',
                fontFamily: activeTab === tab.id
                  ? "'Fraunces', serif"
                  : "'Zen Kaku Gothic New', system-ui, sans-serif",
                fontWeight: activeTab === tab.id ? 600 : 400,
                backgroundColor: activeTab === tab.id ? '#0a0a0a' : 'transparent',
                color: activeTab === tab.id ? '#ffffff' : '#888888',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && renderOverviewTab()}
      {activeTab === 'quotes' && renderQuotesTab()}
      {activeTab === 'samples' && renderSamplesTab()}
      {activeTab === 'design' && renderDesignTab()}
      {activeTab === 'payments' && renderPaymentsTab()}
      {activeTab === 'shipping' && renderShippingTab()}
      {activeTab === 'history' && renderHistoryTab()}
    </div>
  )
}

function Row({ label, value }: { label: string; value?: string | React.ReactNode | null }) {
  return (
    <div className="flex border-b border-[rgba(0,0,0,0.06)] py-2">
      <div className="w-[100px] text-[11px] text-[#888] font-body flex-shrink-0">{label}</div>
      <div className="text-[12px] text-[#0a0a0a] font-body">{value || '-'}</div>
    </div>
  )
}

function formatSize(spec: {
  height_mm?: number | null
  width_mm?: number | null
  depth_mm?: number | null
  diameter_mm?: number | null
  bottom_diameter_mm?: number | null
  capacity_ml?: number | null
}) {
  const parts = []
  if (spec.height_mm) parts.push(`H${spec.height_mm}`)
  if (spec.width_mm) parts.push(`W${spec.width_mm}`)
  if (spec.depth_mm) parts.push(`D${spec.depth_mm}`)
  if (spec.diameter_mm) parts.push(`口径${spec.diameter_mm}`)
  if (spec.bottom_diameter_mm) parts.push(`底径${spec.bottom_diameter_mm}`)
  if (spec.capacity_ml) parts.push(`${spec.capacity_ml}ml`)
  return parts.length > 0 ? parts.join(' × ') : null
}
