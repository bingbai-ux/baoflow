'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState, useEffect, useTransition } from 'react'
import {
  type SimpleStatus,
  SIMPLE_STATUS_CONFIG,
  SIMPLE_STATUS_ORDER,
} from '@/lib/types'
import { Search } from 'lucide-react'

export function DealListFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const currentStatus = searchParams.get('status') || 'all'
  const currentSearch = searchParams.get('q') || ''
  const [searchValue, setSearchValue] = useState(currentSearch)

  useEffect(() => {
    setSearchValue(currentSearch)
  }, [currentSearch])

  const setParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === null || value === '' || value === 'all') {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    const qs = params.toString()
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname)
    })
  }

  return (
    <div className="space-y-3">
      {/* Status filter pills */}
      <div className="flex flex-wrap gap-1.5">
        <FilterPill
          label="すべて"
          active={currentStatus === 'all'}
          onClick={() => setParam('status', null)}
          disabled={isPending}
        />
        {SIMPLE_STATUS_ORDER.map((status: SimpleStatus) => (
          <FilterPill
            key={status}
            label={SIMPLE_STATUS_CONFIG[status].label}
            active={currentStatus === status}
            onClick={() => setParam('status', status)}
            disabled={isPending}
          />
        ))}
      </div>

      {/* Search box */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#888]" />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              setParam('q', searchValue)
            }
          }}
          onBlur={() => {
            if (searchValue !== currentSearch) setParam('q', searchValue)
          }}
          placeholder="案件名・クライアント名で検索"
          className="w-full pl-9 pr-3 py-2 text-[13px] font-body bg-white border border-[#e8e8e6] rounded-[8px] focus:outline-none focus:border-[#0a0a0a] transition-colors"
        />
      </div>
    </div>
  )
}

interface FilterPillProps {
  label: string
  active: boolean
  onClick: () => void
  disabled?: boolean
}

function FilterPill({ label, active, onClick, disabled }: FilterPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        px-3 py-1 rounded-full text-[12px] font-body transition-colors
        ${
          active
            ? 'bg-[#0a0a0a] text-white'
            : 'bg-white text-[#555] border border-[#e8e8e6] hover:bg-[#f5f5f4]'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      {label}
    </button>
  )
}
