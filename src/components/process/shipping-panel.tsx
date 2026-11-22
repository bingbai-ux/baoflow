'use client'

// 再設計 工程8: 発送（完了報告 → 届け先とラベル → 発送依頼・梱包確認 → 発送完了）。

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { recordShipped, saveShipment, type DealShipment } from '@/lib/actions/deal-shipment'
import { ProcessFiles, type ProcessFile } from '@/components/process/process-files'
import { useUi } from '@/components/ui/ui-store'

const ghost = 'min-h-[44px] inline-flex items-center justify-center rounded-full border border-[#E2E1DA] bg-white px-4 text-[12px] font-bold text-[#351E28] no-underline hover:bg-[#FBFAF6] disabled:opacity-40'
const dark = 'min-h-[44px] inline-flex items-center justify-center rounded-full bg-[#351E28] px-4 text-[12px] font-bold text-[#C9A2B8] hover:brightness-95 disabled:opacity-40'
const main = 'min-h-[44px] inline-flex items-center justify-center rounded-full bg-[#E9F056] px-5 text-[12.5px] font-extrabold text-[#666C14] hover:brightness-95 disabled:opacity-40'
const pill = 'rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap'
const field = 'w-full min-h-[44px] rounded-[12px] border border-transparent bg-[#EFEFEA] px-3 text-[14px] text-[#351E28] outline-none focus:border-[#351E28] disabled:opacity-60'
const label = 'block text-[11px] text-[#84787D]'
const card = 'rounded-[16px] border border-[#E2E1DA] bg-white p-4'
const day = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric' }) : ''
const ymd = (d: string) => d.replace(/-/g, '/')
const addDays = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)
const done = (at: string | null) => at ? <span className={pill + ' bg-[#D7EFFF] text-[#33566F]'}>確認済み {day(at)}</span> : null

