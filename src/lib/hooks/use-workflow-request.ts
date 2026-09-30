'use client'
import { useCallback, useEffect, useState } from 'react'
import { recoverWorkflowRequest, type RecoverableOperation } from '@/lib/actions/workflow-recovery'
import { persistentRequestId, readPendingRequest, workflowRequestKey } from '@/lib/utils/request-key'

export function useWorkflowRequest(scope: string, operation: RecoverableOperation, dealId?: string) {
  const [key, setKey] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [unfinished, setUnfinished] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recovered, setRecovered] = useState<Record<string, unknown> | null>(null)
  useEffect(() => {
    let cancelled = false
    setReady(false)
    setError(null)
    setRecovered(null)
    void (async () => {
      try {
        const actor = await recoverWorkflowRequest(operation)
        if (actor.error || !actor.actorId) throw new Error(actor.error || 'ログインしてください')
        const storageKey = workflowRequestKey(actor.actorId, scope)
        const previous = readPendingRequest(sessionStorage, storageKey)
        const saved = previous ? await recoverWorkflowRequest(operation, previous.id, dealId) : null
        if (saved?.error) throw new Error(saved.error)
        if (!cancelled) { setKey(storageKey); setRecovered(saved?.result || null); setUnfinished(!!previous); setReady(true) }
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : '前回の保存結果を確認できません') }
    })()
    return () => { cancelled = true }
  }, [scope, operation, dealId])
  const complete = useCallback(() => { if (key) sessionStorage.removeItem(key); setUnfinished(false); setRecovered(null) }, [key])
  return { ready: ready && !!key?.endsWith(`:${scope}`), unfinished, error, recovered, complete,
    requestId: async (payload: unknown) => {
      if (!ready || !key || !key.endsWith(`:${scope}`)) throw new Error('前回の保存結果の確認を待ってください')
      const id = await persistentRequestId(sessionStorage, key, payload)
      setUnfinished(true)
      return id
    },
  }
}
