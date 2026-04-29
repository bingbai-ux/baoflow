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
}: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value == null ? '' : String(value))
  const [pending, startSave] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null)

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

  const commit = (nextValue?: string) => {
    const sendVal = nextValue !== undefined ? nextValue : draft
    if (sendVal === (value == null ? '' : String(value))) {
      setEditing(false)
      setError(null)
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
              e.preventDefault()
              commit()
            } else if (e.key === 'Escape') {
              cancel()
            }
          }}
          disabled={pending}
          list={suggestions && suggestions.length ? listId.current : undefined}
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
      type="button"
      onClick={() => setEditing(true)}
      className={`block w-full px-1.5 py-1 text-[11px] font-body cursor-text hover:bg-[#fafaf8] hover:ring-1 hover:ring-[#e8e8e6] rounded-[2px] ${alignClass} ${className}`}
    >
      {display || <span className="text-[#bbb]">{placeholder}</span>}
    </button>
  )
}
