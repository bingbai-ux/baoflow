'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useUi } from '@/components/ui/ui-store'
import { searchAll } from '@/lib/actions/search'
import type { SearchHit } from '@/lib/actions/search-types'

interface QuickAction {
  id: string
  title: string
  sub: string
  badge: string
  href: string
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'new_deal', title: '新規案件を作成', sub: 'クライアント選択 → 案件作成', badge: '⌘N', href: '/deals/new' },
  { id: 'go_master', title: '取引先マスター', sub: 'クライアント・工場・担当者', badge: '⌘M', href: '/master' },
  { id: 'go_settings', title: '設定', sub: '会社情報・銀行口座・既定値', badge: '', href: '/settings' },
]

export function CmdK({ initial }: { initial: SearchHit[] }) {
  const router = useRouter()
  const { cmdkOpen, closeCmdk } = useUi()
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<SearchHit[]>(initial)
  const [idx, setIdx] = useState(0)
  const [, startSearch] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (cmdkOpen) {
      setTimeout(() => inputRef.current?.focus(), 30)
      setQ('')
      setHits(initial)
      setIdx(0)
    }
  }, [cmdkOpen, initial])

  // Debounced server search
  useEffect(() => {
    if (!cmdkOpen) return
    const t = setTimeout(() => {
      startSearch(async () => {
        const r = await searchAll(q)
        setHits(r)
      })
    }, 200)
    return () => clearTimeout(t)
  }, [q, cmdkOpen])

  if (!cmdkOpen) return null

  const dealHits = hits.filter((h) => h.kind === 'deal')
  const clientHits = hits.filter((h) => h.kind === 'client')
  const factoryHits = hits.filter((h) => h.kind === 'factory')
  const actions = q.trim() === '' ? QUICK_ACTIONS : []

  type Item =
    | ({ type: 'action' } & QuickAction)
    | ({ type: 'hit' } & SearchHit)
  const flat: Item[] = [
    ...actions.map((a) => ({ type: 'action' as const, ...a })),
    ...dealHits.map((h) => ({ type: 'hit' as const, ...h })),
    ...clientHits.map((h) => ({ type: 'hit' as const, ...h })),
    ...factoryHits.map((h) => ({ type: 'hit' as const, ...h })),
  ]

  const select = (i: number) => {
    const item = flat[i]
    if (!item) return
    closeCmdk()
    router.push(item.href)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIdx((i) => Math.min(i + 1, flat.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      select(idx)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[1000] flex items-start justify-center pt-[10vh]"
      onClick={closeCmdk}
    >
      <div
        className="w-[600px] max-w-[92vw] bg-white rounded-[14px] shadow-[0_20px_60px_rgba(0,0,0,0.3)] overflow-hidden font-body"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setIdx(0)
          }}
          onKeyDown={onKey}
          placeholder="案件番号 · 案件名 · 取引先 · 工場名で検索…"
          className="w-full px-5 py-4 text-[14px] border-b border-[#e8e8e6] outline-none font-body box-border"
        />
        <div className="max-h-[420px] overflow-auto">
          {actions.length > 0 && <Group label="クイックアクション" />}
          {actions.map((a, i) => (
            <Row
              key={`a${a.id}`}
              active={idx === i}
              onClick={() => select(i)}
              onHover={() => setIdx(i)}
              icon={<span className="font-display text-[#0a0a0a] font-semibold">›</span>}
              title={a.title}
              sub={a.sub}
              badge={a.badge}
            />
          ))}

          {dealHits.length > 0 && <Group label="案件" />}
          {dealHits.map((h, i) => {
            const k = actions.length + i
            return (
              <Row
                key={`d${h.id}`}
                active={idx === k}
                onClick={() => select(k)}
                onHover={() => setIdx(k)}
                icon={<span className="w-2 h-2 rounded-full bg-[#888]" />}
                title={h.title}
                sub={h.sub}
                badge={h.badge}
              />
            )
          })}

          {clientHits.length > 0 && <Group label="取引先" />}
          {clientHits.map((h, i) => {
            const k = actions.length + dealHits.length + i
            return (
              <Row
                key={`c${h.id}`}
                active={idx === k}
                onClick={() => select(k)}
                onHover={() => setIdx(k)}
                icon={<span className="font-display text-[#0a0a0a]">◯</span>}
                title={h.title}
                sub={h.sub}
                badge={h.badge}
              />
            )
          })}

          {factoryHits.length > 0 && <Group label="工場" />}
          {factoryHits.map((h, i) => {
            const k = actions.length + dealHits.length + clientHits.length + i
            return (
              <Row
                key={`f${h.id}`}
                active={idx === k}
                onClick={() => select(k)}
                onHover={() => setIdx(k)}
                icon={<span className="font-display text-[#0a0a0a]">▣</span>}
                title={h.title}
                sub={h.sub}
                badge={h.badge}
              />
            )
          })}

          {flat.length === 0 && (
            <div className="p-8 text-center text-[#aaa] text-[12px]">該当なし</div>
          )}
        </div>
        <div className="px-4 py-2.5 border-t border-[#e8e8e6] text-[10px] text-[#aaa] flex gap-3.5">
          <span>
            <Kbd>↑↓</Kbd> 移動
          </span>
          <span>
            <Kbd>↵</Kbd> 選択
          </span>
          <span>
            <Kbd>esc</Kbd> 閉じる
          </span>
        </div>
      </div>
    </div>
  )
}

function Group({ label }: { label: string }) {
  return (
    <div className="px-3.5 pt-2 pb-1 text-[9.5px] text-[#999] font-semibold uppercase tracking-[0.08em]">
      {label}
    </div>
  )
}

function Row({
  active,
  onClick,
  onHover,
  icon,
  title,
  sub,
  badge,
}: {
  active: boolean
  onClick: () => void
  onHover: () => void
  icon: React.ReactNode
  title: string
  sub: string
  badge: string
}) {
  return (
    <div
      onClick={onClick}
      onMouseEnter={onHover}
      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer text-[12.5px] ${
        active ? 'bg-[#fafaf9]' : ''
      }`}
    >
      <span className="w-[18px] flex items-center justify-center">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{title}</div>
        <div className="text-[10px] text-[#888] truncate">{sub}</div>
      </div>
      {badge && (
        <span className="text-[9.5px] text-[#888] font-display tracking-[0.04em]">
          {badge}
        </span>
      )}
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-[#fafaf9] border border-[#e8e8e6] rounded-[3px] px-1.5 py-0.5 font-mono text-[9px]">
      {children}
    </span>
  )
}
