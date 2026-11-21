'use client'

// 再設計 工程1: 新規プロジェクト作成（クリック中心）。
// ① 新規取引先 / 既存取引先 → ② 取引先を選ぶ（または登録）→ ③ 担当者・ブランド・希望納期 → つくる

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createProject } from '@/lib/actions/projects'
import { addBrand, addContact, createClientWithContact } from '@/lib/actions/client-master'
import { daysLeft } from '@/lib/process/stages'
import { DaysLeftBadge } from '@/components/process/process-bar'
import { useUi } from '@/components/ui/ui-store'

export interface PickerContact { id: string; name: string; email: string | null; phone: string | null; role: string | null; isPrimary: boolean }
export interface PickerBrand { id: string; name: string }
export interface PickerClient {
  id: string; name: string; shortName: string | null; industry: string | null; address: string | null
  dealCount: number; lastDealAt: string | null; contacts: PickerContact[]; brands: PickerBrand[]
}

type Step = 'choose' | 'existing' | 'new' | 'details'
type Sort = 'recent' | 'name' | 'count'

const chip = 'min-h-[44px] inline-flex items-center justify-center rounded-full border px-4 text-[12.5px] font-bold transition-colors duration-150'
const chipOff = chip + ' border-[#E2E1DA] bg-white text-[#351E28] hover:bg-[#FBFAF6]'
const chipOn = chip + ' border-[#351E28] bg-[#351E28] text-[#C9A2B8]'
const input = 'w-full min-h-[44px] rounded-[12px] border border-transparent bg-[#EFEFEA] px-3.5 text-[14px] text-[#351E28] outline-none focus:border-[#351E28]'
const label = 'block text-[12.5px] font-bold text-[#351E28] mb-1'
const card = 'rounded-[16px] border border-[#E2E1DA] bg-white'

function addMonths(today: string, months: number): string {
  const [y, m, d] = today.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1 + months, 1))
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, last))
  return target.toISOString().slice(0, 10)
}

