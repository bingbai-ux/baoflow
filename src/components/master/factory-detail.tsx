'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Edit2, Save, X, Star } from 'lucide-react'
import { updateFactoryRecord, deleteFactoryRecord } from '@/lib/actions/factories'
import type { FactoryRollup } from '@/lib/actions/master-types'
import type { Factory } from '@/lib/types'
import { formatDate } from '@/lib/utils/format'

interface Props {
  factory: Factory
  rollup: FactoryRollup
}

export function FactoryDetail({ factory, rollup }: Props) {
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
      const r = await updateFactoryRecord(factory.id, fd)
      if (r.error) setError(r.error)
      else {
        setEditing(false)
        router.refresh()
      }
    })
  }

  const handleDelete = () => {
    if (!confirm(`「${factory.factory_name}」を削除しますか？`)) return
    setError(null)
    startDelete(async () => {
      const r = await deleteFactoryRecord(factory.id)
      if (!r.success) setError(r.error || '削除に失敗しました')
      else {
        router.push('/master?tab=factories')
        router.refresh()
      }
    })
  }

  if (editing) {
    return (
      <form onSubmit={handleSave} className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[18px] font-semibold">工場編集</h2>
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
        <FactoryFormFields initial={factory} />
      </form>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-[18px] font-semibold text-[#0a0a0a] leading-tight">
            {factory.factory_name}
          </h2>
          {factory.name_cn && (
            <p className="text-[11px] text-[#555] font-body mt-0.5">{factory.name_cn}</p>
          )}
          <p className="text-[10px] text-[#888] mt-0.5">
            {factory.lead_time_range && <span>リードタイム {factory.lead_time_range}</span>}
            {factory.since && <span> · 取引開始 {formatDate(factory.since)}</span>}
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

      {/* 評価 */}
      <div className="grid grid-cols-3 gap-2">
        <StarStat label="品質" value={factory.quality_stars} />
        <StarStat label="納期" value={factory.delivery_stars} />
        <StarStat label="価格" value={factory.price_stars} />
      </div>

      {/* 取引実績 */}
      <div className="grid grid-cols-2 gap-2">
        <Stat label="見積実績" value={`${rollup.quote_count}`} unit="件" />
        <Stat label="採用済" value={`${rollup.approved_quote_count}`} unit="件" accent />
      </div>

      {/* 得意分野 */}
      {factory.specialties && factory.specialties.length > 0 && (
        <Section title="得意分野">
          <div className="flex flex-wrap gap-1">
            {factory.specialties.map((s) => (
              <span key={s} className="inline-flex items-center text-[10px] bg-[#f4f4f1] text-[#555] px-2 py-0.5 rounded-full">
                {s}
              </span>
            ))}
          </div>
        </Section>
      )}

      <Section title="連絡先">
        <Row label="担当者" value={factory.contact_name} />
        <Row label="電話" value={factory.contact_phone} />
        <Row label="メール" value={factory.contact_email} />
        <Row label="WeChat ID" value={factory.wechat} />
        <Row label="住所" value={factory.address} multiline />
      </Section>

      <Section title="取引条件">
        <Row label="支払条件" value={factory.payment_terms || factory.default_payment_terms} />
        <Row label="Incoterm" value={factory.incoterm} />
        <Row label="リードタイム" value={factory.lead_time_range} />
      </Section>

      {factory.notes && (
        <Section title="メモ">
          <p className="text-[11px] text-[#0a0a0a] whitespace-pre-line">{factory.notes}</p>
        </Section>
      )}
    </div>
  )
}

function FactoryFormFields({ initial }: { initial: Partial<Factory> }) {
  return (
    <>
      <Section title="基本情報">
        <Field label="工場名" required>
          <input name="factory_name" required defaultValue={initial.factory_name || ''} className={inputClass} />
        </Field>
        <Field label="中国語社名">
          <input name="name_cn" defaultValue={initial.name_cn || ''} className={inputClass} placeholder="蘇州..." />
        </Field>
        <Field label="担当者"><input name="contact_name" defaultValue={initial.contact_name || ''} className={inputClass} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="電話"><input name="contact_phone" defaultValue={initial.contact_phone || ''} className={inputClass} /></Field>
          <Field label="メール"><input type="email" name="contact_email" defaultValue={initial.contact_email || ''} className={inputClass} /></Field>
        </div>
        <Field label="WeChat ID"><input name="wechat" defaultValue={initial.wechat || ''} className={inputClass} /></Field>
        <Field label="住所"><textarea name="address" defaultValue={initial.address || ''} rows={2} className={`${inputClass} resize-y`} /></Field>
      </Section>

      <Section title="評価 (1-5)">
        <div className="grid grid-cols-3 gap-2">
          <Field label="品質"><input type="number" min="1" max="5" name="quality_stars" defaultValue={initial.quality_stars?.toString() || ''} className={inputClass} /></Field>
          <Field label="納期"><input type="number" min="1" max="5" name="delivery_stars" defaultValue={initial.delivery_stars?.toString() || ''} className={inputClass} /></Field>
          <Field label="価格"><input type="number" min="1" max="5" name="price_stars" defaultValue={initial.price_stars?.toString() || ''} className={inputClass} /></Field>
        </div>
      </Section>

      <Section title="得意分野">
        <Field label="カンマまたは改行区切り">
          <textarea name="specialties" defaultValue={(initial.specialties || []).join('\n')} rows={3} placeholder="紙袋&#10;不織布バッグ&#10;箔押し" className={`${inputClass} resize-y`} />
        </Field>
      </Section>

      <Section title="取引条件">
        <Field label="支払条件"><input name="payment_terms" defaultValue={initial.payment_terms || ''} className={inputClass} placeholder="T/T 30% deposit, 70% before shipment" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Incoterm"><input name="incoterm" defaultValue={initial.incoterm || ''} className={inputClass} placeholder="FOB Shanghai" /></Field>
          <Field label="リードタイム範囲"><input name="lead_time_range" defaultValue={initial.lead_time_range || ''} className={inputClass} placeholder="25-30日" /></Field>
        </div>
        <Field label="取引開始日"><input type="date" name="since" defaultValue={initial.since || ''} className={inputClass} /></Field>
      </Section>

      <Section title="メモ"><textarea name="notes" defaultValue={initial.notes || ''} rows={3} className={`${inputClass} resize-y`} /></Section>
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
      <p className={`font-display tabular-nums leading-none mt-1 ${accent ? 'text-[#22c55e] text-[18px]' : 'text-[#0a0a0a] text-[18px]'}`}>
        {value}{unit && <span className="text-[10px] text-[#888] ml-0.5">{unit}</span>}
      </p>
    </div>
  )
}

function StarStat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="bg-[#fafaf9] rounded-[8px] p-2.5">
      <p className="text-[9px] uppercase tracking-[0.06em] text-[#888]">{label}</p>
      <div className="flex items-center gap-0.5 mt-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={`w-3 h-3 ${value && n <= value ? 'text-[#e5a32e] fill-[#e5a32e]' : 'text-[#e8e8e6]'}`}
          />
        ))}
      </div>
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
