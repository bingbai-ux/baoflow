'use client'

// 設定 > 発行元の会社: 会社ごとに情報・ロゴ・角印・インボイス登録番号・振込先を登録し、既定の会社を選ぶ。

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveIssuerCompany, setDefaultIssuerCompany, type IssuerCompany, type IssuerTextField } from '@/lib/actions/issuer-companies'
import { useUi } from '@/components/ui/ui-store'

const card = 'rounded-[16px] border border-[#E2E1DA] bg-white p-4'
const input = 'w-full min-h-[44px] rounded-[12px] border border-transparent bg-[#EFEFEA] px-3.5 text-[14px] text-[#351E28] outline-none focus:border-[#351E28]'
const label = 'block text-[11px] text-[#84787D]'
const ghost = 'min-h-[44px] inline-flex items-center justify-center rounded-full border border-[#E2E1DA] bg-white px-4 text-[12px] font-bold text-[#351E28] hover:bg-[#FBFAF6] disabled:opacity-40'
const dark = 'min-h-[44px] inline-flex items-center justify-center rounded-full bg-[#351E28] px-4 text-[12px] font-bold text-[#C9A2B8] hover:brightness-95 disabled:opacity-40'
const pill = 'rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap'
const FIELDS: Array<[IssuerTextField, string, string?]> = [['postal_code', '郵便番号'], ['address', '住所', 'sm:col-span-2'], ['phone', '電話'], ['email', 'メール'], ['registration_number', 'インボイス登録番号（T + 数字13桁）'],
  ['bank_name', '銀行名'], ['branch_name', '支店名'], ['account_type', '口座種別'], ['account_number', '口座番号'], ['account_holder', '口座名義']]
const MAX_BYTES = 10 * 1024 * 1024 // 選べる画像の上限
const MAX_STORED = 400000 // 保存する画像（data URL）の文字数の上限（約300KB）。ロゴと角印を同時に保存しても送信上限 1MB に収まる大きさ

/**
 * 選んだ画像を、帳票に載せるのに十分な大きさまで自動で縮めて data URL にする（PNG は透明部分を保つ）。
 * 縮めても上限に収まらないときは例外を投げる（黙って粗い画像にしない）。
 */
async function shrinkImage(file: File, maxSide: number): Promise<{ data: string; resized: boolean }> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => { const el = new Image(); el.onload = () => resolve(el); el.onerror = () => reject(new Error('画像を読み込めませんでした')); el.src = url })
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('画像を読み込めませんでした')
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
    let side = Math.min(maxSide, Math.max(img.naturalWidth, img.naturalHeight))
    for (let i = 0; i < 8; i++) {
      const k = side / Math.max(img.naturalWidth, img.naturalHeight)
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.naturalWidth * k)); canvas.height = Math.max(1, Math.round(img.naturalHeight * k))
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('画像を処理できませんでした')
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const data = canvas.toDataURL(type, 0.9)
      if (data.startsWith(`data:${type};base64,`) && data.length <= MAX_STORED) return { data, resized: k < 1 }
      if (side <= 240) break
      side = Math.round(side * 0.75)
    }
    throw new Error('画像を小さくしきれませんでした。別の画像を選んでください')
  } finally { URL.revokeObjectURL(url) }
}
type Draft = { id?: string; name: string; logo: string | null; stamp: string | null; logoTouched: boolean; stampTouched: boolean } & Record<IssuerTextField, string>
const blank = (): Draft => ({ name: '', logo: null, stamp: null, logoTouched: false, stampTouched: false, ...Object.fromEntries(FIELDS.map(([k]) => [k, ''])) as Record<IssuerTextField, string> })
const toDraft = (c: IssuerCompany): Draft => ({ id: c.id, name: c.name, logo: c.logo_data, stamp: c.stamp_data, logoTouched: false, stampTouched: false, ...Object.fromEntries(FIELDS.map(([k]) => [k, c[k] || ''])) as Record<IssuerTextField, string> })