export function NewProjectFlow({ clients: initialClients, initialClientId, today }: { clients: PickerClient[]; initialClientId: string | null; today: string }) {
  const router = useRouter()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const [clients, setClients] = useState(initialClients)
  const [step, setStep] = useState<Step>(initialClientId ? 'details' : 'choose')
  const [clientId, setClientId] = useState<string | null>(initialClientId)
  const client = clients.find(c => c.id === clientId) || null
  const primaryOf = (c: PickerClient | null) => c?.contacts.find(x => x.isPrimary)?.id || c?.contacts[0]?.id || null
  const [contactId, setContactId] = useState<string | null>(primaryOf(client))
  const [brandId, setBrandId] = useState<string | null>(null)
  const [due, setDue] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('recent')
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState<'contact' | 'brand' | null>(null)
  const request = useRef<{ key: string; id: string } | null>(null)

  const sorted = useMemo(() => {
    const q = query.trim().toLocaleLowerCase()
    const list = clients.filter(c => !q || [c.name, c.shortName, c.industry, ...c.brands.map(b => b.name), ...c.contacts.map(x => x.name)].some(v => v?.toLocaleLowerCase().includes(q)))
    return list.sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'ja')
      : sort === 'count' ? b.dealCount - a.dealCount || a.name.localeCompare(b.name, 'ja')
      : (b.lastDealAt || '').localeCompare(a.lastDealAt || '') || a.name.localeCompare(b.name, 'ja'))
  }, [clients, query, sort])

  const pick = (c: PickerClient) => {
    setClientId(c.id); setContactId(primaryOf(c)); setBrandId(null); setName(''); setError(null); setAdding(null); setStep('details')
  }

  const brand = client?.brands.find(b => b.id === brandId) || null
  const defaultName = client ? `${brand?.name || client.shortName || client.name} ${Number(today.slice(0, 4))}年${Number(today.slice(5, 7))}月` : ''
  const left = daysLeft(due || null, today)

  const create = () => {
    if (!client) return
    setError(null)
    const payload = { client_id: client.id, contact_id: contactId, brand_id: brandId, deal_name: name.trim() || null, desired_delivery_date: due || null }
    const key = JSON.stringify(payload)
    // 同じ内容の押し直しは同じ要求IDで送る（二重作成を防ぐ）
    if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() }
    startTransition(async () => {
      const res = await createProject({ request_id: request.current!.id, ...payload })
      if (res.error || !res.dealId) { setError(res.error || 'プロジェクトを作成できませんでした'); return }
      toast(`プロジェクト ${res.dealCode || ''} をつくりました`)
      router.push(`/deals/${res.dealId}`)
    })
  }

  return (
    <div className="mt-4 space-y-4">
      <ol aria-label="作成の手順" className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#84787D]">
        {[['choose', '1 取引先の種類'], ['pick', '2 取引先'], ['details', '3 担当者・納期']].map(([k, t]) => {
          const now = k === 'choose' ? step === 'choose' : k === 'pick' ? step === 'existing' || step === 'new' : step === 'details'
          return <li key={k} aria-current={now ? 'step' : undefined} className={now ? 'font-extrabold text-[#351E28]' : ''}>{t}</li>
        })}
      </ol>

      {step === 'choose' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <button type="button" onClick={() => setStep('existing')} className={card + ' p-6 text-left hover:bg-[#FBFAF6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#351E28]'}>
            <span className="block text-[15px] font-bold text-[#351E28]">既存の取引先</span>
            <span className="mt-1 block text-[12.5px] text-[#84787D]">以前に取引した会社から選びます</span>
            <span className="mt-4 inline-block rounded-full bg-[#D7EFFF] px-2.5 py-[3px] text-[11px] font-bold text-[#33566F] tabular-nums">登録済み {clients.length}社</span>
          </button>
          <button type="button" onClick={() => setStep('new')} className={card + ' p-6 text-left hover:bg-[#FBFAF6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#351E28]'}>
            <span className="block text-[15px] font-bold text-[#351E28]">新規の取引先</span>
            <span className="mt-1 block text-[12.5px] text-[#84787D]">はじめての会社を登録して始めます</span>
            <span className="mt-4 inline-block rounded-full border border-[#E2E1DA] bg-[#EFEFEA] px-2.5 py-[3px] text-[11px] font-bold text-[#351E28]">会社名だけで登録できます</span>
          </button>
        </div>
      )}

      {step === 'existing' && (
        <section aria-label="取引先を選ぶ" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setStep('choose')} className={chipOff}>← もどる</button>
            <label className="min-w-[180px] flex-1"><span className="sr-only">取引先をさがす</span>
              <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="会社名・ブランド・担当者でさがす" className={input + ' !bg-white !border-[#E2E1DA]'} /></label>
          </div>
          <div role="group" aria-label="並び順" className="flex flex-wrap gap-1">
            {([['recent', '最近の案件順'], ['count', '案件の多い順'], ['name', '名前順']] as [Sort, string][]).map(([k, t]) =>
              <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)} className={sort === k ? chipOn : chipOff}>{t}</button>)}
          </div>
          {sorted.length === 0 && <p className={card + ' p-6 text-center text-[13px]'}>{clients.length ? '条件に合う取引先がありません。' : 'まだ取引先が登録されていません。'}<button type="button" onClick={() => setStep('new')} className="ml-2 underline">新規の取引先を登録する</button></p>}
          <ul className="grid gap-2 sm:grid-cols-2">
            {sorted.map(c => (
              <li key={c.id}>
                <button type="button" onClick={() => pick(c)} className={card + ' w-full p-4 text-left hover:bg-[#FBFAF6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#351E28]'}>
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0"><span className="block truncate text-[14px] font-bold text-[#351E28]">{c.name}</span>
                      {c.brands.length > 0 && <span className="block truncate text-[11px] text-[#84787D]">ブランド: {c.brands.map(b => b.name).join('・')}</span>}</span>
                    <span className="flex-shrink-0 rounded-full bg-[#D7EFFF] px-2 py-[3px] text-[11px] font-bold text-[#33566F] tabular-nums">案件 {c.dealCount}件</span>
                  </span>
                  <span className="mt-2 block text-[12.5px] text-[#351E28]">担当者: {c.contacts.length ? c.contacts.map(x => x.name).join('・') : '未登録'}</span>
                  <span className="mt-1 block text-[11px] text-[#84787D] tabular-nums">{c.lastDealAt ? `最後の案件 ${c.lastDealAt.slice(0, 10).replace(/-/g, '/')}` : 'まだ案件がありません'}{c.industry ? ` · ${c.industry}` : ''}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {step === 'new' && <NewClientForm onBack={() => setStep('choose')} onCreated={c => { setClients(xs => [...xs, c]); pick(c) }} />}

      {step === 'details' && client && (
        <section aria-label="担当者・ブランド・希望納期" className="space-y-4">
          <div className={card + ' flex flex-wrap items-center justify-between gap-3 p-4'}>
            <div className="min-w-0"><p className="text-[11px] text-[#84787D]">取引先</p><p className="truncate text-[15px] font-bold text-[#351E28]">{client.name}</p></div>
            <button type="button" onClick={() => { setStep('existing'); setError(null) }} className={chipOff}>取引先を選び直す</button>
          </div>

          <div className={card + ' space-y-4 p-4'}>
            <div>
              <p className={label}>担当者</p>
              <div className="flex flex-wrap gap-2">
                {client.contacts.map(x => (
                  <button key={x.id} type="button" aria-pressed={contactId === x.id} onClick={() => setContactId(x.id)} className={contactId === x.id ? chipOn : chipOff}>
                    {x.name}{x.isPrimary && <span className="ml-1 text-[11px] font-normal">（主担当）</span>}
                  </button>
                ))}
                {client.contacts.length === 0 && <span className="self-center text-[12.5px] text-[#84787D]">担当者が未登録です。あとからでも追加できます。</span>}
                <button type="button" onClick={() => setAdding(adding === 'contact' ? null : 'contact')} aria-expanded={adding === 'contact'} className={chipOff}>＋ 担当者を追加</button>
              </div>
              {adding === 'contact' && <InlineContact clientId={client.id} onCancel={() => setAdding(null)} onAdded={c => {
                setClients(xs => xs.map(v => v.id === client.id ? { ...v, contacts: [...v.contacts, { ...c, isPrimary: v.contacts.length === 0 }] } : v)); setContactId(c.id); setAdding(null)
              }} />}
            </div>

            {(client.brands.length > 0 || adding === 'brand') && (
              <div>
                <p className={label}>ブランド</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" aria-pressed={brandId === null} onClick={() => setBrandId(null)} className={brandId === null ? chipOn : chipOff}>指定しない</button>
                  {client.brands.map(b => <button key={b.id} type="button" aria-pressed={brandId === b.id} onClick={() => setBrandId(b.id)} className={brandId === b.id ? chipOn : chipOff}>{b.name}</button>)}
                  {adding !== 'brand' && <button type="button" onClick={() => setAdding('brand')} className={chipOff}>＋ ブランドを追加</button>}
                </div>
              </div>
            )}
            {client.brands.length === 0 && adding !== 'brand' && <button type="button" onClick={() => setAdding('brand')} className="min-h-[44px] text-[12.5px] text-[#84787D] underline">この会社にブランドを登録する（複数ブランドがある場合）</button>}
            {adding === 'brand' && <InlineBrand clientId={client.id} onCancel={() => setAdding(null)} onAdded={b => {
              setClients(xs => xs.map(v => v.id === client.id ? { ...v, brands: [...v.brands, b] } : v)); setBrandId(b.id); setAdding(null)
            }} />}
          </div>

          <div className={card + ' space-y-4 p-4'}>
            <div>
              <p className={label}>希望納期</p>
              <div className="flex flex-wrap items-center gap-2">
                {[1, 2, 3].map(m => { const v = addMonths(today, m); return <button key={m} type="button" aria-pressed={due === v} onClick={() => setDue(v)} className={due === v ? chipOn : chipOff}>{m}か月後</button> })}
                <button type="button" aria-pressed={due === ''} onClick={() => setDue('')} className={due === '' ? chipOn : chipOff}>未定</button>
                <label className="inline-flex items-center gap-2 text-[12.5px] text-[#84787D]">日付で選ぶ
                  <input type="date" value={due} min={today} onChange={e => setDue(e.target.value)} className={input + ' !w-auto'} /></label>
                {due && <DaysLeftBadge value={left} />}
              </div>
            </div>
            <div>
              <label className={label} htmlFor="project-name">プロジェクト名</label>
              <input id="project-name" value={name} onChange={e => setName(e.target.value)} placeholder={defaultName} maxLength={120} className={input} />
              <p className="mt-1 text-[11px] text-[#84787D]">空のままなら「{defaultName}」になります。あとから変えられます。</p>
            </div>
          </div>

          {error && <p role="alert" className="rounded-[16px] border-[1.5px] border-[#FF5C34] bg-[#FFD8C2] p-3 text-[12.5px] text-[#B03616]">{error}</p>}
          <div className="flex justify-end">
            <button type="button" onClick={create} disabled={pending} className="min-h-[44px] rounded-full bg-[#E9F056] px-6 text-[14px] font-extrabold text-[#666C14] hover:brightness-95 disabled:opacity-60">
              {pending ? 'つくっています…' : 'このプロジェクトをつくる'}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}

export function NewClientForm({ onBack, onCreated }: { onBack: () => void; onCreated: (c: PickerClient) => void }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [f, setF] = useState({ company: '', contact: '', email: '', phone: '', address: '', brand: '', notes: '' })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF(v => ({ ...v, [k]: e.target.value }))
  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setError(null)
    startTransition(async () => {
      const res = await createClientWithContact({
        company_name: f.company, address: f.address, notes: f.notes, brand_name: f.brand,
        contact: f.contact.trim() || f.email.trim() || f.phone.trim() ? { name: f.contact, email: f.email, phone: f.phone } : null,
      })
      if (res.error !== null) { setError(res.error); return }
      onCreated({
        id: res.clientId, name: f.company.trim(), shortName: null, industry: null, address: f.address.trim() || null, dealCount: 0, lastDealAt: null,
        contacts: res.contactId ? [{ id: res.contactId, name: f.contact.trim(), email: f.email.trim() || null, phone: f.phone.trim() || null, role: null, isPrimary: true }] : [],
        brands: res.brandId ? [{ id: res.brandId, name: f.brand.trim() }] : [],
      })
    })
  }
  return (
    <form onSubmit={submit} aria-label="新規の取引先を登録" className={card + ' space-y-4 p-4'}>
      <div><label className={label} htmlFor="nc-company">会社名（必須）</label><input id="nc-company" required value={f.company} onChange={set('company')} className={input} autoComplete="organization" /></div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div><label className={label} htmlFor="nc-contact">担当者の名前</label><input id="nc-contact" value={f.contact} onChange={set('contact')} className={input} autoComplete="off" /></div>
        <div><label className={label} htmlFor="nc-email">メール</label><input id="nc-email" type="email" value={f.email} onChange={set('email')} className={input} autoComplete="off" /></div>
        <div><label className={label} htmlFor="nc-phone">電話</label><input id="nc-phone" type="tel" value={f.phone} onChange={set('phone')} className={input} autoComplete="off" /></div>
      </div>
      <div><label className={label} htmlFor="nc-address">住所</label><input id="nc-address" value={f.address} onChange={set('address')} className={input} autoComplete="off" /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={label} htmlFor="nc-brand">ブランド名（あれば）</label><input id="nc-brand" value={f.brand} onChange={set('brand')} className={input} /><p className="mt-1 text-[11px] text-[#84787D]">2つ目以降は登録後に追加できます。</p></div>
        <div><label className={label} htmlFor="nc-notes">備考</label><input id="nc-notes" value={f.notes} onChange={set('notes')} className={input} /></div>
      </div>
      {error && <p role="alert" className="rounded-[16px] border-[1.5px] border-[#FF5C34] bg-[#FFD8C2] p-3 text-[12.5px] text-[#B03616]">{error}</p>}
      <div className="flex flex-wrap justify-between gap-2">
        <button type="button" onClick={onBack} className={chipOff}>← もどる</button>
        <button type="submit" disabled={pending} className="min-h-[44px] rounded-full bg-[#351E28] px-6 text-[13px] font-bold text-[#C9A2B8] hover:brightness-95 disabled:opacity-60">{pending ? '登録しています…' : '登録して次へ'}</button>
      </div>
    </form>
  )
}

function InlineContact({ clientId, onAdded, onCancel }: { clientId: string; onAdded: (c: PickerContact) => void; onCancel: () => void }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [f, setF] = useState({ name: '', email: '', phone: '' })
  const save = () => { setError(null); startTransition(async () => {
    const res = await addContact(clientId, f)
    if (res.error !== null) { setError(res.error); return }
    onAdded({ id: res.contactId, name: f.name.trim(), email: f.email.trim() || null, phone: f.phone.trim() || null, role: null, isPrimary: false })
  }) }
  return (
    <div className="mt-3 rounded-[16px] border border-[#E2E1DA] bg-[#FBFAF6] p-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-[11px] text-[#84787D]">名前（必須）<input value={f.name} onChange={e => setF(v => ({ ...v, name: e.target.value }))} className={input + ' !bg-white'} /></label>
        <label className="text-[11px] text-[#84787D]">メール<input type="email" value={f.email} onChange={e => setF(v => ({ ...v, email: e.target.value }))} className={input + ' !bg-white'} /></label>
        <label className="text-[11px] text-[#84787D]">電話<input type="tel" value={f.phone} onChange={e => setF(v => ({ ...v, phone: e.target.value }))} className={input + ' !bg-white'} /></label>
      </div>
      {error && <p role="alert" className="mt-2 text-[12.5px] text-[#B03616]">{error}</p>}
      <div className="mt-2 flex gap-2"><button type="button" onClick={save} disabled={pending} className={chipOn}>{pending ? '追加しています…' : 'この担当者を追加'}</button><button type="button" onClick={onCancel} className={chipOff}>やめる</button></div>
    </div>
  )
}

function InlineBrand({ clientId, onAdded, onCancel }: { clientId: string; onAdded: (b: PickerBrand) => void; onCancel: () => void }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const save = () => { setError(null); startTransition(async () => {
    const res = await addBrand(clientId, name)
    if (res.error !== null) { setError(res.error); return }
    onAdded({ id: res.brandId, name: name.trim() })
  }) }
  return (
    <div className="rounded-[16px] border border-[#E2E1DA] bg-[#FBFAF6] p-3">
      <label className="text-[11px] text-[#84787D]">ブランド名<input value={name} onChange={e => setName(e.target.value)} className={input + ' !bg-white'} /></label>
      {error && <p role="alert" className="mt-2 text-[12.5px] text-[#B03616]">{error}</p>}
      <div className="mt-2 flex gap-2"><button type="button" onClick={save} disabled={pending} className={chipOn}>{pending ? '追加しています…' : 'このブランドを追加'}</button><button type="button" onClick={onCancel} className={chipOff}>やめる</button></div>
    </div>
  )
}
