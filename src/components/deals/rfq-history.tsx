'use client'
import { useState } from 'react'
import { listRfqHistory } from '@/lib/actions/rfq-v2'
import { rfqDimensions, rfqEmailStatus } from '@/lib/deals/rfq-preview'
export function RfqHistory({ dealId }: { dealId: string }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listRfqHistory>>>([]), [loading, setLoading] = useState(false), [error, setError] = useState('')
  const load = async () => { setLoading(true); setError(''); try { setRows(await listRfqHistory(dealId)) } catch { setError('履歴を取得できませんでした') } finally { setLoading(false) } }
  return <details className="mt-3 rounded-card border border-[#E2E1DA] bg-white p-3" onToggle={e => { if (e.currentTarget.open) void load() }}><summary className="min-h-11 text-[13px] font-bold cursor-pointer">依頼履歴・送信状態を確認</summary>
    {loading ? <p role="status">履歴を読込中…</p> : error ? <p role="alert">{error}<button type="button" onClick={load} className="min-h-11 underline ml-2">再読込</button></p> : !rows.length ? <p className="text-[12px]">依頼は未作成です。商品と工場を選んで依頼内容を確認してください。</p> : rows.map(r => <section key={r.id} className="border-t border-[#E2E1DA] py-3 text-[12px]"><p className="font-bold">{r.rfq_number} · {r.status === 'fully_responded' ? '全工場の回答記録あり' : r.status === 'partially_responded' ? '一部回答あり' : r.status === 'open' ? '回答受付中' : r.status}</p><p>回答期限: {r.response_deadline || '指定なし'}</p>{r.invitations.map(i => <details key={i.id} className="mt-2"><summary className="min-h-11 cursor-pointer">{i.name} · {i.response} · {rfqEmailStatus(i.email)}</summary><p>依頼仕様形式 v{i.version}（過去の依頼は保持）</p>{i.lines.length ? i.lines.map(l => <p key={l.variant_id}>{l.product_description} / {l.variant_label} · {rfqDimensions(l)} mm · {l.material || '素材未登録'} · 数量 {l.quantities.join(' / ')}</p>) : <p>依頼当時の仕様記録が不足しています。推測補完せず、新しいRFQを作成してください。</p>}</details>)}</section>)}
  </details>
}
