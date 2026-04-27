'use client'

import { useEffect } from 'react'
import { ChevronLeft, ChevronRight, PanelRightOpen } from 'lucide-react'
import { useUi } from '@/components/ui/ui-store'
import { DealPane, DealPaneEmpty } from './deal-pane'
import type { DealPaneData } from '@/lib/actions/deal-pane-types'

interface Props {
  data: DealPaneData | null
}

/**
 * Wraps DealPane with show/hide behavior.
 * - Auto-opens when a deal is selected (URL ?selected=)
 * - When user explicitly closes via the X button in DealPane, paneOpen=false
 * - When closed, shows a small reopen tab on the right edge
 */
export function DealPaneHost({ data }: Props) {
  const { paneOpen, setPaneOpen } = useUi()

  // Auto-open when a deal is selected
  useEffect(() => {
    if (data && !paneOpen) {
      setPaneOpen(true)
    }
  }, [data, paneOpen, setPaneOpen])

  if (!paneOpen) {
    return (
      <button
        type="button"
        onClick={() => setPaneOpen(true)}
        className="self-start mt-3 mr-0 w-7 h-20 bg-white border border-r-0 border-[#e8e8e6] rounded-l-[8px] flex items-center justify-center text-[#888] hover:text-[#0a0a0a] hover:bg-[#fafaf9] transition-colors flex-shrink-0"
        title="案件パネルを開く"
        aria-label="案件パネルを開く"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
    )
  }

  return data ? <DealPane data={data} /> : <DealPaneEmpty />
}

/**
 * Toggle button to put in the toolbar (e.g. inside the deals table header)
 * for explicit show/hide UX.
 */
export function DealPaneToggle() {
  const { paneOpen, togglePane } = useUi()
  return (
    <button
      type="button"
      onClick={togglePane}
      className="text-[11px] font-body text-[#555] border border-[#e8e8e6] rounded-[6px] px-2 py-1 bg-white hover:bg-[#fafaf8] inline-flex items-center gap-1"
      title={paneOpen ? '案件パネルを閉じる' : '案件パネルを開く'}
    >
      {paneOpen ? <ChevronRight className="w-3 h-3" /> : <PanelRightOpen className="w-3 h-3" />}
      パネル
    </button>
  )
}