export function IssuerCompanies({ companies }: { companies: IssuerCompany[] }) {
  const router = useRouter()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = (work: () => Promise<{ error: string | null }>, done: string, after?: () => void) => { setError(null); startTransition(async () => {
    const r = await work()
    if (r.error) { setError(r.error); return }
    after?.(); toast(done); router.refresh()
  }) }
  const pick = (kind: 'logo' | 'stamp') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    if (!['image/png', 'image/jpeg'].includes(file.type)) { setError('画像は PNG か JPEG を選んでください'); return }
    if (file.size > MAX_BYTES) { setError('画像が大きすぎます（10MB まで）'); return }
    shrinkImage(file, kind === 'logo' ? 1200 : 800).then(({ data, resized }) => {
      setError(null); setDraft(d => d && { ...d, [kind]: data, [kind + 'Touched']: true })
      if (resized) toast('画像を帳票用の大きさに縮めました')
    }).catch((e: unknown) => setError(e instanceof Error ? e.message : '画像を読み込めませんでした'))
  }
  const save = (d: Draft) => run(() => saveIssuerCompany({ id: d.id, name: d.name, ...Object.fromEntries(FIELDS.map(([k]) => [k, d[k]])), ...(d.logoTouched ? { logo_data: d.logo } : {}), ...(d.stampTouched ? { stamp_data: d.stamp } : {}),
    archived: companies.find(c => c.id === d.id)?.archived }), '会社を保存しました', () => setDraft(null))

  return (
    <div className="space-y-3">
      {error && <p role="alert" className="rounded-[16px] border-[1.5px] border-[#FF5C34] bg-[#FFD8C2] p-3 text-[12.5px] text-[#B03616]">{error}</p>}
      <ul aria-label="会社" className="space-y-2">
        {companies.map(c => draft?.id === c.id ? null : (
          <li key={c.id} className={card + ' flex flex-wrap items-center gap-3' + (c.archived ? ' opacity-60' : '')}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {c.logo_data ? <img src={c.logo_data} alt="" className="h-[44px] w-[88px] rounded-[12px] border border-[#E2E1DA] object-contain" /> : <span className="flex h-[44px] w-[88px] items-center justify-center rounded-[12px] border border-[#E2E1DA] bg-[#FBFAF6] text-[11px] text-[#84787D]">ロゴなし</span>}
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-[15px] font-bold">{c.name}
                {c.is_default && <span className={pill + ' bg-[#D7EFFF] text-[#33566F]'}>既定</span>}
                {c.archived && <span className={pill + ' bg-[#AEB8A0] text-[#4C5544]'}>使わない</span>}
                {!c.archived && c.missing.length > 0 && <span className={pill + ' bg-[#FFD8C2] text-[#B03616]'}>請求書に未登録: {c.missing.join('・')}</span>}</p>
              <p className="break-words text-[12.5px] text-[#84787D] tabular-nums">{[c.registration_number ? `登録番号 ${c.registration_number}` : '登録番号なし', c.stamp_data ? '角印あり' : '角印なし', c.address].filter(Boolean).join(' ・ ')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {!c.is_default && !c.archived && <button type="button" disabled={pending} className={ghost} onClick={() => run(() => setDefaultIssuerCompany(c.id), `${c.name} を既定にしました`)}>既定にする</button>}
              {!c.is_default && <button type="button" disabled={pending} className={ghost} onClick={() => run(() => saveIssuerCompany({ id: c.id, name: c.name, ...Object.fromEntries(FIELDS.map(([k]) => [k, c[k] || ''])), archived: !c.archived }), c.archived ? `${c.name} を使えるようにしました` : `${c.name} を使わない会社にしました`)}>{c.archived ? '使う' : '使わない'}</button>}
              <button type="button" disabled={pending} className={ghost} onClick={() => { setError(null); setDraft(toDraft(c)) }}>直す</button>
            </div>
          </li>
        ))}
      </ul>
      {!draft && <button type="button" className={dark} onClick={() => { setError(null); setDraft(blank()) }}>＋ 会社を追加</button>}

      {draft && (
        <form aria-label={draft.id ? '会社を直す' : '会社を追加'} className={card + ' space-y-3'} onSubmit={e => { e.preventDefault(); save(draft) }}>
          <label className={label}>会社名（必須）<input required value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} className={input} /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map(([k, text, span]) => <label key={k} className={label + (span ? ' ' + span : '')}>{text}<input value={draft[k]} onChange={e => setDraft({ ...draft, [k]: e.target.value })} className={input} /></label>)}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {([['logo', 'ロゴ'], ['stamp', '角印（ハンコ）']] as const).map(([kind, text]) => (
              <div key={kind} className="rounded-[12px] border border-[#E2E1DA] p-3">
                <p className={label}>{text}（PNG / JPEG・10MB まで）</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {draft[kind] ? <img src={draft[kind]!} alt={`${text}の見本`} className="h-[72px] w-[72px] rounded-[12px] border border-[#E2E1DA] object-contain" /> : <span className="flex h-[72px] w-[72px] items-center justify-center rounded-[12px] border border-[#E2E1DA] bg-[#FBFAF6] text-[11px] text-[#84787D]">未登録</span>}
                  <label className={ghost + ' cursor-pointer'}>{text}を選ぶ<input type="file" accept="image/png,image/jpeg" aria-label={`${text}の画像`} className="sr-only" onChange={pick(kind)} /></label>
                  {draft[kind] && <button type="button" className={ghost} onClick={() => setDraft({ ...draft, [kind]: null, [kind + 'Touched']: true })}>外す</button>}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2"><button type="submit" disabled={pending} className={dark}>この内容で保存する</button><button type="button" className={ghost} onClick={() => { setDraft(null); setError(null) }}>やめる</button></div>
        </form>
      )}
    </div>
  )
}
