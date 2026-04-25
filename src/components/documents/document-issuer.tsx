'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Printer, FileText } from 'lucide-react'
import {
  DocumentTemplate,
  type DocumentType,
  type DocumentMeta,
  type SpecLite,
  type QuoteLite,
  type FeeLite,
} from './document-templates'
import { issueDocument, type DocumentRow } from '@/lib/actions/documents'
import type { CompanyInfoPhase1, BankAccountPhase1 } from '@/lib/types'
import { formatDate } from '@/lib/utils/format'

interface DealLite {
  id: string
  deal_code: string
  deal_name: string | null
  client_name_text: string | null
  desired_delivery_date: string | null
}

interface DocumentIssuerProps {
  deal: DealLite
  specs: SpecLite[]
  quotes: QuoteLite[]
  fees: FeeLite[]
  company: CompanyInfoPhase1 | null
  banks: BankAccountPhase1[] | null
  defaultShippingAddress: string | null
  initialDocs: DocumentRow[]
  nextNumbers: Record<DocumentType, string>
}

const TABS: Array<{ id: DocumentType; label: string }> = [
  { id: 'quotation', label: '見積書' },
  { id: 'invoice', label: '請求書' },
  { id: 'delivery_note', label: '納品書' },
]

export function DocumentIssuer({
  deal,
  specs,
  quotes,
  fees,
  company,
  banks,
  defaultShippingAddress,
  initialDocs,
  nextNumbers,
}: DocumentIssuerProps) {
  const router = useRouter()
  const [active, setActive] = useState<DocumentType>('quotation')
  const [issuing, startIssue] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [docs, setDocs] = useState<DocumentRow[]>(initialDocs)
  const [paymentDueDate, setPaymentDueDate] = useState('')
  const [shippingDate, setShippingDate] = useState('')
  const [shippingAddress, setShippingAddress] = useState(defaultShippingAddress || '')
  const [notes, setNotes] = useState('')

  const docsByType = (t: DocumentType) => docs.filter((d) => d.document_type === t)
  const currentDocs = docsByType(active)
  const previewNumber = currentDocs[0]?.document_number || nextNumbers[active]

  const meta: DocumentMeta = {
    documentNumber: previewNumber,
    paymentDueDate: active === 'invoice' ? paymentDueDate || null : null,
    shippingDate: active === 'delivery_note' ? shippingDate || null : null,
    shippingAddress: active === 'delivery_note' ? shippingAddress || null : null,
    notes: notes || null,
  }

  const handleIssue = () => {
    setError(null)
    startIssue(async () => {
      const r = await issueDocument({
        deal_id: deal.id,
        document_type: active,
        metadata: {
          payment_due_date: paymentDueDate || undefined,
          shipping_date: shippingDate || undefined,
          shipping_address: shippingAddress || undefined,
          notes: notes || undefined,
        },
      })
      if (r.error || !r.data) {
        setError(r.error || '発行に失敗しました')
        return
      }
      setDocs([r.data, ...docs])
      router.refresh()
    })
  }

  const handlePrint = () => window.print()

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-3 no-print">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActive(t.id)}
            className={`
              px-4 py-2 rounded-[8px] text-[13px] font-body transition-colors
              ${
                active === t.id
                  ? 'bg-[#0a0a0a] text-white'
                  : 'bg-white text-[#555] border border-[#e8e8e6] hover:bg-[#f5f5f4]'
              }
            `}
          >
            {t.label}
            {docsByType(t.id).length > 0 && (
              <span className="ml-2 text-[10px] opacity-70">{docsByType(t.id).length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-4 mb-3 space-y-3 no-print">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {active === 'invoice' && (
            <Field label="お支払期日">
              <input
                type="date"
                value={paymentDueDate}
                onChange={(e) => setPaymentDueDate(e.target.value)}
                className={inputClass}
              />
            </Field>
          )}
          {active === 'delivery_note' && (
            <>
              <Field label="出荷日">
                <input
                  type="date"
                  value={shippingDate}
                  onChange={(e) => setShippingDate(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="納品先住所" className="md:col-span-2">
                <textarea
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  rows={3}
                  className={`${inputClass} resize-y`}
                />
              </Field>
            </>
          )}
          <Field label="備考" className={active === 'delivery_note' ? 'md:col-span-2' : ''}>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="(任意)"
              className={`${inputClass} resize-y`}
            />
          </Field>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleIssue}
            disabled={issuing}
            className="bg-[#22c55e] text-white rounded-[8px] px-4 py-2 text-[13px] font-medium font-body inline-flex items-center gap-1 disabled:opacity-50"
          >
            <FileText className="w-3.5 h-3.5" />
            {currentDocs.length > 0 ? `この内容で再発行 (No. ${nextNumbers[active]})` : `発行 (No. ${previewNumber})`}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="bg-white border border-[#e8e8e6] text-[#0a0a0a] rounded-[8px] px-4 py-2 text-[13px] font-medium font-body inline-flex items-center gap-1"
          >
            <Printer className="w-3.5 h-3.5" />
            印刷 / PDF として保存
          </button>
        </div>
        {error && (
          <p className="text-[11px] text-[#b91c1c] font-body">{error}</p>
        )}
        {currentDocs.length > 0 && (
          <div className="pt-2 border-t border-[#f0f0ed]">
            <p className="text-[10px] text-[#888] font-body">発行履歴 ({currentDocs.length})</p>
            <ul className="text-[11px] text-[#555] font-body mt-1 space-y-0.5">
              {currentDocs.slice(0, 5).map((d) => (
                <li key={d.id} className="tabular-nums">
                  {d.document_number} · {formatDate(d.issued_at)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="document-frame">
        <DocumentTemplate
          type={active}
          deal={deal}
          specs={specs}
          quotes={quotes}
          fees={fees}
          company={company}
          banks={banks}
          meta={meta}
        />
      </div>
    </div>
  )
}

const inputClass =
  'w-full px-3 py-2 text-[13px] font-body bg-white border border-[#e8e8e6] rounded-[8px] focus:outline-none focus:border-[#0a0a0a]'

function Field({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <label className={`block ${className || ''}`}>
      <span className="block text-[11px] font-body text-[#888] mb-1">{label}</span>
      {children}
    </label>
  )
}
