'use client'

export function SearchField({ label, value, onChange, count }: {
  label: string; value: string; onChange: (value: string) => void; count?: number
}) {
  return <div className="flex flex-wrap items-center gap-2 my-3">
    <label className="flex-1 min-w-[180px] max-w-md text-[12px] text-[#84787D]">
      <span className="sr-only">{label}</span>
      <input type="search" placeholder={label} value={value} onChange={e => onChange(e.target.value)}
        className="w-full min-h-[44px] rounded-input border border-[#E2E1DA] bg-[#EFEFEA] px-4 text-[#351E28] focus:outline-none focus:border-[#351E28]" />
    </label>
    {value && <button type="button" onClick={() => onChange('')} className="min-h-[44px] px-3 text-[12px] underline">検索を解除</button>}
    {count != null && <span role="status" className="text-[12px] text-[#84787D]">{count}件</span>}
  </div>
}

export function matchesSearch(search: string, values: unknown[]) {
  return values.filter(v => typeof v === 'string' || typeof v === 'number').join(' ').normalize('NFKC').toLocaleLowerCase().includes(search.trim().normalize('NFKC').toLocaleLowerCase())
}
