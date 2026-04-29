'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  value: string | number | null
  onSave: (newValue: string) => Promise<{ success: boolean; error?: string }>
  type?: 'text' | 'number' | 'date' | 'select'
  format?: (v: string | number | null) => string
  className?: string
  disabled?: boolean
  placeholder?: string
  align?: 'left' | 'right'
  // type='select' の場合のみ使用。空文字を許可する場合は ['', ...] を渡す。
  options?: Array<{ value: string; label: string }>
  // type='text' の場合、サジェスト候補 (datalist 経由)
  suggestions?: string[]
  // Sprint 7-3-4: キーボード移動用に DOM へ data-col attr を出す。
  // Enter で「同じ data-col を持つ次の <tr> 内の cell」へフォーカス移動。
  dataCol?: string
}

export function InlineCell({
  value,
  onSave,
  type = 'text',
  format,
  className = '',
  disabled = false,
  placeholder = '-',
  align = 'left',
  options,
  suggestions,
  dataCol,
}: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value == null ? '' : String(value))
  const [pending, startSave] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // Refs: button (display mode), input (text/number/date), select (select mode)
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>(null)

  // 一意な datalist id (suggestions を使う text 入力用)
  const listId = useRef(`il-${Math.random().toString(36).slice(2, 9)}`)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      if (inputRef.current instanceof HTMLInputElement) inputRef.current.select()
    }
  }, [editing])

  useEffect(() => {
    setDraft(value == null ? '' : String(value))
  }, [value])

  const display = format ? format(value) : value == null ? '' : String(value)

  /**
   * Sprint 7-3-4: 編集確定後の次セルフォーカス移動。
   * direction='down': 同じ data-col を持つ次の <tr> 内の cell を探して focus。
   * 商品ヘッダー行など data-col を持たない行はスキップして次データ行へ。
   * Tab はブラウザのネイティブ focus 移動を使うので、ここでは扱わない (preventDefault しない)。
   */
  const focusNextDown = () => {
    if (!dataCol) return
    const el = inputRef.current
    if (!el) return
    const tr = el.closest('tr')
    if (!tr) return
    let next: Element | null = tr.nextElementSibling
    while (next) {
      const target = next.querySelector(`[data-col="${dataCol}"]`) as HTMLElement | null
      if (target) {
        target.focus()
        return
      }
      next = next.nextElementSibling
    }
  }

  const commit = (nextValue?: string, moveDown = false) => {
    const sendVal = nextValue !== undefined ? nextValue : draft
    if (sendVal === (value == null ? '' : String(value))) {
      setEditing(false)
      setError(null)
      if (moveDown) setTimeout(focusNextDown, 0)
      return
    }
    setError(null)
    startSave(async () => {
      const r = await onSave(sendVal)
      if (!r.success) {
        setError(r.error || 'エラー')
        return
      }
      setEditing(false)
      router.refresh()
      if (moveDown) setTimeout(focusNextDown, 30)
    })
  }

  const cancel = () => {
    setDraft(value == null ? '' : String(value))
    setEditing(false)
    setError(null)
  }

  const alignClass = align === 'right' ? 'text-right' : 'text-left'

  if (disabled) {
    return (
      <span className={`block px-1.5 py-0.5 text-[#888] ${alignClass} ${className}`}>
        {display || placeholder}
      </span>
    )
  }

  // ----- select モード: ドロップダウンですぐ commit -----
  if (editing && type === 'select' && options) {
    return (
      <select
        ref={inputRef as React.RefObject<HTMLSelectElement>}
        value={draft}
        onChange={(e) => {
          const v = e.target.value
          setDraft(v)
          commit(v) // select は変更即 commit
        }}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') cancel()
        }}
        disabled={pending}
        data-col={dataCol}
        className={`block w-full px-1.5 py-1 text-[11px] font-body bg-[#fffaf2] border border-[#e5a32e] rounded-[2px] focus:outline-none ${alignClass} ${className}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label || '(未指定)'}
          </option>
        ))}
      </select>
    )
  }

  // ----- text/number/date モード -----
  if (editing) {
    return (
      <>
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              // Sprint 7-3-4: Enter で commit + 次セル下へフォーカス移動
              e.preventDefault()
              commit(undefined, true)
            } else if (e.key === 'Tab') {
              // Sprint 7-3-4: Tab はブラウザの自然 focus 移動を使う。
              // preventDefault しない、blur イベントが先に走り commit() される。
              // Shift+Tab は仕様書通り後送り (現状はブラウザのネイティブ動作のまま)。
            } else if (e.key === 'Escape') {
              cancel()
            }
          }}
          disabled={pending}
          list={suggestions && suggestions.length ? listId.current : undefined}
          data-col={dataCol}
          className={`block w-full px-1.5 py-1 text-[11px] font-body bg-[#fffaf2] border border-[#e5a32e] rounded-[2px] focus:outline-none ${alignClass} ${className} ${
            error ? 'border-[#cf5a3a]' : ''
          }`}
          title={error || ''}
        />
        {suggestions && suggestions.length > 0 && (
          <datalist id={listId.current}>
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        )}
      </>
    )
  }

  return (
    <button
      ref={inputRef as React.RefObject<HTMLButtonElement>}
      type="button"
      onClick={() => setEditing(true)}
      onKeyDown={(e) => {
        // フォーカスされた状態で Enter / Space → 編集モードへ (Sprint 7-3-4)
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setEditing(true)
        }
      }}
      data-col={dataCol}
      className={`block w-full px-1.5 py-1 text-[11px] font-body cursor-text hover:bg-[#fafaf8] hover:ring-1 hover:ring-[#e8e8e6] focus:bg-[#fafaf8] focus:ring-1 focus:ring-[#e5a32e] focus:outline-none rounded-[2px] ${alignClass} ${className}`}
    >
      {display || <span className="text-[#bbb]">{placeholder}</span>}
    </button>
  )
}
