'use client'

// 再設計 工程1: 取引先マスターの一覧（1行=1社の表・並び替え・検索・新規登録）。

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { NewClientForm } from '@/components/process/new-project-flow'

export interface DirectoryClient {
  id: string; name: string; shortName: string | null; industry: string | null; address: string | null
  contacts: string[]; brands: string[]; dealCount: number; activeCount: number; lastDealAt: string | null
}
type Sort = 'recent' | 'name' | 'count'
const button = 'min-h-[44px] inline-flex items-center justify-center rounded-full border border-[#E2E1DA] px-3 text-[12px] font-bold'
const grid = 'lg:grid lg:grid-cols-[minmax(160px,1.5fr)_minmax(120px,1fr)_minmax(120px,1fr)_96px_96px_120px]'

export function ClientDirectory({ clients }: { clients: DirectoryClient[] }) {
  const router = useRouter()
  const [sort, setSort] = useState<Sort>('recent')
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase()
    return clients.filter(c => !q || [c.name, c.shortName, c.industry, ...c.brands, ...c.contacts].some(v => v?.toLocaleLowerCase().includes(q)))
      .sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'ja')
        : sort === 'count' ? b.dealCount - a.dealCount || a.name.localeCompare(b.name, 'ja')
        : (b.lastDealAt || '').localeCompare(a.lastDealAt || '') || a.name.localeCompare(b.name, 'ja'))
  }, [clients, query, sort])
  return (
    <div className="space-y-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-[21px] font-extrabold">取引先</h1><p className="text-[12.5px] text-[#84787D] tabular-nums">登録 {clients.length}社 · 進行中の案件がある取引先 {clients.filter(c => c.activeCount > 0).length}社</p></div>
        <button type="button" onClick={() => setCreating(v => !v)} aria-expanded={creating} className={button + ' bg-[#351E28] text-[#C9A2B8] !border-[#351E28]'}>{creating ? '登録をやめる' : '新しい取引先を登録'}</button>
      </div>
      {creating && <NewClientForm onBack={() => setCreating(false)} onCreated={c => router.push(`/clients/${c.id}`)} />}
      <div className="flex flex-wrap gap-2">
        <label className="min-w-[180px] flex-1"><span className="sr-only">取引先をさがす</span><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="会社名・ブランド・担当者でさがす" className="min-h-[44px] w-full rounded-input border border-[#E2E1DA] bg-white px-3 text-[13px]" /></label>
        <div role="group" aria-label="並び順" className="flex flex-wrap gap-1">
          {([['recent', '最近の案件順'], ['count', '案件の多い順'], ['name', '名前順']] as [Sort, string][]).map(([k, t]) =>
            <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)} className={button + (sort === k ? ' bg-[#351E28] text-[#C9A2B8] !border-[#351E28]' : ' bg-white')}>{t}</button>)}
        </div>
      </div>
      <div role="table" aria-label="取引先一覧" className="overflow-hidden rounded-card border border-[#E2E1DA] bg-white">
        <div role="row" className={grid + ' hidden border-b border-[#E2E1DA] bg-[#FBFAF6] text-[11px] text-[#84787D]'}>
          {['会社名', 'ブランド', '担当者', '案件', '進行中', '最後の案件'].map(t => <div key={t} role="columnheader" className="p-3">{t}</div>)}
        </div>
        {rows.map(c => (
          <div key={c.id} role="row" className={grid + ' grid grid-cols-2 gap-x-3 border-b border-[#E2E1DA] p-3 last:border-0 hover:bg-[#FBFAF6] lg:gap-0 lg:p-0'}>
            <div role="cell" className="col-span-2 lg:col-span-1 lg:p-3"><Link href={`/clients/${c.id}`} className="block min-h-[24px] text-[13px] font-bold underline-offset-4 hover:underline">{c.name}</Link>{c.industry && <span className="block text-[11px] text-[#84787D]">{c.industry}</span>}</div>
            <div role="cell" className="text-[12px] lg:p-3"><span className="text-[11px] text-[#84787D] lg:hidden">ブランド </span>{c.brands.join('・') || '—'}</div>
            <div role="cell" className="text-[12px] lg:p-3"><span className="text-[11px] text-[#84787D] lg:hidden">担当者 </span>{c.contacts.join('・') || '未登録'}</div>
            <div role="cell" className="text-[12px] tabular-nums lg:p-3"><span className="text-[11px] text-[#84787D] lg:hidden">案件 </span>{c.dealCount}件</div>
            <div role="cell" className="text-[12px] tabular-nums lg:p-3"><span className="text-[11px] text-[#84787D] lg:hidden">進行中 </span>{c.activeCount}件</div>
            <div role="cell" className="text-[12px] tabular-nums lg:p-3"><span className="text-[11px] text-[#84787D] lg:hidden">最後の案件 </span>{c.lastDealAt ? c.lastDealAt.slice(0, 10).replace(/-/g, '/') : '—'}</div>
          </div>
        ))}
        {!rows.length && <div className="p-8 text-center text-[13px]">{clients.length ? '条件に合う取引先がありません。' : 'まだ取引先がありません。「新しい取引先を登録」から始めてください。'}</div>}
      </div>
    </div>
  )
}
