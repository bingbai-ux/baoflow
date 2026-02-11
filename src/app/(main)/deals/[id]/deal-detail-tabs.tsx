'use client'

import { useState } from 'react'
import Link from 'next/link'
import { StatusDot } from '@/components/status-dot'
import { formatJPY, formatUSD, formatDate } from '@/lib/utils/format'

interface DealDetailTabsProps {
  deal: {
    id: string
    deal_code: string
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
      version: number
      is_final: boolean
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

const tabs = [
  { id: 'overview', label: '概要' },
  { id: 'quotes', label: '見積もり' },
  { id: 'samples', label: 'サンプル' },
  { id: 'design', label: 'デザイン' },
  { id: 'payments', label: '支払い' },
  { id: 'shipping', label: '配送' },
  { id: 'chat', label: 'チャット', href: true },
  { id: 'customs', label: '通関', href: true },
  { id: 'food-import', label: '輸入届出', href: true },
  { id: 'history', label: '履歴' },
]

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
  const [activeTab, setActiveTab] = useState('overview')

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

  const renderQuotesTab = () => (
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
                  <p className="font-display tabular-nums text-[#0a0a0a]">{quote.quantity.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-[#888] font-body">単価USD</span>
                  <p className="font-display tabular-nums text-[#0a0a0a]">{formatUSD(quote.factory_unit_price_usd)}</p>
                </div>
                <div>
                  <span className="text-[#888] font-body">掛率</span>
                  <p className="font-display tabular-nums text-[#0a0a0a]">{(quote.cost_ratio * 100).toFixed(0)}%</p>
                </div>
                <div>
                  <span className="text-[#888] font-body">販売単価JPY</span>
                  <p className="font-display tabular-nums text-[#0a0a0a]">{formatJPY(quote.selling_price_jpy)}</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-[rgba(0,0,0,0.06)] flex justify-between items-center">
                <span className="text-[11px] text-[#888] font-body">請求合計（税込）</span>
                <span className="font-display tabular-nums text-[16px] font-semibold text-[#0a0a0a]">
                  {formatJPY(quote.total_billing_tax_jpy)}
                </span>
              </div>
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
  )

  const renderSamplesTab = () => (
    <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-[14px] font-medium text-[#0a0a0a] font-body">サンプル一覧</h3>
        <button className="bg-[#0a0a0a] text-white rounded-[8px] px-3 py-1.5 text-[12px] font-medium font-body">
          + サンプル追加
        </button>
      </div>
      {deal.samples && deal.samples.length > 0 ? (
        <div className="space-y-3">
          {deal.samples.map(sample => (
            <div key={sample.id} className="border border-[rgba(0,0,0,0.06)] rounded-[12px] p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[13px] font-medium text-[#0a0a0a] font-body">
                  ラウンド {sample.round_number}
                </span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-body ${
                  sample.sample_status === 'ok' ? 'bg-[#22c55e] text-white' : 'bg-[#f2f2f0] text-[#888]'
                }`}>
                  {sampleStatusLabels[sample.sample_status] || sample.sample_status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-[12px]">
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
                <div className="mt-2 text-[11px] text-[#555] font-body">
                  フィードバック: {sample.feedback_memo}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-[#888] font-body">サンプルがありません</p>
      )}
    </div>
  )

  const renderDesignTab = () => (
    <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-[14px] font-medium text-[#0a0a0a] font-body">デザインファイル</h3>
        <button className="bg-[#0a0a0a] text-white rounded-[8px] px-3 py-1.5 text-[12px] font-medium font-body">
          + ファイル追加
        </button>
      </div>
      {deal.design_files && deal.design_files.length > 0 ? (
        <div className="space-y-2">
          {deal.design_files.map(file => (
            <div key={file.id} className="flex items-center justify-between py-3 border-b border-[rgba(0,0,0,0.06)]">
              <div className="flex items-center gap-3">
                <span className="text-[13px] text-[#0a0a0a] font-body">{file.file_name}</span>
                <span className="text-[11px] text-[#888] font-body">v{file.version}</span>
                {file.is_final && (
                  <span className="bg-[#22c55e] text-white text-[10px] px-2 py-0.5 rounded-full font-body">
                    最終確定
                  </span>
                )}
              </div>
              <span className="text-[11px] text-[#888] font-body">{formatDate(file.created_at)}</span>
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
