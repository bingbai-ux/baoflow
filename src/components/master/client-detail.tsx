'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Trash2, Edit2, Save, X, ExternalLink } from 'lucide-react'
import {
  updateClientRecord,
  deleteClientRecord,
  type ClientRollup,
} from '@/lib/actions/clients'
import type { Client } from '@/lib/types'
import { formatJPY, formatDate } from '@/lib/utils/format'

interface Props {
  client: Client
  rollup: ClientRollup
}

export function ClientDetail({ client, rollup }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [pending, startSave] = useTransition()
  const [deleting, startDelete] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startSave(async () => {
      const r = await updateClientRecord(client.id, fd)
      if (r.error) setError(r.error)
      else {
        setEditing(false)
        router.refresh()
      }
    })
  }

  const handleDelete = () => {
    if (!confirm(`「${client.company_name}」を削除しますか？`)) return
    setError(null)
    startDelete(async () => {
      const r = await deleteClientRecord(client.id)
      if (!r.success) setError(r.error || '削除に失敗しました')
      else {
        router.push('/master?tab=clients')
        router.refresh()
      }
    })
  }

  if (editing) {
    return (
      <form onSubmit={handleSave} className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[18px] font-semibold">クライアント編集</h2>
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(false)} className="text-[12px] text-[#555] border border-[#e8e8e6] rounded-[6px] px-3 py-1 inline-flex items-center gap-1">
              <X className="w-3 h-3" />キャンセル
            </button>
            <button type="submit" disabled={pending} className="text-[12px] text-white bg-[#0a0a0a] rounded-[6px] px-3 py-1 inline-flex items-center gap-1 disabled:opacity-50">
              <Save className="w-3 h-3" />{pending ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
        {error && <ErrorBanner message={error} />}
        <ClientFormFields initial={client} />
      </form>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-[18px] font-semibold text-[#0a0a0a] leading-tight">
            {client.company_name}
          </h2>
          <p className="text-[11px] text-[#888] font-body mt-0.5">
            {client.short_name && <span>{client.short_name} · </span>}
            {client.industry || '業種未設定'}
            {client.since && <span> · 取引開始 {formatDate(client.since)}</span>}
          </p>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={() => setEditing(true)} className="text-[11px] text-[#555] border border-[#e8e8e6] rounded-[6px] px-2 py-1 inline-flex items-center gap-1 hover:bg-[#fafaf8]">
            <Edit2 className="w-3 h-3" />編集
          </button>
          <button onClick={handleDelete} disabled={deleting} className="text-[11px] text-[#ef4444] border border-[#fde2e2] rounded-[6px] px-2 py-1 inline-flex items-center gap-1 hover:bg-[#fef2f2] disabled:opacity-50">
            <Trash2 className="w-3 h-3" />{deleting ? '削除中...' : '削除'}
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* 売上ロールアップ */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="案件" value={`${rollup.deal_count}`} unit="件" />
        <Stat label="進行中" value={`${rollup.in_progress_count}`} unit="件" />
        <Stat label="採用合計 税込" value={formatJPY(rollup.approved_total_jpy)} accent />
      </div>

      <Section title="基本情報">
        <Row label="担当者" value={client.contact_name} />
        <Row label="電話 (会社)" value={client.phone} />
        <Row label="連絡先電話" value={client.contact_phone} />
        <Row label="メール" value={client.email} />
        <Row label="住所" value={client.address} multiline />
        <Row label="納品先" value={client.default_delivery_address} multiline />
      </Section>

      <Section title="請求情報">
        <Row label="請求先" value={client.billing_to} />
        <Row label="インボイス番号" value={client.tax_id} />
        <Row label="支払条件" value={client.payment_terms} />
        <Row label="税率 (%)" value={client.tax_rate?.toString()} />
      </Section>

      {client.notes && (
        <Section title="メモ">
          <p className="text-[11px] text-[#0a0a0a] whitespace-pre-line">{client.notes}</p>
        </Section>
      )}

      {/* 取引履歴 */}
      <Section title={`取引履歴 (直近 ${rollup.recent_deals.length})`}>
        {rollup.recent_deals.length === 0 ? (
          <p className="text-[11px] text-[#888]">まだ案件がありません</p>
        ) : (
          <ul className="divide-y divide-[#f0f0ed]">
            {rollup.recent_deals.map((d) => (
              <li key={d.id} className="py-1.5">
                <Link
                  href={`/deals/${d.id}`}
                  className="flex items-center justify-between gap-2 no-underline text-[#0a0a0a] hover:bg-[#fafaf8] -mx-1 px-1 rounded"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-[10px] tabular-nums text-[#888]">{d.deal_code}</span>
                    <span className="text-[11px] truncate">{d.deal_name || '(未設定)'}</span>
                    <span className="text-[10px] text-[#888]">{d.simple_status}</span>
                  </div>
                  <span className="text-[11px] tabular-nums text-[#22c55e] flex-shrink-0">
                    {d.approved_total_jpy > 0 ? formatJPY(d.approved_total_jpy) : '-'}
                  </span>
                  <ExternalLink className="w-3 h-3 text-[#bbb] flex-shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}

function ClientFormFields({ initial }: { initial: Partial<Client> }) {
  return (
    <>
      <Section title="基本情報">
        <Field label="会社名" required>
          <input name="company_name" required defaultValue={initial.company_name || ''} className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="短縮名"><input name="short_name" defaultValue={initial.short_name || ''} className={inputClass} /></Field>
          <Field label="ブランド名"><input name="brand_name" defaultValue={initial.brand_name || ''} className={inputClass} /></Field>
        </div>
        <Field label="業種"><input name="industry" defaultValue={initial.industry || ''} className={inputClass} /></Field>
        <Field label="担当者"><input name="contact_name" defaultValue={initial.contact_name || ''} className={inputClass} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="電話 (会社)"><input name="phone" defaultValue={initial.phone || ''} className={inputClass} /></Field>
          <Field label="連絡先電話"><input name="contact_phone" defaultValue={initial.contact_phone || ''} className={inputClass} /></Field>
        </div>
        <Field label="メール"><input type="email" name="email" defaultValue={initial.email || ''} className={inputClass} /></Field>
        <Field label="住所">
          <textarea name="address" defaultValue={initial.address || ''} rows={2} className={`${inputClass} resize-y`} />
        </Field>
        <Field label="納品先">
          <textarea name="default_delivery_address" defaultValue={initial.default_delivery_address || ''} rows={2} className={`${inputClass} resize-y`} />
        </Field>
      </Section>
      <Section title="請求情報">
        <Field label="請求先"><input name="billing_to" defaultValue={initial.billing_to || ''} className={inputClass} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="インボイス番号"><input name="tax_id" defaultValue={initial.tax_id || ''} className={inputClass} /></Field>
          <Field label="税率 (%)"><input type="number" step="0.1" name="tax_rate" defaultValue={initial.tax_rate?.toString() || ''} className={inputClass} /></Field>
        </div>
        <Field label="支払条件"><input name="payment_terms" defaultValue={initial.payment_terms || ''} className={inputClass} placeholder="月末締翌月末払い" /></Field>
        <Field label="取引開始日"><input type="date" name="since" defaultValue={initial.since || ''} className={inputClass} /></Field>
      </Section>
      <Section title="メモ">
        <textarea name="notes" defaultValue={initial.notes || ''} rows={3} className={`${inputClass} resize-y`} />
      </Section>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-[0.08em] text-[#bbb] font-body mb-1.5">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Row({ label, value, multiline }: { label: string; value: string | null | undefined; multiline?: boolean }) {
  return (
    <div className="grid grid-cols-[90px_1fr] gap-2 text-[11px] py-1 border-b border-[rgba(0,0,0,0.03)]">
      <span className="text-[10px] text-[#888]">{label}</span>
      <span className={`text-[#0a0a0a] ${multiline ? 'whitespace-pre-line' : 'truncate'}`}>
        {value || <span className="text-[#bbb]">-</span>}
      </span>
    </div>
  )
}

function Stat({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent?: boolean }) {
  return (
    <div className="bg-[#fafaf9] rounded-[8px] p-2.5">
      <p className="text-[9px] uppercase tracking-[0.06em] text-[#888]">{label}</p>
      <p className={`font-display tabular-nums leading-none mt-1 ${accent ? 'text-[#22c55e] text-[16px]' : 'text-[#0a0a0a] text-[18px]'}`}>
        {value}{unit && <span className="text-[10px] text-[#888] ml-0.5">{unit}</span>}
      </p>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] text-[#555] mb-0.5">{label}{required && <span className="text-[#ef4444] ml-1">*</span>}</span>
      {children}
    </label>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return <div className="bg-[#fef2f2] border border-[#fca5a5] rounded-[6px] px-2 py-1 text-[11px] text-[#b91c1c]">{message}</div>
}

const inputClass =
  'w-full px-2 py-1.5 text-[12px] font-body bg-white border border-[#e8e8e6] rounded-[6px] focus:outline-none focus:border-[#0a0a0a]'
