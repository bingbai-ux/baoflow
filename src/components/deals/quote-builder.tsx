'use client'

// Sprint 10 (C): 見積ビルダー。
// バリエごとに数量パターンを横に並べ、原価→掛率→税込を1画面で比較する。
// 掛率はその場で編集(サーバ側で再計算)、「この価格で採用」で確定し見積書へ。

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { quoteAdoptionIssue } from '@/lib/deals/readiness'
import { useRouter } from 'next/navigation'
import { updateQuoteField } from '@/lib/actions/inline-edit'
import { selectQuote, unselectQuote } from '@/lib/actions/quotes'
import { useUi } from '@/components/ui/ui-store'
import { formatJPY } from '@/lib/utils/format'

export interface DealHead {
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
export interface VariantHead {
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
  factory_id?: string | null
  factory?: { factory_name: string } | null
  factory_response?: { line?: Record<string, unknown> } | null
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
  const [productFilter, setProductFilter] = useState('')
  const [quantityFilter, setQuantityFilter] = useState('')
  const [factoryFilter, setFactoryFilter] = useState('')
  const variantProducts = new Map(variants.map(v => [v.id, v.product_id]))
  const visibleQuotes = quotes.filter(q => (!productFilter || (q.variant_id && variantProducts.get(q.variant_id) === productFilter)) && (!quantityFilter || String(q.quantity) === quantityFilter) && (!factoryFilter || q.factory_id === factoryFilter))
  const factories = [...new Map(quotes.filter(q => q.factory_id).map(q => [q.factory_id!, q.factory?.factory_name || '工場名未登録'])).entries()]
  const byVariant = new Map<string, BuilderQuote[]>()
  const dealLevelQuotes: BuilderQuote[] = []
  for (const q of visibleQuotes) {
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
            商品・数量・工場を絞って比較し、回答条件と費用の内訳を確認してください。
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

      <details className="mb-4 rounded-card border border-[#E2E1DA] bg-white p-3 text-[12px]"><summary className="min-h-11 cursor-pointer font-bold">商品・数量・工場で絞込 · {visibleQuotes.length} / {quotes.length}件</summary><div role="group" aria-label="見積比較の絞込" className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        <label>商品<select className="block w-full mt-1 min-h-11 rounded-input bg-[#EFEFEA] px-3" value={productFilter} onChange={e=>setProductFilter(e.target.value)}><option value="">すべての商品</option>{products.map(p=><option key={p.id} value={p.id}>{p.product_no}. {p.description || '商品名未設定'}</option>)}</select></label>
        <label>比較数量<select className="block w-full mt-1 min-h-11 rounded-input bg-[#EFEFEA] px-3" value={quantityFilter} onChange={e=>setQuantityFilter(e.target.value)}><option value="">すべての数量</option>{[...new Set(quotes.map(q=>q.quantity).filter((n):n is number=>n!=null))].sort((a,b)=>a-b).map(n=><option key={n} value={n}>{n.toLocaleString()} 個</option>)}</select></label>
        <label>回答工場<select className="block w-full mt-1 min-h-11 rounded-input bg-[#EFEFEA] px-3" value={factoryFilter} onChange={e=>setFactoryFilter(e.target.value)}><option value="">すべての工場</option>{factories.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
        <p role="status">比較対象 {visibleQuotes.length}件 / 全{quotes.length}件</p>{(productFilter || quantityFilter || factoryFilter) && <button type="button" className="min-h-11 underline text-left" onClick={()=>{setProductFilter('');setQuantityFilter('');setFactoryFilter('')}}>絞込を解除</button>}
      </div></details>
      {!visibleQuotes.length && quotes.length>0 && <p className="mb-4 text-[13px]">条件に合う見積がありません。絞込を解除するか、対象の工場回答を確認してください。</p>}

      {variants.length === 0 && dealLevelQuotes.length === 0 && (
        <div className="bg-white rounded-[16px] border border-[#E2E1DA] px-5 py-8 text-[12.5px] text-[#84787D] font-body">
          商品・バリエーションがまだありません。
          <Link href={`/deals/${deal.id}?step=2`} className="ml-2 underline text-[#351E28]">商品仕様を登録する →</Link>
        </div>
      )}

      {dealLevelQuotes.length > 0 && (
        <div className="mb-4">
          <h2 className="font-display font-bold text-[15px] text-[#351E28] mb-1.5">
            案件全体の見積
            <span className="text-[11px] font-body font-normal text-[#84787D] ml-2">
              仕様未紐付けの旧見積。閲覧・再発行を保持し、新規発注には使用できません。
            </span>
          </h2>
          <QuoteTable deal={deal} quotes={dealLevelQuotes} />
        </div>
      )}

      {products.map((p) => {
        if (productFilter && p.id !== productFilter) return null
        const vs = variantsByProduct.get(p.id) || []
        if (vs.length === 0) return null
        return (
          <div key={p.id} className="mb-4">
            <h2 className="font-display font-bold text-[15px] text-[#351E28] mb-1.5">
              <span className="fc-num text-[#84787D] mr-1.5">{p.product_no}.</span>
              {p.description || '(商品名未設定)'}
            </h2>
            {vs.map((v) => (
              (!quantityFilter && !factoryFilter || byVariant.has(v.id)) && <VariantQuoteTable key={v.id} deal={deal} variant={v} quotes={byVariant.get(v.id) || []} />
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

export function QuoteTable({ deal, quotes }: { deal: DealHead; quotes: BuilderQuote[] }) {
  return (
    <div className="bg-white rounded-[16px] border border-[#E2E1DA] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="block md:table w-full text-[12px] font-body" style={{ fontVariantNumeric: 'tabular-nums' }}>
          <thead className="hidden md:table-header-group">
            <tr className="bg-[#FBFAF6] text-[#84787D] text-[10.5px] font-bold border-b border-[#E2E1DA]">
              <th className="text-left px-3 py-1.5 whitespace-nowrap">パターン</th>
              <th className="text-right px-3 py-1.5">数量</th>
              <th className="text-right px-3 py-1.5">工場単価$</th>
              <th className="text-right px-3 py-1.5">算定送料$</th>
              <th className="text-right px-3 py-1.5">原価計$</th>
              <th className="text-right px-3 py-1.5">為替</th>
              <th className="text-right px-3 py-1.5">掛率(原価÷売値)</th>
              <th className="text-right px-3 py-1.5">売単価¥</th>
              <th className="text-right px-3 py-1.5">税込合計¥</th>
              <th className="text-right px-3 py-1.5">粗利率</th>
              <th className="text-right px-3 py-1.5 w-[120px]"></th>
            </tr>
          </thead>
          <tbody className="block md:table-row-group">
            {quotes.map((q, i) => (
              <QuoteRow key={q.id} deal={deal} q={q} index={i} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function VariantQuoteTable({
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
          数量パターンがまだありません。
          <Link href={`/deals/${deal.id}?step=4`} className="ml-2 underline text-[#351E28]">工場回答で数量と単価を追加する →</Link>
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="block md:table w-full text-[12px] font-body" style={{ fontVariantNumeric: 'tabular-nums' }}>
            <thead className="hidden md:table-header-group">
              <tr className="bg-[#FBFAF6] text-[#84787D] text-[10.5px] font-bold border-b border-[#E2E1DA]">
                <th className="text-left px-3 py-1.5 whitespace-nowrap">パターン</th>
                <th className="text-right px-3 py-1.5">数量</th>
                <th className="text-right px-3 py-1.5">工場単価$</th>
                <th className="text-right px-3 py-1.5">算定送料$</th>
                <th className="text-right px-3 py-1.5">原価計$</th>
                <th className="text-right px-3 py-1.5">為替</th>
                <th className="text-right px-3 py-1.5">掛率(原価÷売値)</th>
                <th className="text-right px-3 py-1.5">売単価¥</th>
                <th className="text-right px-3 py-1.5">税込合計¥</th>
                <th className="text-right px-3 py-1.5">粗利率</th>
                <th className="text-right px-3 py-1.5 w-[120px]"></th>
              </tr>
            </thead>
            <tbody className="block md:table-row-group">
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

  const adoptionIssue = quoteAdoptionIssue(q)
  const approvedRow = q.status === 'approved'
  const freight = q.china_freight_usd
  const margin = q.cost_ratio != null ? Math.round((1 - Number(q.cost_ratio)) * 1000) / 10 : null

  const commitRatio = (val: string) => {
    setRatioDraft(null)
    if (val === '' || Number(val) === Number(q.cost_ratio)) return
    if (!Number.isFinite(Number(val)) || Number(val) <= 0 || Number(val) > 1) {
      toast('掛率は0より大きく1以下で入力してください', 'warn')
      return
    }
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
    <tr className={`grid grid-cols-2 md:table-row gap-y-2 p-3 md:p-0 border-b border-[#EFEFEA] last:border-b-0 ${approvedRow ? 'bg-[rgba(233,240,86,0.28)]' : index % 2 ? 'bg-[#FBFAF6]' : 'bg-white'}`}>
      <td className="col-span-2 md:table-cell px-3 py-2 whitespace-nowrap">
        <span className="text-[10.5px] text-[#84787D] fc-num">v{q.version ?? '—'}</span>
        {q.factory_id && <span className="block text-[10px] text-[#84787D]">{q.factory?.factory_name || '工場回答'}</span>}
        {approvedRow && (
          <span className="ml-1.5 rounded-full bg-[#E9F056] text-[#666C14] text-[10px] font-bold px-2 py-[2px]">採用</span>
        )}
        <QuoteBreakdown quote={q} />
      </td>
      <td className="px-3 py-2 text-right fc-num font-bold text-[#351E28]"><span className="block md:hidden text-[11px] font-normal">数量（個）</span>{num(q.quantity)}</td>
      <td className="px-3 py-2 text-right fc-num"><span className="block md:hidden text-[11px]">工場単価（USD/個）</span>{num(q.factory_unit_price_usd, 3)}</td>
      <td className="px-3 py-2 text-right fc-num"><span className="block md:hidden text-[11px]">算定送料（USD・国内別）</span>{num(freight, 2)}</td>
      <td className="px-3 py-2 text-right fc-num"><span className="block md:hidden text-[11px]">原価計（USD）</span>{num(q.total_cost_usd, 2)}</td>
      <td className="px-3 py-2 text-right fc-num"><span className="block md:hidden text-[11px]">保存レート（JPY/USD）</span>{num(q.exchange_rate, 2)}</td>
      <td className="px-3 py-2 text-right">
        <span className="block md:hidden text-[11px]">掛率（原価÷売値）</span>
        <input
          aria-label={`見積v${q.version ?? index + 1}の掛率（原価÷売値）`}
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
        <span className="block md:hidden text-[11px] font-normal">売単価（税抜JPY/個）</span>
        {q.selling_price_jpy != null ? formatJPY(Number(q.selling_price_jpy)) : '—'}
      </td>
      <td className="px-3 py-2 text-right fc-num text-[#351E28] font-bold">
        <span className="block md:hidden text-[11px] font-normal">税込合計（JPY）</span>
        {q.total_billing_tax_jpy != null ? formatJPY(Number(q.total_billing_tax_jpy)) : '—'}
      </td>
      <td className={`px-3 py-2 text-right fc-num font-bold ${
        margin == null ? 'text-[#84787D]' : margin < 15 ? 'text-[#B03616]' : 'text-[#666C14]'
      }`}>
        <span className="block md:hidden text-[11px] font-normal">掛率からの粗利率</span>
        {margin == null ? '—' : `${margin.toFixed(1)}%`}
      </td>
      <td className="col-span-2 md:table-cell px-3 py-2 text-right whitespace-nowrap">
        {q.factory_response && !q.total_cost_usd && <button type="button" disabled={pending} className="block mb-1 rounded-full border border-[#351E28] px-3 py-1.5 text-[11px]" onClick={() => startTransition(async () => {
          const r = await updateQuoteField(q.id, 'quantity', String(q.quantity))
          if (r.success) { toast('工場回答のカートン条件から原価・売値を計算しました'); router.refresh() }
          else toast(r.error || '計算に失敗しました', 'warn')
        })}>工場回答から売値を計算</button>}
        <button
          type="button"
          onClick={toggleApprove}
          disabled={pending || (!approvedRow && adoptionIssue !== null)}
          title={!approvedRow ? adoptionIssue ?? undefined : undefined}
          className={`rounded-full text-[10.5px] font-bold px-3 py-1.5 disabled:opacity-50 transition-[filter] hover:brightness-95 ${
            approvedRow
              ? 'bg-white border border-[#E2E1DA] text-[#84787D]'
              : 'bg-[#351E28] text-[#C9A2B8]'
          }`}
        >
          {pending ? '更新中…' : approvedRow ? '採用を解除' : 'この価格で採用'}
        </button>
        {!approvedRow && adoptionIssue && <p className="mt-1 max-w-[200px] whitespace-normal text-[11px] text-[#84787D]">{adoptionIssue}</p>}
      </td>
    </tr>
  )
}

function QuoteBreakdown({quote:q}:{quote:BuilderQuote}) {
  const line=q.factory_response?.line
  const value=(key:string,unit:string)=>line?.[key]!=null?`${String(line[key])} ${unit}`:'未回答'
  const fees:[string,number|null][]=[['版代',q.plate_fee_usd],['色指定費',q.pantone_color_fee_usd],['中国国内送料',q.domestic_china_freight_usd],['算定送料',q.china_freight_usd],['工場提示送料',q.factory_calculated_freight_usd],['サンプル製作費（旧保存値）',q.sample_cost_usd],['サンプル送料（旧保存値）',q.sample_shipping_usd],['その他費用（旧一括値）',q.other_fees_usd]]
  return <details className="mt-2 whitespace-normal text-[12px] max-w-[340px]"><summary className="min-h-11 cursor-pointer font-bold">回答条件・費用内訳</summary><div className="space-y-2 py-2">
    <p>梱包: {value('pcs_per_carton','個/CTN')} · {value('carton_w_cm','cm')} × {value('carton_h_cm','cm')} × {value('carton_d_cm','cm')}</p><p>重量: {value('gross_weight_kg','kg/CTN')} · 工場製造納期: {value('production_lead_days','日')}（輸送日数を含みません）</p>
    <dl>{fees.map(([name,n])=><div key={name} className="flex justify-between gap-3"><dt>{name}</dt><dd className="fc-num">{n==null?'未登録':`${num(n,2)} USD`}</dd></div>)}</dl><p>工場提示送料は算定送料と別記録です。包含・重複を確認せず両方を合算しません。表の算定送料は国内送料を含まない保存値です。</p>
    <p>為替: {q.exchange_rate==null?'未登録':`${num(q.exchange_rate,4)} JPY/USD（保存値）`}。取得元・取得時刻はこの旧見積では未記録です。</p><p>送料の適用料金表・有効日・税／DDP・追加料金・輸送日数は要確認。保存額を確定見積とは扱わず、見積発行前に確認してください。</p><p>売単価は円切上げ。その他費用の明細化・サンプル独立請求・改訂版の最新為替固定は後続実装で、ここでは既存値を再分類しません。</p>
  </div></details>
}
