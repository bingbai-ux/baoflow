'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, X } from 'lucide-react'
import type { Client, Factory, Profile } from '@/lib/types'
import { formatJPY } from '@/lib/utils/format'
import { ClientDetail } from './client-detail'
import { FactoryDetail } from './factory-detail'
import { StaffDetail } from './staff-detail'
import { createClientRecord, type ClientRollup } from '@/lib/actions/clients'
import { createFactoryRecord, type FactoryRollup } from '@/lib/actions/factories'
import type { StaffRollup } from '@/lib/actions/master-types'

interface ClientWithTotal extends Client {
  approved_total_jpy: number
  in_progress_count: number
}

interface FactoryWithStats extends Factory {
  quote_count: number
}

interface StaffWithStats extends Profile {
  in_progress_count: number
}

type Tab = 'clients' | 'factories' | 'staff'

interface Props {
  tab: Tab
  clients: ClientWithTotal[]
  factories: FactoryWithStats[]
  staff: StaffWithStats[]
  selectedClient?: { client: Client; rollup: ClientRollup } | null
  selectedFactory?: { factory: Factory; rollup: FactoryRollup } | null
  selectedStaff?: { staff: Profile; rollup: StaffRollup } | null
}

const ROLE_LABELS: Record<string, string> = {
  admin: '管理者',
  sales: '営業',
}

