'use client'

import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { SIMPLE_STATUS_CONFIG, type SimpleStatus } from '@/lib/types'
import { formatJPY, formatDate } from '@/lib/utils/format'
import { waitingLabel, type approvedAmount, type caseAction } from '@/lib/deals/case-workspace'

export interface CaseListRow {
  id: string; deal_code: string; deal_name: string | null; client_name_text: string | null
  desired_delivery_date: string | null; simple_status: SimpleStatus; waiting_on: string | null
  last_activity_at: string | null; sales_user_id: string | null; owner: string | null
  amount: ReturnType<typeof approvedAmount>; action: ReturnType<typeof caseAction>
}
const views = [{ key: 'todo', label: '自分の要対応' }, { key: 'active', label: '進行中' }, { key: 'all', label: 'すべて' }, { key: 'done', label: '完了' }]
const button = 'min-h-[44px] inline-flex items-center justify-center rounded-full border border-[#E2E1DA] px-3 text-[12px] font-bold'
const rowGrid = 'lg:grid lg:grid-cols-[minmax(150px,1.4fr)_minmax(88px,.8fr)_92px_minmax(145px,1.4fr)_94px_100px_80px_48px]'
const amountText = (r: CaseListRow) => r.amount.label || formatJPY(r.amount.total)

