'use client'

// Sprint 10 (#18): 案件詳細 =「一本の線」画面。
// ユーザーと確認した13ステップの案件ライフラインを縦1本に並べ、
// 各ステップをその場で開いて入力・進行できるようにする。
// タブ分散(基本情報/商品/見積/画像/通信/履歴)をやめ、線の上に統合した。
//
// ステップの実行者: ● 自分 / ▲ 工場 / ◯ クライアント
// 完了判定は実データ(商品数・RFQ数・単価・カートン・採用・帳票・ステータス)から。

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { InlineCell } from '@/components/deals/inline-cell'
import {
  QuoteTable,
  VariantQuoteTable,
  type BuilderQuote,
  type DealHead,
  type VariantHead,
} from '@/components/deals/quote-builder'
import { RfqCreateModal } from '@/components/deals/rfq-create-modal'
import { DocumentModal } from '@/components/documents/document-modal'
import { AttachmentGallery } from '@/components/deals/attachment-gallery'
import { DealCommunicationTab } from '@/components/deals/deal-communication-tab'
import { RepeatDealButton } from '@/components/deals/repeat-deal-button'
import {
  updateDealField,
  updateProductField,
  updateVariantField,
  updateQuoteField,
} from '@/lib/actions/inline-edit'
import { updateDealStatus } from '@/lib/actions/deal-status'
import { addBlankProduct } from '@/lib/actions/products'
import { addBlankVariant } from '@/lib/actions/variants'
import { createQuote } from '@/lib/actions/quotes'
import { archiveDeal } from '@/lib/actions/deals'
import { useUi } from '@/components/ui/ui-store'
import { formatJPY, formatDate } from '@/lib/utils/format'
import {
  type SimpleStatus,
  SIMPLE_STATUS_ORDER,
  SIMPLE_STATUS_CONFIG,
  type DealProduct,
  type DealProductVariant,
  type DealCommunication,
} from '@/lib/types'
import type { DesignFileRow } from '@/lib/actions/designs'
import type { ProductRow } from '@/components/deals/deals-nested-table'

// ---------------------------------------------------------------------------
// 型
// ---------------------------------------------------------------------------

export interface FlowDeal {
  id: string
  deal_code: string
  deal_name: string | null
  client_name_text: string | null
  desired_delivery_date: string | null
  memo: string | null
  simple_status: SimpleStatus
  waiting_on: string | null
  created_at: string
  last_activity_at: string
  sales_user?: { display_name: string | null } | null
}

export interface FlowDocument {
  id: string
  document_type: string
  document_number: string | null
  file_url: string | null
  created_at: string
}

export interface FlowHistoryRow {
  id: string
  from_simple_status: SimpleStatus | null
  to_simple_status: SimpleStatus | null
  changed_at: string
  note: string | null
  kind: string | null
  changer?: { display_name: string | null } | null
}

interface DealFlowProps {
  deal: FlowDeal
  products: DealProduct[]
  variants: DealProductVariant[]
  quotes: BuilderQuote[]
  designFiles: DesignFileRow[]
  documents: FlowDocument[]
  rfqCount: number
  statusHistory: FlowHistoryRow[]
  communications: DealCommunication[]
}

type Actor = 'us' | 'factory' | 'client'

const ACTOR_LABEL: Record<Actor, string> = {
  us: '● 自分',
  factory: '▲ 工場',
  client: '◯ クライアント',
}

// ---------------------------------------------------------------------------
// 本体
// ---------------------------------------------------------------------------

