'use client'

import { useState, useTransition } from 'react'
import { RefreshCw } from 'lucide-react'
import { updateSettings, fetchAndUpdateExchangeRate } from '@/lib/actions/settings'

interface SettingsFormProps {
  initial: {
    default_exchange_rate: number
    default_tax_rate: number
    default_cost_ratio: number
  }
  profile: {
    display_name: string | null
    email: string | null
    role: string | null
  }
}

export function SettingsForm({ initial, profile }: SettingsFormProps) {
  const [isPending, startTransition] = useTransition()
  const [isFetching, startFetch] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [exchangeRate, setExchangeRate] = useState(String(initial.default_exchange_rate))
  const [taxRate, setTaxRate] = useState(String(initial.default_tax_rate))
  const [costRatio, setCostRatio] = useState(String(initial.default_cost_ratio))

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setMessage(null)
    const er = Number(exchangeRate)
    const tr = Number(taxRate)
    const cr = Number(costRatio)
    if (!Number.isFinite(er) || er <= 0) return setMessage({ type: 'error', text: '為替レートは正の数を入力してください' })
    if (!Number.isFinite(tr) || tr < 0) return setMessage({ type: 'error', text: '消費税率は 0 以上の数を入力してください' })
    if (!Number.isFinite(cr) || cr <= 0 || cr > 1)
      return setMessage({ type: 'error', text: '掛け率は 0 < x ≦ 1 で入力してください' })

    startTransition(async () => {
      const result = await updateSettings({
        default_exchange_rate: er,
        default_tax_rate: tr,
        default_cost_ratio: cr,
      })
      if (result.error) setMessage({ type: 'error', text: result.error })
      else setMessage({ type: 'success', text: '保存しました' })
    })
  }

  const handleFetchRate = () => {
    setMessage(null)
    startFetch(async () => {
      const r = await fetchAndUpdateExchangeRate()
      if (!r.updated) {
        setMessage({ type: 'error', text: r.error || '為替レート取得に失敗しました' })
        return
      }
      setExchangeRate(String(r.result.rate))
      setMessage({
        type: 'success',
        text: `為替レートを ${r.result.rate.toFixed(2)} に更新しました (${r.result.source || 'API'})`,
      })
    })
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {message && (
        <div
          className={`rounded-[8px] px-3 py-2 text-[12px] font-body ${
            message.type === 'success'
              ? 'bg-[#f0fdf4] border border-[#86efac] text-[#166534]'
              : 'bg-[#fef2f2] border border-[#fca5a5] text-[#b91c1c]'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 計算デフォルト */}
      <form onSubmit={handleSave} className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5 space-y-4">
        <div>
          <h2 className="text-[14px] font-body font-semibold text-[#0a0a0a]">見積計算のデフォルト</h2>
          <p className="text-[11px] text-[#888] font-body mt-0.5">
            新規見積でフォームの初期値として使われます。各見積で個別に上書き可能です。
          </p>
        </div>

        <Field
          label="為替レート (USD/JPY)"
          hint="為替 API から取得もできます"
        >
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              min="0"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
              className={inputClass}
            />
            <button
              type="button"
              onClick={handleFetchRate}
              disabled={isFetching || isPending}
              className="bg-white text-[#555] border border-[#e8e8e6] rounded-[8px] px-3 text-[12px] font-body whitespace-nowrap inline-flex items-center gap-1 disabled:opacity-50"
              title="為替 API から最新レートを取得"
            >
              <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin' : ''}`} />
              {isFetching ? '取得中...' : '最新を取得'}
            </button>
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="消費税率 (%)">
            <input
              type="number"
              step="0.1"
              min="0"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="デフォルト掛け率" hint="原価/販売価格 (例: 0.55)">
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="1"
              value={costRatio}
              onChange={(e) => setCostRatio(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <button
          type="submit"
          disabled={isPending || isFetching}
          className="bg-[#0a0a0a] text-white rounded-[8px] px-4 py-2 text-[13px] font-medium font-body disabled:opacity-50"
        >
          {isPending ? '保存中...' : '保存'}
        </button>
      </form>

      {/* プロフィール (読み取り専用) */}
      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5">
        <h2 className="text-[14px] font-body font-semibold text-[#0a0a0a] mb-3">プロフィール</h2>
        <dl className="space-y-2 text-[13px] font-body">
          <Row label="表示名" value={profile.display_name || '(未設定)'} />
          <Row label="メール" value={profile.email || '-'} />
          <Row label="役割" value={profile.role || '-'} />
        </dl>
        <p className="mt-3 text-[11px] text-[#888] font-body">
          ※ プロフィール編集は Phase 2 で対応予定です。
        </p>
      </div>
    </div>
  )
}

const inputClass =
  'flex-1 w-full px-3 py-2 text-[13px] font-body bg-white border border-[#e8e8e6] rounded-[8px] focus:outline-none focus:border-[#0a0a0a] tabular-nums'

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-[12px] font-body text-[#555] mb-1">
        <span>{label}</span>
        {hint && <span className="text-[11px] text-[#888]">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3 py-1">
      <dt className="text-[11px] text-[#888] w-24 flex-shrink-0">{label}</dt>
      <dd className="text-[13px] text-[#0a0a0a]">{value}</dd>
    </div>
  )
}
