'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatJPY, formatDate } from '@/lib/utils/format'
import { type SimpleStatus, SIMPLE_STATUS_CONFIG } from '@/lib/types'

type TabId = 'basic' | 'specifications' | 'quotes' | 'images'

interface DealLite {
  id: string
  deal_code: string
  deal_name: string | null
  client_name_text: string | null
  desired_delivery_date: string | null
  memo: string | null
  simple_status: SimpleStatus
  created_at: string
  last_activity_at: string
  sales_user?: { display_name: string | null } | null
}

interface SpecLite {
  id: string
  product_name: string | null
  product_category: string | null
  height_mm: number | null
  width_mm: number | null
  depth_mm: number | null
  material_category: string | null
  print_colors?: string | null
  printing_method?: string | null
  processing_list?: string[] | null
  specification_memo?: string | null
}

interface QuoteLite {
  id: string
  version: number | null
  quantity: number | null
  total_billing_tax_jpy: number | null
  status: string | null
  created_at: string
}

interface DesignFileLite {
  id: string
  storage_url: string | null
  file_name: string | null
  created_at: string
}

interface StatusHistoryLite {
  id: string
  from_simple_status: SimpleStatus | null
  to_simple_status: SimpleStatus | null
  changed_at: string
  note: string | null
  changer?: { display_name: string | null } | null
}

interface DealDetailTabsProps {
  deal: DealLite
  specifications: SpecLite[]
  quotes: QuoteLite[]
  designFiles: DesignFileLite[]
  statusHistory: StatusHistoryLite[]
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'basic', label: '基本情報' },
  { id: 'specifications', label: '商品仕様' },
  { id: 'quotes', label: '見積' },
  { id: 'images', label: '画像' },
]

