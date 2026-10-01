'use client'

import { useCallback, useSyncExternalStore } from 'react'

const event = 'bao:section-navigation'
function subscribe(listener: () => void) {
  window.addEventListener('popstate', listener)
  window.addEventListener(event, listener)
  return () => {
    window.removeEventListener('popstate', listener)
    window.removeEventListener(event, listener)
  }
}

/** Preserve the selected section across reloads and browser Back, without refetching or saving form data. */
export function useSectionNavigation<T extends string>(allowed: readonly T[], initial: T) {
  const snapshot = useCallback(() => {
    const value = new URLSearchParams(window.location.search).get('tab') as T
    return allowed.includes(value) ? value : initial
  }, [allowed, initial])
  const selected = useSyncExternalStore(subscribe, snapshot, () => initial)
  const select = (value: T) => {
    const url = new URL(window.location.href)
    url.searchParams.set('tab', value)
    if (url.href === window.location.href) return
    window.history.pushState(null, '', url)
    window.dispatchEvent(new Event(event))
  }
  return [selected, select] as const
}

export function SectionNavigation<T extends string>({ label, items, value, onChange }: {
  label: string
  items: readonly { id: T; label: string; badge?: number }[]
  value: T
  onChange: (value: T) => void
}) {
  return <nav aria-label={label} className="flex flex-wrap gap-1.5 my-3">
    {items.map(item => <button key={item.id} type="button" aria-pressed={value === item.id}
      onClick={() => onChange(item.id)}
      className={`min-h-[44px] rounded-full px-3.5 text-[12px] font-bold border ${value === item.id
        ? 'bg-[#E9F056] text-[#666C14] border-[#E9F056]'
        : 'bg-white text-[#351E28] border-[#E2E1DA] hover:bg-[#FBFAF6]'}`}>
      {item.label}{item.badge != null && <span className="fc-num ml-1.5">{item.badge}</span>}
    </button>)}
  </nav>
}
