'use client'

import { useState, useTransition, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Printer, FileText, Copy, Check } from 'lucide-react'
import {
  DocumentTemplate,
  type DocumentType,
  type DocumentMeta,
  type SpecLite,
  type ProductLite,
  type VariantLite,
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
  products: ProductLite[]
  variants: VariantLite[]
  quotes: QuoteLite[]
  fees: FeeLite[]
  company: CompanyInfoPhase1 | null
  banks: BankAccountPhase1[] | null
  defaultShippingAddress: string | null
  initialDocs: DocumentRow[]
  nextNumbers: Record<DocumentType, string>
  // Sprint 9: 設定画面で編集可能な定型文 (タブ別)
  boilerplateTexts?: Record<DocumentType, string>
}

const TABS: Array<{ id: DocumentType; label: string }> = [
  { id: 'quotation', label: '見積書' },
  { id: 'invoice', label: '請求書' },
  { id: 'delivery_note', label: '納品書' },
  { id: 'rfq', label: 'RFQ (工場用)' },
]

export function DocumentIssuer({
  deal,
  specs,
  products,
  variants,
  quotes,
  fees,
  company,
  banks,
  defaultShippingAddress,
  initialDocs,
  nextNumbers,
  boilerplateTexts,
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
  const [notesEdited, setNotesEdited] = useState(false)
  const [copyState, setCopyState] = useState<'code' | 'text' | null>(null)

  // タブ切替時に定型文を notes に投入 (ユーザーが手動編集していない場合)
  useEffect(() => {
    if (!notesEdited && boilerplateTexts) {
      setNotes(boilerplateTexts[active] || '')
    }
  }, [active, boilerplateTexts, notesEdited])

  const docsByType = (t: DocumentType) => docs.filter((d) => d.document_type === t)
  const currentDocs = docsByType(active)
  const previewNumber = currentDocs[0]?.document_number || nextNumbers[active]

  const meta: DocumentMeta = {
    documentNumber: previewNumber,
    paymentDueDate: active === 'invoice' ? paymentDueDate || null : null,
    shippingDate: active === 'delivery_note' ? shippingDate || null : null,
    shippingAddress: active === 'delivery_note' ? shippingAddress || null : null,
    // Sprint 9: notes フィールドが空ならテンプレ定型文を補填
    notes: notes || boilerplateTexts?.[active] || null,
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

  const handleCopyDealCode = async () => {
    try {
      await navigator.clipboard.writeText(deal.deal_code)
      setCopyState('code')
      setTimeout(() => setCopyState(null), 1500)
    } catch {
      // noop
    }
  }

  // 全テキストコピー: 帳票の主要内容をプレーンテキストで生成
  const fullText = useMemo(() => {
    const tabLabel = TABS.find((t) => t.id === active)?.label || active
    const lines: string[] = [
      `[${tabLabel}] No. ${previewNumber}`,
      `案件: ${deal.deal_name || '(未設定)'} (${deal.deal_code})`,
      `クライアント: ${deal.client_name_text || '-'}`,
      '',
    ]
    if (notes) lines.push(notes, '')
    return lines.join('\n')
  }, [active, deal.deal_code, deal.deal_name, deal.client_name_text, notes, previewNumber])

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(fullText)
      setCopyState('text')
      setTimeout(() => setCopyState(null), 1500)
    } catch {
      // noop
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-3 no-print">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActive(t.id)}
            className={`px-4 py-2 rounded-[8px] text-[13px] font-body transition-colors ${
              active === t.id
                ? 'bg-[#0a0a0a] text-white'
                : 'bg-white text-[#555] border border-[#e8e8e6] hover:bg-[#f5f5f4]'
            }`}
          >
            {t.label}
            {docsByType(t.id).length > 0 && (
              <span className="ml-2 text-[10px] opacity-70">{docsByType(t.id).length}</span>
            )}
          </button>
        ))}
      </div>

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
          <Field label="備考 / 定型文 (設定画面で編集可)" className={active === 'delivery_note' || active === 'rfq' ? 'md:col-span-2' : ''}>
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value)
                setNotesEdited(true)
              }}
              rows={4}
              placeholder={active === 'rfq' ? '工場への補足事項 (任意)' : '(任意)'}
              className={`${inputClass} resize-y`}
            />
            {notesEdited && boilerplateTexts && (
              <button
                type="button"
                onClick={() => {
                  setNotes(boilerplateTexts[active] || '')
                  setNotesEdited(false)
                }}
                className="text-[10px] text-[#888] hover:text-[#0a0a0a] mt-1 underline"
              >
                定型文に戻す
              </button>
            )}
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

          {/* Sprint 9-6: コピペボタン */}
          <button
            type="button"
            onClick={handleCopyDealCode}
            className="bg-white border border-[#e8e8e6] text-[#0a0a0a] rounded-[8px] px-3 py-2 text-[12px] font-body inline-flex items-center gap-1"
            title="案件番号をクリップボードにコピー"
          >
            {copyState === 'code' ? <Check className="w-3.5 h-3.5 text-[#22c55e]" /> : <Copy className="w-3.5 h-3.5" />}
            案件番号
          </button>
          <button
            type="button"
            onClick={handleCopyAll}
            className="bg-white border border-[#e8e8e6] text-[#0a0a0a] rounded-[8px] px-3 py-2 text-[12px] font-body inline-flex items-center gap-1"
            title="帳票の主要内容をプレーンテキストでコピー (メール添付用)"
          >
            {copyState === 'text' ? <Check className="w-3.5 h-3.5 text-[#22c55e]" /> : <Copy className="w-3.5 h-3.5" />}
            全テキスト
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

      <div className="document-frame">
        <DocumentTemplate
          type={active}
          deal={deal}
          specs={specs}
          products={products}
          variants={variants}
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
