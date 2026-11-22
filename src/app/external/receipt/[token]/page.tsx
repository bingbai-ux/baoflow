import { loadReceipt } from '@/lib/actions/deal-receipt'
import { ReceiveButton } from '@/components/external/receive-button'

// 再設計 工程9: 顧客が届いた内容を確認して「受領しました」を押すページ（ログイン不要）。開いただけでは何も記録しない。

export const dynamic = 'force-dynamic'
const warn = 'rounded-[16px] border-[1.5px] border-[#FF5C34] bg-[#FFD8C2] p-4 text-[14px] text-[#B03616]'
const ymd = (d: string | null) => d ? d.replace(/-/g, '/') : ''

export default async function ReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const r = await loadReceipt(token)
  const s = r.snapshot
  return (
    <div>
      {!s || r.status === 'missing' ? (
        <div className="rounded-[16px] border border-[#E2E1DA] bg-white p-6"><h1 className="text-[21px] font-extrabold">ページが見つかりません</h1><p className="mt-2 text-[14px]">リンクが正しいかご確認ください。</p></div>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {r.logo && <img src={r.logo} alt={s.issuer.name} className="mb-3 max-h-[48px] max-w-[160px] object-contain" />}
          <h1 className="text-[21px] font-extrabold">お届け内容のご確認</h1>
          <p className="mt-1 text-[14px]">{s.client_name} 様 ／ {s.deal_name}{s.brand ? `（${s.brand}）` : ''}</p>
          <p className="text-[12.5px] text-[#84787D] tabular-nums">番号 {s.delivery_note_number} ・ 到着日 {ymd(s.arrived_on)}{s.tracking_number ? ` ・ 追跡番号 ${s.tracking_number}` : ''}{s.carton_count ? ` ・ ${s.carton_count}箱` : ''}</p>
          <div className="mt-4 overflow-x-auto rounded-[16px] border border-[#E2E1DA] bg-white">
            <table aria-label="お届けした商品" className="w-full text-[13px] tabular-nums">
              <thead><tr className="bg-[#FBFAF6] text-[11px] text-[#84787D]"><th className="px-4 py-2 text-left font-normal">商品</th><th className="px-4 py-2 text-right font-normal">数量</th></tr></thead>
              <tbody>{s.lines.map((l, i) => <tr key={i} className="border-t border-[#E2E1DA]"><td className="px-4 py-2 break-words">{l.name}</td><td className="whitespace-nowrap px-4 py-2 text-right">{Number(l.quantity).toLocaleString('ja-JP')}個</td></tr>)}</tbody>
            </table>
          </div>
          {s.ship_to?.address && <p className="mt-2 break-words text-[12.5px] text-[#84787D]">お届け先: {s.ship_to.name} {s.ship_to.postal_code ? `〒${s.ship_to.postal_code} ` : ''}{s.ship_to.address}</p>}
          <div className="mt-4">
            {r.status === 'sent' && <ReceiveButton token={token} />}
            {r.status === 'received' && <div role="status" className="rounded-[16px] bg-[#D7EFFF] p-4 text-[#33566F]"><p className="text-[14px] font-bold">受領のご確認済みです。ありがとうございます。</p>
              <a href={`/external/receipt/${token}/delivery-note`} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-[44px] items-center text-[13px] font-bold underline">納品書を開く</a></div>}
            {r.status === 'cancelled' && <p role="status" className={warn}>この確認依頼は取り消されました。新しいメールをご確認ください。</p>}
            {r.status === 'expired' && <p role="status" className={warn}>このページは期限が切れました。担当者へご連絡ください。</p>}
          </div>
        </>
      )}
    </div>
  )
}
