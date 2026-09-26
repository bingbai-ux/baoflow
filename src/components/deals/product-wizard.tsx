'use client'

// Sprint 14: 仕様ウィザード。
// 大分類(線画カード) → 中分類 → 小分類 → 詳細(サイズ・素材・色数・加工) → 数量。
// 各分類はプリセット + その場で追加できる。数量は複数入れると数量違いの
// 見積枠がまとめて作られ、後からバリエ単位で枚数違いを追加できる。

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import type { CatalogNode } from '@/lib/actions/catalog'
import { addCatalogNode } from '@/lib/actions/catalog'
import { createProductFromWizard } from '@/lib/actions/deal-wizard'
import { useUi } from '@/components/ui/ui-store'

interface Props {
  dealId: string
  catalog: CatalogNode[]
  /** 新規案件ウィザードで作った空の商品枠 (仕様をここに入れる) */
  targetProduct?: { id: string; category_l1: string | null } | null
  onClose: () => void
}

type Phase = 'l1' | 'l2' | 'l3' | 'detail' | 'qty'

const inputCls =
  'bg-[#EFEFEA] rounded-[12px] px-3 py-2 text-[12.5px] font-body text-[#351E28] border border-transparent outline-none focus:border-[#351E28]'

// 大分類の線画アイコン (手書き SVG、stroke = Cassis)
function LineIcon({ iconKey }: { iconKey: string | null }) {
  const common = {
    fill: 'none',
    stroke: '#351E28',
    strokeWidth: 2.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  switch (iconKey) {
    case 'bag':
      return (
        <svg viewBox="0 0 64 64" className="w-12 h-12">
          <path {...common} d="M16 22 L20 54 H44 L48 22 Z" />
          <path {...common} d="M24 22 v-4 a8 8 0 0 1 16 0 v4" />
        </svg>
      )
    case 'cup':
      return (
        <svg viewBox="0 0 64 64" className="w-12 h-12">
          <path {...common} d="M20 18 L24 54 H40 L44 18 Z" />
          <path {...common} d="M18 24 H46" />
        </svg>
      )
    case 'lid':
      return (
        <svg viewBox="0 0 64 64" className="w-12 h-12">
          <path {...common} d="M14 40 H50" />
          <path {...common} d="M17 40 a15 12 0 0 1 30 0" />
          <path {...common} d="M28 24 h8" />
        </svg>
      )
    case 'box':
      return (
        <svg viewBox="0 0 64 64" className="w-12 h-12">
          <path {...common} d="M14 26 L32 16 L50 26 L50 46 L32 56 L14 46 Z" />
          <path {...common} d="M14 26 L32 36 L50 26 M32 36 V56" />
        </svg>
      )
    case 'label':
      return (
        <svg viewBox="0 0 64 64" className="w-12 h-12">
          <circle {...common} cx="32" cy="32" r="18" />
          <circle {...common} cx="32" cy="32" r="10" strokeDasharray="3 4" />
        </svg>
      )
    case 'film':
      return (
        <svg viewBox="0 0 64 64" className="w-12 h-12">
          <circle {...common} cx="26" cy="30" r="12" />
          <circle {...common} cx="26" cy="30" r="4" />
          <path {...common} d="M26 42 H54 v8 H34" />
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 64 64" className="w-12 h-12">
          <rect {...common} x="16" y="16" width="32" height="32" rx="6" />
          <path {...common} d="M26 32 h12 M32 26 v12" />
        </svg>
      )
  }
}

export const MATERIAL_PRESETS = ['クラフト紙', 'コート紙', 'PET', 'PP', 'PE', 'アルミ蒸着', '生分解素材']
export const COLOR_PRESETS = ['1色', '2色', '3色', '4色', 'フルカラー', '印刷なし']
export const PRINT_PRESETS = ['オフセット', 'グラビア', 'フレキソ', 'シルク', 'デジタル']
export const PROCESS_PRESETS = ['マット加工', 'グロス加工', '箔押し', 'エンボス', '窓付き', 'ジップ', 'バルブ']

export function ProductWizard({ dealId, catalog, targetProduct, onClose }: Props) {
  const router = useRouter()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const [nodes, setNodes] = useState<CatalogNode[]>(catalog)

  const initialL1 = targetProduct?.category_l1 || null
  const [phase, setPhase] = useState<Phase>(initialL1 ? 'l2' : 'l1')
  const [l1, setL1] = useState<string | null>(initialL1)
  const [l2, setL2] = useState<string | null>(null)
  const [l3, setL3] = useState<string | null>(null)

  // 詳細
  const [w, setW] = useState('')
  const [h, setH] = useState('')
  const [d, setD] = useState('')
  const [material, setMaterial] = useState('')
  const [colors, setColors] = useState('')
  const [printMethod, setPrintMethod] = useState('')
  const [processes, setProcesses] = useState<string[]>([])
  const [colorNote, setColorNote] = useState('')
  const [otherNote, setOtherNote] = useState('')

  // 数量 (複数)
  const [qtys, setQtys] = useState<string[]>(['', '', ''])

  const l1Node = nodes.find((n) => n.level === 1 && n.name === l1)
  const l2Node = nodes.find((n) => n.level === 2 && n.name === l2 && n.parent_id === l1Node?.id)
  const l2Options = useMemo(
    () => nodes.filter((n) => n.level === 2 && n.parent_id === l1Node?.id),
    [nodes, l1Node]
  )
  const l3Options = useMemo(
    () => nodes.filter((n) => n.level === 3 && n.parent_id === l2Node?.id),
    [nodes, l2Node]
  )

  const addNode = (level: 1 | 2 | 3, name: string, after: (name: string) => void) => {
    const parent = level === 1 ? null : level === 2 ? l1Node?.id || null : l2Node?.id || null
    startTransition(async () => {
      const r = await addCatalogNode({ level, parent_id: parent, name })
      if (r.node) {
        setNodes((xs) => [...xs, r.node!])
        after(r.node.name)
      } else {
        toast(r.error || '追加に失敗しました', 'warn')
      }
    })
  }

  const finish = () =>
    startTransition(async () => {
      const quantities = qtys.map((q) => Number(q)).filter((q) => q > 0)
      const r = await createProductFromWizard(dealId, {
        product_id: targetProduct?.id || null,
        category_l1: l1 || '',
        category_l2: l2,
        category_l3: l3,
        width_mm: w ? Number(w) : null,
        height_mm: h ? Number(h) : null,
        depth_mm: d ? Number(d) : null,
        material,
        print_color_count: colors,
        print_method: printMethod,
        processing: processes.join('・') || null,
        color_description: colorNote || null,
        other_notes: otherNote || null,
        quantities,
      })
      if (r.success) {
        toast('商品仕様を登録しました')
        router.refresh()
        onClose()
      } else {
        toast(r.error || '登録に失敗しました', 'warn')
      }
    })

  const crumbs = [l1, l2, l3].filter(Boolean).join(' / ')

  return (
    <div className="fixed inset-0 z-[1000] bg-black/40 flex items-start justify-center p-4 pt-[6vh] overflow-auto" onClick={onClose}>
      <div
        className="w-[720px] max-w-[95vw] bg-white rounded-[16px] shadow-[0_20px_60px_rgba(53,30,40,0.3)] overflow-hidden font-body"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-[#E2E1DA] flex items-center gap-3">
          <p className="font-display text-[15px] font-bold text-[#351E28]">商品を追加</p>
          {crumbs && <p className="text-[11.5px] text-[#84787D] truncate">{crumbs}</p>}
          <span className="flex-1" />
          <button type="button" onClick={onClose} className="p-1 text-[#84787D] hover:bg-[#FBFAF6] rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 min-h-[340px]">
          {/* 大分類 */}
          {phase === 'l1' && (
            <StepBlock title="どんなものを作りますか?(大分類)">
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {nodes
                  .filter((n) => n.level === 1)
                  .map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        setL1(n.name)
                        setL2(null)
                        setL3(null)
                        setPhase('l2')
                      }}
                      className={`rounded-[16px] border p-3 flex flex-col items-center gap-1.5 transition-colors ${
                        l1 === n.name ? 'border-[#351E28] bg-[#FBFAF6]' : 'border-[#E2E1DA] bg-white hover:bg-[#FBFAF6]'
                      }`}
                    >
                      <LineIcon iconKey={n.icon_key} />
                      <span className="text-[12px] font-bold text-[#351E28]">{n.name}</span>
                    </button>
                  ))}
              </div>
              <AddInline placeholder="大分類を追加" onAdd={(name) => addNode(1, name, (nm) => { setL1(nm); setPhase('l2') })} />
            </StepBlock>
          )}

          {/* 中分類 */}
          {phase === 'l2' && (
            <StepBlock title={`「${l1}」の種類は?(中分類)`}>
              <ChipGrid
                options={l2Options.map((n) => n.name)}
                value={l2}
                onSelect={(name) => {
                  setL2(name)
                  setL3(null)
                  setPhase('l3')
                }}
              />
              {l2Options.length === 0 && (
                <p className="text-[11.5px] text-[#84787D] mb-2">プリセットがありません。下から追加するか、スキップできます。</p>
              )}
              <AddInline placeholder="中分類を追加" onAdd={(name) => addNode(2, name, (nm) => { setL2(nm); setPhase('l3') })} />
              <SkipButton label="中分類をスキップ" onClick={() => { setL2(null); setL3(null); setPhase('detail') }} />
            </StepBlock>
          )}

          {/* 小分類 */}
          {phase === 'l3' && (
            <StepBlock title={`「${l2}」のタイプは?(小分類)`}>
              <ChipGrid
                options={l3Options.map((n) => n.name)}
                value={l3}
                onSelect={(name) => {
                  setL3(name)
                  setPhase('detail')
                }}
              />
              {l3Options.length === 0 && (
                <p className="text-[11.5px] text-[#84787D] mb-2">プリセットがありません。下から追加するか、スキップできます。</p>
              )}
              <AddInline placeholder="小分類を追加" onAdd={(name) => addNode(3, name, (nm) => { setL3(nm); setPhase('detail') })} />
              <SkipButton label="小分類をスキップ" onClick={() => { setL3(null); setPhase('detail') }} />
            </StepBlock>
          )}

          {/* 詳細 */}
          {phase === 'detail' && (
            <StepBlock title="詳細を選ぶ(わかる範囲でOK)">
              <div className="space-y-3.5">
                <div>
                  <p className="text-[11px] font-bold text-[#84787D] mb-1">サイズ(mm)</p>
                  <div className="flex items-center gap-1.5">
                    <input type="number" value={w} onChange={(e) => setW(e.target.value)} className={`${inputCls} w-[90px] text-right fc-num`} placeholder="巾" />
                    <span className="text-[#84787D]">×</span>
                    <input type="number" value={h} onChange={(e) => setH(e.target.value)} className={`${inputCls} w-[90px] text-right fc-num`} placeholder="高さ" />
                    <span className="text-[#84787D]">×</span>
                    <input type="number" value={d} onChange={(e) => setD(e.target.value)} className={`${inputCls} w-[90px] text-right fc-num`} placeholder="マチ/奥行" />
                  </div>
                </div>
                <ChipSelect label="素材" presets={MATERIAL_PRESETS} value={material} onChange={setMaterial} allowCustom />
                <ChipSelect label="色数" presets={COLOR_PRESETS} value={colors} onChange={setColors} />
                <ChipSelect label="印刷方式(わかれば)" presets={PRINT_PRESETS} value={printMethod} onChange={setPrintMethod} allowCustom />
                <div>
                  <p className="text-[11px] font-bold text-[#84787D] mb-1">オプション加工(複数可)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PROCESS_PRESETS.map((x) => (
                      <Chip
                        key={x}
                        label={x}
                        on={processes.includes(x)}
                        onClick={() => setProcesses((xs) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]))}
                      />
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-[11px] font-bold text-[#84787D]">
                    色の指定(パントン等)
                    <input value={colorNote} onChange={(e) => setColorNote(e.target.value)} className={`${inputCls} w-full font-normal`} placeholder="例: PANTONE 2925C" />
                  </label>
                  <label className="text-[11px] font-bold text-[#84787D]">
                    その他メモ
                    <input value={otherNote} onChange={(e) => setOtherNote(e.target.value)} className={`${inputCls} w-full font-normal`} placeholder="任意" />
                  </label>
                </div>
              </div>
              <div className="flex justify-between mt-5">
                <BackButton onClick={() => setPhase(l3 ? 'l3' : l2 ? 'l3' : 'l2')} />
                <NextButton label="次へ: 数量" onClick={() => setPhase('qty')} />
              </div>
            </StepBlock>
          )}

          {/* 数量 */}
          {phase === 'qty' && (
            <StepBlock title="数量を入れる(複数入れると数量違いの見積枠ができます)">
              <div className="space-y-2">
                {qtys.map((q, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[11px] text-[#84787D] w-[64px]">パターン{i + 1}</span>
                    <input
                      type="number"
                      min={1}
                      value={q}
                      onChange={(e) => setQtys((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))}
                      className={`${inputCls} w-[140px] text-right fc-num`}
                      placeholder="例: 1000"
                    />
                    <span className="text-[11px] text-[#84787D]">個</span>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setQtys((xs) => [...xs, ''])}
                  className="rounded-full bg-white border border-[#E2E1DA] text-[#351E28] text-[10.5px] font-bold px-2.5 py-1"
                >
                  + パターンを増やす
                </button>
              </div>
              <div className="rounded-[12px] bg-[#FBFAF6] border border-[#E2E1DA] px-4 py-3 mt-4 text-[12px]">
                <p className="font-bold text-[#351E28] mb-0.5">登録内容</p>
                <p className="text-[#351E28]">
                  {crumbs}
                  {(w || h || d) && ` · ${[w, h, d].filter(Boolean).join('×')}mm`}
                  {material && ` · ${material}`}
                  {colors && ` · ${colors}`}
                  {processes.length > 0 && ` · ${processes.join('・')}`}
                </p>
                <p className="text-[#84787D] mt-0.5">
                  数量: {qtys.filter((q) => Number(q) > 0).map((q) => Number(q).toLocaleString()).join(' / ') || '未入力'}
                </p>
              </div>
              <div className="flex justify-between mt-5">
                <BackButton onClick={() => setPhase('detail')} />
                <button
                  type="button"
                  onClick={finish}
                  disabled={pending || qtys.every((q) => !(Number(q) > 0))}
                  className="rounded-full bg-[#E9F056] text-[#666C14] text-[13px] font-extrabold px-5 py-2.5 disabled:opacity-40 hover:brightness-95"
                >
                  {pending ? '登録中…' : 'この内容で登録する'}
                </button>
              </div>
            </StepBlock>
          )}
        </div>
      </div>
    </div>
  )
}

function StepBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[13.5px] font-display font-bold text-[#351E28] mb-3">{title}</p>
      {children}
    </div>
  )
}

function Chip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[12px] font-bold border transition-colors ${
        on ? 'bg-[#351E28] text-[#C9A2B8] border-[#351E28]' : 'bg-white text-[#351E28] border-[#E2E1DA] hover:bg-[#FBFAF6]'
      }`}
    >
      {label}
    </button>
  )
}

function ChipGrid({
  options,
  value,
  onSelect,
}: {
  options: string[]
  value: string | null
  onSelect: (name: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-3">
      {options.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => onSelect(name)}
          className={`rounded-[12px] border px-4 py-2.5 text-[12.5px] font-bold transition-colors ${
            value === name ? 'border-[#351E28] bg-[#FBFAF6] text-[#351E28]' : 'border-[#E2E1DA] bg-white text-[#351E28] hover:bg-[#FBFAF6]'
          }`}
        >
          {name}
        </button>
      ))}
    </div>
  )
}

function ChipSelect({
  label,
  presets,
  value,
  onChange,
  allowCustom = false,
}: {
  label: string
  presets: string[]
  value: string
  onChange: (v: string) => void
  allowCustom?: boolean
}) {
  const [custom, setCustom] = useState('')
  return (
    <div>
      <p className="text-[11px] font-bold text-[#84787D] mb-1">{label}</p>
      <div className="flex flex-wrap gap-1.5 items-center">
        {presets.map((x) => (
          <Chip key={x} label={x} on={value === x} onClick={() => onChange(value === x ? '' : x)} />
        ))}
        {allowCustom && (
          <input
            value={presets.includes(value) ? custom : value || custom}
            onChange={(e) => {
              setCustom(e.target.value)
              onChange(e.target.value)
            }}
            className={`${inputCls} w-[130px]`}
            placeholder="自由入力"
          />
        )}
      </div>
    </div>
  )
}

function AddInline({ placeholder, onAdd }: { placeholder: string; onAdd: (name: string) => void }) {
  const [v, setV] = useState('')
  return (
    <div className="flex items-center gap-2 mt-3">
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && v.trim()) {
            e.preventDefault()
            onAdd(v.trim())
            setV('')
          }
        }}
        className={`${inputCls} max-w-[220px]`}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => {
          if (v.trim()) {
            onAdd(v.trim())
            setV('')
          }
        }}
        className="rounded-full bg-[#351E28] text-[#C9A2B8] text-[11px] font-bold px-3 py-1.5 hover:brightness-95"
      >
        + 追加して選ぶ
      </button>
    </div>
  )
}

function SkipButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="block mt-3 text-[11px] text-[#84787D] underline">
      {label} →
    </button>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full bg-white border border-[#E2E1DA] text-[#84787D] text-[12px] font-bold px-4 py-2"
    >
      ← 戻る
    </button>
  )
}

function NextButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full bg-[#351E28] text-[#C9A2B8] text-[12.5px] font-bold px-4 py-2 hover:brightness-95"
    >
      {label} →
    </button>
  )
}
