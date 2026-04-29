'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createProduct, updateProduct, deleteProduct } from '@/lib/actions/products'
import type { FoodGradeStatus } from '@/lib/types'

export interface ProductFormInitial {
  id?: string
  product_no?: number | null
  description?: string | null
  factory_staff_code?: string | null
  production_process?: string | null
  food_grade_status?: FoodGradeStatus
  food_inspection_status?: FoodGradeStatus
  product_memo?: string | null
}

interface ProductFormProps {
  dealId: string
  initial?: ProductFormInitial
  cancelHref: string
}

const FOOD_OPTIONS: Array<{ value: '' | '*' | '●' | '同'; label: string }> = [
  { value: '', label: '— なし —' },
  { value: '*', label: '*' },
  { value: '●', label: '●' },
  { value: '同', label: '同' },
]

const FACTORY_STAFF_PRESETS = ['NA', 'AL', 'JT', 'RI']

export function ProductForm({ dealId, initial, cancelHref }: ProductFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [deleting, startDelete] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const isEdit = Boolean(initial?.id)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = isEdit
        ? await updateProduct(initial!.id!, fd)
        : await createProduct(dealId, fd)
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
    if (!confirm('この商品とその全バリエーション・見積を削除しますか？')) return
    setError(null)
    startDelete(async () => {
      const r = await deleteProduct(initial.id!)
      if (!r.success) {
        setError(r.error || '削除に失敗しました')
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="商品番号 (#)" hint="空欄なら自動採番">
          <input
            type="number"
            name="product_no"
            min="1"
            step="1"
            defaultValue={initial?.product_no ?? ''}
            className={inputClass}
            placeholder="自動"
          />
        </Field>
        <Field label="工場担当者 code" hint="NA / AL / JT / RI 等">
          <input
            list="factory-staff-presets"
            name="factory_staff_code"
            defaultValue={initial?.factory_staff_code || ''}
            className={inputClass}
            placeholder="NA"
          />
          <datalist id="factory-staff-presets">
            {FACTORY_STAFF_PRESETS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </Field>
      </div>

      <Field label="Description (商品名)" required>
        <input
          name="description"
          required
          defaultValue={initial?.description || ''}
          maxLength={200}
          placeholder="例: Plastic Bag / Paper Bag / Pastry Bag"
          className={inputClass}
        />
      </Field>

      <Field label="製作プロセス">
        <input
          name="production_process"
          defaultValue={initial?.production_process || ''}
          placeholder="例: 抜き型 / 印刷 / 熱接着 / 検品"
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="food grade">
          <select
            name="food_grade_status"
            defaultValue={initial?.food_grade_status || ''}
            className={inputClass}
          >
            {FOOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="食品検査">
          <select
            name="food_inspection_status"
            defaultValue={initial?.food_inspection_status || ''}
            className={inputClass}
          >
            {FOOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="メモ">
        <textarea
          name="product_memo"
          defaultValue={initial?.product_memo || ''}
          rows={3}
          placeholder="商品全体に関する備考"
          className={`${inputClass} resize-y`}
        />
      </Field>

      <div className="flex items-center justify-between gap-2 pt-2">
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending || deleting}
            className="bg-[#0a0a0a] text-white rounded-[8px] px-4 py-2 text-[13px] font-medium font-body disabled:opacity-50"
          >
            {pending ? '保存中...' : isEdit ? '保存' : '商品を追加'}
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
            {deleting ? '削除中...' : '削除 (バリエーション・見積も全削除)'}
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
