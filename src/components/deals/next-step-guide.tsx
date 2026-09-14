import Link from 'next/link'
import type { SimpleStatus } from '@/lib/types'
import { normalizeWaitingOn } from '@/lib/utils/waiting-on'

// Sprint 10: 「次の一歩」ガイド。
// ステータスごとに「いま何をどこでやるか」をチェックリストで示す。
// 完了/未完了は実データ(商品数・単価入力数・採用数・帳票数)から判定する。
// D79: ひとこと・案内 = Wasabi 面の NoteCard。ガイドは1画面1枚だけ置く。

export interface GuideCounts {
  products: number
  variants: number
  pricedQuotes: number // 数量と工場単価が入った見積行
  approvedQuotes: number // 採用済み
  quoteDocs: number // 発行済み見積書
  invoiceDocs: number // 発行済み請求書
}

interface Step {
  label: string
  done: boolean
  href?: string
  actionLabel?: string
}

function buildSteps(
  dealId: string,
  status: SimpleStatus,
  waitingOn: string | null | undefined,
  c: GuideCounts
): { title: string; steps: Step[]; hint?: string } {
  const w = normalizeWaitingOn(waitingOn)
  switch (status) {
    case 'quoting':
      return {
        title: '見積を出すまで',
        steps: [
          {
            label: `商品とバリエを登録する${c.products > 0 ? `(${c.products}商品)` : ''}`,
            done: c.products > 0 && c.variants > 0,
            href: `/deals?selected=${dealId}`,
            actionLabel: '一覧のグリッドで登録',
          },
          {
            label: `数量と工場単価$を入れる${c.pricedQuotes > 0 ? `(${c.pricedQuotes}パターン)` : ''}`,
            done: c.pricedQuotes > 0,
            href: `/deals/${dealId}/quote-builder`,
            actionLabel: '見積ビルダーで入力',
          },
          {
            label: '掛率を決めて「この価格で採用」する',
            done: c.approvedQuotes > 0,
            href: `/deals/${dealId}/quote-builder`,
            actionLabel: '見積ビルダーで比較',
          },
          {
            label: '見積書をつくってクライアントに送る',
            done: c.quoteDocs > 0,
            href: `/deals/${dealId}/documents`,
            actionLabel: '帳票をつくる',
          },
        ],
        hint:
          c.quoteDocs > 0 && w === 'us'
            ? '見積書を送ったら、上のボールを「クライアント待ち」に切り替えてください。返事が来たらステータスを「見積確定」へ。'
            : '工場に見積を依頼する場合は、案件詳細の「見積依頼」から RFQ を送れます。',
      }
    case 'quote_confirmed':
      return {
        title: '入金まで',
        steps: [
          {
            label: '請求書を発行してクライアントに送る',
            done: c.invoiceDocs > 0,
            href: `/deals/${dealId}/documents`,
            actionLabel: '請求書をつくる',
          },
          {
            label: '入金を確認したらステータスを「入金完了」へ進める',
            done: false,
          },
        ],
        hint: '送ったらボールを「クライアント待ち」に。入金確認は自分の作業なので、確認できたら進めるだけです。',
      }
    case 'paid':
      return {
        title: '入稿データの確認',
        steps: [
          {
            label: '最終入稿データ(デザイン)を添付に集める',
            done: false,
            href: `/deals/${dealId}`,
            actionLabel: '添付を確認',
          },
          {
            label: '工場と最終確認できたら「最終入稿データ確認完了」へ進める',
            done: false,
          },
        ],
        hint: 'データ待ちなら、ボールを「クライアント待ち」または「工場待ち」にしておくとホームの催促リストに載ります。',
      }
    case 'data_confirmed':
      return {
        title: '製作開始',
        steps: [
          { label: '工場へ製作開始を指示する', done: false },
          { label: '指示したらステータスを「製作中」へ、ボールを「工場待ち」に', done: false },
        ],
      }
    case 'in_production':
      return {
        title: '製作中(工場待ち)',
        steps: [
          { label: 'ときどき進捗を確認する(通信タブに記録を残す)', done: false },
          { label: '工場が発送したら「工場発送完了」へ進める', done: false },
        ],
      }
    case 'shipped':
      return {
        title: '到着まで',
        steps: [
          { label: '到着したら検品する', done: false },
          {
            label: '物流倉庫に保管する分は「在庫」に入庫を記録する',
            done: false,
            href: '/inventory',
            actionLabel: '在庫へ',
          },
          { label: '納品できたら「納品完了」へ進める', done: false },
        ],
      }
    case 'delivered':
      return {
        title: 'この案件は納品完了',
        steps: [
          {
            label: '同じ仕様で再注文が来たら「リピート注文」で新しい案件をつくる',
            done: false,
          },
          { label: '記録として残すだけなら「アーカイブ」へ', done: false },
        ],
      }
  }
}

