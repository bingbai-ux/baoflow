'use client'

// 再設計 工程1: 取引先の基本情報・担当者（複数・主担当1人）・ブランドの編集。

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addBrand, addContact, deleteBrand, deleteContact, setPrimaryContact, updateClientBasics, updateContact } from '@/lib/actions/client-master'
import { useUi } from '@/components/ui/ui-store'

interface Contact { id: string; name: string; email: string | null; phone: string | null; role: string | null; isPrimary: boolean }
interface Brand { id: string; name: string }
interface Basics { id: string; companyName: string; shortName: string | null; address: string | null; notes: string | null }

const card = 'rounded-[16px] border border-[#E2E1DA] bg-white p-4'
const input = 'w-full min-h-[44px] rounded-[12px] border border-transparent bg-[#EFEFEA] px-3.5 text-[14px] text-[#351E28] outline-none focus:border-[#351E28]'
const label = 'block text-[11px] text-[#84787D]'
const ghost = 'min-h-[44px] inline-flex items-center justify-center rounded-full border border-[#E2E1DA] bg-white px-3 text-[12px] font-bold text-[#351E28] hover:bg-[#FBFAF6] disabled:opacity-60'
const dark = 'min-h-[44px] inline-flex items-center justify-center rounded-full bg-[#351E28] px-4 text-[12px] font-bold text-[#C9A2B8] hover:brightness-95 disabled:opacity-60'
const danger = 'min-h-[44px] inline-flex items-center justify-center rounded-full border border-[#FF5C34] bg-white px-3 text-[12px] font-bold text-[#B03616] disabled:opacity-60'

