'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Edit2, Save, X, ExternalLink } from 'lucide-react'
import { updateStaffRecord } from '@/lib/actions/staff'
import type { StaffRollup } from '@/lib/actions/master-types'
import type { Profile } from '@/lib/types'
import { formatJPY, formatDate } from '@/lib/utils/format'

interface Props {
  staff: Profile
  rollup: StaffRollup
}

const ROLE_LABELS: Record<string, string> = {
  admin: '管理者',
  sales: '営業',
}

export function StaffDetail({ staff, rollup }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [pending, startSave] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startSave(async () => {
      const r = await updateStaffRecord(staff.id, fd)
      if (r.error) setError(r.error)
      else {
        setEditing(false)
        router.refresh()
      }
    })
  }

  const initials = (staff.display_name || staff.email || 'U')
    .split(/[\s@]/)
    .filter(Boolean)
    .map((s) => s[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  if (editing) {
    return (
      <form onSubmit={handleSave} className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[18px] font-semibold">担当者編集</h2>
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(false)} className="text-[12px] text-[#351E28] border border-[#E2E1DA] rounded-[8px] px-3 py-1 inline-flex items-center gap-1">
              <X className="w-3 h-3" />キャンセル
            </button>
            <button type="submit" disabled={pending} className="text-[12px] text-[#C9A2B8] bg-[#351E28] rounded-[8px] px-3 py-1 inline-flex items-center gap-1 disabled:opacity-50">
              <Save className="w-3 h-3" />{pending ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
        {error && <ErrorBanner message={error} />}
        <Section title="基本情報">
          <Field label="表示名">
            <input name="display_name" defaultValue={staff.display_name || ''} className={inputClass} />
          </Field>
          <Field label="メール (変更不可)">
            <input value={staff.email || ''} disabled className={`${inputClass} bg-[#EFEFEA] text-[#84787D]`} />
          </Field>
          <Field label="ロール">
            <select name="role" defaultValue={staff.role} className={inputClass}>
              <option value="sales">営業</option>
              <option value="admin">管理者</option>
            </select>
          </Field>
          <Field label="言語">
            <select name="language_preference" defaultValue={staff.language_preference || 'ja'} className={inputClass}>
              <option value="ja">日本語</option>
              <option value="en">English</option>
              <option value="zh">中文</option>
            </select>
          </Field>
        </Section>
      </form>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-[#EFEFEA] flex items-center justify-center text-[13px] text-[#351E28] font-body font-medium flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-[18px] font-semibold text-[#351E28] leading-tight truncate">
              {staff.display_name || staff.email?.split('@')[0] || '(名前未設定)'}
            </h2>
            <p className="text-[11px] text-[#84787D] font-body mt-0.5 truncate">
              {ROLE_LABELS[staff.role] || staff.role} · {staff.email}
            </p>
          </div>
        </div>
        <button onClick={() => setEditing(true)} className="text-[11px] text-[#351E28] border border-[#E2E1DA] rounded-[8px] px-2 py-1 inline-flex items-center gap-1 hover:bg-[#FBFAF6] flex-shrink-0">
          <Edit2 className="w-3 h-3" />編集
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-3 gap-2">
        <Stat label="担当案件" value={`${rollup.deal_count}`} unit="件" />
        <Stat label="進行中" value={`${rollup.in_progress_count}`} unit="件" />
        <Stat label="採用合計 税込" value={formatJPY(rollup.approved_total_jpy)} accent />
      </div>

      <Section title="基本情報">
        <Row label="表示名" value={staff.display_name} />
        <Row label="メール" value={staff.email} />
        <Row label="ロール" value={ROLE_LABELS[staff.role] || staff.role} />
        <Row label="言語" value={staff.language_preference} />
        <Row label="登録日" value={formatDate(staff.created_at)} />
      </Section>

      <Section title={`担当案件 (直近 ${rollup.recent_deals.length})`}>
        {rollup.recent_deals.length === 0 ? (
          <p className="text-[11px] text-[#84787D]">まだ担当案件がありません</p>
        ) : (
          <ul className="divide-y divide-[#EFEFEA]">
            {rollup.recent_deals.map((d) => (
              <li key={d.id} className="py-1.5">
                <Link
                  href={`/deals/${d.id}`}
                  className="flex items-center justify-between gap-2 no-underline text-[#351E28] hover:bg-[#FBFAF6] -mx-1 px-1 rounded"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-[10px] tabular-nums text-[#84787D]">{d.deal_code}</span>
                    <span className="text-[11px] truncate">{d.deal_name || '(未設定)'}</span>
                    <span className="text-[10px] text-[#84787D]">{d.simple_status}</span>
                  </div>
                  <span className="text-[11px] tabular-nums text-[#666C14] flex-shrink-0">
                    {d.approved_total_jpy > 0 ? formatJPY(d.approved_total_jpy) : '-'}
                  </span>
                  <ExternalLink className="w-3 h-3 text-[#AEB8A0] flex-shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-[0.08em] text-[#AEB8A0] font-body mb-1.5">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-[90px_1fr] gap-2 text-[11px] py-1 border-b border-[rgba(53,30,40,0.03)]">
      <span className="text-[10px] text-[#84787D]">{label}</span>
      <span className="text-[#351E28] truncate">
        {value || <span className="text-[#AEB8A0]">-</span>}
      </span>
    </div>
  )
}

function Stat({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent?: boolean }) {
  return (
    <div className="bg-[#FBFAF6] rounded-[12px] p-2.5">
      <p className="text-[9px] uppercase tracking-[0.06em] text-[#84787D]">{label}</p>
      <p className={`font-display tabular-nums leading-none mt-1 ${accent ? 'text-[#666C14] text-[16px]' : 'text-[#351E28] text-[18px]'}`}>
        {value}{unit && <span className="text-[10px] text-[#84787D] ml-0.5">{unit}</span>}
      </p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] text-[#351E28] mb-0.5">{label}</span>
      {children}
    </label>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return <div className="bg-[#FFD8C2] border border-[#FF5C34] rounded-[8px] px-2 py-1 text-[11px] text-[#B03616]">{message}</div>
}

const inputClass =
  'w-full px-2 py-1.5 text-[12px] font-body bg-white border border-[#E2E1DA] rounded-[8px] focus:outline-none focus:border-[#351E28]'