export function NextStepGuide({
  dealId,
  status,
  waitingOn,
  counts,
  compact = false,
}: {
  dealId: string
  status: SimpleStatus
  waitingOn: string | null | undefined
  counts: GuideCounts
  compact?: boolean
}) {
  const { title, steps, hint } = buildSteps(dealId, status, waitingOn, counts)
  const nextIdx = steps.findIndex((s) => !s.done)

  return (
    <div className={`rounded-[16px] bg-[#E9F056] ${compact ? 'px-4 py-3' : 'px-5 py-4'}`}>
      <p className={`font-bold text-[#666C14] ${compact ? 'text-[12px]' : 'text-[13px]'}`}>
        次の一歩 — {title}
      </p>
      <ol className={`mt-2 space-y-1.5 ${compact ? 'text-[11.5px]' : 'text-[12.5px]'}`}>
        {steps.map((s, i) => {
          const isNext = i === nextIdx
          return (
            <li key={s.label} className="flex items-baseline gap-2 text-[#666C14]">
              <span className="fc-num flex-shrink-0 w-[16px] font-bold">
                {s.done ? '✓' : `${i + 1}.`}
              </span>
              <span className={`${s.done ? 'line-through opacity-60' : isNext ? 'font-bold' : 'opacity-80'}`}>
                {s.label}
              </span>
              {!s.done && s.href && (
                <Link
                  href={s.href}
                  className={`flex-shrink-0 no-underline rounded-full px-2.5 py-[3px] text-[10.5px] font-bold whitespace-nowrap ${
                    isNext
                      ? 'bg-[#351E28] text-[#C9A2B8] hover:brightness-95'
                      : 'bg-white/60 text-[#666C14] hover:bg-white'
                  }`}
                >
                  {s.actionLabel || '開く'} →
                </Link>
              )}
            </li>
          )
        })}
      </ol>
      {hint && (
        <p className={`mt-2 text-[#666C14] opacity-80 leading-relaxed ${compact ? 'text-[10.5px]' : 'text-[11px]'}`}>
          {hint}
        </p>
      )}
    </div>
  )
}

// 実データから完了判定に使う件数をまとめる補助
export function buildGuideCounts(args: {
  products: Array<unknown>
  variants: Array<unknown>
  quotes: Array<{ quantity?: number | null; factory_unit_price_usd?: number | null; status?: string | null }>
  documents: Array<{ document_type?: string | null }>
}): GuideCounts {
  const priced = args.quotes.filter(
    (q) => q.quantity != null && q.factory_unit_price_usd != null
  ).length
  const approved = args.quotes.filter((q) => q.status === 'approved').length
  const quoteDocs = args.documents.filter((d) => d.document_type === 'quotation').length
  const invoiceDocs = args.documents.filter((d) => d.document_type === 'invoice').length
  return {
    products: args.products.length,
    variants: args.variants.length,
    pricedQuotes: priced,
    approvedQuotes: approved,
    quoteDocs,
    invoiceDocs,
  }
}
