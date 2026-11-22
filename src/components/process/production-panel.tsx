'use client'

// 再設計 工程7: サンプル製造（必要な案件だけ）と本製造。完成まであと何日か・到着目安を常に出す。

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { saveProduction, type DealProduction, type ProductionAction, type SampleRound } from '@/lib/actions/deal-production'
import { deleteDesignImage } from '@/lib/actions/designs'
import { uploadProcessFiles } from '@/lib/process/upload'
import { useUi } from '@/components/ui/ui-store'

export interface ProductionFile { id: string; category: string; name: string; url: string; sizeBytes: number | null; createdAt: string }

const ghost = 'min-h-[44px] inline-flex items-center justify-center rounded-full border border-[#E2E1DA] bg-white px-4 text-[12px] font-bold text-[#351E28] hover:bg-[#FBFAF6] disabled:opacity-40'
const dark = 'min-h-[44px] inline-flex items-center justify-center rounded-full bg-[#351E28] px-4 text-[12px] font-bold text-[#C9A2B8] hover:brightness-95 disabled:opacity-40'
const main = 'min-h-[44px] inline-flex items-center justify-center rounded-full bg-[#E9F056] px-5 text-[12.5px] font-extrabold text-[#666C14] hover:brightness-95 disabled:opacity-40'
const link = 'min-h-[44px] inline-flex items-center px-2 text-[12px] underline disabled:opacity-40'
const pill = 'rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap'
const field = 'min-h-[44px] rounded-[12px] border border-transparent bg-[#EFEFEA] px-3 text-[14px] tabular-nums text-[#351E28] outline-none focus:border-[#351E28]'
const day = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric' }) : ''
const ymd = (d: string | null) => d ? d.replace(/-/g, '/') : ''
const size = (n: number | null) => n == null ? '' : n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`
const stamp = (d: string) => Date.parse(d + 'T00:00:00Z')
export const addDays = (d: string, n: number) => new Date(stamp(d) + n * 86400000).toISOString().slice(0, 10)
export const diffDays = (from: string, to: string) => Math.round((stamp(to) - stamp(from)) / 86400000)

export function ProductionPanel({ dealId, production, files, sampleRequired, intakeStarted, desiredDate, today, readOnly }: {
  dealId: string; production: DealProduction; files: ProductionFile[]; sampleRequired: boolean; intakeStarted: boolean; desiredDate: string | null; today: string; readOnly?: boolean
}) {
  const router = useRouter()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const [expectedOn, setExpectedOn] = useState('')
  const [startedOn, setStartedOn] = useState(production.startedOn || today)
  const [dueOn, setDueOn] = useState(production.dueOn || '')
  const [transit, setTransit] = useState(production.transitDays == null ? '' : String(production.transitDays))
  const [ask, setAsk] = useState<'approve' | 'revise' | 'finish' | null>(null)
  const [feedback, setFeedback] = useState('')
  const [editing, setEditing] = useState(false)

  const { rounds } = production
  const current = rounds.length ? rounds[rounds.length - 1] : null
  const open = current && !current.result ? current : null
  const approved = rounds.some(r => r.result === 'approved')
  const started = !!production.startedOn, finished = !!production.finishedAt
  const locked = readOnly || !intakeStarted || finished
  const canStartSample = !started && !open && !approved // サンプル不要の案件でも、希望があれば依頼できる
  const canStartProduction = !started && !open && (!sampleRequired || approved)
  const transitN = /^\d{1,3}$/.test(transit) ? Number(transit) : null
  const arrival = production.dueOn && production.transitDays != null ? addDays(production.dueOn, production.transitDays) : null
  const left = production.dueOn ? diffDays(today, production.dueOn) : null
  const margin = arrival && desiredDate ? diffDays(arrival, desiredDate) : null // 正: 希望納期より前に着く

  const run = (action: ProductionAction, payload: Record<string, unknown>, done: string, after?: () => void) => { setAsk(null); setError(null); startTransition(async () => {
    const r = await saveProduction(dealId, action, payload)
    if (r.error) { setError(r.error); return }
    after?.(); toast(done); router.refresh()
  }) }
  const upload = (category: string) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []); e.target.value = ''
    if (!picked.length) return
    setError(null); setUploading(category)
    try { toast(`${await uploadProcessFiles(dealId, category, picked)}件のファイルを登録しました`) } catch (err) { setError(err instanceof Error ? err.message : 'アップロードできませんでした') } finally { setUploading(null); router.refresh() }
  }
  const remove = (f: ProductionFile) => { setError(null); startTransition(async () => {
    const r = await deleteDesignImage(f.id)
    if (!r.success) { setError(r.error || '削除できませんでした'); return }
    toast('ファイルを削除しました'); router.refresh()
  }) }
  const fileList = (category: string, title: string, editable: boolean) => {
    const list = files.filter(f => f.category === category)
    return (
      <div className="mt-2 rounded-[12px] border border-[#E2E1DA] bg-[#FBFAF6] p-3">
        <ul aria-label={title} className="space-y-1">
          {list.map(f => (
            <li key={f.id} className="flex flex-wrap items-center gap-x-2 text-[12.5px]">
              <a href={f.url} target="_blank" rel="noreferrer" className="min-w-0 break-all font-bold underline">{f.name}</a>
              <span className="text-[11px] text-[#84787D] tabular-nums">{size(f.sizeBytes)}</span>
              <button type="button" className={link} onClick={() => navigator.clipboard?.writeText(f.url).then(() => toast('リンクをコピーしました'))}>リンクをコピー</button>
              {editable && !locked && <button type="button" disabled={pending} aria-label={`${f.name} を削除`} className={link + ' text-[#B03616]'} onClick={() => remove(f)}>削除</button>}
            </li>
          ))}
          {!list.length && <li className="text-[12.5px] text-[#84787D]">{title}はまだありません</li>}
        </ul>
        {editable && !locked && <label className={ghost + ' mt-2 cursor-pointer' + (uploading ? ' opacity-40' : '')}>{uploading === category ? 'アップロード中…' : `${title}を登録`}
          <input type="file" multiple disabled={!!uploading} aria-label={`${title}を選ぶ`} className="sr-only" onChange={upload(category)} /></label>}
      </div>
    )
  }
  const roundBadge = (r: SampleRound) => r.result === 'approved' ? <span className={pill + ' bg-[#D7EFFF] text-[#33566F]'}>承認 {day(r.decidedAt)}</span>
    : r.result === 'revise' ? <span className={pill + ' bg-[#FFD8C2] text-[#B03616]'}>修正 {day(r.decidedAt)}</span>
    : <span className={pill + ' bg-[#FFD8C2] text-[#B03616]'}>{!r.completedAt ? `工場で製作中${r.expectedOn ? `（完成予定 ${ymd(r.expectedOn)}）` : ''}` : !r.sharedAt ? '顧客へ渡す前' : '顧客の返事待ち'}</span>

  return (
    <section aria-label="サンプルと本製造" className="space-y-3">
      {!intakeStarted && <p className="rounded-[16px] border border-[#E2E1DA] bg-[#FBFAF6] p-3 text-[12.5px]">入稿と前払いを済ませて「製作開始へ進む」を押すと始められます<Link href={`/deals/${dealId}?step=9`} className="ml-2 underline">入稿を開く</Link></p>}
      {error && <p role="alert" className="rounded-[16px] border-[1.5px] border-[#FF5C34] bg-[#FFD8C2] p-3 text-[12.5px] text-[#B03616] break-words">{error}</p>}

      <div className="rounded-[16px] border border-[#E2E1DA] bg-white p-4">
        <h3 className="flex flex-wrap items-center gap-2 text-[15px] font-bold"><span className="tabular-nums text-[#84787D]">1</span>サンプル
          {approved ? <span className={pill + ' bg-[#D7EFFF] text-[#33566F]'}>承認済み</span> : open ? null : sampleRequired ? <span className={pill + ' bg-[#FFD8C2] text-[#B03616]'}>必要</span> : <span className={pill + ' border border-[#E2E1DA] bg-[#EFEFEA] text-[#351E28]'}>なし</span>}</h3>
        <ol aria-label="サンプルの回" className="mt-2 space-y-2">
          {rounds.map(r => (
            <li key={r.id} className="rounded-[12px] border border-[#E2E1DA] p-3">
              <p className="flex flex-wrap items-center gap-2 text-[13px] font-bold">第{r.round}回 {roundBadge(r)}</p>
              {r.feedback && <p className="mt-1 break-words text-[12.5px]"><span className="text-[#84787D]">修正の内容: </span>{r.feedback}</p>}
              {fileList(`sample_r${r.round}`, `第${r.round}回の写真・動画`, r === open && !r.completedAt)}
              {(r.result === 'revise' || files.some(f => f.category === `sample_fix_r${r.round}`)) && fileList(`sample_fix_r${r.round}`, `第${r.round}回の修正データ`, r.result === 'revise' && r === current && !started)}
              {r === open && !locked && (
                <div className="mt-2 flex flex-wrap justify-end gap-2">
                  {!r.completedAt && <button type="button" disabled={pending || !!uploading || !files.some(f => f.category === `sample_r${r.round}`)} className={dark} onClick={() => run('sample_done', {}, '記録しました')}>工場から受け取った</button>}
                  {r.completedAt && !r.sharedAt && <button type="button" disabled={pending} className={dark} onClick={() => run('sample_shared', {}, '記録しました')}>顧客へ渡した</button>}
                  {r.sharedAt && <><button type="button" disabled={pending} className={ghost} onClick={() => { setFeedback(''); setAsk('revise') }}>修正の指示があった</button>
                    <button type="button" disabled={pending} className={dark} onClick={() => setAsk('approve')}>顧客が承認した</button></>}
                </div>
              )}
            </li>
          ))}
        </ol>
        {!locked && canStartSample && (
          <div className="mt-2 flex flex-wrap items-end justify-end gap-2">
            <label className="text-[11px] text-[#84787D]">サンプルの完成予定日<br /><input type="date" value={expectedOn} min={today} onChange={e => setExpectedOn(e.target.value)} className={field} /></label>
            <button type="button" disabled={pending || !expectedOn} className={sampleRequired || rounds.length ? dark : ghost} onClick={() => run('sample_start', { expected_on: expectedOn }, `第${rounds.length + 1}回サンプルを依頼しました`, () => setExpectedOn(''))}>第{rounds.length + 1}回サンプルを依頼</button>
          </div>
        )}
      </div>

      <div className="rounded-[16px] border border-[#E2E1DA] bg-white p-4">
        <h3 className="flex flex-wrap items-center gap-2 text-[15px] font-bold"><span className="tabular-nums text-[#84787D]">2</span>本製造
          {finished ? <span className={pill + ' bg-[#D7EFFF] text-[#33566F]'}>製造完了 {day(production.finishedAt)}</span> : started ? <span className={pill + ' bg-[#FFD8C2] text-[#B03616]'}>製造中</span> : <span className={pill + ' border border-[#E2E1DA] bg-[#EFEFEA] text-[#351E28]'}>{canStartProduction ? '未開始' : 'サンプルの承認後'}</span>}</h3>
        {started && (
          <dl aria-label="製造の予定" className="mt-3 grid gap-2 sm:grid-cols-3">
            <div className={`rounded-[16px] p-3 ${!finished && left != null && left < 0 ? 'border-[1.5px] border-[#FF5C34] bg-[#FFD8C2] text-[#B03616]' : 'bg-[#D7EFFF] text-[#33566F]'}`}><dt className="text-[11px]">完成予定 {ymd(production.dueOn)}</dt>
              <dd className="text-[24px] font-extrabold tabular-nums">{finished ? '完了' : left == null ? '—' : left < 0 ? `${-left}日 超過` : left === 0 ? '今日' : `あと ${left}日`}</dd></div>
            <div className="rounded-[16px] bg-[#D7EFFF] p-3 text-[#33566F]"><dt className="text-[11px]">到着目安（完成 + {production.transitDays}日）</dt><dd className="text-[24px] font-extrabold tabular-nums">{ymd(arrival)}</dd></div>
            <div className={`rounded-[16px] p-3 ${margin != null && margin < 0 ? 'border-[1.5px] border-[#FF5C34] bg-[#FFD8C2] text-[#B03616]' : 'bg-[#D7EFFF] text-[#33566F]'}`}><dt className="text-[11px]">希望納期 {desiredDate ? ymd(desiredDate) : '未設定'}</dt>
              <dd className="text-[24px] font-extrabold tabular-nums">{margin == null ? '—' : margin < 0 ? `${-margin}日 遅れ` : margin === 0 ? '当日着' : `${margin}日前に着`}</dd></div>
          </dl>
        )}
        {!locked && (!started || editing) && (
          <div className="mt-3 flex flex-wrap items-end justify-end gap-2">
            {!started && <label className="text-[11px] text-[#84787D]">開始日<br /><input type="date" value={startedOn} onChange={e => setStartedOn(e.target.value)} className={field} /></label>}
            <label className="text-[11px] text-[#84787D]">完成予定日<br /><input type="date" value={dueOn} min={started ? production.startedOn! : startedOn} onChange={e => setDueOn(e.target.value)} className={field} /></label>
            <label className="text-[11px] text-[#84787D]">完成から到着までの日数<br /><input inputMode="numeric" value={transit} onChange={e => setTransit(e.target.value.replace(/\D/g, '').slice(0, 3))} className={field + ' w-[96px] text-right'} /></label>
            {started
              ? <><button type="button" className={ghost} onClick={() => setEditing(false)}>やめる</button><button type="button" disabled={pending || !dueOn || transitN == null} className={dark} onClick={() => run('production_update', { due_on: dueOn, transit_days: transitN }, '予定を変更しました', () => setEditing(false))}>予定を変更する</button></>
              : <button type="button" disabled={pending || !canStartProduction || !startedOn || !dueOn || transitN == null || dueOn < startedOn} className={dark} onClick={() => run('production_start', { started_on: startedOn, due_on: dueOn, transit_days: transitN }, '本製造を開始しました')}>本製造を開始</button>}
          </div>
        )}
        {!locked && started && !editing && (
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button type="button" disabled={pending} className={ghost} onClick={() => setEditing(true)}>予定を直す</button>
            <button type="button" disabled={pending} className={main} onClick={() => setAsk('finish')}>製造完了 → 発送へ進む</button>
          </div>
        )}
      </div>

      {ask && (
        <div role="dialog" aria-modal="true" aria-label={{ approve: '顧客が承認した', revise: '修正の指示があった', finish: '製造完了' }[ask]} className="fixed inset-0 z-[70] flex items-center justify-center bg-[#351E28]/40 p-4">
          <div className="w-full max-w-[440px] rounded-[16px] border border-[#E2E1DA] bg-white p-4 shadow-[0_20px_50px_rgba(53,30,40,.12)]">
            <p className="text-[15px] font-bold">{{ approve: `第${open?.round}回サンプルを顧客が承認しましたか？`, revise: `第${open?.round}回サンプルの修正内容`, finish: '製造完了を記録して発送へ進みますか？' }[ask]}</p>
            {ask === 'finish' && <p className="mt-1 text-[12.5px] text-[#84787D]">進んだあとは、サンプルと製造の記録を変更できません。</p>}
            {ask === 'revise' && <label className="mt-2 block text-[11px] text-[#84787D]">顧客からの指示
              <textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={3} maxLength={2000} className="mt-1 w-full rounded-[12px] border border-transparent bg-[#EFEFEA] p-3 text-[14px] text-[#351E28] outline-none focus:border-[#351E28]" /></label>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={ghost} onClick={() => setAsk(null)}>やめる</button>
              {ask === 'approve' && <button type="button" className={dark} onClick={() => run('sample_result', { result: 'approved' }, '承認を記録しました')}>記録する</button>}
              {ask === 'revise' && <button type="button" className={dark} disabled={!feedback.trim()} onClick={() => run('sample_result', { result: 'revise', feedback }, '修正の指示を記録しました')}>記録する</button>}
              {ask === 'finish' && <button type="button" className={dark} onClick={() => run('production_finish', {}, '発送へ進みました')}>進む</button>}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
