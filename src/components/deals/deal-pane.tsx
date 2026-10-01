'use client'

import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useUi } from '@/components/ui/ui-store'
import { SIMPLE_STATUS_CONFIG } from '@/lib/types'
import { caseAction, approvedAmount, waitingLabel, invalidDocumentQuotes } from '@/lib/deals/case-workspace'
import { buildGuideCounts } from './next-step-guide'
import { formatJPY, formatDate } from '@/lib/utils/format'
import type { DealPaneData } from '@/lib/actions/deal-pane-types'

/** The grid preview is read-only. Transactions are performed in the full case workspace. */
export function DealPane({ data }: { data: DealPaneData }) {
  const router = useRouter(), pathname = usePathname(), params = useSearchParams()
  const { setPaneOpen } = useUi()
  const counts = buildGuideCounts({ products: data.products, variants: data.variants as never, quotes: data.quotes as never, documents: data.documents, rfqs: data.rfqCount })
  const amount = approvedAmount(data.quotes as Array<{ status?: string | null; total_billing_tax_jpy?: unknown }>)
  const action = caseAction(data.deal.simple_status, { ...counts, missingAmounts: amount.missing, invalidApprovedQuotes: invalidDocumentQuotes(data.quotes as Array<{ status?: string | null; quantity?: unknown; total_billing_jpy?: unknown }>), quotationDocs: counts.quoteDocs })
  const close = () => { const p = new URLSearchParams(params.toString()); p.delete('selected'); setPaneOpen(false); router.push(pathname + (p.size ? '?' + p.toString() : ''), { scroll: false }) }
  return <aside aria-label="案件の概要" className="w-full lg:w-[360px] lg:shrink-0 border-l border-[#E2E1DA] bg-white p-4 space-y-4">
    <div className="flex justify-between gap-3"><div><p className="text-[11px] text-[#84787D]">{data.deal.deal_code}</p><h2 className="text-[15px] font-bold">{data.deal.deal_name || '案件名未設定'}</h2><p className="text-[12px] text-[#84787D]">{data.deal.client_name_text || '取引先未設定'}</p></div><button type="button" onClick={close} className="min-h-[44px] text-[12px] underline">閉じる</button></div>
    <dl className="grid grid-cols-2 gap-3 text-[12px]"><div><dt className="text-[#84787D]">現在の工程</dt><dd className="font-bold">{SIMPLE_STATUS_CONFIG[data.deal.simple_status]?.label}</dd></div><div><dt className="text-[#84787D]">待ち先</dt><dd>{waitingLabel(data.deal.waiting_on)}</dd></div><div><dt className="text-[#84787D]">希望納期</dt><dd>{data.deal.desired_delivery_date ? formatDate(data.deal.desired_delivery_date) : '未設定'}</dd></div><div><dt className="text-[#84787D]">担当</dt><dd>{data.deal.sales_user?.display_name || '未設定'}</dd></div><div><dt className="text-[#84787D]">採用額（税込）</dt><dd>{amount.label || formatJPY(amount.total)}</dd></div></dl>
    <div><p className="text-[11px] text-[#84787D]">次の対応</p><p className="text-[13px] font-bold">{action.label}</p><p className="text-[12px] text-[#84787D] mt-1">{action.reason}</p></div>
    <Link href={`/deals/${data.deal.id}?step=${action.step}`} className="inline-flex min-h-[44px] items-center rounded-full border border-[#E2E1DA] px-4 text-[12px] font-bold">案件の作業画面を開く</Link>
  </aside>
}
export function DealPaneEmpty() { return null }