export function DealFlow({
  deal,
  products,
  variants,
  quotes,
  designFiles,
  documents,
  rfqCount,
  statusHistory,
  communications,
}: DealFlowProps) {
  const statusIdx = SIMPLE_STATUS_ORDER.indexOf(deal.simple_status)

  const pricedQuotes = quotes.filter(
    (q) => q.quantity != null && q.factory_unit_price_usd != null
  ).length
  const cartonReady = variants.filter(
    (v) =>
      v.pcs_per_carton != null &&
      v.carton_width_cm != null &&
      v.carton_height_cm != null &&
      v.carton_depth_cm != null &&
      v.gross_weight_kg != null
  ).length
  const approvedQuotes = quotes.filter((q) => q.status === 'approved')
  const quoteDocs = documents.filter((d) => d.document_type === 'quotation')
  const invoiceDocs = documents.filter((d) => d.document_type === 'invoice')

  const dealHead: DealHead = {
    id: deal.id,
    deal_code: deal.deal_code,
    deal_name: deal.deal_name,
    client_name_text: deal.client_name_text,
  }

  // 各ステップの完了判定(status が先へ進んでいれば前段は完了扱い)
  const doneList: boolean[] = [
    true, // 1 案件作成
    products.length > 0 && variants.length > 0, // 2 仕様
    rfqCount > 0 || statusIdx >= 1, // 3 RFQ
    (pricedQuotes > 0 && cartonReady > 0) || statusIdx >= 1, // 4 工場回答
    (pricedQuotes > 0 && cartonReady > 0) || statusIdx >= 1, // 5 原価(自動)
    approvedQuotes.length > 0 || statusIdx >= 1, // 6 売値
    statusIdx >= 1, // 7 見積書→承認
    statusIdx >= 2, // 8 請求書→入金
    statusIdx >= 3, // 9 前払い・入稿データ
    statusIdx >= 4, // 10 製作開始
    statusIdx >= 5, // 11 出荷・輸送
    statusIdx >= 6, // 12 到着・検品・入庫
    false, // 13 完了(最終)
  ]
  const currentIdx = doneList.findIndex((d) => !d)

  const [openSet, setOpenSet] = useState<Set<number>>(() => new Set([currentIdx]))
  const toggle = (i: number) =>
    setOpenSet((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  const steps: Array<{
    title: string
    actor: Actor
    summary: string
    body: React.ReactNode
  }> = [
    {
      title: '問い合わせ → 案件をつくる',
      actor: 'us',
      summary: `${deal.client_name_text || 'クライアント未設定'} · 希望納期 ${
        deal.desired_delivery_date ? formatDate(deal.desired_delivery_date) : '未設定'
      }`,
      body: <StepDealInfo deal={deal} />,
    },
    {
      title: '仕様を固める(サイズ・素材・印刷)',
      actor: 'us',
      summary:
        products.length > 0
          ? `${products.length}商品 · ${variants.length}バリエ`
          : 'まだ商品がありません',
      body: <StepSpecs deal={deal} products={products} variants={variants} />,
    },
    {
      title: '工場へ見積依頼(RFQ)を送る',
      actor: 'us',
      summary: rfqCount > 0 ? `${rfqCount}件 送付済み` : 'まだ送っていません',
      body: <StepRfq deal={deal} products={products} rfqCount={rfqCount} />,
    },
    {
      title: '工場の回答を記録(単価$・型代・MOQ・カートン)',
      actor: 'factory',
      summary: `単価入力 ${pricedQuotes}行 · カートン情報 ${cartonReady}/${variants.length}バリエ`,
      body: (
        <StepFactoryReply
          deal={deal}
          products={products}
          variants={variants}
          quotes={quotes}
          cartonReady={cartonReady}
        />
      ),
    },
    {
      title: '原価を計算(単価+型代+送料+手数料)',
      actor: 'us',
      summary:
        cartonReady > 0
          ? 'カートン情報から容積重量→送料を自動計算'
          : 'カートン情報が無いと送料が出せません',
      body: (
        <StepCost
          products={products}
          variants={variants}
          quotes={quotes}
          cartonReady={cartonReady}
        />
      ),
    },
    {
      title: '売値を決める(掛率 → 粗利)',
      actor: 'us',
      summary:
        approvedQuotes.length > 0
          ? `${approvedQuotes.length}パターン採用 · 税込 ${formatJPY(
              approvedQuotes.reduce((s, q) => s + (Number(q.total_billing_tax_jpy) || 0), 0)
            )}`
          : '掛率を入れて「この価格で採用」',
      body: (
        <StepPricing dealHead={dealHead} products={products} variants={variants} quotes={quotes} />
      ),
    },
    {
      title: '見積書をつくって送る(修正が来たら④〜⑦を回す)',
      actor: 'client',
      summary:
        quoteDocs.length > 0 ? `見積書 ${quoteDocs.length}通 発行済み` : 'まだ発行していません',
      body: <StepQuoteDoc deal={deal} docs={quoteDocs} statusIdx={statusIdx} />,
    },
    {
      title: '承認 → 見積確定 → 請求書 → 入金待ち',
      actor: 'client',
      summary:
        invoiceDocs.length > 0 ? `請求書 ${invoiceDocs.length}通 発行済み` : '承認後に請求書を発行',
      body: <StepInvoice deal={deal} docs={invoiceDocs} statusIdx={statusIdx} />,
    },
    {
      title: '入金確認 → 工場へ前払い → 入稿データ最終確認',
      actor: 'us',
      summary: `入稿データ添付 ${designFiles.length}件`,
      body: <StepDataCheck deal={deal} designFiles={designFiles} statusIdx={statusIdx} />,
    },
    {
      title: '製作開始を指示 → 製作',
      actor: 'factory',
      summary:
        statusIdx >= 4 ? '製作中(工場待ち)' : statusIdx === 3 ? '指示待ち' : 'データ確認後',
      body: <StepProduction deal={deal} statusIdx={statusIdx} />,
    },
    {
      title: '完成・出荷 → 輸送・通関',
      actor: 'factory',
      summary: statusIdx >= 5 ? '発送済み・輸送中' : '工場の発送待ち',
      body: <StepShipping deal={deal} statusIdx={statusIdx} />,
    },
    {
      title: '到着検品 → 直接納品 or 在庫入庫',
      actor: 'us',
      summary: statusIdx >= 6 ? '納品済み' : '到着したら検品して納品/入庫',
      body: <StepArrival deal={deal} statusIdx={statusIdx} />,
    },
    {
      title: '納品完了 → アーカイブ / リピート',
      actor: 'us',
      summary: statusIdx >= 6 ? 'この案件は完了しています' : '納品完了後',
      body: <StepDone deal={deal} />,
    },
  ]

  return (
    <div className="pb-8">
      <ol className="list-none m-0 p-0">
        {steps.map((s, i) => {
          const done = doneList[i]
          const isCurrent = i === currentIdx
          const open = openSet.has(i)
          return (
            <li key={s.title} className="relative flex gap-3">
              {/* 縦の線 + ドット(過去=Cool Blue / 現在=Wasabi / 未来=Line) */}
              <div className="flex flex-col items-center w-[34px] flex-shrink-0">
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  aria-expanded={open}
                  className={`fc-num w-[30px] h-[30px] rounded-full flex items-center justify-center text-[12px] font-extrabold flex-shrink-0 mt-1 ${
                    done
                      ? 'bg-[#D7EFFF] text-[#33566F]'
                      : isCurrent
                        ? 'bg-[#E9F056] text-[#666C14]'
                        : 'bg-white border border-[#E2E1DA] text-[#84787D]'
                  }`}
                >
                  {done ? '✓' : i + 1}
                </button>
                {i < steps.length - 1 && (
                  <div
                    className={`w-[2px] flex-1 min-h-[16px] ${
                      done ? 'bg-[#D7EFFF]' : 'bg-[#E2E1DA]'
                    }`}
                  />
                )}
              </div>

              {/* ステップカード */}
              <div
                className={`flex-1 min-w-0 mb-2 bg-white rounded-[16px] border ${
                  isCurrent ? 'border-[#E9F056] border-[1.5px]' : 'border-[#E2E1DA]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  className="w-full text-left px-4 py-2.5 flex items-center gap-2.5 cursor-pointer"
                >
                  <span
                    className={`text-[13px] font-display font-bold flex-1 min-w-0 truncate ${
                      done ? 'text-[#84787D]' : 'text-[#351E28]'
                    }`}
                  >
                    {s.title}
                  </span>
                  <span className="hidden sm:inline text-[11px] text-[#84787D] font-body truncate max-w-[280px]">
                    {s.summary}
                  </span>
                  <span className="rounded-full bg-[#EFEFEA] border border-[#E2E1DA] text-[#4C5544] text-[10px] font-bold px-2 py-[2px] whitespace-nowrap">
                    {ACTOR_LABEL[s.actor]}
                  </span>
                  {isCurrent && (
                    <span className="rounded-full bg-[#E9F056] text-[#666C14] text-[10px] font-bold px-2 py-[2px] whitespace-nowrap">
                      今ここ
                    </span>
                  )}
                  <span className="text-[#84787D] text-[11px] flex-shrink-0">
                    {open ? '▴' : '▾'}
                  </span>
                </button>
                {open && (
                  <div className="px-4 pb-4 pt-1 border-t border-[#EFEFEA]">{s.body}</div>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {/* 線の外の道具箱: 通信・履歴 */}
      <UtilitySection title={`通信の記録 (${communications.length})`}>
        <DealCommunicationTab dealId={deal.id} initial={communications} />
      </UtilitySection>
      <UtilitySection title={`変更履歴 (${statusHistory.length})`}>
        <HistoryList rows={statusHistory} />
      </UtilitySection>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 共通部品
// ---------------------------------------------------------------------------

function UtilitySection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-2 ml-[46px] bg-[#FBFAF6] rounded-[16px] border border-[#E2E1DA]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-4 py-2.5 flex items-center justify-between cursor-pointer"
      >
        <span className="text-[12.5px] font-display font-bold text-[#351E28]">{title}</span>
        <span className="text-[#84787D] text-[11px]">{open ? '▴' : '▾'}</span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

/** ステータスを進めるボタン(dark ピル。今のステップの主ボタンのみ Wasabi) */
function AdvanceButton({
  dealId,
  to,
  label,
  primary = false,
  disabled = false,
}: {
  dealId: string
  to: SimpleStatus
  label: string
  primary?: boolean
  disabled?: boolean
}) {
  const router = useRouter()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const run = () =>
    startTransition(async () => {
      const r = await updateDealStatus(dealId, to)
      if (r.success) {
        toast(`ステータスを「${SIMPLE_STATUS_CONFIG[to].label}」に進めました`)
        router.refresh()
      } else {
        toast(r.error || '更新に失敗しました', 'warn')
      }
    })
  return (
    <button
      type="button"
      onClick={run}
      disabled={pending || disabled}
      className={`rounded-full text-[12px] font-bold px-4 py-2 disabled:opacity-40 transition-[filter] hover:brightness-95 ${
        primary ? 'bg-[#E9F056] text-[#666C14] font-extrabold' : 'bg-[#351E28] text-[#C9A2B8]'
      }`}
    >
      {pending ? '…' : label}
    </button>
  )
}

/** ボール(待ち先)を切り替える小ボタン */
function BallButton({ dealId, to, label }: { dealId: string; to: string; label: string }) {
  const router = useRouter()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const run = () =>
    startTransition(async () => {
      const r = await updateDealField(dealId, 'waiting_on', to)
      if (r.success) {
        toast('待ち先を切り替えました')
        router.refresh()
      } else {
        toast(r.error || '更新に失敗しました', 'warn')
      }
    })
  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      className="rounded-full bg-white border border-[#E2E1DA] text-[#351E28] text-[11px] font-bold px-3 py-1.5 disabled:opacity-40 hover:bg-[#FBFAF6]"
    >
      {pending ? '…' : label}
    </button>
  )
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">{children}</div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 py-1.5 border-b border-[#EFEFEA] items-center">
      <span className="text-[10.5px] text-[#84787D] font-body">{label}</span>
      <div className="text-[12.5px] min-w-0">{children}</div>
    </div>
  )
}

function Hint({ children, warn = false }: { children: React.ReactNode; warn?: boolean }) {
  return (
    <p
      className={`mt-2.5 text-[11px] leading-relaxed rounded-[12px] px-3 py-2 ${
        warn ? 'bg-[#FFD8C2] text-[#B03616]' : 'bg-[#FBFAF6] text-[#84787D]'
      }`}
    >
      {children}
    </p>
  )
}

const numFmt = (v: number | null | undefined, digits = 2) =>
  v == null
    ? '—'
    : Number(v).toLocaleString(undefined, {
        maximumFractionDigits: digits,
        minimumFractionDigits: 0,
      })

// ---------------------------------------------------------------------------
// ① 案件情報
// ---------------------------------------------------------------------------

function StepDealInfo({ deal }: { deal: FlowDeal }) {
  const save = (field: string) => async (val: string) =>
    updateDealField(deal.id, field, val || null)
  return (
    <div>
      <FieldGrid>
        <Field label="案件名">
          <InlineCell value={deal.deal_name} onSave={save('deal_name')} placeholder="案件名を入力" />
        </Field>
        <Field label="クライアント">
          <InlineCell
            value={deal.client_name_text}
            onSave={save('client_name_text')}
            placeholder="クライアント名"
          />
        </Field>
        <Field label="希望納期">
          <InlineCell
            type="date"
            value={deal.desired_delivery_date}
            onSave={save('desired_delivery_date')}
          />
        </Field>
        <Field label="担当">
          <span className="font-body text-[#351E28]">
            {deal.sales_user?.display_name || '—'}
          </span>
        </Field>
      </FieldGrid>
      <div className="mt-2">
        <p className="text-[10.5px] text-[#84787D] font-body mb-1">メモ</p>
        <InlineCell value={deal.memo} onSave={save('memo')} placeholder="メモ — クリックで編集" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ② 仕様
// ---------------------------------------------------------------------------

function StepSpecs({
  deal,
  products,
  variants,
}: {
  deal: FlowDeal
  products: DealProduct[]
  variants: DealProductVariant[]
}) {
  const router = useRouter()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()

  const addProduct = () =>
    startTransition(async () => {
      const r = await addBlankProduct(deal.id)
      if (r.error) toast(r.error, 'warn')
      else router.refresh()
    })
  const addVariant = (productId: string) =>
    startTransition(async () => {
      const r = await addBlankVariant(productId)
      if (r.error) toast(r.error, 'warn')
      else router.refresh()
    })

  return (
    <div>
      {products.length === 0 && (
        <p className="text-[12px] text-[#84787D] font-body py-2">
          まだ商品がありません。「商品を追加」から始めてください。
        </p>
      )}
      <div className="space-y-3">
        {products.map((p) => {
          const vs = variants.filter((v) => v.product_id === p.id)
          return (
            <div key={p.id} className="rounded-[12px] border border-[#E2E1DA]">
              <div className="px-3 py-2 bg-[#FBFAF6] rounded-t-[12px] flex items-center gap-2">
                <span className="fc-num text-[10.5px] text-[#84787D]">#{p.product_no}</span>
                <div className="flex-1 min-w-0 text-[12.5px] font-bold">
                  <InlineCell
                    value={p.description}
                    onSave={async (v) => updateProductField(p.id, 'description', v || null)}
                    placeholder="商品名"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11.5px] font-body" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  <thead>
                    <tr className="text-[#84787D] text-[10px] font-bold border-b border-[#EFEFEA]">
                      <th className="text-left px-3 py-1.5">バリエ</th>
                      <th className="text-right px-2 py-1.5">巾mm</th>
                      <th className="text-right px-2 py-1.5">高mm</th>
                      <th className="text-right px-2 py-1.5">マチmm</th>
                      <th className="text-left px-2 py-1.5">素材</th>
                      <th className="text-left px-2 py-1.5">印刷色数</th>
                      <th className="text-left px-2 py-1.5">加工</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vs.map((v) => (
                      <tr key={v.id} className="border-b border-[#EFEFEA] last:border-b-0">
                        <td className="px-3 py-1 font-bold">
                          <InlineCell
                            value={v.variant_label}
                            onSave={async (val) => updateVariantField(v.id, 'variant_label', val || null)}
                            placeholder="A"
                          />
                        </td>
                        <td className="px-2 py-1 text-right">
                          <InlineCell type="number" align="right" value={v.width_mm}
                            onSave={async (val) => updateVariantField(v.id, 'width_mm', val || null)} />
                        </td>
                        <td className="px-2 py-1 text-right">
                          <InlineCell type="number" align="right" value={v.height_mm}
                            onSave={async (val) => updateVariantField(v.id, 'height_mm', val || null)} />
                        </td>
                        <td className="px-2 py-1 text-right">
                          <InlineCell type="number" align="right" value={v.depth_mm}
                            onSave={async (val) => updateVariantField(v.id, 'depth_mm', val || null)} />
                        </td>
                        <td className="px-2 py-1">
                          <InlineCell value={v.material}
                            onSave={async (val) => updateVariantField(v.id, 'material', val || null)}
                            placeholder="素材" />
                        </td>
                        <td className="px-2 py-1">
                          <InlineCell value={v.print_color_count}
                            onSave={async (val) => updateVariantField(v.id, 'print_color_count', val || null)}
                            placeholder="1色" />
                        </td>
                        <td className="px-2 py-1">
                          <InlineCell value={v.processing}
                            onSave={async (val) => updateVariantField(v.id, 'processing', val || null)}
                            placeholder="—" />
                        </td>
                      </tr>
                    ))}
                    {vs.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-3 py-2 text-[#84787D]">
                          バリエーションがありません
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-3 py-1.5 border-t border-[#EFEFEA]">
                <button
                  type="button"
                  onClick={() => addVariant(p.id)}
                  disabled={pending}
                  className="rounded-full bg-white border border-[#E2E1DA] text-[#351E28] text-[10.5px] font-bold px-2.5 py-1 disabled:opacity-40 hover:bg-[#FBFAF6]"
                >
                  + バリエーションを追加
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-2.5 flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={addProduct}
          disabled={pending}
          className="rounded-full bg-[#351E28] text-[#C9A2B8] text-[11.5px] font-bold px-3.5 py-1.5 disabled:opacity-40 hover:brightness-95"
        >
          + 商品を追加
        </button>
        <Link
          href={`/deals?selected=${deal.id}`}
          className="text-[11.5px] text-[#33566F] font-bold no-underline hover:underline"
        >
          色・パントン・その他の全項目はグリッドで編集 →
        </Link>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ③ RFQ
// ---------------------------------------------------------------------------

function StepRfq({
  deal,
  products,
  rfqCount,
}: {
  deal: FlowDeal
  products: DealProduct[]
  rfqCount: number
}) {
  const [modalOpen, setModalOpen] = useState(false)
  return (
    <div>
      <p className="text-[12px] font-body text-[#351E28]">
        仕様が固まったら、まず工場に原価を聞きます。回答には単価だけでなく
        <b>カートン情報(PCS/CTN・箱サイズ・G.W)</b>も必ずもらってください — 送料計算に必要です。
      </p>
      <div className="mt-2.5 flex items-center gap-2.5 flex-wrap">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-full bg-[#351E28] text-[#C9A2B8] text-[12px] font-bold px-4 py-2 hover:brightness-95"
        >
          見積依頼(RFQ)をつくる
        </button>
        {rfqCount > 0 && (
          <span className="rounded-full bg-[#D7EFFF] text-[#33566F] text-[11px] font-bold px-2.5 py-1">
            {rfqCount}件 送付済み
          </span>
        )}
        <BallButton dealId={deal.id} to="factory" label="送った → ボールを工場待ちに" />
      </div>
      {modalOpen && (
        <RfqCreateModal
          dealId={deal.id}
          products={products as unknown as ProductRow[]}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ④ 工場回答の記録
// ---------------------------------------------------------------------------

function StepFactoryReply({
  deal,
  products,
  variants,
  quotes,
  cartonReady,
}: {
  deal: FlowDeal
  products: DealProduct[]
  variants: DealProductVariant[]
  quotes: BuilderQuote[]
  cartonReady: number
}) {
  const productName = (pid: string) =>
    products.find((p) => p.id === pid)?.description || '商品'

  return (
    <div className="space-y-3">
      {variants.length === 0 && (
        <p className="text-[12px] text-[#84787D] font-body py-1">
          先に②で商品・バリエーションを登録してください。
        </p>
      )}
      {variants.map((v) => (
        <VariantReplyCard
          key={v.id}
          deal={deal}
          label={`${productName(v.product_id)} / ${v.variant_label || 'バリエ'}`}
          variant={v}
          quotes={quotes.filter((q) => q.variant_id === v.id)}
        />
      ))}
      {variants.length > 0 && cartonReady < variants.length && (
        <Hint warn>
          カートン情報が未入力のバリエがあります。PCS/CTN・箱サイズ・G.W
          が無いと容積重量→送料が計算できず、原価が固まりません。
        </Hint>
      )}
      <BallButton dealId={deal.id} to="us" label="回答を記録した → ボールを自分に戻す" />
    </div>
  )
}

function VariantReplyCard({
  deal,
  label,
  variant,
  quotes,
}: {
  deal: FlowDeal
  label: string
  variant: DealProductVariant
  quotes: BuilderQuote[]
}) {
  const router = useRouter()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const [qty, setQty] = useState('')
  const [price, setPrice] = useState('')

  const saveVariant = (field: string) => async (val: string) =>
    updateVariantField(variant.id, field, val || null)
  const saveQuote = (quoteId: string, field: string) => async (val: string) =>
    updateQuoteField(quoteId, field, val || null)

  const addPattern = () =>
    startTransition(async () => {
      const r = await createQuote({
        deal_id: deal.id,
        variant_id: variant.id,
        quantity: Number(qty),
        factory_unit_price_usd: Number(price),
      })
      if (r.error) toast(r.error, 'warn')
      else {
        toast('数量パターンを追加しました')
        setQty('')
        setPrice('')
        router.refresh()
      }
    })

  return (
    <div className="rounded-[12px] border border-[#E2E1DA]">
      <div className="px-3 py-2 bg-[#FBFAF6] rounded-t-[12px] text-[12px] font-bold text-[#351E28]">
        {label}
      </div>

      {/* カートン情報(送料計算の前提) */}
      <div className="px-3 py-2 border-b border-[#EFEFEA]">
        <p className="text-[10px] font-bold text-[#84787D] mb-1">
          カートン情報(工場に確認 — 送料計算に必須)
        </p>
        <div className="flex items-center gap-1.5 flex-wrap text-[11.5px]">
          <span className="text-[#84787D]">PCS/CTN</span>
          <span className="w-[72px]">
            <InlineCell type="number" align="right" value={variant.pcs_per_carton}
              onSave={saveVariant('pcs_per_carton')} />
          </span>
          <span className="text-[#84787D] ml-2">箱 巾×高×奥(cm)</span>
          <span className="w-[56px]">
            <InlineCell type="number" align="right" value={variant.carton_width_cm}
              onSave={saveVariant('carton_width_cm')} />
          </span>
          <span className="text-[#84787D]">×</span>
          <span className="w-[56px]">
            <InlineCell type="number" align="right" value={variant.carton_height_cm}
              onSave={saveVariant('carton_height_cm')} />
          </span>
          <span className="text-[#84787D]">×</span>
          <span className="w-[56px]">
            <InlineCell type="number" align="right" value={variant.carton_depth_cm}
              onSave={saveVariant('carton_depth_cm')} />
          </span>
          <span className="text-[#84787D] ml-2">G.W(kg)</span>
          <span className="w-[64px]">
            <InlineCell type="number" align="right" value={variant.gross_weight_kg}
              onSave={saveVariant('gross_weight_kg')} />
          </span>
        </div>
      </div>

      {/* 数量パターン(単価・型代・MOQ) */}
      <div className="overflow-x-auto">
        <table className="w-full text-[11.5px] font-body" style={{ fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr className="text-[#84787D] text-[10px] font-bold border-b border-[#EFEFEA]">
              <th className="text-right px-3 py-1.5">数量</th>
              <th className="text-right px-2 py-1.5">工場単価$</th>
              <th className="text-right px-2 py-1.5">型代$</th>
              <th className="text-right px-2 py-1.5">MOQ</th>
              <th className="text-right px-2 py-1.5">工場提示送料$</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.id} className="border-b border-[#EFEFEA] last:border-b-0">
                <td className="px-3 py-1 text-right font-bold">
                  <InlineCell type="number" align="right" value={q.quantity}
                    onSave={saveQuote(q.id, 'quantity')} />
                </td>
                <td className="px-2 py-1 text-right">
                  <InlineCell type="number" align="right" value={q.factory_unit_price_usd}
                    onSave={saveQuote(q.id, 'factory_unit_price_usd')} />
                </td>
                <td className="px-2 py-1 text-right">
                  <InlineCell type="number" align="right" value={q.plate_fee_usd}
                    onSave={saveQuote(q.id, 'plate_fee_usd')} />
                </td>
                <td className="px-2 py-1 text-right">
                  <InlineCell type="number" align="right" value={q.moq}
                    onSave={saveQuote(q.id, 'moq')} />
                </td>
                <td className="px-2 py-1 text-right">
                  <InlineCell type="number" align="right" value={q.factory_calculated_freight_usd}
                    onSave={saveQuote(q.id, 'factory_calculated_freight_usd')} />
                </td>
              </tr>
            ))}
            {quotes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-2 text-[#84787D]">
                  数量パターンがまだありません — 下の欄から追加
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* パターン追加 */}
      <div className="px-3 py-2 border-t border-[#EFEFEA] flex items-center gap-2 flex-wrap">
        <input
          type="number"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder="数量"
          className="w-[90px] text-right fc-num bg-[#EFEFEA] rounded-[12px] px-2.5 py-1.5 text-[11.5px] border border-transparent outline-none focus:border-[#351E28]"
        />
        <input
          type="number"
          step="0.001"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="工場単価$"
          className="w-[100px] text-right fc-num bg-[#EFEFEA] rounded-[12px] px-2.5 py-1.5 text-[11.5px] border border-transparent outline-none focus:border-[#351E28]"
        />
        <button
          type="button"
          onClick={addPattern}
          disabled={pending || !qty || !price}
          className="rounded-full bg-[#351E28] text-[#C9A2B8] text-[11px] font-bold px-3 py-1.5 disabled:opacity-40 hover:brightness-95"
        >
          {pending ? '…' : '+ 数量パターンを追加'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ⑤ 原価(自動計算の確認)
// ---------------------------------------------------------------------------

function StepCost({
  products,
  variants,
  quotes,
  cartonReady,
}: {
  products: DealProduct[]
  variants: DealProductVariant[]
  quotes: BuilderQuote[]
  cartonReady: number
}) {
  const rows = useMemo(
    () =>
      quotes
        .filter((q) => q.quantity != null && q.factory_unit_price_usd != null)
        .map((q) => {
          const v = variants.find((x) => x.id === q.variant_id)
          const p = v ? products.find((x) => x.id === v.product_id) : null
          const freight =
            (Number(q.factory_calculated_freight_usd) || 0) +
            (Number(q.domestic_china_freight_usd) || 0) +
            (Number(q.china_freight_usd) || 0)
          return { q, freight, name: [p?.description, v?.variant_label].filter(Boolean).join(' / ') || '案件全体' }
        }),
    [quotes, variants, products]
  )

  return (
    <div>
      <p className="text-[12px] font-body text-[#351E28]">
        単価とカートン情報が入ると、容積重量→中国運賃→原価合計まで自動で計算されます。ここは確認だけです。
      </p>
      {rows.length === 0 ? (
        <Hint>④で数量と工場単価を入力すると、ここに原価が並びます。</Hint>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-[12px] border border-[#E2E1DA]">
          <table className="w-full text-[11.5px] font-body" style={{ fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr className="bg-[#FBFAF6] text-[#84787D] text-[10px] font-bold border-b border-[#E2E1DA]">
                <th className="text-left px-3 py-1.5">対象</th>
                <th className="text-right px-2 py-1.5">数量</th>
                <th className="text-right px-2 py-1.5">単価$</th>
                <th className="text-right px-2 py-1.5">型代$</th>
                <th className="text-right px-2 py-1.5">送料計$</th>
                <th className="text-right px-2 py-1.5">原価合計$</th>
                <th className="text-right px-3 py-1.5">原価単価$</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ q, freight, name }, i) => (
                <tr key={q.id} className={`border-b border-[#EFEFEA] last:border-b-0 ${i % 2 ? 'bg-[#FBFAF6]' : 'bg-white'}`}>
                  <td className="px-3 py-1.5">{name}</td>
                  <td className="px-2 py-1.5 text-right fc-num font-bold">{numFmt(q.quantity, 0)}</td>
                  <td className="px-2 py-1.5 text-right fc-num">{numFmt(q.factory_unit_price_usd, 3)}</td>
                  <td className="px-2 py-1.5 text-right fc-num">{numFmt(q.plate_fee_usd)}</td>
                  <td className="px-2 py-1.5 text-right fc-num">{freight > 0 ? numFmt(freight) : '—'}</td>
                  <td className="px-2 py-1.5 text-right fc-num font-bold">{numFmt(q.total_cost_usd)}</td>
                  <td className="px-3 py-1.5 text-right fc-num">{numFmt(q.unit_cost_usd, 4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {variants.length > 0 && cartonReady < variants.length && (
        <Hint warn>
          カートン情報が入っていないバリエは送料 0 のまま計算されています。④に戻って入力してください。
        </Hint>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ⑥ 売値(掛率→粗利)
// ---------------------------------------------------------------------------

function StepPricing({
  dealHead,
  products,
  variants,
  quotes,
}: {
  dealHead: DealHead
  products: DealProduct[]
  variants: DealProductVariant[]
  quotes: BuilderQuote[]
}) {
  const dealLevel = quotes.filter((q) => !q.variant_id)
  const byVariant = new Map<string, BuilderQuote[]>()
  for (const q of quotes) {
    if (!q.variant_id) continue
    const list = byVariant.get(q.variant_id) || []
    list.push(q)
    byVariant.set(q.variant_id, list)
  }
  return (
    <div>
      <p className="text-[12px] font-body text-[#351E28] mb-2">
        掛率(原価÷売値)を入れると売単価と粗利率が出ます。よければ「この価格で採用」。
      </p>
      {dealLevel.length > 0 && <QuoteTable deal={dealHead} quotes={dealLevel} />}
      {variants.map((v) => (
        <VariantQuoteTable
          key={v.id}
          deal={dealHead}
          variant={v as unknown as VariantHead}
          quotes={byVariant.get(v.id) || []}
        />
      ))}
      {quotes.length === 0 && <Hint>④⑤で原価ができると、ここで売値を組み立てられます。</Hint>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ⑦ 見積書 / ⑧ 請求書
// ---------------------------------------------------------------------------

function DocList({ docs }: { docs: FlowDocument[] }) {
  if (docs.length === 0) return null
  return (
    <ul className="mb-2 space-y-1">
      {docs.map((d) => (
        <li key={d.id} className="text-[11.5px] font-body flex items-center gap-2">
          <span className="fc-num text-[#351E28] font-bold">{d.document_number || '—'}</span>
          <span className="text-[#84787D] fc-num">{formatDate(d.created_at)}</span>
          {d.file_url && (
            <a
              href={d.file_url}
              target="_blank"
              rel="noreferrer"
              className="text-[#33566F] font-bold no-underline hover:underline"
            >
              開く →
            </a>
          )}
        </li>
      ))}
    </ul>
  )
}

function StepQuoteDoc({
  deal,
  docs,
  statusIdx,
}: {
  deal: FlowDeal
  docs: FlowDocument[]
  statusIdx: number
}) {
  const [modalOpen, setModalOpen] = useState(false)
  return (
    <div>
      <DocList docs={docs} />
      <div className="flex items-center gap-2.5 flex-wrap">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-full bg-[#351E28] text-[#C9A2B8] text-[12px] font-bold px-4 py-2 hover:brightness-95"
        >
          見積書をつくる
        </button>
        <BallButton dealId={deal.id} to="client" label="送った → クライアント待ちに" />
        {statusIdx < 1 && (
          <AdvanceButton dealId={deal.id} to="quote_confirmed" label="承認された → 見積確定へ" primary />
        )}
      </div>
      <Hint>
        修正依頼が来たら ④工場回答〜⑦見積書 をもう一周します(サンプル製作もこのループの中)。承認をもらえたら「見積確定」へ。
      </Hint>
      {modalOpen && <DocumentModal dealId={deal.id} onClose={() => setModalOpen(false)} />}
    </div>
  )
}

function StepInvoice({
  deal,
  docs,
  statusIdx,
}: {
  deal: FlowDeal
  docs: FlowDocument[]
  statusIdx: number
}) {
  const [modalOpen, setModalOpen] = useState(false)
  return (
    <div>
      <DocList docs={docs} />
      <div className="flex items-center gap-2.5 flex-wrap">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-full bg-[#351E28] text-[#C9A2B8] text-[12px] font-bold px-4 py-2 hover:brightness-95"
        >
          請求書をつくる
        </button>
        <BallButton dealId={deal.id} to="client" label="送った → クライアント待ちに" />
        {statusIdx === 1 && (
          <AdvanceButton dealId={deal.id} to="paid" label="入金を確認した → 入金完了へ" primary />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ⑨ 前払い・入稿データ
// ---------------------------------------------------------------------------

function StepDataCheck({
  deal,
  designFiles,
  statusIdx,
}: {
  deal: FlowDeal
  designFiles: DesignFileRow[]
  statusIdx: number
}) {
  return (
    <div>
      <p className="text-[12px] font-body text-[#351E28] mb-2">
        入金を確認したら工場へ前払い(Wise/Alibaba)。並行して最終入稿データをここに集め、工場と最終確認します。
      </p>
      <AttachmentGallery dealId={deal.id} initial={designFiles} />
      <div className="mt-2.5 flex items-center gap-2.5 flex-wrap">
        <BallButton dealId={deal.id} to="client" label="データ待ち → クライアント待ちに" />
        {statusIdx === 2 && (
          <AdvanceButton
            dealId={deal.id}
            to="data_confirmed"
            label="最終確認できた → 入稿データ確認完了へ"
            primary
          />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ⑩〜⑫ 製作・輸送・到着
// ---------------------------------------------------------------------------

function StepProduction({ deal, statusIdx }: { deal: FlowDeal; statusIdx: number }) {
  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      {statusIdx === 3 && (
        <AdvanceButton dealId={deal.id} to="in_production" label="製作開始を指示した → 製作中へ" primary />
      )}
      <BallButton dealId={deal.id} to="factory" label="ボールを工場待ちに" />
      <span className="text-[11px] text-[#84787D] font-body">
        進捗のやりとりは下の「通信の記録」に残します
      </span>
    </div>
  )
}

function StepShipping({ deal, statusIdx }: { deal: FlowDeal; statusIdx: number }) {
  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      {statusIdx === 4 && (
        <AdvanceButton dealId={deal.id} to="shipped" label="工場が発送した → 工場発送完了へ" primary />
      )}
      <Link
        href={`/inventory?tab=inbound&deal=${deal.id}`}
        className="rounded-full bg-white border border-[#E2E1DA] text-[#351E28] text-[11px] font-bold px-3 py-1.5 no-underline hover:bg-[#FBFAF6]"
      >
        追跡番号つきの入庫予定をつくる →
      </Link>
      <span className="text-[11px] text-[#84787D] font-body">
        入庫予定にするとロジ会社が追跡→着荷検収まで引き継げます
      </span>
    </div>
  )
}

function StepArrival({ deal, statusIdx }: { deal: FlowDeal; statusIdx: number }) {
  return (
    <div>
      <p className="text-[12px] font-body text-[#351E28]">
        到着したら検品。直接納品する分はそのまま納品、倉庫に保管する分は在庫に入庫を記録します。
      </p>
      <div className="mt-2 flex items-center gap-2.5 flex-wrap">
        <Link
          href={`/inventory?tab=inbound&deal=${deal.id}`}
          className="rounded-full bg-white border border-[#E2E1DA] text-[#351E28] text-[11.5px] font-bold px-3.5 py-2 no-underline hover:bg-[#FBFAF6]"
        >
          この案件の入庫予定・入庫を記録 →
        </Link>
        {statusIdx === 5 && (
          <AdvanceButton dealId={deal.id} to="delivered" label="納品できた → 納品完了へ" primary />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ⑬ 完了
// ---------------------------------------------------------------------------

function StepDone({ deal }: { deal: FlowDeal }) {
  const router = useRouter()
  const { toast } = useUi()
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  const archive = () =>
    startTransition(async () => {
      const r = await archiveDeal(deal.id, 'completed', null)
      if (r.success) {
        toast('案件をアーカイブしました')
        router.push('/deals')
      } else {
        toast(r.error || 'アーカイブに失敗しました', 'warn')
        setConfirming(false)
      }
    })

  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      <RepeatDealButton dealId={deal.id} dealName={deal.deal_name} />
      {confirming ? (
        <>
          <button
            type="button"
            onClick={archive}
            disabled={pending}
            className="rounded-full bg-[#351E28] text-[#C9A2B8] text-[11.5px] font-bold px-3.5 py-2 disabled:opacity-40"
          >
            {pending ? '…' : '本当にアーカイブする'}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-full bg-white border border-[#E2E1DA] text-[#84787D] text-[11.5px] font-bold px-3 py-2"
          >
            やめる
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-full bg-white border border-[#E2E1DA] text-[#351E28] text-[11.5px] font-bold px-3.5 py-2 hover:bg-[#FBFAF6]"
        >
          完了としてアーカイブ
        </button>
      )}
      <span className="text-[11px] text-[#84787D] font-body">
        同じ仕様の再注文は「リピート注文」で新しい案件がすぐできます
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 履歴(簡易タイムライン)
// ---------------------------------------------------------------------------

const HISTORY_KIND_LABEL: Record<string, string> = {
  status: 'ステータス',
  edit: '編集',
  variant: 'バリエ',
  attachment: '添付',
  comm: '通信',
  fee: '費用',
}

function HistoryList({ rows }: { rows: FlowHistoryRow[] }) {
  if (rows.length === 0)
    return <p className="text-[11.5px] text-[#84787D] font-body py-2">まだ履歴がありません</p>
  return (
    <ul className="space-y-1.5 border-l-2 border-[#E2E1DA] pl-3">
      {rows.map((h) => {
        const from = h.from_simple_status ? SIMPLE_STATUS_CONFIG[h.from_simple_status]?.label : null
        const to = h.to_simple_status ? SIMPLE_STATUS_CONFIG[h.to_simple_status]?.label : null
        return (
          <li key={h.id} className="text-[11px] font-body flex items-baseline gap-2 flex-wrap">
            <span className="fc-num text-[#84787D]">{formatDate(h.changed_at)}</span>
            <span className="text-[9.5px] uppercase tracking-wider text-[#84787D]">
              {HISTORY_KIND_LABEL[h.kind || 'status'] || h.kind}
            </span>
            <span className="text-[#351E28]">
              {from && to ? `${from} → ${to}` : to || h.note || '—'}
            </span>
            {h.changer?.display_name && (
              <span className="text-[10px] text-[#84787D]">by {h.changer.display_name}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
