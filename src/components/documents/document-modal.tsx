'use client'

import { useEffect, useState, useTransition } from 'react'
import { X } from 'lucide-react'
import { DocumentIssuer } from './document-issuer'
import type {
  DocumentType,
  SpecLite,
  ProductLite,
  VariantLite,
  QuoteLite,
  FeeLite,
} from './document-templates'
import type { DocumentRow } from '@/lib/actions/documents'
import type { CompanyInfoPhase1, BankAccountPhase1 } from '@/lib/types'
import { fetchDocumentBundle } from '@/lib/actions/documents'

interface Props {
  dealId: string
  initialType?: DocumentType
  onClose: () => void
}

interface Bundle {
  deal: {
    id: string
    deal_code: string
    deal_name: string | null
    client_name_text: string | null
    desired_delivery_date: string | null
  }
  specs: SpecLite[]
  products: ProductLite[]
  variants: VariantLite[]
  quotes: QuoteLite[]
  fees: FeeLite[]
  docs: DocumentRow[]
  company: CompanyInfoPhase1 | null
  banks: BankAccountPhase1[] | null
  defaultShippingAddress: string | null
  boilerplateTexts: Record<DocumentType, string>
  nextNumbers: Record<DocumentType, string>
}

export function DocumentModal({ dealId, onClose }: Props) {
  const [bundle, setBundle] = useState<Bundle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startLoad] = useTransition()

  useEffect(() => {
    startLoad(async () => {
      const r = await fetchDocumentBundle(dealId)
      if (r.error || !r.data) setError(r.error || 'データ取得に失敗しました')
      else setBundle(r.data as unknown as Bundle)
    })
  }, [dealId])

  // ESC で閉じる
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 no-print"
      onClick={onClose}
    >
      <div
        className="bg-[#f2f2f0] rounded-[14px] max-w-6xl w-full h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[rgba(0,0,0,0.06)] bg-white no-print">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-[14px] font-semibold text-[#0a0a0a]">帳票発行</h2>
            {bundle && (
              <p className="text-[11px] text-[#888] tabular-nums">
                {bundle.deal.deal_code} · {bundle.deal.deal_name || '(未設定)'}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#555] hover:bg-[#f5f5f4] rounded-[6px]"
            aria-label="閉じる"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {error ? (
            <div className="bg-[#fef2f2] border border-[#fca5a5] rounded-[8px] p-3 text-[12px] text-[#b91c1c]">
              {error}
            </div>
          ) : !bundle ? (
            <p className="text-[12px] text-[#888] text-center py-8">読込中...</p>
          ) : (
            <DocumentIssuer
              deal={bundle.deal}
              specs={bundle.specs}
              products={bundle.products}
              variants={bundle.variants}
              quotes={bundle.quotes}
              fees={bundle.fees}
              company={bundle.company}
              banks={bundle.banks}
              defaultShippingAddress={bundle.defaultShippingAddress}
              initialDocs={bundle.docs}
              nextNumbers={bundle.nextNumbers}
              boilerplateTexts={bundle.boilerplateTexts}
            />
          )}
        </div>
      </div>
    </div>
  )
}
