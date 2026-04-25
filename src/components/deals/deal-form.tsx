'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createDeal, updateDeal } from '@/lib/actions/deals'

export interface DealFormInitial {
  id?: string
  deal_name?: string | null
  client_name_text?: string | null
  desired_delivery_date?: string | null
  sales_user_id?: string | null
  memo?: string | null
}

interface SalesUserOption {
  id: string
  display_name: string | null
}

interface DealFormProps {
  initial?: DealFormInitial
  salesUsers: SalesUserOption[]
  cancelHref: string
}

export function DealForm({ initial, salesUsers, cancelHref }: DealFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isEdit = Boolean(initial?.id)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = isEdit
        ? await updateDeal(initial!.id!, formData)
        : await createDeal(formData)

      if (result.error || !result.data) {
        setError(result.error || '保存に失敗しました')
        return
      }
      router.push(`/deals/${result.data.id}`)
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

      <Field label="案件名" required>
        <input
          name="deal_name"
          defaultValue={initial?.deal_name || ''}
          required
          maxLength={200}
          placeholder="例: コーヒーバッグ春発注"
          className="w-full px-3 py-2 text-[13px] font-body bg-white border border-[#e8e8e6] rounded-[8px] focus:outline-none focus:border-[#0a0a0a]"
        />
      </Field>

      <Field label="クライアント名" required>
        <input
          name="client_name_text"
          defaultValue={initial?.client_name_text || ''}
          required
          maxLength={200}
          placeholder="例: 株式会社サンプル"
          className="w-full px-3 py-2 text-[13px] font-body bg-white border border-[#e8e8e6] rounded-[8px] focus:outline-none focus:border-[#0a0a0a]"
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="希望納期">
          <input
            type="date"
            name="desired_delivery_date"
            defaultValue={initial?.desired_delivery_date || ''}
            className="w-full px-3 py-2 text-[13px] font-body bg-white border border-[#e8e8e6] rounded-[8px] focus:outline-none focus:border-[#0a0a0a]"
          />
        </Field>

        <Field label="担当スタッフ">
          <select
            name="sales_user_id"
            defaultValue={initial?.sales_user_id || ''}
            className="w-full px-3 py-2 text-[13px] font-body bg-white border border-[#e8e8e6] rounded-[8px] focus:outline-none focus:border-[#0a0a0a]"
          >
            <option value="">未設定</option>
            {salesUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.display_name || '(名前未設定)'}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="メモ">
        <textarea
          name="memo"
          defaultValue={initial?.memo || ''}
          rows={4}
          placeholder="補足情報、要望、社内メモなど"
          className="w-full px-3 py-2 text-[13px] font-body bg-white border border-[#e8e8e6] rounded-[8px] focus:outline-none focus:border-[#0a0a0a] resize-y"
        />
      </Field>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="bg-[#0a0a0a] text-white rounded-[8px] px-4 py-2 text-[13px] font-medium font-body disabled:opacity-50"
        >
          {isPending ? '保存中...' : isEdit ? '保存' : '作成'}
        </button>
        <Link
          href={cancelHref}
          className="bg-white text-[#555] border border-[#e8e8e6] rounded-[8px] px-4 py-2 text-[13px] font-medium font-body no-underline"
        >
          キャンセル
        </Link>
      </div>
    </form>
  )
}

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
