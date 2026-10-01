'use client'

import { useState, useTransition, useEffect, useMemo } from 'react'
import { useWorkflowRequest } from '@/lib/hooks/use-workflow-request'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Printer, FileText, Copy, Check } from 'lucide-react'
import {
  DocumentTemplate,
  type DocumentType,
  type TemplateProps,
  type DocumentMeta,
  type SpecLite,
  type ProductLite,
  type VariantLite,
  type QuoteLite,
  type FeeLite,
} from './document-templates'
import { issueDocument, type DocumentRow } from '@/lib/actions/documents'
import type { CompanyInfoPhase1, BankAccountPhase1 } from '@/lib/types'
import { documentTotals } from '@/lib/calc/document-totals'
import { formatJPY, formatDate } from '@/lib/utils/format'

interface DealLite {
  id: string
  deal_code: string
  deal_name: string | null
  client_name_text: string | null
  desired_delivery_date: string | null
}

interface DocumentIssuerProps {
  initialType?: DocumentType
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
  initialType = 'quotation',
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
  const [active, setActive] = useState<DocumentType>(initialType)
  const recovery = useWorkflowRequest(`document/${deal.id}/${active}`, 'document', deal.id)
  const { recovered, complete: completeRecovery } = recovery
  const [issuing, startIssue] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [docs, setDocs] = useState<DocumentRow[]>(initialDocs)
  const [paymentDueDate, setPaymentDueDate] = useState('')
  const [shippingDate, setShippingDate] = useState('')
  const [shippingAddress, setShippingAddress] = useState(defaultShippingAddress || '')
  const [notes, setNotes] = useState('')
  const [notesEdited, setNotesEdited] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<DocumentRow | null>(null)
  const [manualFxConfirmed,setManualFxConfirmed]=useState(false)
  const [manualFxRate,setManualFxRate]=useState('')
  useEffect(() => {
    if (recovered?.document_type === active) {
      const restored = recovered as unknown as DocumentRow
      setDocs(previous => previous.some(d => d.id === restored.id) ? previous : [restored, ...previous])
      setSelectedDoc(restored)
      completeRecovery()
    }
  }, [recovered, completeRecovery, active])
  const [copyState, setCopyState] = useState<'code' | 'text' | null>(null)

  // タブ切替時に定型文を notes に投入 (ユーザーが手動編集していない場合)
  useEffect(() => {
    if (!notesEdited && boilerplateTexts) {
      setNotes(boilerplateTexts[active] || '')
    }
  }, [active, boilerplateTexts, notesEdited])

  const docsByType = (t: DocumentType) => docs.filter((d) => d.document_type === t)
  const currentDocs = docsByType(active)
  const previewNumber = selectedDoc?.document_number || nextNumbers[active]
  const saved = selectedDoc?.metadata
  const snapshot = saved?.snapshot as Omit<TemplateProps, 'type' | 'meta'> | undefined
  const hasApprovedQuote = quotes.some(q => q.status === 'approved')
  const canIssue = active === 'rfq' ? variants.length > 0 : hasApprovedQuote
  const requiresManualFx=active==='quotation'&&quotes.some(q=>q.status==='approved'&&q.pricing_snapshot)
  const confirmedFxValid=!requiresManualFx||(manualFxConfirmed&&Number.isFinite(Number(manualFxRate))&&Number(manualFxRate)>0&&quotes.filter(q=>q.status==='approved').every(q=>q.pricing_snapshot&&Number((q.pricing_snapshot.fx as {rate?:string})?.rate)===Number(manualFxRate)))

  const meta: DocumentMeta = {
    documentNumber: previewNumber,
    issuedAt: selectedDoc?.issued_at,
    paymentDueDate: active === 'invoice' ? (selectedDoc ? String(saved?.payment_due_date || '') : paymentDueDate) || null : null,
    shippingDate: active === 'delivery_note' ? (selectedDoc ? String(saved?.shipping_date || '') : shippingDate) || null : null,
    shippingAddress: active === 'delivery_note' ? (selectedDoc ? String(saved?.shipping_address || '') : shippingAddress) || null : null,
    // Sprint 9: notes フィールドが空ならテンプレ定型文を補填
    notes: selectedDoc ? String(saved?.notes || '') : notes || null,
  }

