import { loadOffer } from '@/lib/actions/price-offer'
import { offerNumber, yen } from '@/lib/process/offer-format'
import { OfferDecision } from '@/components/external/offer-decision'

// 再設計 工程4: 顧客がお見積を確認して「承認」か「変更を依頼」を選ぶページ（ログイン不要）。
// 開いただけでは何も記録しない。

export const dynamic = 'force-dynamic'
const day = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }) : ''
const warn = 'rounded-[16px] border-[1.5px] border-[#FF5C34] bg-[#FFD8C2] p-4 text-[14px] text-[#B03616]'

export default async function OfferPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const o = await loadOffer(token)
  const s = o.snapshot
  return (
    <div>
      {!s || o.status === 'missing' ? (
        <div className="rounded-[16px] border border-[#E2E1DA] bg-white p-6"><h1 className="text-[21px] font-extrabold">ページが見つかりません</h1><p className="mt-2 text-[14px]">リンクが正しいかご確認ください。</p></div>
      ) : (
        <>
          <h1 className="text-[21px] font-extrabold">お見積書（第{s.round}回）</h1>
          <p className="mt-1 text-[14px]">{s.client_name} 様 ／ {s.deal_name}{s.brand ? `（${s.brand}）` : ''}</p>
          <p className="text-[12.5px] text-[#84787D] tabular-nums">番号 {offerNumber(s)} ・ 発行日 {day(o.createdAt)} ・ 有効期限 {day(o.expiresAt)} ・ 消費税 {s.tax_rate ?? 10}%</p>
          {o.status === 'sent' ? <OfferDecision token={token} items={s.items} /> : (
            <>
              <ol aria-label="商品" className="mt-4 space-y-2">
                {s.items.map((item, i) => (
                  <li key={item.product_id} className="rounded-[16px] border border-[#E2E1DA] bg-white p-4">
                    <p className="text-[14px] font-bold break-words"><span className="mr-2 tabular-nums text-[#84787D]">{i + 1}</span>{item.name}</p>
                    <ul className="mt-2 space-y-1">{item.options.map(x => (
                      <li key={x.quote_id} className={`rounded-[12px] px-3 py-2 text-[12.5px] tabular-nums ${o.choices.includes(x.quote_id) ? 'bg-[#D7EFFF] font-bold text-[#33566F]' : 'bg-[#FBFAF6]'}`}>
                        {Number(x.quantity).toLocaleString('ja-JP')}個 ・ 単価 {yen(x.unit_jpy)} ・ 税込 {yen(x.tax_jpy)}{o.choices.includes(x.quote_id) ? ' ・ 承認済み' : ''}</li>
                    ))}</ul>
                  </li>
                ))}
              </ol>
              <div className="mt-4">
                {o.status === 'approved' && <p role="status" className="rounded-[16px] bg-[#D7EFFF] p-4 text-[14px] font-bold text-[#33566F]">このお見積は承認済みです。ありがとうございます。</p>}
                {o.status === 'returned' && <p role="status" className="rounded-[16px] bg-[#D7EFFF] p-4 text-[14px] font-bold text-[#33566F]">変更のご依頼を受け付けました。新しいお見積をお待ちください。</p>}
                {o.status === 'cancelled' && <p role="status" className={warn}>このお見積は取り消されました。新しいメールをご確認ください。</p>}
                {o.status === 'expired' && <p role="status" className={warn}>このお見積は有効期限が切れました。担当者へご連絡ください。</p>}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
