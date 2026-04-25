'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createVariant, updateVariant, deleteVariant } from '@/lib/actions/variants'

export interface VariantFormInitial {
  id?: string
  variant_label?: string | null
  variant_order?: number | null
  width_mm?: number | null
  height_mm?: number | null
  depth_mm?: number | null
  material?: string | null
  color_description?: string | null
  pantone_colors?: string | null
  processing?: string | null
  other_notes?: string | null
  print_color_count?: string | null
  print_method?: string | null
  pcs_per_carton?: number | null
  carton_width_cm?: number | null
  carton_height_cm?: number | null
  carton_depth_cm?: number | null
  gross_weight_kg?: number | null
  production_lead_days?: number | null
  shipping_lead_days?: number | null
  food_inspection_days?: number | null
  shipping_address?: string | null
}

interface VariantFormProps {
  dealId: string
  productId: string
  initial?: VariantFormInitial
  defaultShippingAddress?: string | null
  cancelHref: string
}

export function VariantForm({
  dealId,
  productId,
  initial,
  defaultShippingAddress,
  cancelHref,
}: VariantFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [deleting, startDelete] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [productionDays, setProductionDays] = useState(String(initial?.production_lead_days ?? ''))
  const [shippingDays, setShippingDays] = useState(String(initial?.shipping_lead_days ?? ''))
  const [foodDays, setFoodDays] = useState(String(initial?.food_inspection_days ?? ''))

  const isEdit = Boolean(initial?.id)

  const totalLeadDays = useMemo(() => {
    const sum = [productionDays, shippingDays, foodDays]
      .map((v) => Number(v) || 0)
      .reduce((a, b) => a + b, 0)
    return sum
  }, [productionDays, shippingDays, foodDays])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = isEdit
        ? await updateVariant(initial!.id!, fd)
        : await createVariant(productId, fd)
      if (r.error || !r.data) {
        setError(r.error || '保存に失敗しました')
        return
      }
      router.push(`/deals/${dealId}`)
      router.refresh()
    })
  }

  const handleDelete = () => {
    if (!isEdit || !initial?.id) return
    if (!confirm('このバリエーションとその全見積を削除しますか？')) return
    setError(null)
    startDelete(async () => {
      const r = await deleteVariant(initial.id!)
      if (!r.success) {
        setError(r.error || '削除に失敗しました')
        return
      }
      router.push(`/deals/${dealId}`)
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-3xl">
      {error && (
        <div className="bg-[#fef2f2] border border-[#fca5a5] rounded-[8px] px-3 py-2 text-[12px] text-[#b91c1c] font-body">
          {error}
        </div>
      )}

      {/* Section 1: 基本仕様 */}
      <Section title="基本仕様">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="バリエーションラベル" required hint="small / medium / large / 8oz 等">
            <input
              name="variant_label"
              required
              defaultValue={initial?.variant_label || ''}
              placeholder="small"
              className={inputClass}
            />
          </Field>
          <Field label="表示順" hint="空欄なら自動">
            <input
              type="number"
              name="variant_order"
              step="1"
              defaultValue={initial?.variant_order ?? ''}
              className={inputClass}
            />
          </Field>
        </div>

        <fieldset className="border border-[#e8e8e6] rounded-[8px] p-3 mt-3">
          <legend className="text-[11px] font-body text-[#888] px-1">サイズ (mm)</legend>
          <div className="grid grid-cols-3 gap-3 mt-1">
            <Field label="幅 (Wide)">
              <input type="number" name="width_mm" step="0.1" defaultValue={initial?.width_mm ?? ''} className={inputClass} />
            </Field>
            <Field label="高さ (Height)">
              <input type="number" name="height_mm" step="0.1" defaultValue={initial?.height_mm ?? ''} className={inputClass} />
            </Field>
            <Field label="奥行 (Depth)">
              <input type="number" name="depth_mm" step="0.1" defaultValue={initial?.depth_mm ?? ''} className={inputClass} />
            </Field>
          </div>
        </fieldset>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <Field label="素材">
            <input
              name="material"
              defaultValue={initial?.material || ''}
              placeholder="PE / ペーパー / クラフト"
              className={inputClass}
            />
          </Field>
          <Field label="色">
            <input
              name="color_description"
              defaultValue={initial?.color_description || ''}
              placeholder="ライトブルー 透明度: 画像参照"
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="パントンカラー指定">
          <input
            name="pantone_colors"
            defaultValue={initial?.pantone_colors || ''}
            placeholder="BLUE: 646 C, YELLOW: 134 C"
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <Field label="加工 (Processing)">
            <input
              name="processing"
              defaultValue={initial?.processing || ''}
              placeholder="耐油仕様 / 箔押し 等"
              className={inputClass}
            />
          </Field>
          <Field label="その他注記">
            <input
              name="other_notes"
              defaultValue={initial?.other_notes || ''}
              placeholder="サイズ: 持ち手を含む 等"
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <Field label="印刷色数">
            <input
              name="print_color_count"
              defaultValue={initial?.print_color_count || ''}
              placeholder="ロゴ: 2color"
              className={inputClass}
            />
          </Field>
          <Field label="印刷方法">
            <input
              name="print_method"
              defaultValue={initial?.print_method || ''}
              placeholder="オフセット / グラビア"
              className={inputClass}
            />
          </Field>
        </div>
      </Section>

      {/* Section 2: カートン・物流 */}
      <Section title="カートン・物流情報" subtitle="送料計算に使用">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="PCS/CTN (1 カートン入数)">
            <input
              type="number"
              name="pcs_per_carton"
              min="1"
              step="1"
              defaultValue={initial?.pcs_per_carton ?? ''}
              placeholder="1000"
              className={inputClass}
            />
          </Field>
          <Field label="G.W (1 カートン総重量 kg)">
            <input
              type="number"
              name="gross_weight_kg"
              min="0"
              step="0.1"
              defaultValue={initial?.gross_weight_kg ?? ''}
              placeholder="65"
              className={inputClass}
            />
          </Field>
        </div>

        <fieldset className="border border-[#e8e8e6] rounded-[8px] p-3 mt-3">
          <legend className="text-[11px] font-body text-[#888] px-1">CARTONMEAS (cm)</legend>
          <div className="grid grid-cols-3 gap-3 mt-1">
            <Field label="縦">
              <input type="number" name="carton_width_cm" step="0.1" defaultValue={initial?.carton_width_cm ?? ''} className={inputClass} />
            </Field>
            <Field label="横">
              <input type="number" name="carton_height_cm" step="0.1" defaultValue={initial?.carton_height_cm ?? ''} className={inputClass} />
            </Field>
            <Field label="高さ">
              <input type="number" name="carton_depth_cm" step="0.1" defaultValue={initial?.carton_depth_cm ?? ''} className={inputClass} />
            </Field>
          </div>
        </fieldset>

        <Field label="納品先住所">
          <textarea
            name="shipping_address"
            defaultValue={initial?.shipping_address || defaultShippingAddress || ''}
            rows={3}
            placeholder="〒192-0375 東京都八王子市鑓水２丁目１７５−１ サンキューコーポレーション八王子ロジスティックスセンター"
            className={`${inputClass} resize-y`}
          />
        </Field>
      </Section>

      {/* Section 3: リードタイム */}
      <Section title="リードタイム (日)">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="製作期間">
            <input
              type="number"
              name="production_lead_days"
              min="0"
              step="1"
              value={productionDays}
              onChange={(e) => setProductionDays(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="配送期間">
            <input
              type="number"
              name="shipping_lead_days"
              min="0"
              step="1"
              value={shippingDays}
              onChange={(e) => setShippingDays(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="食品検査期間">
            <input
              type="number"
              name="food_inspection_days"
              min="0"
              step="1"
              value={foodDays}
              onChange={(e) => setFoodDays(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
        <p className="text-[12px] font-body text-[#555] mt-2">
          合計リードタイム: <span className="tabular-nums font-semibold text-[#0a0a0a]">{totalLeadDays}</span> 日
        </p>
      </Section>

      <div className="flex items-center justify-between gap-2 pt-2">
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending || deleting}
            className="bg-[#0a0a0a] text-white rounded-[8px] px-4 py-2 text-[13px] font-medium font-body disabled:opacity-50"
          >
            {pending ? '保存中...' : isEdit ? '保存' : 'バリエーションを追加'}
          </button>
          <Link
            href={cancelHref}
            className="bg-white text-[#555] border border-[#e8e8e6] rounded-[8px] px-4 py-2 text-[13px] font-medium font-body no-underline"
          >
            キャンセル
          </Link>
        </div>
        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting || pending}
            className="text-[12px] font-body text-[#ef4444] hover:underline disabled:opacity-50"
          >
            {deleting ? '削除中...' : '削除 (見積も全削除)'}
          </button>
        )}
      </div>
    </form>
  )
}

const inputClass =
  'w-full px-3 py-2 text-[13px] font-body bg-white border border-[#e8e8e6] rounded-[8px] focus:outline-none focus:border-[#0a0a0a]'

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <fieldset className="border border-[#e8e8e6] rounded-[10px] p-4">
      <legend className="px-2 text-[12px] font-body font-semibold text-[#0a0a0a]">
        {title}
        {subtitle && <span className="ml-2 text-[10px] text-[#888] font-normal">{subtitle}</span>}
      </legend>
      <div className="space-y-3">{children}</div>
    </fieldset>
  )
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-[12px] font-body text-[#555] mb-1">
        <span>
          {label}
          {required && <span className="text-[#ef4444] ml-1">*</span>}
        </span>
        {hint && <span className="text-[11px] text-[#888]">{hint}</span>}
      </span>
      {children}
    </label>
  )
}
