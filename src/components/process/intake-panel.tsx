'use client'

// 再設計 工程6: 入稿（BAO が受け取って相手へ渡し、受け渡しを記録する）と、工場への前払い → 製作開始へ。

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { registerIntakeFile, saveIntake, type DealIntake, type IntakeKind, type IntakeStep } from '@/lib/actions/deal-intake'
import { deleteDesignImage } from '@/lib/actions/designs'
import { useUi } from '@/components/ui/ui-store'

export interface IntakeFile { id: string; kind: IntakeKind; name: string; url: string; sizeBytes: number | null; createdAt: string }

const ghost = 'min-h-[44px] inline-flex items-center justify-center rounded-full border border-[#E2E1DA] bg-white px-4 text-[12px] font-bold text-[#351E28] hover:bg-[#FBFAF6] disabled:opacity-40'
const dark = 'min-h-[44px] inline-flex items-center justify-center rounded-full bg-[#351E28] px-4 text-[12px] font-bold text-[#C9A2B8] hover:brightness-95 disabled:opacity-40'
const main = 'min-h-[44px] inline-flex items-center justify-center rounded-full bg-[#E9F056] px-5 text-[12.5px] font-extrabold text-[#666C14] hover:brightness-95 disabled:opacity-40'
const link = 'min-h-[44px] inline-flex items-center px-2 text-[12px] underline disabled:opacity-40'
const pill = 'rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap'
const field = 'min-h-[44px] rounded-[12px] border border-transparent bg-[#EFEFEA] px-3 text-[14px] tabular-nums text-[#351E28] outline-none focus:border-[#351E28]'
const choice = (on: boolean) => 'min-h-[44px] rounded-full border px-4 text-[12px] font-bold disabled:opacity-40 ' + (on ? 'border-[#351E28] bg-[#351E28] text-[#C9A2B8]' : 'border-[#E2E1DA] bg-white text-[#351E28] hover:bg-[#FBFAF6]')
const day = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric' }) : ''
const size = (n: number | null) => n == null ? '' : n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`
const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const STEPS: Record<'customer' | 'template', IntakeStep[]> = { customer: ['artwork_received', 'artwork_sent', 'factory_ok'], template: ['template_received', 'template_sent', 'artwork_received', 'artwork_sent', 'factory_ok'] }
const LABEL: Record<IntakeStep, string> = { template_received: '工場から雛形を受け取る', template_sent: '雛形を顧客へ渡す', artwork_received: '顧客から入稿データを受け取る', artwork_sent: '入稿データを工場へ渡す', factory_ok: '工場がデータを確認' }
const FILE_OF: Partial<Record<IntakeStep, IntakeKind>> = { template_received: 'template', template_sent: 'template', artwork_received: 'artwork', artwork_sent: 'artwork' }
const MAX_BYTES = 52428800

export function IntakePanel({ dealId, intake, files, costUsd, agreed, today, readOnly }: {
  dealId: string; intake: DealIntake; files: IntakeFile[]; /** 承認済み見積の原価合計（$）。前払い額の目安に使う */ costUsd: number | null; agreed: boolean; today: string; readOnly?: boolean
}) {
  const router = useRouter()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState<IntakeKind | null>(null)
  const [paidOn, setPaidOn] = useState(today)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [ask, setAsk] = useState<'start' | null>(null)

  const locked = readOnly || !agreed || !!intake.startedAt
  const steps = intake.pattern ? STEPS[intake.pattern] : []
  const nextStep = steps.find(s => !intake.done[s]) || null
  const lastDone = [...steps].reverse().find(s => intake.done[s]) || null
  const anyDone = steps.some(s => intake.done[s])
  const suggested = costUsd && intake.prepayRate ? Math.round(costUsd * intake.prepayRate) / 100 : null
  const paid = !!intake.prepayPaidOn
  const ready = !!intake.done.factory_ok && paid

  const run = (action: Parameters<typeof saveIntake>[1], payload: Record<string, unknown>, done: string) => { setAsk(null); setError(null); startTransition(async () => {
    const r = await saveIntake(dealId, action, payload)
    if (r.error) { setError(r.error); return }
    toast(done); router.refresh()
  }) }
  const upload = (kind: IntakeKind) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []); e.target.value = ''
    if (!picked.length) return
    setError(null); setUploading(kind)
    try {
      const supabase = createClient()
      for (const file of picked) {
        if (file.size > MAX_BYTES) throw new Error(`${file.name}: ファイルが大きすぎます（50MB まで）`)
        if (file.size === 0) throw new Error(`${file.name}: 空のファイルです`)
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'file'
        const storagePath = `${dealId}/${crypto.randomUUID()}_${safe}`
        const up = await supabase.storage.from('deal-images').upload(storagePath, file, { cacheControl: '3600', upsert: false })
        if (up.error) throw new Error(`${file.name}: アップロードできませんでした`)
        const r = await registerIntakeFile(dealId, kind, { storagePath, name: file.name, size: file.size, type: file.type })
        if (r.error) throw new Error(`${file.name}: ${r.error}`)
      }
      toast(`${picked.length}件のファイルを登録しました`); router.refresh()
    } catch (err) { setError(err instanceof Error ? err.message : 'アップロードできませんでした'); router.refresh() } finally { setUploading(null) }
  }
  const remove = (f: IntakeFile) => { setError(null); startTransition(async () => {
    const r = await deleteDesignImage(f.id)
    if (!r.success) { setError(r.error || '削除できませんでした'); return }
    toast('ファイルを削除しました'); router.refresh()
  }) }

  const fileBox = (kind: IntakeKind, frozen: boolean) => {
    const list = files.filter(f => f.kind === kind), title = kind === 'template' ? '雛形' : '入稿データ'
    return (
      <div className="mt-2 rounded-[12px] border border-[#E2E1DA] bg-[#FBFAF6] p-3">
        <ul aria-label={`${title}のファイル`} className="space-y-1">
          {list.map(f => (
            <li key={f.id} className="flex flex-wrap items-center gap-x-2 text-[12.5px]">
              <a href={f.url} target="_blank" rel="noreferrer" className="min-w-0 break-all font-bold underline">{f.name}</a>
              <span className="text-[11px] text-[#84787D] tabular-nums">{size(f.sizeBytes)} ・ {day(f.createdAt)}</span>
              <button type="button" className={link} onClick={() => navigator.clipboard?.writeText(f.url).then(() => toast('リンクをコピーしました'))}>リンクをコピー</button>
              {!frozen && !locked && <button type="button" disabled={pending} aria-label={`${f.name} を削除`} className={link + ' text-[#B03616]'} onClick={() => remove(f)}>削除</button>}
            </li>
          ))}
          {!list.length && <li className="text-[12.5px] text-[#84787D]">{title}のファイルはまだありません</li>}
        </ul>
        {!locked && <label className={ghost + ' mt-2 cursor-pointer' + (uploading ? ' opacity-40' : '')}>{uploading === kind ? 'アップロード中…' : `${title}を登録`}
          <input type="file" multiple disabled={!!uploading} aria-label={`${title}のファイルを選ぶ`} className="sr-only" onChange={upload(kind)} /></label>}
      </div>
    )
  }

  return (
    <section aria-label="入稿と前払い" className="space-y-3">
      {!agreed && <p className="rounded-[16px] border border-[#E2E1DA] bg-[#FBFAF6] p-3 text-[12.5px]">請求書の承認（契約成立）のあとに始められます<Link href={`/deals/${dealId}?step=8`} className="ml-2 underline">請求・契約を開く</Link></p>}
      {error && <p role="alert" className="rounded-[16px] border-[1.5px] border-[#FF5C34] bg-[#FFD8C2] p-3 text-[12.5px] text-[#B03616] break-words">{error}</p>}

      <div className="rounded-[16px] border border-[#E2E1DA] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex flex-wrap items-center gap-2 text-[15px] font-bold"><span className="tabular-nums text-[#84787D]">1</span>入稿
            {intake.done.factory_ok ? <span className={pill + ' bg-[#D7EFFF] text-[#33566F]'}>工場確認済み {day(intake.done.factory_ok)}</span> : nextStep ? <span className={pill + ' bg-[#FFD8C2] text-[#B03616]'}>次: {LABEL[nextStep]}</span> : <span className={pill + ' border border-[#E2E1DA] bg-[#EFEFEA] text-[#351E28]'}>進め方を選ぶ</span>}</h3>
          <div role="group" aria-label="入稿の進め方" className="flex flex-wrap gap-1">
            {([['customer', '顧客がデータを用意'], ['template', '工場の雛形を使う']] as const).map(([value, text]) =>
              <button key={value} type="button" aria-pressed={intake.pattern === value} disabled={pending || locked || (anyDone && intake.pattern !== value)} className={choice(intake.pattern === value)} onClick={() => run('pattern', { pattern: value }, '進め方を変更しました')}>{text}</button>)}
          </div>
        </div>
        {steps.length > 0 && (
          <ol aria-label="入稿の手順" className="mt-3 space-y-2">
            {steps.map((s, i) => {
              const at = intake.done[s], kind = FILE_OF[s], showFiles = s === 'template_received' || s === 'artwork_received'
              return (
                <li key={s} className="rounded-[12px] border border-[#E2E1DA] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex flex-wrap items-center gap-2 text-[13px] font-bold"><span className="tabular-nums text-[#84787D]">{i + 1}</span>{LABEL[s]}
                      {at && <span className={pill + ' bg-[#D7EFFF] text-[#33566F]'}>記録済み {day(at)}</span>}</p>
                    {!locked && (at
                      ? s === lastDone && <button type="button" disabled={pending} className={link} onClick={() => run('step', { step: s, done: false }, '記録を取り消しました')}>取り消す</button>
                      : s === nextStep && <button type="button" disabled={pending || !!uploading || (showFiles && !files.some(f => f.kind === kind))} className={dark} onClick={() => run('step', { step: s }, '記録しました')}>記録する</button>)}
                  </div>
                  {showFiles && kind && fileBox(kind, !!at)}
                </li>
              )
            })}
          </ol>
        )}
      </div>

      <div className="rounded-[16px] border border-[#E2E1DA] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex flex-wrap items-center gap-2 text-[15px] font-bold"><span className="tabular-nums text-[#84787D]">2</span>工場への前払い
            {paid ? <span className={pill + ' bg-[#D7EFFF] text-[#33566F]'}>支払い済み {intake.prepayPaidOn!.replace(/-/g, '/')} ・ {usd(intake.prepayAmountUsd!)}（{intake.prepayRate}%）</span> : <span className={pill + ' bg-[#FFD8C2] text-[#B03616]'}>未払い</span>}</h3>
          <div role="group" aria-label="前払いの割合" className="flex flex-wrap gap-1">
            {[30, 50, 100].map(rate => <button key={rate} type="button" aria-pressed={intake.prepayRate === rate} disabled={pending || locked || paid} className={choice(intake.prepayRate === rate)} onClick={() => run('prepay_rate', { rate }, `前払いを ${rate}% にしました`)}>{rate}%</button>)}
          </div>
        </div>
        {paid && intake.prepayNote && <p className="mt-2 break-words text-[12.5px] text-[#84787D]">{intake.prepayNote}</p>}
        {!locked && (paid
          ? <div className="mt-2 flex justify-end"><button type="button" disabled={pending} className={link} onClick={() => run('prepay_unpaid', {}, '振込の記録を取り消しました')}>振込の記録を取り消す</button></div>
          : intake.prepayRate != null && (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              {suggested != null && <p className="mr-auto text-[12.5px] tabular-nums">目安 <span className="text-[15px] font-extrabold">{usd(suggested)}</span><span className="ml-1 text-[11px] text-[#84787D]">（原価 {usd(costUsd!)} × {intake.prepayRate}%）</span></p>}
              <label className="text-[11px] text-[#84787D]">振込日<br /><input type="date" value={paidOn} max={today} onChange={e => setPaidOn(e.target.value)} className={field} /></label>
              <label className="text-[11px] text-[#84787D]">振り込んだ金額 $<br /><input inputMode="decimal" value={amount} placeholder={suggested != null ? String(suggested) : ''} onChange={e => setAmount(e.target.value)} className={field + ' w-[120px] text-right'} /></label>
              <label className="text-[11px] text-[#84787D]">メモ<br /><input value={note} onChange={e => setNote(e.target.value)} maxLength={500} className={field + ' w-[160px]'} /></label>
              <button type="button" disabled={pending || !paidOn || !(Number(amount || suggested) > 0)} className={dark} onClick={() => run('prepay_paid', { paid_on: paidOn, amount_usd: amount.trim() || String(suggested), note }, '振込を記録しました')}>振込を記録する</button>
            </div>
          ))}
      </div>

      {intake.startedAt
        ? <p role="status" className="rounded-[16px] bg-[#D7EFFF] p-3 text-[13px] font-bold text-[#33566F]">製作開始へ進みました {day(intake.startedAt)}</p>
        : !readOnly && agreed && <div className="flex justify-end"><button type="button" disabled={pending || !ready} className={main} onClick={() => setAsk('start')}>製作開始へ進む</button></div>}

      {ask === 'start' && (
        <div role="dialog" aria-modal="true" aria-label="製作開始へ進む" className="fixed inset-0 z-[70] flex items-center justify-center bg-[#351E28]/40 p-4">
          <div className="w-full max-w-[420px] rounded-[16px] border border-[#E2E1DA] bg-white p-4 shadow-[0_20px_50px_rgba(53,30,40,.12)]">
            <p className="text-[15px] font-bold">製作開始へ進みますか？</p>
            <p className="mt-1 text-[12.5px] text-[#84787D]">進んだあとは、入稿と前払いの記録を変更できません。</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={ghost} onClick={() => setAsk(null)}>やめる</button>
              <button type="button" className={dark} onClick={() => run('start', {}, '製作開始へ進みました')}>進む</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