export function ShippingPanel({ dealId, shipment, files, productionFinished, foodInspection, transitDays, defaultName, today, readOnly }: {
  dealId: string; shipment: DealShipment; files: ProcessFile[]; productionFinished: boolean; foodInspection: boolean; /** 工程7で入れた「完成から到着までの日数」 */ transitDays: number | null; defaultName: string; today: string; readOnly?: boolean
}) {
  const router = useRouter()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [to, setTo] = useState({ name: shipment.shipTo.name || defaultName, postal: shipment.shipTo.postalCode, address: shipment.shipTo.address, phone: shipment.shipTo.phone,
    cartons: shipment.cartonCount == null ? '' : String(shipment.cartonCount), inspection: shipment.inspectionDays == null ? '' : String(shipment.inspectionDays) })
  const [toDirty, setToDirty] = useState(false)
  const [ship, setShip] = useState({ carrier: '', number: '', url: '', on: today })
  const [ask, setAsk] = useState(false)

  const shipped = !!shipment.shippedOn
  const locked = readOnly || !productionFinished || shipped
  const savedTo = !!shipment.shipTo.address && shipment.cartonCount != null
  const has = (category: string) => files.some(f => f.category === category)
  const arrival = shipment.shippedOn && transitDays != null ? addDays(shipment.shippedOn, transitDays + (shipment.inspectionDays || 0)) : null
  const editTo = (patch: Partial<typeof to>) => { setTo(v => ({ ...v, ...patch })); setToDirty(true) }
  const toReady = !!to.name.trim() && !!to.address.trim() && Number(to.cartons) >= 1 && (!foodInspection || to.inspection !== '')

  const run = (action: Parameters<typeof saveShipment>[1], payload: Record<string, unknown>, message: string, after?: () => void) => { setError(null); startTransition(async () => {
    const r = await saveShipment(dealId, action, payload)
    if (r.error) { setError(r.error); return }
    after?.(); toast(message); router.refresh()
  }) }
  const finish = () => { setAsk(false); setError(null); startTransition(async () => {
    const r = await recordShipped(dealId, { carrier: ship.carrier, trackingNumber: ship.number, trackingUrl: ship.url, shippedOn: ship.on })
    if (r.error) { setError(r.error); return }
    setNotice(r.notice); toast(r.notice ? '発送完了を記録しました' : '発送完了を記録し、顧客へ知らせました'); router.refresh()
  }) }

  return (
    <section aria-label="発送" className="space-y-3">
      {!productionFinished && <p className="rounded-[16px] border border-[#E2E1DA] bg-[#FBFAF6] p-3 text-[12.5px]">製造完了を記録すると始められます<Link href={`/deals/${dealId}?step=10`} className="ml-2 underline">製造を開く</Link></p>}
      {error && <p role="alert" className="rounded-[16px] border-[1.5px] border-[#FF5C34] bg-[#FFD8C2] p-3 text-[12.5px] text-[#B03616] break-words">{error}</p>}
      {notice && <p role="alert" className="rounded-[16px] border-[1.5px] border-[#FF5C34] bg-[#FFD8C2] p-3 text-[12.5px] text-[#B03616] break-words">{notice}</p>}

      <div className={card}>
        <h3 className="flex flex-wrap items-center gap-2 text-[15px] font-bold"><span className="tabular-nums text-[#84787D]">1</span>工場の完了報告 {done(shipment.completionAt)}</h3>
        {shipment.completionNote && <p className="mt-1 break-words text-[12.5px] text-[#84787D]">{shipment.completionNote}</p>}
        <ProcessFiles dealId={dealId} category="ship_done" title="完成品の写真・動画" files={files} editable={!locked && !shipment.completionAt} onError={setError} />
        {!locked && !shipment.completionAt && (
          <div className="mt-2 flex flex-wrap items-end justify-end gap-2">
            <label className={label + ' min-w-[200px] flex-1'}>備考<input value={note} onChange={e => setNote(e.target.value)} maxLength={2000} className={field} /></label>
            <button type="button" disabled={pending || !has('ship_done')} className={dark} onClick={() => run('completion', { note }, '記録しました')}>完了報告を確認した</button>
          </div>
        )}
      </div>

      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex flex-wrap items-center gap-2 text-[15px] font-bold"><span className="tabular-nums text-[#84787D]">2</span>届け先と段ボールラベル
            {savedTo ? <span className={pill + ' bg-[#D7EFFF] text-[#33566F]'}>{shipment.cartonCount}箱</span> : <span className={pill + ' bg-[#FFD8C2] text-[#B03616]'}>未入力</span>}
            {foodInspection && <span className={pill + ' bg-[#FFD8C2] text-[#B03616]'}>食品検査あり</span>}</h3>
          {savedTo && !toDirty && <a href={`/deals/${dealId}/carton-labels`} target="_blank" rel="noreferrer" className={ghost}>ラベルPDFを開く</a>}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <label className={label + ' sm:col-span-2'}>届け先の名前<input value={to.name} disabled={locked} onChange={e => editTo({ name: e.target.value })} className={field} /></label>
          <label className={label}>郵便番号<input value={to.postal} disabled={locked} onChange={e => editTo({ postal: e.target.value })} className={field} /></label>
          <label className={label}>電話<input type="tel" value={to.phone} disabled={locked} onChange={e => editTo({ phone: e.target.value })} className={field} /></label>
          <label className={label + ' sm:col-span-2'}>住所<input value={to.address} disabled={locked} onChange={e => editTo({ address: e.target.value })} className={field} /></label>
          <label className={label}>箱数<input inputMode="numeric" value={to.cartons} disabled={locked} onChange={e => editTo({ cartons: e.target.value.replace(/\D/g, '').slice(0, 3) })} className={field + ' text-right tabular-nums'} /></label>
          {foodInspection && <label className={label}>食品検査の日数<input inputMode="numeric" value={to.inspection} disabled={locked} onChange={e => editTo({ inspection: e.target.value.replace(/\D/g, '').slice(0, 3) })} className={field + ' text-right tabular-nums'} /></label>}
        </div>
        {!locked && <div className="mt-2 flex justify-end"><button type="button" disabled={pending || !toDirty || !toReady} className={dark}
          onClick={() => run('destination', { name: to.name, postal_code: to.postal, address: to.address, phone: to.phone, carton_count: to.cartons, inspection_days: to.inspection }, '届け先を保存しました', () => setToDirty(false))}>届け先を保存する</button></div>}
      </div>

      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex flex-wrap items-center gap-2 text-[15px] font-bold"><span className="tabular-nums text-[#84787D]">3</span>発送依頼と梱包の確認
            {shipment.packedAt ? done(shipment.packedAt) : shipment.requestedAt ? <span className={pill + ' bg-[#FFD8C2] text-[#B03616]'}>依頼済み {day(shipment.requestedAt)} ・ 梱包写真待ち</span> : <span className={pill + ' border border-[#E2E1DA] bg-[#EFEFEA] text-[#351E28]'}>未依頼</span>}</h3>
          {!locked && !shipment.requestedAt && <button type="button" disabled={pending || !shipment.completionAt || !savedTo || toDirty} className={dark} onClick={() => run('request', {}, '記録しました')}>工場へ発送を依頼した</button>}
        </div>
        {shipment.requestedAt && <>
          <ProcessFiles dealId={dealId} category="ship_pack" title="梱包の写真" files={files} editable={!locked && !shipment.packedAt} onError={setError} />
          <ProcessFiles dealId={dealId} category="ship_label" title="ラベルを貼った写真" files={files} editable={!locked && !shipment.packedAt} onError={setError} />
          {!locked && !shipment.packedAt && <div className="mt-2 flex justify-end"><button type="button" disabled={pending || !has('ship_pack') || !has('ship_label')} className={dark} onClick={() => run('packed', {}, '記録しました')}>梱包とラベルを確認した</button></div>}
        </>}
      </div>

      <div className={card}>
        <h3 className="flex flex-wrap items-center gap-2 text-[15px] font-bold"><span className="tabular-nums text-[#84787D]">4</span>発送完了
          {shipped ? <span className={pill + ' bg-[#D7EFFF] text-[#33566F]'}>発送済み {ymd(shipment.shippedOn!)}</span> : <span className={pill + ' border border-[#E2E1DA] bg-[#EFEFEA] text-[#351E28]'}>未発送</span>}
          {shipped && shipment.notifyStatus && <span className={pill + (shipment.notifyStatus === 'accepted' ? ' bg-[#D7EFFF] text-[#33566F]' : ' bg-[#FFD8C2] text-[#B03616]')}>{shipment.notifyStatus === 'accepted' ? '顧客へ通知済み' : '顧客へ未通知'}</span>}</h3>
        {shipped ? (
          <dl aria-label="発送の内容" className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-[16px] bg-[#D7EFFF] p-3 text-[#33566F]"><dt className="text-[11px]">追跡番号{shipment.carrier ? `（${shipment.carrier}）` : ''}</dt>
              <dd className="break-all text-[21px] font-extrabold tabular-nums">{shipment.trackingNumber}</dd>
              {shipment.trackingUrl && <dd><a href={shipment.trackingUrl} target="_blank" rel="noreferrer" className="break-all text-[12.5px] underline">追跡ページを開く</a></dd>}</div>
            <div className="rounded-[16px] bg-[#D7EFFF] p-3 text-[#33566F]"><dt className="text-[11px]">到着目安{transitDays != null ? `（発送 + ${transitDays + (shipment.inspectionDays || 0)}日${shipment.inspectionDays ? '・検査を含む' : ''}）` : ''}</dt>
              <dd className="text-[21px] font-extrabold tabular-nums">{arrival ? ymd(arrival) : '—'}</dd></div>
          </dl>
        ) : !locked && (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className={label + ' w-[140px]'}>配送業者<input value={ship.carrier} onChange={e => setShip({ ...ship, carrier: e.target.value })} maxLength={100} className={field} /></label>
            <label className={label + ' w-[180px]'}>追跡番号<input value={ship.number} onChange={e => setShip({ ...ship, number: e.target.value })} maxLength={100} className={field + ' tabular-nums'} /></label>
            <label className={label + ' min-w-[200px] flex-1'}>追跡URL<input type="url" value={ship.url} onChange={e => setShip({ ...ship, url: e.target.value })} maxLength={500} placeholder="https://" className={field} /></label>
            <label className={label}>発送日<input type="date" value={ship.on} max={today} onChange={e => setShip({ ...ship, on: e.target.value })} className={field + ' tabular-nums'} /></label>
            <button type="button" disabled={pending || !shipment.packedAt || !ship.number.trim() || !ship.on || (!!ship.url.trim() && !/^https?:\/\/\S+$/i.test(ship.url.trim()))} className={main} onClick={() => setAsk(true)}>発送完了を記録する</button>
          </div>
        )}
      </div>

      {ask && (
        <div role="dialog" aria-modal="true" aria-label="発送完了を記録する" className="fixed inset-0 z-[70] flex items-center justify-center bg-[#351E28]/40 p-4">
          <div className="w-full max-w-[420px] rounded-[16px] border border-[#E2E1DA] bg-white p-4 shadow-[0_20px_50px_rgba(53,30,40,.12)]">
            <p className="text-[15px] font-bold">発送完了を記録しますか？</p>
            <p className="mt-1 text-[12.5px] text-[#84787D]">顧客へ追跡番号をメールで知らせ、検収へ進みます。記録したあとは変更できません。</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={ghost} onClick={() => setAsk(false)}>やめる</button>
              <button type="button" className={dark} onClick={finish}>記録する</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
