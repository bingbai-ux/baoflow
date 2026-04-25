'use client'

import { useState, useTransition } from 'react'
import { RefreshCw, Plus, Trash2 } from 'lucide-react'
import { updateSettings, fetchAndUpdateExchangeRate } from '@/lib/actions/settings'
import type { CompanyInfoPhase1, BankAccountPhase1 } from '@/lib/types'

interface SettingsFormProps {
  initial: {
    default_exchange_rate: number
    default_tax_rate: number
    default_cost_ratio: number
    company_info_phase1: CompanyInfoPhase1 | null
    bank_accounts_phase1: BankAccountPhase1[] | null
    default_shipping_address: string | null
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

  const [company, setCompany] = useState<CompanyInfoPhase1>(
    initial.company_info_phase1 || {}
  )
  const [banks, setBanks] = useState<BankAccountPhase1[]>(
    initial.bank_accounts_phase1 || []
  )
  const [shippingAddress, setShippingAddress] = useState(
    initial.default_shipping_address || ''
  )

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
        company_info_phase1: company,
        bank_accounts_phase1: banks.filter((b) => b.bank_name?.trim()),
        default_shipping_address: shippingAddress.trim() || null,
      } as never)
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
    <form onSubmit={handleSave} className="space-y-6 max-w-3xl">
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
      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5 space-y-4">
        <div>
          <h2 className="text-[14px] font-body font-semibold text-[#0a0a0a]">見積計算のデフォルト</h2>
          <p className="text-[11px] text-[#888] font-body mt-0.5">
            新規見積でフォームの初期値として使われます。各見積で個別に上書き可能です。
          </p>
        </div>

        <Field label="為替レート (USD/JPY)" hint="為替 API から取得もできます">
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
      </div>

      {/* 会社情報 */}
      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5 space-y-4">
        <div>
          <h2 className="text-[14px] font-body font-semibold text-[#0a0a0a]">会社情報 (帳票発行用)</h2>
          <p className="text-[11px] text-[#888] font-body mt-0.5">
            見積書/請求書/納品書の右上に表示されます。
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="会社名">
            <input value={company.name || ''} onChange={(e) => setCompany({ ...company, name: e.target.value })} className={inputClass} />
          </Field>
          <Field label="会社名 (英語)">
            <input value={company.name_en || ''} onChange={(e) => setCompany({ ...company, name_en: e.target.value })} className={inputClass} />
          </Field>
        </div>
        <Field label="住所">
          <textarea value={company.address || ''} onChange={(e) => setCompany({ ...company, address: e.target.value })} rows={2} className={`${inputClass} resize-y`} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="電話">
            <input value={company.phone || ''} onChange={(e) => setCompany({ ...company, phone: e.target.value })} className={inputClass} />
          </Field>
          <Field label="メール">
            <input type="email" value={company.email || ''} onChange={(e) => setCompany({ ...company, email: e.target.value })} className={inputClass} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="インボイス登録番号">
            <input value={company.registration_number || ''} onChange={(e) => setCompany({ ...company, registration_number: e.target.value })} className={inputClass} placeholder="T1234..." />
          </Field>
          <Field label="代表者">
            <input value={company.representative || ''} onChange={(e) => setCompany({ ...company, representative: e.target.value })} className={inputClass} />
          </Field>
        </div>
      </div>

      {/* 振込先 */}
      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5 space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-[14px] font-body font-semibold text-[#0a0a0a]">振込先銀行口座</h2>
            <p className="text-[11px] text-[#888] font-body mt-0.5">請求書に表示されます。</p>
          </div>
          <button
            type="button"
            onClick={() => setBanks([...banks, { bank_name: '' }])}
            className="text-[12px] font-body text-[#22c55e] hover:underline inline-flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> 追加
          </button>
        </div>
        {banks.length === 0 && (
          <p className="text-[12px] text-[#888] font-body">銀行口座が登録されていません。</p>
        )}
        {banks.map((bank, i) => (
          <div key={i} className="border border-[#e8e8e6] rounded-[8px] p-3 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-[#888]">口座 {i + 1}</span>
              <button
                type="button"
                onClick={() => setBanks(banks.filter((_, j) => j !== i))}
                className="text-[#ef4444] hover:underline text-[11px] inline-flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> 削除
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="銀行名" value={bank.bank_name} onChange={(e) => updateBank(i, { bank_name: e.target.value })} className={inputClass} />
              <input placeholder="支店名" value={bank.branch_name || ''} onChange={(e) => updateBank(i, { branch_name: e.target.value })} className={inputClass} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input placeholder="種別 (普通/当座)" value={bank.account_type || ''} onChange={(e) => updateBank(i, { account_type: e.target.value })} className={inputClass} />
              <input placeholder="口座番号" value={bank.account_number || ''} onChange={(e) => updateBank(i, { account_number: e.target.value })} className={inputClass} />
              <input placeholder="名義人" value={bank.account_holder || ''} onChange={(e) => updateBank(i, { account_holder: e.target.value })} className={inputClass} />
            </div>
            <input placeholder="SWIFT code (海外送金時, 任意)" value={bank.swift_code || ''} onChange={(e) => updateBank(i, { swift_code: e.target.value })} className={inputClass} />
          </div>
        ))}
      </div>

      {/* 配送先 */}
      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5 space-y-3">
        <div>
          <h2 className="text-[14px] font-body font-semibold text-[#0a0a0a]">デフォルト配送先 (納品書用)</h2>
          <p className="text-[11px] text-[#888] font-body mt-0.5">
            納品書発行時に初期値として使われます。各納品書で個別に上書き可能。
          </p>
        </div>
        <textarea value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} rows={3} placeholder="例: サンキューコーポレーション八王子ロジスティックスセンター&#10;〒192-0375 東京都八王子市鑓水２丁目１７５−１" className={`${inputClass} resize-y`} />
      </div>

      {/* プロフィール (読み取り専用) */}
      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5">
        <h2 className="text-[14px] font-body font-semibold text-[#0a0a0a] mb-3">プロフィール</h2>
        <dl className="space-y-2 text-[13px] font-body">
          <Row label="表示名" value={profile.display_name || '(未設定)'} />
          <Row label="メール" value={profile.email || '-'} />
          <Row label="役割" value={profile.role || '-'} />
        </dl>
        <p className="mt-3 text-[11px] text-[#888] font-body">※ プロフィール編集は Phase 2 で対応予定です。</p>
      </div>

      <div className="sticky bottom-4">
        <button
          type="submit"
          disabled={isPending || isFetching}
          className="bg-[#0a0a0a] text-white rounded-[8px] px-6 py-2.5 text-[13px] font-medium font-body disabled:opacity-50 shadow"
        >
          {isPending ? '保存中...' : 'すべて保存'}
        </button>
      </div>
    </form>
  )

  function updateBank(idx: number, patch: Partial<BankAccountPhase1>) {
    setBanks(banks.map((b, i) => (i === idx ? { ...b, ...patch } : b)))
  }
}

const inputClass =
  'w-full px-3 py-2 text-[13px] font-body bg-white border border-[#e8e8e6] rounded-[8px] focus:outline-none focus:border-[#0a0a0a]'

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