export function ClientDetail({ client, contacts, brands }: { client: Basics; contacts: Contact[]; brands: Brand[] }) {
  const router = useRouter()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [basics, setBasics] = useState({ company: client.companyName, short: client.shortName || '', address: client.address || '', notes: client.notes || '' })
  const [editing, setEditing] = useState<string | null>(null) // contact id | 'new' | 'basics'
  const [draft, setDraft] = useState({ name: '', email: '', phone: '', role: '' })
  const [confirm, setConfirm] = useState<{ kind: 'contact' | 'brand'; id: string; name: string } | null>(null)
  const [brandName, setBrandName] = useState('')

  const run = (work: () => Promise<{ error: string | null }>, done: string, after?: () => void) => {
    setError(null)
    startTransition(async () => {
      const res = await work()
      if (res.error) { setError(res.error); return }
      after?.(); toast(done); router.refresh()
    })
  }
  const openContact = (c: Contact | null) => { setDraft({ name: c?.name || '', email: c?.email || '', phone: c?.phone || '', role: c?.role || '' }); setEditing(c ? c.id : 'new'); setError(null) }

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="rounded-[16px] border-[1.5px] border-[#FF5C34] bg-[#FFD8C2] p-3 text-[12.5px] text-[#B03616]">{error}</p>}

      <section aria-label="基本情報" className={card}>
        <div className="mb-2 flex items-center justify-between gap-2"><h2 className="text-[15px] font-bold">基本情報</h2>
          {editing !== 'basics' && <button type="button" className={ghost} onClick={() => { setEditing('basics'); setError(null) }}>基本情報を直す</button>}</div>
        {editing === 'basics' ? (
          <form className="space-y-3" onSubmit={e => { e.preventDefault(); run(() => updateClientBasics(client.id, { company_name: basics.company, short_name: basics.short, address: basics.address, notes: basics.notes }), '基本情報を保存しました', () => setEditing(null)) }}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={label}>会社名（必須）<input required value={basics.company} onChange={e => setBasics(v => ({ ...v, company: e.target.value }))} className={input} /></label>
              <label className={label}>短い呼び名<input value={basics.short} onChange={e => setBasics(v => ({ ...v, short: e.target.value }))} className={input} /></label>
            </div>
            <label className={label}>住所<input value={basics.address} onChange={e => setBasics(v => ({ ...v, address: e.target.value }))} className={input} /></label>
            <label className={label}>備考<input value={basics.notes} onChange={e => setBasics(v => ({ ...v, notes: e.target.value }))} className={input} /></label>
            <div className="flex gap-2"><button type="submit" disabled={pending} className={dark}>この内容で保存する</button><button type="button" className={ghost} onClick={() => setEditing(null)}>やめる</button></div>
          </form>
        ) : (
          <dl className="grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
            <div><dt className={label}>短い呼び名</dt><dd>{client.shortName || '—'}</dd></div>
            <div><dt className={label}>住所</dt><dd>{client.address || '—'}</dd></div>
            <div className="sm:col-span-2"><dt className={label}>備考</dt><dd>{client.notes || '—'}</dd></div>
          </dl>
        )}
      </section>

      <section aria-label="担当者" className={card}>
        <div className="mb-2 flex items-center justify-between gap-2"><h2 className="text-[15px] font-bold">担当者 <span className="text-[12.5px] font-normal text-[#84787D] tabular-nums">{contacts.length}人</span></h2>
          {editing !== 'new' && <button type="button" className={ghost} onClick={() => openContact(null)}>＋ 担当者を追加</button>}</div>
        <ul className="divide-y divide-[#E2E1DA]">
          {contacts.map(c => editing === c.id ? (
            <li key={c.id} className="py-3"><ContactForm draft={draft} setDraft={setDraft} pending={pending} onCancel={() => setEditing(null)}
              onSave={() => run(() => updateContact(c.id, client.id, draft), '担当者を保存しました', () => setEditing(null))} /></li>
          ) : (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0 text-[13px]">
                <p className="font-bold">{c.name}{c.isPrimary && <span className="ml-2 rounded-full bg-[#D7EFFF] px-2 py-[3px] text-[11px] font-bold text-[#33566F]">主担当</span>}{c.role && <span className="ml-2 text-[11px] font-normal text-[#84787D]">{c.role}</span>}</p>
                <p className="break-all text-[12.5px] text-[#84787D]">{[c.email, c.phone].filter(Boolean).join(' · ') || '連絡先未登録'}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {!c.isPrimary && <button type="button" disabled={pending} className={ghost} onClick={() => run(() => setPrimaryContact(c.id, client.id), `${c.name} さんを主担当にしました`)}>主担当にする</button>}
                <button type="button" className={ghost} onClick={() => openContact(c)}>直す</button>
                <button type="button" className={danger} onClick={() => setConfirm({ kind: 'contact', id: c.id, name: c.name })}>削除</button>
              </div>
            </li>
          ))}
          {!contacts.length && editing !== 'new' && <li className="py-3 text-[13px] text-[#84787D]">担当者が未登録です。</li>}
        </ul>
        {editing === 'new' && <div className="border-t border-[#E2E1DA] pt-3"><ContactForm draft={draft} setDraft={setDraft} pending={pending} onCancel={() => setEditing(null)}
          onSave={() => run(() => addContact(client.id, draft), '担当者を追加しました', () => setEditing(null))} /></div>}
      </section>

      <section aria-label="ブランド" className={card}>
        <h2 className="mb-2 text-[15px] font-bold">ブランド <span className="text-[12.5px] font-normal text-[#84787D] tabular-nums">{brands.length}件</span></h2>
        <ul className="mb-3 flex flex-wrap gap-2">
          {brands.map(b => <li key={b.id} className="inline-flex items-center gap-1 rounded-full border border-[#E2E1DA] bg-[#EFEFEA] py-1 pl-3 pr-1 text-[12.5px]">{b.name}
            <button type="button" aria-label={`${b.name} を削除`} className="min-h-[36px] rounded-full px-2 text-[11px] text-[#B03616] underline" onClick={() => setConfirm({ kind: 'brand', id: b.id, name: b.name })}>削除</button></li>)}
          {!brands.length && <li className="text-[13px] text-[#84787D]">ブランドは未登録です。</li>}
        </ul>
        <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); run(() => addBrand(client.id, brandName), 'ブランドを追加しました', () => setBrandName('')) }}>
          <label className={label + ' min-w-[200px] flex-1'}>新しいブランド名<input value={brandName} onChange={e => setBrandName(e.target.value)} className={input} /></label>
          <button type="submit" disabled={pending || !brandName.trim()} className={dark}>ブランドを追加</button>
        </form>
      </section>

      {confirm && (
        <div role="dialog" aria-modal="true" aria-label="削除の確認" className="fixed inset-0 z-[70] flex items-center justify-center bg-[#351E28]/40 p-4">
          <div className="w-full max-w-[400px] rounded-[16px] border border-[#E2E1DA] bg-white p-4 shadow-[0_20px_50px_rgba(53,30,40,.12)]">
            <p className="text-[15px] font-bold">{confirm.kind === 'contact' ? '担当者' : 'ブランド'}「{confirm.name}」を削除しますか？</p>
            <p className="mt-1 text-[12.5px] text-[#84787D]">削除すると元に戻せません。{confirm.kind === 'contact' ? '過去の案件の担当者欄からも外れます。' : '案件で使われているブランドは削除できません。'}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={ghost} onClick={() => setConfirm(null)}>やめる</button>
              <button type="button" disabled={pending} className={danger} onClick={() => { const c = confirm; setConfirm(null); run(() => c.kind === 'contact' ? deleteContact(c.id, client.id) : deleteBrand(c.id, client.id), '削除しました') }}>削除する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ContactForm({ draft, setDraft, pending, onSave, onCancel }: {
  draft: { name: string; email: string; phone: string; role: string }; setDraft: (f: (v: { name: string; email: string; phone: string; role: string }) => { name: string; email: string; phone: string; role: string }) => void
  pending: boolean; onSave: () => void; onCancel: () => void
}) {
  const set = (k: 'name' | 'email' | 'phone' | 'role') => (e: React.ChangeEvent<HTMLInputElement>) => setDraft(v => ({ ...v, [k]: e.target.value }))
  return (
    <form className="space-y-3" onSubmit={e => { e.preventDefault(); onSave() }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>名前（必須）<input required value={draft.name} onChange={set('name')} className={input} /></label>
        <label className={label}>役割・部署<input value={draft.role} onChange={set('role')} className={input} /></label>
        <label className={label}>メール<input type="email" value={draft.email} onChange={set('email')} className={input} /></label>
        <label className={label}>電話<input type="tel" value={draft.phone} onChange={set('phone')} className={input} /></label>
      </div>
      <div className="flex gap-2"><button type="submit" disabled={pending} className={dark}>この内容で保存する</button><button type="button" className={ghost} onClick={onCancel}>やめる</button></div>
    </form>
  )
}