  const handleIssue = () => {
    setError(null)
    startIssue(async () => {
      try {
      const metadata = { payment_due_date: paymentDueDate || undefined, shipping_date: shippingDate || undefined, shipping_address: shippingAddress || undefined, notes: meta.notes || undefined, ...(requiresManualFx?{manual_fx:{rate:Number(manualFxRate),confirmed:manualFxConfirmed}}:{}) }
      const request_id = await recovery.requestId({ deal_id: deal.id, document_type: active, metadata })
      const r = await issueDocument({
        request_id,
        deal_id: deal.id,
        document_type: active,
        metadata,
      })
      if (r.error || !r.data) {
        setError(r.error || '発行に失敗しました')
        return
      }
      recovery.complete()
      setDocs(previous => previous.some(d => d.id === r.data!.id) ? previous : [r.data!, ...previous])
      setSelectedDoc(r.data)
      setManualFxConfirmed(false)
      router.refresh()
      } catch (e) { setError(e instanceof Error ? e.message : '帳票の発行に失敗しました。履歴を確認してから再試行してください') }
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
    if (active !== 'rfq') {
      const totals = documentTotals(snapshot?.quotes || quotes, snapshot?.fees || fees)
      for (const q of totals.lineItems) {
        const variant = (snapshot?.variants || variants).find(v => v.id === q.variant_id)
        const product = (snapshot?.products || products).find(p => p.id === variant?.product_id)
        const spec = (snapshot?.specs || specs).find(s => s.id === q.spec_id)
        lines.push(`${product?.description || spec?.product_name || '商品'} ${variant?.variant_label || ''} / ${q.quantity?.toLocaleString()}個 × ${formatJPY(q.selling_price_jpy || 0)} = ${formatJPY(q.total_billing_jpy || 0)}`)
      }
      lines.push(`別途費用: ${formatJPY(totals.feesTotal)}`, `消費税: ${formatJPY(totals.tax)}`, `合計(税込): ${formatJPY(totals.grandTotal)}`)
    }
    if (meta.notes) lines.push(meta.notes, '')
    return lines.join('\n')
  }, [active, deal.deal_code, deal.deal_name, deal.client_name_text, meta.notes, previewNumber, snapshot, quotes, fees, variants, products, specs])

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
            onClick={() => { setActive(t.id); setSelectedDoc(null); setNotesEdited(false); setError(null) }}
            className={`min-h-[44px] px-4 py-2 rounded-full text-[13px] font-body transition-colors ${
              active === t.id
                ? 'bg-[#351E28] text-[#C9A2B8]'
                : 'bg-white text-[#351E28] border border-[#E2E1DA] hover:bg-[#EFEFEA]'
            }`}
          >
            {t.label}
            {docsByType(t.id).length > 0 && (
              <span className="ml-2 text-[10px] opacity-70">{docsByType(t.id).length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-[16px] border border-[rgba(53,30,40,0.06)] p-4 mb-3 space-y-3 no-print">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {active === 'invoice' && (
            <Field label="お支払期日">
              <input
                disabled={!!selectedDoc}
                type="date"
                value={selectedDoc ? String(saved?.payment_due_date || '') : paymentDueDate}
                onChange={(e) => setPaymentDueDate(e.target.value)}
                className={inputClass}
              />
            </Field>
          )}
          {active === 'delivery_note' && (
            <>
              <Field label="出荷日">
                <input
                  disabled={!!selectedDoc}
                type="date"
                  value={selectedDoc ? String(saved?.shipping_date || '') : shippingDate}
                  onChange={(e) => setShippingDate(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="納品先住所" className="md:col-span-2">
                <textarea
                  disabled={!!selectedDoc}
                  value={selectedDoc ? String(saved?.shipping_address || '') : shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  rows={3}
                  className={`${inputClass} resize-y`}
                />
              </Field>
            </>
          )}
          <Field label="備考 / 定型文 (設定画面で編集可)" className={active === 'delivery_note' || active === 'rfq' ? 'md:col-span-2' : ''}>
            <textarea
              disabled={!!selectedDoc}
              value={selectedDoc ? String(saved?.notes || '') : notes}
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
                className="text-[10px] text-[#84787D] hover:text-[#351E28] mt-1 underline"
              >
                定型文に戻す
              </button>
            )}
          </Field>
        </div>

        <p className="text-[12px] text-[#84787D]">{selectedDoc ? '発行済み帳票を表示中。印刷で同じ内容を再出力できます。' : !canIssue ? (active === 'rfq' ? '先に案件の仕様を登録してください。登録後にRFQを発行できます。' : '先に見積を採用してください。未採用の見積は帳票に含めません。') : '採用見積と別途費用から作成します。発行すると内容を保存します。'}</p>
        {!canIssue && !selectedDoc && <Link href={`/deals/${deal.id}${active === 'rfq' ? '?step=2' : '/quote-builder'}`} className="inline-flex items-center min-h-[44px] underline text-[12px]">{active === 'rfq' ? '案件の仕様を登録する' : '見積を確認・採用する'}</Link>}
        {recovery.error && <p role="alert" className="text-[#B03616] text-[12px]">{recovery.error}</p>}
        {recovery.unfinished && !recovery.recovered && <button type="button" className="underline text-[12px]" onClick={recovery.complete}>発行履歴を確認済み・新しい発行を始める</button>}
        {selectedDoc && <button type="button" className="rounded-full border border-[#E2E1DA] px-4 py-2 text-[12px]" onClick={() => { setSelectedDoc(null); setManualFxConfirmed(false); recovery.complete() }}>新しい帳票を作成する</button>}
        {selectedDoc && !snapshot && <p role="alert" className="text-[12px] text-[#B03616]">この旧帳票には発行時の内容が保存されていません。現在の案件情報を参考表示しています。</p>}
        {requiresManualFx&&!selectedDoc&&<div className="rounded-card border border-[#E2E1DA] p-3 space-y-2 text-[12px]"><p>発行時のレートを手入力で確認してください。最新自動取得は未実装です。変更がある場合は採用価格を新しいFXで改訂し、PDFを再確認してください。</p><label className="block">発行時に確認したJPY/USD<input className="block min-h-11 rounded-input bg-[#EFEFEA] px-3" type="number" step="any" value={manualFxRate} onChange={e=>{setManualFxRate(e.target.value);setManualFxConfirmed(false)}} disabled={issuing}/></label><label className="flex gap-2 min-h-11 items-center"><input type="checkbox" checked={manualFxConfirmed} onChange={e=>setManualFxConfirmed(e.target.checked)} disabled={issuing}/>発行時レートと全採用版の金額・PDFを確認しました</label>{!confirmedFxValid&&<p role="status">レート確認と全採用価格版の一致が必要です。</p>}</div>}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleIssue}
            disabled={!recovery.ready || issuing || !canIssue || !!selectedDoc || !confirmedFxValid}
            className="bg-[#E9F056] text-[#666C14] rounded-full min-h-[44px] px-4 py-2 text-[13px] font-medium font-body inline-flex items-center gap-1 disabled:opacity-50"
          >
            <FileText className="w-3.5 h-3.5" />
            {issuing ? '発行中…' : 'この内容で発行する'}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={!selectedDoc && !canIssue}
            className="bg-white border border-[#E2E1DA] text-[#351E28] rounded-full min-h-[44px] px-4 py-2 text-[13px] font-medium font-body inline-flex items-center gap-1"
          >
            <Printer className="w-3.5 h-3.5" />
            印刷 / PDF として保存
          </button>

          {/* Sprint 9-6: コピペボタン */}
          <button
            type="button"
            onClick={handleCopyDealCode}
            className="bg-white border border-[#E2E1DA] text-[#351E28] rounded-[12px] px-3 py-2 text-[12px] font-body inline-flex items-center gap-1"
            title="案件番号をクリップボードにコピー"
          >
            {copyState === 'code' ? <Check className="w-3.5 h-3.5 text-[#666C14]" /> : <Copy className="w-3.5 h-3.5" />}
            案件番号
          </button>
          <button
            type="button"
            onClick={handleCopyAll}
            className="bg-white border border-[#E2E1DA] text-[#351E28] rounded-[12px] px-3 py-2 text-[12px] font-body inline-flex items-center gap-1"
            title="帳票の主要内容をプレーンテキストでコピー (メール添付用)"
          >
            {copyState === 'text' ? <Check className="w-3.5 h-3.5 text-[#666C14]" /> : <Copy className="w-3.5 h-3.5" />}
            全テキスト
          </button>
        </div>
        {error && (
          <p className="text-[11px] text-[#B03616] font-body">{error}</p>
        )}
        {currentDocs.length > 0 && (
          <div className="pt-2 border-t border-[#EFEFEA]">
            <p className="text-[10px] text-[#84787D] font-body">発行履歴 ({currentDocs.length})</p>
            <ul className="text-[11px] text-[#351E28] font-body mt-1 space-y-0.5">
              {currentDocs.slice(0, 5).map((d) => (
                <li key={d.id} className="tabular-nums">
                  <button type="button" onClick={() => setSelectedDoc(d)} className="rounded-full px-3 py-2 underline" aria-pressed={selectedDoc?.id === d.id}>{d.document_number} · {formatDate(d.issued_at)} を表示</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="document-frame">
        <DocumentTemplate
          type={active}
          deal={snapshot?.deal || deal}
          specs={snapshot?.specs || specs}
          products={snapshot?.products || products}
          variants={snapshot?.variants || variants}
          quotes={snapshot?.quotes || quotes}
          fees={snapshot?.fees || fees}
          company={snapshot ? snapshot.company : company}
          banks={snapshot ? snapshot.banks : banks}
          meta={meta}
        />
      </div>
    </div>
  )
}

const inputClass =
  'w-full px-3 py-2 text-[13px] font-body bg-white border border-[#E2E1DA] rounded-[12px] focus:outline-none focus:border-[#351E28]'

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
      <span className="block text-[11px] font-body text-[#84787D] mb-1">{label}</span>
      {children}
    </label>
  )
}
