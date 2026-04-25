'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  value: string | number | null
  onSave: (newValue: string) => Promise<{ success: boolean; error?: string }>
  type?: 'text' | 'number' | 'date'
  format?: (v: string | number | null) => string
  className?: string
  disabled?: boolean
  placeholder?: string
  align?: 'left' | 'right'
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
}: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value == null ? '' : String(value))
  const [pending, startSave] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  useEffect(() => {
    setDraft(value == null ? '' : String(value))
  }, [value])

  const display = format ? format(value) : value == null ? '' : String(value)

  const commit = () => {
    if (draft === (value == null ? '' : String(value))) {
      setEditing(false)
      setError(null)
      return
    }
    setError(null)
    startSave(async () => {
      const r = await onSave(draft)
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

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          } else if (e.key === 'Escape') {
            cancel()
          }
        }}
        disabled={pending}
        className={`block w-full px-1.5 py-0.5 text-[10px] font-body bg-[#fffaf2] border border-[#e5a32e] rounded-[2px] focus:outline-none ${alignClass} ${className} ${
          error ? 'border-[#cf5a3a]' : ''
        }`}
        title={error || ''}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`block w-full px-1.5 py-0.5 text-[10px] font-body cursor-text hover:bg-[#fafaf8] hover:ring-1 hover:ring-[#e8e8e6] rounded-[2px] ${alignClass} ${className}`}
    >
      {display || <span className="text-[#bbb]">{placeholder}</span>}
    </button>
  )
}
