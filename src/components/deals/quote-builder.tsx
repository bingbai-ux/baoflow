'use client'

// Sprint 10 (C): 見積ビルダー。
// バリエごとに数量パターンを横に並べ、原価→掛率→税込を1画面で比較する。
// 掛率はその場で編集(サーバ側で再計算)、「この価格で採用」で確定し見積書へ。

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { updateQuoteField } from '@/lib/actions/inline-edit'
import { selectQuote, unselectQuote } from '@/lib/actions/quotes'
import { useUi } from '@/components/ui/ui-store'
import { formatJPY } from '@/lib/utils/format'

interface DealHead {
  id: string
  deal_code: string
  deal_name: string | null
  client_name_text: string | null
}
interface ProductHead {
  id: string
  product_no: number
  description: string
}
interface VariantHead {
  id: string
  product_id: string
  variant_label: string
  material: string | null
  width_mm: number | null
  height_mm: number | null
  depth_mm: number | null
}
export interface BuilderQuote {
  id: string
  variant_id: string | null
  version: number | null
  quantity: number | null
  moq: number | null
  factory_unit_price_usd: number | null
  factory_calculated_freight_usd: number | null
  domestic_china_freight_usd: number | null
  china_freight_usd: number | null
  plate_fee_usd: number | null
  pantone_color_fee_usd: number | null
  sample_cost_usd: number | null
  sample_shipping_usd: number | null
  other_fees_usd: number | null
  exchange_rate: number | null
  cost_ratio: number | null
  unit_cost_usd: number | null
  total_cost_usd: number | null
  selling_price_jpy: number | null
  total_billing_jpy: number | null
  total_billing_tax_jpy: number | null
  status: string | null
}

const num = (v: number | null | undefined, digits = 0) =>
  v == null ? '—' : Number(v).toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 })

export function QuoteBuilder({
  deal,
  products,
  variants,
  quotes,
}: {
  deal: DealHead
  products: ProductHead[]
  variants: VariantHead[]
  quotes: BuilderQuote[]
}) {
  const byVariant = new Map<string, BuilderQuote[]>()
  const dealLevelQuotes: BuilderQuote[] = []
  for (const q of quotes) {
    if (!q.variant_id) {
      dealLevelQuotes.push(q)
      continue
    }
    const list = byVariant.get(q.variant_id) || []
    list.push(q)
    byVariant.set(q.variant_id, list)
  }

  const approved = quotes.filter((q) => q.status === 'approved')
  const approvedTax = approved.reduce((s, q) => s + (Number(q.total_billing_tax_jpy) || 0), 0)

  const variantsByProduct = new Map<string, VariantHead[]>()
  for (const v of variants) {
    const list = variantsByProduct.get(v.product_id) || []
    list.push(v)
    variantsByProduct.set(v.product_id, list)
  }

  return (
    <div>
      <div className="py-3 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-[21px] font-extrabold text-[#351E28]">
            見積を組み立てる
          </h1>
          <p className="text-[12.5px] text-[#84787D] font-body mt-1">
            {deal.client_name_text || '—'} · <span className="fc-num">{deal.deal_code}</span> ·
            数量パターンごとの原価と売値を横並びで比較し、「この価格で採用」で確定します。
            単価・送料の入力は案件一覧のグリッド(価格ビュー)からもできます。
          </p>
        </div>
        {/* 数値データ = Cool Blue 面(D79) */}
        <div className="rounded-[16px] bg-[#D7EFFF] px-4 py-3 min-w-[220px]">
          <p className="text-[11px] font-bold text-[#33566F]">採用済みの合計(税込)</p>
          <p className="fc-num text-[24px] font-extrabold text-[#33566F] leading-none mt-1">
            {approvedTax > 0 ? formatJPY(approvedTax) : '—'}
          </p>
          <p className="text-[10.5px] text-[#33566F] opacity-80 mt-1">
            {approved.length > 0 ? `${approved.length}パターン採用中` : 'まだ採用がありません'}
          </p>
        </div>
      </div>

      {variants.length === 0 && dealLevelQuotes.length === 0 && (
        <div className="bg-white rounded-[16px] border border-[#E2E1DA] px-5 py-8 text-[12.5px] text-[#84787D] font-body">
          商品・バリエーションがまだありません。まず案件に商品を追加してください。
        </div>
      )}

      {dealLevelQuotes.length > 0 && (
        <div className="mb-4">
          <h2 className="font-display font-bold text-[15px] text-[#351E28] mb-1.5">
            案件全体の見積
            <span className="text-[11px] font-body font-normal text-[#84787D] ml-2">
              商品に紐づいていない見積(旧形式・そのまま採用できます)
            </span>
          </h2>
          <QuoteTable deal={deal} quotes={dealLevelQuotes} />
        </div>
      )}

      {products.map((p) => {
        const vs = variantsByProduct.get(p.id) || []
        if (vs.length === 0) return null
        return (
          <div key={p.id} className="mb-4">
            <h2 className="font-display font-bold text-[15px] text-[#351E28] mb-1.5">
              <span className="fc-num text-[#84787D] mr-1.5">{p.product_no}.</span>
              {p.description || '(商品名未設定)'}
            </h2>
            {vs.map((v) => (
              <VariantQuoteTable key={v.id} deal={deal} variant={v} quotes={byVariant.get(v.id) || []} />
            ))}
          </div>
        )
      })}

      {approved.length > 0 && (
        <div className="flex justify-end mt-2 mb-6">
          <Link
            href={`/deals/${deal.id}/documents`}
            className="rounded-full bg-[#E9F056] text-[#666C14] text-[12.5px] font-extrabold px-5 py-2.5 no-underline hover:brightness-95"
          >
            採用した価格で見積書をつくる
          </Link>
        </div>
      )}
    </div>
  )
}