export function MasterShell({
  tab,
  clients,
  factories,
  staff,
  selectedClient,
  selectedFactory,
  selectedStaff,
}: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)

  const filteredClients = clients.filter((c) =>
    !search ||
    c.company_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.short_name?.toLowerCase().includes(search.toLowerCase()) ?? false)
  )
  const filteredFactories = factories.filter((f) =>
    !search ||
    f.factory_name.toLowerCase().includes(search.toLowerCase()) ||
    (f.name_cn?.toLowerCase().includes(search.toLowerCase()) ?? false)
  )
  const filteredStaff = staff.filter((s) =>
    !search ||
    (s.display_name?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
    (s.email?.toLowerCase().includes(search.toLowerCase()) ?? false)
  )

  const switchTab = (next: Tab) => {
    router.push(`/master?tab=${next}`)
  }

  const selectClient = (id: string) => router.push(`/master?tab=clients&id=${id}`)
  const selectFactory = (id: string) => router.push(`/master?tab=factories&id=${id}`)
  const selectStaff = (id: string) => router.push(`/master?tab=staff&id=${id}`)

  const newButtonLabel =
    tab === 'clients' ? '新規クライアント' : tab === 'factories' ? '新規工場' : null

  return (
    <div className="bg-white border border-[rgba(0,0,0,0.06)] rounded-[14px] overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-3.5 py-2 border-b border-[rgba(0,0,0,0.06)]">
        <div className="flex items-center gap-0">
          <TabButton active={tab === 'clients'} onClick={() => switchTab('clients')}>
            クライアント <span className="text-[10px] text-[#888] ml-1 tabular-nums">{clients.length}</span>
          </TabButton>
          <TabButton active={tab === 'factories'} onClick={() => switchTab('factories')}>
            工場 <span className="text-[10px] text-[#888] ml-1 tabular-nums">{factories.length}</span>
          </TabButton>
          <TabButton active={tab === 'staff'} onClick={() => switchTab('staff')}>
            担当者 <span className="text-[10px] text-[#888] ml-1 tabular-nums">{staff.length}</span>
          </TabButton>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#888]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="検索..."
            className="w-full pl-7 pr-2 py-1 text-[11px] font-body bg-[#fafaf9] border border-[rgba(0,0,0,0.08)] rounded-[6px] focus:outline-none focus:border-[#0a0a0a]"
          />
        </div>
        {newButtonLabel && (
          <button
            onClick={() => setShowNew(true)}
            className="bg-[#0a0a0a] text-white text-[11px] rounded-[6px] px-3 py-1 inline-flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />{newButtonLabel}
          </button>
        )}
      </div>

      {/* Split pane */}
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] md:divide-x divide-[rgba(0,0,0,0.06)]" style={{ minHeight: 'calc(100vh - 220px)' }}>
        {/* Left list */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
          {tab === 'clients' &&
            (filteredClients.length === 0 ? (
              <p className="text-[11px] text-[#888] p-4 text-center">該当なし</p>
            ) : (
              <ul>
                {filteredClients.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => selectClient(c.id)}
                      className={`w-full text-left px-3 py-2 border-b border-[rgba(0,0,0,0.04)] hover:bg-[#fafaf8] ${
                        selectedClient?.client.id === c.id ? 'bg-[#f4f4f1]' : ''
                      }`}
                    >
                      <div className="text-[12px] font-display font-semibold text-[#0a0a0a] truncate">
                        {c.short_name || c.company_name}
                      </div>
                      <div className="text-[10px] text-[#888] mt-0.5 truncate">{c.industry || '業種未設定'}</div>
                      <div className="text-[10px] text-[#22c55e] font-display tabular-nums mt-0.5">
                        {formatJPY(c.approved_total_jpy)}
                        <span className="text-[#bbb] ml-1">· {c.in_progress_count} 進行中</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ))}

          {tab === 'factories' &&
            (filteredFactories.length === 0 ? (
              <p className="text-[11px] text-[#888] p-4 text-center">該当なし</p>
            ) : (
              <ul>
                {filteredFactories.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => selectFactory(f.id)}
                      className={`w-full text-left px-3 py-2 border-b border-[rgba(0,0,0,0.04)] hover:bg-[#fafaf8] ${
                        selectedFactory?.factory.id === f.id ? 'bg-[#f4f4f1]' : ''
                      }`}
                    >
                      <div className="text-[12px] font-display font-semibold text-[#0a0a0a] truncate">{f.factory_name}</div>
                      {f.name_cn && <div className="text-[10px] text-[#555] mt-0.5 truncate">{f.name_cn}</div>}
                      <div className="text-[10px] text-[#888] tabular-nums mt-0.5">
                        {f.quote_count} 見積実績
                        {f.lead_time_range && <span> · {f.lead_time_range}</span>}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ))}

          {tab === 'staff' &&
            (filteredStaff.length === 0 ? (
              <p className="text-[11px] text-[#888] p-4 text-center">該当なし</p>
            ) : (
              <ul>
                {filteredStaff.map((s) => {
                  const initials = (s.display_name || s.email || 'U')
                    .split(/[\s@]/)
                    .filter(Boolean)
                    .map((x) => x[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => selectStaff(s.id)}
                        className={`w-full text-left px-3 py-2 border-b border-[rgba(0,0,0,0.04)] hover:bg-[#fafaf8] ${
                          selectedStaff?.staff.id === s.id ? 'bg-[#f4f4f1]' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#f2f2f0] flex items-center justify-center text-[10px] text-[#555] font-body font-medium flex-shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[12px] font-display font-semibold text-[#0a0a0a] truncate">
                              {s.display_name || s.email?.split('@')[0] || '(未設定)'}
                            </div>
                            <div className="text-[10px] text-[#888] mt-0.5 truncate">
                              {ROLE_LABELS[s.role] || s.role}
                              {s.in_progress_count > 0 && (
                                <span className="text-[#22c55e] ml-1 tabular-nums">· {s.in_progress_count} 進行中</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ))}
        </div>

        {/* Right detail */}
        <div className="overflow-y-auto p-4" style={{ maxHeight: 'calc(100vh - 220px)' }}>
          {tab === 'clients' &&
            (selectedClient ? (
              <ClientDetail client={selectedClient.client} rollup={selectedClient.rollup} />
            ) : (
              <EmptyDetail message="左のリストからクライアントを選んでください" />
            ))}
          {tab === 'factories' &&
            (selectedFactory ? (
              <FactoryDetail factory={selectedFactory.factory} rollup={selectedFactory.rollup} />
            ) : (
              <EmptyDetail message="左のリストから工場を選んでください" />
            ))}
          {tab === 'staff' &&
            (selectedStaff ? (
              <StaffDetail staff={selectedStaff.staff} rollup={selectedStaff.rollup} />
            ) : (
              <EmptyDetail message="左のリストから担当者を選んでください" />
            ))}
        </div>
      </div>

      {showNew && tab === 'clients' && (
        <NewClientModal onClose={() => setShowNew(false)} />
      )}
      {showNew && tab === 'factories' && (
        <NewFactoryModal onClose={() => setShowNew(false)} />
      )}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-2 text-[12px] font-display font-medium border-b-2 -mb-[9px] ${
        active ? 'text-[#0a0a0a] border-[#0a0a0a]' : 'text-[#888] border-transparent'
      }`}
    >
      {children}
    </button>
  )
}

function EmptyDetail({ message }: { message: string }) {
  return (
    <div className="h-full flex items-center justify-center">
      <p className="text-[12px] text-[#888]">{message}</p>
    </div>
  )
}

function NewClientModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [pending, startSave] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startSave(async () => {
      const r = await createClientRecord(fd)
      if (r.error || !r.data) {
        setError(r.error || '作成に失敗しました')
        return
      }
      onClose()
      router.push(`/master?tab=clients&id=${r.data.id}`)
      router.refresh()
    })
  }

  return (
    <ModalShell title="新規クライアント" onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-3">
        {error && <ErrorBanner message={error} />}
        <Field label="会社名" required>
          <input name="company_name" required className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="短縮名"><input name="short_name" className={inputClass} /></Field>
          <Field label="業種"><input name="industry" className={inputClass} /></Field>
        </div>
        <Field label="担当者"><input name="contact_name" className={inputClass} /></Field>
        <Field label="メール"><input type="email" name="email" className={inputClass} /></Field>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="text-[12px] text-[#555] border border-[#e8e8e6] rounded-[6px] px-3 py-1">キャンセル</button>
          <button type="submit" disabled={pending} className="text-[12px] text-white bg-[#0a0a0a] rounded-[6px] px-3 py-1 disabled:opacity-50">
            {pending ? '作成中...' : '作成'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function NewFactoryModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [pending, startSave] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startSave(async () => {
      const r = await createFactoryRecord(fd)
      if (r.error || !r.data) {
        setError(r.error || '作成に失敗しました')
        return
      }
      onClose()
      router.push(`/master?tab=factories&id=${r.data.id}`)
      router.refresh()
    })
  }

  return (
    <ModalShell title="新規工場" onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-3">
        {error && <ErrorBanner message={error} />}
        <Field label="工場名" required><input name="factory_name" required className={inputClass} /></Field>
        <Field label="中国語社名"><input name="name_cn" className={inputClass} /></Field>
        <Field label="担当者"><input name="contact_name" className={inputClass} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="WeChat ID"><input name="wechat" className={inputClass} /></Field>
          <Field label="リードタイム"><input name="lead_time_range" placeholder="25-30日" className={inputClass} /></Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="text-[12px] text-[#555] border border-[#e8e8e6] rounded-[6px] px-3 py-1">キャンセル</button>
          <button type="submit" disabled={pending} className="text-[12px] text-white bg-[#0a0a0a] rounded-[6px] px-3 py-1 disabled:opacity-50">
            {pending ? '作成中...' : '作成'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-[12px] max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[rgba(0,0,0,0.06)]">
          <h3 className="font-display text-[14px] font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1 text-[#888] hover:bg-[#f5f5f4] rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4">{children}</div>
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