export function DealDetailTabs({
  deal,
  specifications,
  quotes,
  designFiles,
  statusHistory,
}: DealDetailTabsProps) {
  const [active, setActive] = useState<TabId>('basic')

  return (
    <div>
      {/* Tab Navigation */}
      <div className="flex gap-1 mb-3 border-b border-[rgba(0,0,0,0.06)]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={`
              px-4 py-2 text-[13px] font-body transition-colors border-b-2 -mb-px
              ${
                active === tab.id
                  ? 'border-[#0a0a0a] text-[#0a0a0a] font-semibold'
                  : 'border-transparent text-[#888] hover:text-[#555]'
              }
            `}
          >
            {tab.label}
            {tab.id === 'specifications' && specifications.length > 0 && (
              <span className="ml-1.5 text-[10px] text-[#888]">{specifications.length}</span>
            )}
            {tab.id === 'quotes' && quotes.length > 0 && (
              <span className="ml-1.5 text-[10px] text-[#888]">{quotes.length}</span>
            )}
            {tab.id === 'images' && designFiles.length > 0 && (
              <span className="ml-1.5 text-[10px] text-[#888]">{designFiles.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {active === 'basic' && <BasicTab deal={deal} statusHistory={statusHistory} />}
      {active === 'specifications' && (
        <SpecsTab dealId={deal.id} specifications={specifications} />
      )}
      {active === 'quotes' && <QuotesTab dealId={deal.id} quotes={quotes} />}
      {active === 'images' && <ImagesTab dealId={deal.id} designFiles={designFiles} />}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5">
      <h2 className="text-[13px] font-body font-semibold text-[#0a0a0a] mb-3">{title}</h2>
      {children}
    </div>
  )
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 py-1.5">
      <span className="text-[11px] text-[#888] font-body w-28 flex-shrink-0">{label}</span>
      <span className="text-[13px] text-[#0a0a0a] font-body">{value || '-'}</span>
    </div>
  )
}

function EmptyState({ message, actionHref, actionLabel }: { message: string; actionHref?: string; actionLabel?: string }) {
  return (
    <div className="text-center py-8">
      <p className="text-[13px] text-[#888] font-body">{message}</p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-2 inline-block text-[12px] font-body text-[#22c55e] no-underline hover:underline"
        >
          {actionLabel} →
        </Link>
      )}
    </div>
  )
}

function BasicTab({
  deal,
  statusHistory,
}: {
  deal: DealLite
  statusHistory: StatusHistoryLite[]
}) {
  return (
    <div className="space-y-3">
      <Section title="案件情報">
        <FieldRow label="案件名" value={deal.deal_name} />
        <FieldRow label="クライアント名" value={deal.client_name_text} />
        <FieldRow label="希望納期" value={deal.desired_delivery_date ? formatDate(deal.desired_delivery_date) : null} />
        <FieldRow label="担当スタッフ" value={deal.sales_user?.display_name} />
        <FieldRow label="作成日" value={formatDate(deal.created_at)} />
        <FieldRow label="最終更新" value={formatDate(deal.last_activity_at)} />
      </Section>

      {deal.memo && (
        <Section title="メモ">
          <p className="text-[13px] text-[#0a0a0a] font-body whitespace-pre-wrap">{deal.memo}</p>
        </Section>
      )}

      <Section title="ステータス履歴">
        {statusHistory.length === 0 ? (
          <p className="text-[12px] text-[#888] font-body">まだ履歴がありません。</p>
        ) : (
          <ul className="space-y-2">
            {statusHistory.map((h) => {
              const from = h.from_simple_status ? SIMPLE_STATUS_CONFIG[h.from_simple_status]?.label : null
              const to = h.to_simple_status ? SIMPLE_STATUS_CONFIG[h.to_simple_status]?.label : null
              return (
                <li key={h.id} className="flex items-baseline gap-3 text-[12px] font-body">
                  <span className="text-[#888] tabular-nums w-32 flex-shrink-0">
                    {formatDate(h.changed_at)}
                  </span>
                  <span className="text-[#0a0a0a]">
                    {from ? `${from} → ${to || '-'}` : to ? `→ ${to}` : (h.note || '-')}
                  </span>
                  {h.changer?.display_name && (
                    <span className="text-[#888] ml-auto">{h.changer.display_name}</span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Section>
    </div>
  )
}

function SpecsTab({ dealId, specifications }: { dealId: string; specifications: SpecLite[] }) {
  return (
    <Section title="商品仕様">
      {specifications.length === 0 ? (
        <EmptyState
          message="まだ商品仕様が登録されていません。"
          actionHref={`/deals/${dealId}/specifications/new`}
          actionLabel="商品仕様を追加"
        />
      ) : (
        <>
          <ul className="space-y-2">
            {specifications.map((s) => {
              const sizeStr =
                s.height_mm && s.width_mm
                  ? `${s.height_mm}×${s.width_mm}${s.depth_mm ? `×${s.depth_mm}` : ''}mm`
                  : null
              const summary = [s.product_category, s.material_category, sizeStr].filter(Boolean).join(' / ')
              const printSummary = [s.printing_method, s.print_colors].filter(Boolean).join(' · ')
              return (
                <li
                  key={s.id}
                  className="border border-[#e8e8e6] rounded-[8px] p-3 text-[13px] font-body"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[#0a0a0a] font-semibold">
                        {s.product_name || '(商品名未設定)'}
                      </p>
                      {summary && <p className="text-[#555] mt-1">{summary}</p>}
                      {printSummary && <p className="text-[#888] mt-0.5 text-[12px]">印刷: {printSummary}</p>}
                      {s.processing_list && s.processing_list.length > 0 && (
                        <p className="text-[#888] mt-0.5 text-[12px]">
                          加工: {s.processing_list.join(', ')}
                        </p>
                      )}
                    </div>
                    <Link
                      href={`/deals/${dealId}/specifications/${s.id}/edit`}
                      className="text-[12px] font-body text-[#22c55e] no-underline hover:underline whitespace-nowrap"
                    >
                      編集
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
          <Link
            href={`/deals/${dealId}/specifications/new`}
            className="mt-3 inline-block text-[12px] font-body text-[#22c55e] no-underline hover:underline"
          >
            + 別の商品仕様を追加
          </Link>
        </>
      )}
    </Section>
  )
}

function QuotesTab({ dealId, quotes }: { dealId: string; quotes: QuoteLite[] }) {
  const visible = quotes.slice(0, 3)
  const hidden = quotes.length - visible.length

  return (
    <Section title="見積">
      {quotes.length === 0 ? (
        <EmptyState
          message="まだ見積がありません。"
          actionHref={`/deals/${dealId}/quotes/new`}
          actionLabel="見積を作成"
        />
      ) : (
        <>
          <ul className="space-y-2">
            {visible.map((q) => (
              <li
                key={q.id}
                className="border border-[#e8e8e6] rounded-[8px] p-3 flex items-center justify-between text-[13px] font-body"
              >
                <div>
                  <p className="text-[#0a0a0a] font-semibold tabular-nums">
                    v{q.version || 1} · {q.quantity?.toLocaleString() || '-'} 個
                  </p>
                  <p className="text-[11px] text-[#888]">{formatDate(q.created_at)}</p>
                </div>
                <p className="text-[#0a0a0a] tabular-nums font-semibold">
                  {q.total_billing_tax_jpy != null ? formatJPY(q.total_billing_tax_jpy) : '-'}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-4">
            <Link
              href={`/deals/${dealId}/quotes/new`}
              className="text-[12px] font-body text-[#22c55e] no-underline hover:underline"
            >
              + 別バージョンを追加
            </Link>
            {(hidden > 0 || quotes.length > 0) && (
              <Link
                href={`/deals/${dealId}/quote`}
                className="text-[12px] font-body text-[#555] no-underline hover:underline"
              >
                {hidden > 0 ? `他 ${hidden} 件を見る →` : 'すべての見積を見る →'}
              </Link>
            )}
          </div>
        </>
      )}
    </Section>
  )
}

function ImagesTab({ dealId, designFiles }: { dealId: string; designFiles: DesignFileLite[] }) {
  return (
    <Section title="画像">
      {designFiles.length === 0 ? (
        <EmptyState
          message="まだ画像が登録されていません。"
          actionHref={`/deals/${dealId}/designs`}
          actionLabel="画像をアップロード"
        />
      ) : (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {designFiles.map((f) =>
              f.storage_url ? (
                <a
                  key={f.id}
                  href={f.storage_url}
                  target="_blank"
                  rel="noreferrer"
                  className="block aspect-square bg-[#f5f5f4] rounded-[8px] overflow-hidden border border-[#e8e8e6]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.storage_url}
                    alt={f.file_name || ''}
                    className="w-full h-full object-cover"
                  />
                </a>
              ) : null
            )}
          </div>
          <Link
            href={`/deals/${dealId}/designs`}
            className="mt-3 inline-block text-[12px] font-body text-[#22c55e] no-underline hover:underline"
          >
            画像を管理 →
          </Link>
        </>
      )}
      <p className="text-[11px] text-[#bbb] font-body mt-3">
        ※ Sprint 4 で UI を本格実装します。
      </p>
    </Section>
  )
}
