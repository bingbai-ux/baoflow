'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { importPendingRfqAnswer, listPendingRfqAnswers, type PendingRfqAnswer } from '@/lib/actions/rfq'

export function PendingRfqAnswers({ dealId }: { dealId: string }) {
  const router = useRouter()
  const [answers, setAnswers] = useState<PendingRfqAnswer[]>([])
  const [factories, setFactories] = useState<Array<{ id: string; factory_name: string }>>([])
  const [selection, setSelection] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    listPendingRfqAnswers(dealId).then(({ answers: a, factories: f }) => {
      if (active) { setAnswers(a); setFactories(f); setLoaded(true) }
    }).catch(() => { if (active) setError('未登録工場の回答を読込めませんでした') })
    return () => { active = false }
  }, [dealId, revision])
  const importAnswer = (answer: PendingRfqAnswer) => {
    if (pending || !selection[answer.invitationId]) return
    startTransition(async () => {
      setError(null); setMessage(null)
      try {
        const result = await importPendingRfqAnswer(dealId, answer.invitationId, selection[answer.invitationId])
        if (result.error) { setError(result.error); return }
        setMessage('保存済み回答を見積に取り込みました。数量と仕様は依頼時の記録を保持しています。')
        setRevision(v => v + 1); router.refresh()
      } catch { setError('取込結果を確認できませんでした。同じ登録工場で再試行してください') }
    })
  }
  return <div className="mt-3 text-[12px]">
    <button type="button" disabled={pending} onClick={() => { setError(null); setRevision(v => v + 1) }} className="min-h-11 rounded-full border border-[#E2E1DA] px-3 py-2">未登録工場の回答を確認</button>
    {error && <p role="alert" className="text-[#B03616] mt-2">{error}</p>}
    {message && <p role="status" className="mt-2">{message}</p>}
    {loaded && answers.length === 0 && !error && <p className="mt-2 text-[#84787D]">取込待ちの回答はありません。</p>}
    {answers.length > 0 && <div className="mt-2 rounded-[12px] border border-[#E2E1DA] bg-[#FBFAF6] p-3 space-y-3">
      <p>未登録工場の回答は自動で紐付けません。<Link href="/master?tab=factories" className="underline">工場の基本情報を登録</Link>してから、実際の回答元を選択してください。</p>
      {answers.map(answer => <div key={answer.invitationId}>
        <p className="font-semibold">{answer.rfqNumber} · {answer.factoryName}</p>
        <label className="block mt-1">{answer.factoryName} の登録工場<select aria-label={`${answer.factoryName} の登録工場`} disabled={pending} value={selection[answer.invitationId] || ''} onChange={e => setSelection(s => ({ ...s, [answer.invitationId]: e.target.value }))} className="block min-h-11 w-full border border-[#E2E1DA] rounded-[8px] p-2 bg-white">
          <option value="">回答元の登録工場を選択</option>{factories.map(f => <option key={f.id} value={f.id}>{f.factory_name}</option>)}
        </select></label>
        <button type="button" disabled={pending || !selection[answer.invitationId]} onClick={() => importAnswer(answer)} className="mt-2 min-h-11 rounded-full bg-[#351E28] text-[#C9A2B8] px-4 py-2 disabled:opacity-50">{pending ? '取込中…' : 'この工場の回答として取り込む'}</button>
      </div>)}
    </div>}
  </div>
}
