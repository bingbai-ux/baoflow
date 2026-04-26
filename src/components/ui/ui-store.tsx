'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'

export type Currency = 'JPY' | 'USD' | 'BOTH'
export type ToastTone = 'ok' | 'warn' | 'info'

interface ToastMsg {
  id: number
  msg: string
  tone: ToastTone
}

interface UiState {
  ccy: Currency
  setCcy: (c: Currency) => void
  toasts: ToastMsg[]
  toast: (msg: string, tone?: ToastTone) => void
  cmdkOpen: boolean
  openCmdk: () => void
  closeCmdk: () => void
  notifOpen: boolean
  toggleNotif: () => void
  closeNotif: () => void
}

const Ctx = createContext<UiState | null>(null)

const CCY_KEY = 'baoflow:ccy'

export function UiProvider({ children }: { children: React.ReactNode }) {
  const [ccy, setCcyState] = useState<Currency>('JPY')
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  const [cmdkOpen, setCmdkOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)

  // Restore ccy from localStorage
  useEffect(() => {
    try {
      const v = localStorage.getItem(CCY_KEY) as Currency | null
      if (v === 'JPY' || v === 'USD' || v === 'BOTH') setCcyState(v)
    } catch {}
  }, [])

  const setCcy = useCallback((c: Currency) => {
    setCcyState(c)
    try {
      localStorage.setItem(CCY_KEY, c)
    } catch {}
  }, [])

  const toast = useCallback((msg: string, tone: ToastTone = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, msg, tone }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 2500)
  }, [])

  const openCmdk = useCallback(() => setCmdkOpen(true), [])
  const closeCmdk = useCallback(() => setCmdkOpen(false), [])
  const toggleNotif = useCallback(() => setNotifOpen((v) => !v), [])
  const closeNotif = useCallback(() => setNotifOpen(false), [])

  // Global keyboard: Cmd+K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCmdkOpen((v) => !v)
      }
      if (e.key === 'Escape') {
        if (cmdkOpen) setCmdkOpen(false)
        if (notifOpen) setNotifOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cmdkOpen, notifOpen])

  return (
    <Ctx.Provider
      value={{
        ccy,
        setCcy,
        toasts,
        toast,
        cmdkOpen,
        openCmdk,
        closeCmdk,
        notifOpen,
        toggleNotif,
        closeNotif,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useUi(): UiState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useUi must be used within UiProvider')
  return v
}