function QuoteTable({ deal, quotes }: { deal: DealHead; quotes: BuilderQuote[] }) {
  return (
    <div className="bg-white rounded-[16px] border border-[#E2E1DA] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[11.5px] font-body" style={{ fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr className="bg-[#FBFAF6] text-[#84787D] text-[10.5px] font-bold border-b border-[#E2E1DA]">
              <th className="text-left px-3 py-1.5 whitespace-nowrap">パターン</th>
              <th className="text-right px-3 py-1.5">数量</th>
              <th className="text-right px-3 py-1.5">工場単価$</th>
              <th className="text-right px-3 py-1.5">送料計$</th>
              <th className="text-right px-3 py-1.5">原価計$</th>
              <th className="text-right px-3 py-1.5">為替</th>
              <th className="text-right px-3 py-1.5">掛率(原価÷売値)</th>
              <th className="text-right px-3 py-1.5">売単価¥</th>
              <th className="text-right px-3 py-1.5">税込合計¥</th>
              <th className="text-right px-3 py-1.5">粗利率</th>
              <th className="text-right px-3 py-1.5 w-[120px]"></th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q, i) => (
              <QuoteRow key={q.id} deal={deal} q={q} index={i} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function VariantQuoteTable({
  deal,
  variant,
  quotes,
}: {
  deal: DealHead
  variant: VariantHead
  quotes: BuilderQuote[]
}) {
  const size = [variant.width_mm, variant.height_mm, variant.depth_mm]
    .filter((x) => x != null)
    .join('×')

  return (
    <div className="bg-white rounded-[16px] border border-[#E2E1DA] mb-2 overflow-hidden">
      <div className="px-4 py-2 bg-[#FBFAF6] border-b border-[#E2E1DA] flex items-baseline gap-2">
        <span className="text-[12.5px] font-bold text-[#351E28]">{variant.variant_label || 'バリエ'}</span>
        <span className="text-[11px] text-[#84787D]">
          {[size && `${size}mm`, variant.material].filter(Boolean).join(' · ')}
        </span>
      </div>
      {quotes.length === 0 ? (
        <p className="text-[11.5px] text-[#84787D] font-body px-4 py-3">
          数量パターンがまだありません。グリッドの「価格」ビューで数量と工場単価を入力すると、ここに並びます。
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11.5px] font-body" style={{ fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr className="bg-[#FBFAF6] text-[#84787D] text-[10.5px] font-bold border-b border-[#E2E1DA]">
                <th className="text-left px-3 py-1.5 whitespace-nowrap">パターン</th>
                <th className="text-right px-3 py-1.5">数量</th>
                <th className="text-right px-3 py-1.5">工場単価$</th>
                <th className="text-right px-3 py-1.5">送料計$</th>
                <th className="text-right px-3 py-1.5">原価計$</th>
                <th className="text-right px-3 py-1.5">為替</th>
                <th className="text-right px-3 py-1.5">掛率(原価÷売値)</th>
                <th className="text-right px-3 py-1.5">売単価¥</th>
                <th className="text-right px-3 py-1.5">税込合計¥</th>
                <th className="text-right px-3 py-1.5">粗利率</th>
                <th className="text-right px-3 py-1.5 w-[120px]"></th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q, i) => (
                <QuoteRow key={q.id} deal={deal} q={q} index={i} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function QuoteRow({ deal, q, index }: { deal: DealHead; q: BuilderQuote; index: number }) {
  const router = useRouter()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const [ratioDraft, setRatioDraft] = useState<string | null>(null)

  const approvedRow = q.status === 'approved'
  const freight =
    (Number(q.factory_calculated_freight_usd) || 0) +
    (Number(q.domestic_china_freight_usd) || 0) +
    (Number(q.china_freight_usd) || 0)
  const margin = q.cost_ratio != null ? Math.round((1 - Number(q.cost_ratio)) * 1000) / 10 : null

  const commitRatio = (val: string) => {
    setRatioDraft(null)
    if (val === '' || Number(val) === Number(q.cost_ratio)) return
    startTransition(async () => {
      const r = await updateQuoteField(q.id, 'cost_ratio', val)
      if (r.success) {
        toast('掛率を更新し、売値を再計算しました')
        router.refresh()
      } else {
        toast(r.error || '更新に失敗しました', 'warn')
      }
    })
  }

  const toggleApprove = () => {
    startTransition(async () => {
      const r = approvedRow ? await unselectQuote(q.id) : await selectQuote(q.id)
      if (r.success) {
        toast(approvedRow ? '採用を解除しました' : 'この価格を採用しました')
        router.refresh()
      } else {
        toast(r.error || '更新に失敗しました', 'warn')
      }
    })
  }

  return (
    <tr className={`border-b border-[#EFEFEA] last:border-b-0 ${approvedRow ? 'bg-[rgba(233,240,86,0.28)]' : index % 2 ? 'bg-[#FBFAF6]' : 'bg-white'}`}>
      <td className="px-3 py-2 whitespace-nowrap">
        <span className="text-[10.5px] text-[#84787D] fc-num">v{q.version ?? '—'}</span>
        {approvedRow && (
          <span className="ml-1.5 rounded-full bg-[#E9F056] text-[#666C14] text-[10px] font-bold px-2 py-[2px]">採用</span>
        )}
      </td>
      <td className="px-3 py-2 text-right fc-num font-bold text-[#351E28]">{num(q.quantity)}</td>
      <td className="px-3 py-2 text-right fc-num">{num(q.factory_unit_price_usd, 3)}</td>
      <td className="px-3 py-2 text-right fc-num">{freight > 0 ? num(freight, 2) : '—'}</td>
      <td className="px-3 py-2 text-right fc-num">{num(q.total_cost_usd, 2)}</td>
      <td className="px-3 py-2 text-right fc-num">{num(q.exchange_rate, 2)}</td>
      <td className="px-3 py-2 text-right">
        <input
          type="number"
          step="0.01"
          min="0.01"
          max="1"
          disabled={pending}
          value={ratioDraft ?? (q.cost_ratio == null ? '' : String(q.cost_ratio))}
          onChange={(e) => setRatioDraft(e.target.value)}
          onBlur={(e) => commitRatio(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
          className="w-[64px] text-right fc-num bg-[#EFEFEA] rounded-[8px] px-2 py-1 border border-transparent outline-none focus:border-[#351E28] disabled:opacity-50"
          placeholder="0.65"
        />
      </td>
      <td className="px-3 py-2 text-right fc-num text-[#351E28] font-bold">
        {q.selling_price_jpy != null ? formatJPY(Number(q.selling_price_jpy)) : '—'}
      </td>
      <td className="px-3 py-2 text-right fc-num text-[#351E28] font-bold">
        {q.total_billing_tax_jpy != null ? formatJPY(Number(q.total_billing_tax_jpy)) : '—'}
      </td>
      <td className={`px-3 py-2 text-right fc-num font-bold ${
        margin == null ? 'text-[#84787D]' : margin < 15 ? 'text-[#B03616]' : 'text-[#666C14]'
      }`}>
        {margin == null ? '—' : `${margin.toFixed(1)}%`}
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        <button
          type="button"
          onClick={toggleApprove}
          disabled={pending}
          className={`rounded-full text-[10.5px] font-bold px-3 py-1.5 disabled:opacity-50 transition-[filter] hover:brightness-95 ${
            approvedRow
              ? 'bg-white border border-[#E2E1DA] text-[#84787D]'
              : 'bg-[#351E28] text-[#C9A2B8]'
          }`}
        >
          {pending ? '…' : approvedRow ? '採用を解除' : 'この価格で採用'}
        </button>
      </td>
    </tr>
  )
}
