'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createSpec, updateSpec, deleteSpec } from '@/lib/actions/specifications'

export interface SpecFormInitial {
  id?: string
  product_name?: string | null
  product_category?: string | null
  height_mm?: number | null
  width_mm?: number | null
  depth_mm?: number | null
  material_category?: string | null
  print_colors?: string | null
  printing_method?: string | null
  processing_list?: string[] | null
  specification_memo?: string | null
}

interface SpecFormProps {
  dealId: string
  initial?: SpecFormInitial
  cancelHref: string
}

const PROCESSING_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'deboss', label: '型押し (deboss)' },
  { value: 'emboss', label: '凸押し (emboss)' },
  { value: 'foil', label: '箔押し (foil)' },
  { value: 'lamination', label: 'ラミネート (lamination)' },
  { value: 'spot_uv', label: 'スポット UV' },
  { value: 'die_cut', label: '型抜き (die cut)' },
  { value: 'window', label: '窓抜き' },
]

export function SpecForm({ dealId, initial, cancelHref }: SpecFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isDeleting, startDelete] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const isEdit = Boolean(initial?.id)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = isEdit
        ? await updateSpec(initial!.id!, formData)
        : await createSpec(dealId, formData)
      if (result.error) {
        setError(result.error)
        return
      }
      router.push(`/deals/${dealId}`)
      router.refresh()
    })
  }

  const handleDelete = () => {
    if (!isEdit || !initial?.id) return
    if (!confirm('この商品仕様を削除しますか？')) return
    setError(null)
    startDelete(async () => {
      const result = await deleteSpec(initial.id!)
      if (!result.success) {
        setError(result.error || '削除に失敗しました')
        return
      }
      router.push(`/deals/${dealId}`)
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      {error && (
        <div className="bg-[#fef2f2] border border-[#fca5a5] rounded-[8px] px-3 py-2 text-[12px] text-[#b91c1c] font-body">
          {error}
        </div>
      )}

      <Field label="商品名" required>
        <input
          name="product_name"
          required
          defaultValue={initial?.product_name || ''}
          maxLength={200}
          placeholder="例: ドリップバッグ用パッケージ"
          className={inputClass}
        />
      </Field>

      <Field label="カテゴリ">
        <input
          name="product_category"
          defaultValue={initial?.product_category || ''}
          maxLength={100}
          placeholder="例: コーヒーバッグ / ギフトボックス"
          className={inputClass}
        />
      </Field>

      <fieldset className="border border-[#e8e8e6] rounded-[8px] p-3">
        <legend className="text-[11px] font-body text-[#888] px-1">サイズ (mm)</legend>
        <div className="grid grid-cols-3 gap-3 mt-1">
          <Field label="高さ">
            <input type="number" name="height_mm" step="0.1" defaultValue={initial?.height_mm ?? ''} className={inputClass} />
          </Field>
          <Field label="幅">
            <input type="number" name="width_mm" step="0.1" defaultValue={initial?.width_mm ?? ''} className={inputClass} />
          </Field>
          <Field label="奥行">
            <input type="number" name="depth_mm" step="0.1" defaultValue={initial?.depth_mm ?? ''} className={inputClass} />
          </Field>
        </div>
      </fieldset>

      <Field label="素材">
        <input
          name="material_category"
          defaultValue={initial?.material_category || ''}
          maxLength={100}
          placeholder="例: クラフト紙 350g / アルミ蒸着"
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="印刷色数">
          <input
            name="print_colors"
            defaultValue={initial?.print_colors || ''}
            maxLength={50}
            placeholder="例: 4 色 / フルカラー"
            className={inputClass}
          />
        </Field>
        <Field label="印刷方法">
          <input
            name="printing_method"
            defaultValue={initial?.printing_method || ''}
            maxLength={100}
            placeholder="例: オフセット / グラビア"
            className={inputClass}
          />
        </Field>
      </div>

      <fieldset className="border border-[#e8e8e6] rounded-[8px] p-3">
        <legend className="text-[11px] font-body text-[#888] px-1">加工</legend>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-1">
          {PROCESSING_OPTIONS.map((opt) => {
            const checked = initial?.processing_list?.includes(opt.value) || false
            return (
              <label key={opt.value} className="flex items-center gap-2 text-[12px] font-body text-[#0a0a0a]">
                <input
                  type="checkbox"
                  name="processing_list"
                  value={opt.value}
                  defaultChecked={checked}
                  className="w-3.5 h-3.5"
                />
                {opt.label}
              </label>
            )
          })}
        </div>
      </fieldset>

      <Field label="メモ">
        <textarea
          name="specification_memo"
          defaultValue={initial?.specification_memo || ''}
          rows={3}
          placeholder="その他要望、参考品番、注意事項など"
          className={`${inputClass} resize-y`}
        />
      </Field>

      <div className="flex items-center justify-between gap-2 pt-2">
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending || isDeleting}
            className="bg-[#0a0a0a] text-white rounded-[8px] px-4 py-2 text-[13px] font-medium font-body disabled:opacity-50"
          >
            {isPending ? '保存中...' : isEdit ? '保存' : '追加'}
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
            disabled={isDeleting || isPending}
            className="text-[12px] font-body text-[#ef4444] hover:underline disabled:opacity-50"
          >
            {isDeleting ? '削除中...' : '削除'}
          </button>
        )}
      </div>
    </form>
  )
}

const inputClass =
  'w-full px-3 py-2 text-[13px] font-body bg-white border border-[#e8e8e6] rounded-[8px] focus:outline-none focus:border-[#0a0a0a]'

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-[12px] font-body text-[#555] mb-1">
        {label}
        {required && <span className="text-[#ef4444] ml-1">*</span>}
      </span>
      {children}
    </label>
  )
}