export function CaseList({ rows, selfId, today }: { rows: CaseListRow[]; selfId: string; today: string }) {
  const params = useSearchParams(), router = useRouter()
  const q = params.get('q') || '', client = params.get('client') || '', status = params.get('status') || ''
  const view = params.get('scope') || (status === 'delivered' ? 'done' : status ? 'all' : 'active')
  const from = '/deals' + (params.toString() ? '?' + params.toString() : '')
  const preview = rows.find(r => r.id === params.get('selected'))
  const [search, setSearch] = useState(q)
  useEffect(() => { setSearch(q) }, [q])
  const update = (values: Record<string, string>) => {
    const p = new URLSearchParams(params.toString())
    p.delete('selected')
    for (const [key, value] of Object.entries(values)) { if (value) p.set(key, value); else p.delete(key) }
    router.push('/deals' + (p.size ? '?' + p.toString() : ''), { scroll: false })
  }
  const todo = (r: CaseListRow) => r.simple_status !== 'delivered' && r.sales_user_id === selfId && r.waiting_on === 'us'
  const overdue = (r: CaseListRow) => r.simple_status !== 'delivered' && !!r.desired_delivery_date && r.desired_delivery_date < today
  const filtered = rows.filter(r => {
    if (view === 'active' && r.simple_status === 'delivered' || view === 'done' && r.simple_status !== 'delivered' || view === 'todo' && !todo(r)) return false
    if (status && r.simple_status !== status) return false
    if (client === '__none__' ? !!r.client_name_text : client && r.client_name_text !== client) return false
    return !q || [r.deal_name, r.deal_code, r.client_name_text].some(v => v?.toLocaleLowerCase().includes(q.toLocaleLowerCase()))
  }).sort((a, b) => Number(overdue(b)) - Number(overdue(a)) || Number(todo(b)) - Number(todo(a)) || (a.desired_delivery_date || '9999').localeCompare(b.desired_delivery_date || '9999') || (b.last_activity_at || '').localeCompare(a.last_activity_at || ''))
  const clients = [...new Set(rows.map(r => r.client_name_text).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, 'ja'))
  const total = filtered.reduce((sum, r) => sum + r.amount.total, 0)
  const known = filtered.reduce((sum, r) => sum + r.amount.count - r.amount.missing, 0)
  const missing = filtered.filter(r => r.amount.missing > 0).length
  const remember = (id: string) => {
    try { sessionStorage.setItem('bao-case-return-v1', JSON.stringify({ path: from, top: document.getElementById('main-content')?.scrollTop || 0, id })) } catch { /* navigation works without storage */ }
  }
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('bao-case-return-v1') || 'null')
      if (saved?.path === from && Number.isFinite(saved.top)) {
        requestAnimationFrame(() => { const main = document.getElementById('main-content'); if (main) main.scrollTop = saved.top; document.getElementById('case-' + saved.id)?.focus({ preventScroll: true }) })
        sessionStorage.removeItem('bao-case-return-v1')
      }
    } catch { /* invalid old position is ignored */ }
  }, [from])
  const href = (r: CaseListRow) => `/deals/${r.id}?step=${r.action.step}&from=${encodeURIComponent(from)}`
  return <div className="py-4 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-[21px] font-extrabold">案件管理</h1><p className="text-[12px] text-[#84787D]">自分の要対応 {rows.filter(todo).length}件 · 希望納期超過 {rows.filter(overdue).length}件</p></div>
      <Link href={'/deals/new?from=' + encodeURIComponent(from)} className={button + ' bg-[#E9F056] text-[#666C14] border-transparent'}>新規案件をつくる</Link>
    </div>
    <div className="flex flex-wrap justify-between items-center gap-2">
      <nav aria-label="案件の絞り込み" className="flex flex-wrap gap-1">{views.map(v => <button key={v.key} type="button" aria-pressed={view === v.key} onClick={() => update({ scope: v.key, status: '' })} className={button + (view === v.key ? ' bg-[#351E28] text-[#C9A2B8] !border-[#351E28]' : ' bg-white')}>{v.label}</button>)}</nav>
      <details className="relative"><summary className={button + ' cursor-pointer'}>その他の操作</summary><div className="absolute z-10 right-0 mt-1 min-w-[180px] rounded-card border border-[#E2E1DA] bg-white p-2 space-y-1"><Link href={'/deals?view=grid' + (client ? '&client=' + encodeURIComponent(client) : '')} className={button + ' w-full'}>商品グリッドを開く</Link><Link href="/archive" className={button + ' w-full'}>アーカイブを見る</Link></div></details>
    </div>
    <form onSubmit={e => { e.preventDefault(); update({ q: search.trim() }) }} className="flex flex-wrap gap-2">
      <label className="flex-1 min-w-[180px]"><span className="sr-only">案件名・番号・取引先で検索</span><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="案件名・番号・取引先で検索" className="w-full min-h-[44px] rounded-input border border-[#E2E1DA] bg-white px-3 text-[13px]" /></label>
      <button className={button} type="submit">検索</button>
      <label><span className="sr-only">取引先で絞り込む</span><select value={client} onChange={e => update({ client: e.target.value })} className="max-w-full min-h-[44px] rounded-input border border-[#E2E1DA] bg-white px-3 text-[12px]"><option value="">すべての取引先</option>{clients.map(c => <option key={c}>{c}</option>)}<option value="__none__">取引先未設定</option></select></label>
      {(q || client || status) && <button type="button" onClick={() => { setSearch(''); update({ q: '', client: '', status: '' }) }} className={button}>検索・絞込を解除</button>}
    </form>
    <p aria-live="polite" className="text-[12px] text-[#84787D]">{filtered.length}件 · 採用額（税込・登録済み分）{known ? formatJPY(total) : '登録済み採用額なし'}{missing ? ` · 金額未登録 ${missing}案件` : ''} · 未採用 {filtered.filter(r => !r.amount.count).length}案件</p>
    <div className="rounded-card border border-[#E2E1DA] bg-white overflow-hidden" role="table" aria-label="案件一覧">
      <div role="row" className={rowGrid + ' hidden bg-[#FBFAF6] border-b border-[#E2E1DA] text-[11px] text-[#84787D]'}>{['案件名・番号', '取引先', '現在の工程', '次の対応・待ち先', '希望納期', '採用額（税込）', '担当', '概要'].map(t => <div role="columnheader" key={t} className="p-3">{t}</div>)}</div>
      {filtered.map(r => <div role="row" key={r.id} className={rowGrid + ' grid grid-cols-2 gap-x-3 lg:gap-0 p-3 lg:p-0 border-b last:border-0 border-[#E2E1DA] hover:bg-[#FBFAF6]'}>
        <div role="cell" className="col-span-2 lg:col-span-1 lg:p-3"><Link id={'case-' + r.id} href={href(r)} onClick={() => remember(r.id)} className="block text-[13px] font-bold underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2"><span>{r.deal_name || '案件名未設定'}</span><span className="block text-[11px] text-[#84787D] font-normal tabular-nums mt-1">{r.deal_code}</span></Link></div>
        <div role="cell" className="lg:p-3 text-[12px] break-words">{r.client_name_text || <span className="text-[#B03616]">取引先未設定</span>}</div>
        <div role="cell" className="lg:p-3 text-[11px]"><span className="inline-block rounded-full bg-[#D7EFFF] text-[#33566F] px-2 py-1">{SIMPLE_STATUS_CONFIG[r.simple_status]?.label || '工程未設定'}</span></div>
        <div role="cell" className="col-span-2 lg:col-span-1 py-2 lg:p-3 text-[12px]"><Link href={href(r)} onClick={() => remember(r.id)} className="font-bold underline-offset-4 hover:underline">{r.action.label}</Link><span className="block text-[11px] text-[#84787D] mt-1">{waitingLabel(r.waiting_on)}</span></div>
        <div role="cell" className={'lg:p-3 text-[12px] tabular-nums ' + (overdue(r) ? 'text-[#B03616]' : '')}><span className="lg:hidden text-[11px] text-[#84787D]">希望納期 </span>{r.desired_delivery_date ? formatDate(r.desired_delivery_date) : '未設定'}{overdue(r) && <span className="block text-[11px]">期限超過</span>}</div>
        <div role="cell" className="lg:p-3 text-[12px] tabular-nums"><span className="lg:hidden text-[11px] text-[#84787D]">採用額 </span>{amountText(r)}{r.amount.missing > 0 && <span className="block text-[11px] text-[#84787D]">{r.amount.missing}件不足</span>}</div>
        <div role="cell" className="lg:p-3 text-[12px]"><span className="lg:hidden text-[11px] text-[#84787D]">担当 </span>{r.owner || '未設定'}</div>
        <div role="cell" className="lg:px-1 lg:py-2"><button type="button" aria-label={`${r.deal_name || r.deal_code}の概要`} className="min-h-[44px] px-1 text-[11px] underline" onClick={() => update({ selected: r.id })}>概要</button></div>
      </div>)}
      {!filtered.length && <div className="p-8 text-center text-[13px]">{rows.length ? '条件に一致する案件がありません。絞り込みを変更してください。' : 'まだ案件がありません。新規案件から始めてください。'}</div>}
    </div>
    {preview && <section aria-label="案件の概要" className="rounded-card border border-[#E2E1DA] bg-white p-4"><div className="flex justify-between gap-3"><h2 className="text-[15px] font-bold">{preview.deal_name || preview.deal_code}</h2><button type="button" onClick={() => update({ selected: '' })} className={button}>概要を閉じる</button></div><dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px] my-3"><div><dt className="text-[#84787D]">現在の工程</dt><dd>{SIMPLE_STATUS_CONFIG[preview.simple_status]?.label}</dd></div><div><dt className="text-[#84787D]">担当・待ち先</dt><dd>{preview.owner || '未設定'} / {waitingLabel(preview.waiting_on)}</dd></div><div><dt className="text-[#84787D]">希望納期</dt><dd>{preview.desired_delivery_date ? formatDate(preview.desired_delivery_date) : '未設定'}</dd></div><div><dt className="text-[#84787D]">採用額（税込）</dt><dd>{amountText(preview)}</dd></div></dl><p className="text-[12px] text-[#84787D] mb-3">{preview.action.reason}</p><Link href={href(preview)} onClick={() => remember(preview.id)} className={button}>作業画面を開く</Link></section>}
  </div>
}
