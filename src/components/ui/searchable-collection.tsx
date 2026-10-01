'use client'

import { useState, type ReactNode } from 'react'
import { SearchField, matchesSearch } from './search-field'

export function SearchableCollection({ label, rows, empty, categories = [] }: {
  label: string
  rows: { id: string; text: string; category?: string; content: ReactNode }[]
  empty: ReactNode
  categories?: { value: string; label: string }[]
}) {
  const [query, setQuery] = useState(''), [category, setCategory] = useState('')
  const visible = rows.filter(row => (!category || row.category === category) && matchesSearch(query, [row.text]))
  return <section aria-label={label}>
    {rows.length > 0 && <>
      <SearchField label={label} value={query} onChange={setQuery} count={visible.length} />
      {categories.length > 0 && <label className="inline-flex items-center gap-2 mb-3 text-[12px]">種別
        <select value={category} onChange={e => setCategory(e.target.value)} className="min-h-[44px] rounded-input border border-[#E2E1DA] bg-[#EFEFEA] px-3">
          <option value="">すべて</option>{categories.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>}
    </>}
    {rows.length === 0 ? empty : visible.length === 0 ? <div className="rounded-card border border-[#E2E1DA] bg-white p-5 text-[13px]">
      一致する項目がありません。<button type="button" className="underline min-h-[44px] ml-2" onClick={() => { setQuery(''); setCategory('') }}>絞り込みを解除</button>
    </div> : <div className="space-y-2">{visible.map(row => <div key={row.id}>{row.content}</div>)}</div>}
  </section>
}
