import { loadAgreement } from '@/lib/actions/order-agreement'
import { yen } from '@/lib/process/offer-format'
import { bankLine, issuerAddress, jpDate } from '@/lib/process/invoice-format'
import { AgreeButton } from '@/components/external/agree-button'

// 再設計 工程5: 顧客が請求書を確認して承認する（= 契約成立）ページ（ログイン不要）。
// 開いただけでは何も記録しない。

export const dynamic = 'force-dynamic'
const warn = 'rounded-[16px] border-[1.5px] border-[#FF5C34] bg-[#FFD8C2] p-4 text-[14px] text-[#B03616]'

export default async function InvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const a = await loadAgreement(token)
  const s = a.snapshot
  return (
    <div>
      {!s || a.status === 'missing' ? (
        <div className="rounded-[16px] border border-[#E2E1DA] bg-white p-6"><h1 className="text-[21px] font-extrabold">ページが見つかりません</h1><p className="mt-2 text-[14px]">リンクが正しいかご確認ください。</p></div>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {a.logo && <img src={a.logo} alt={s.issuer.name} className="mb-3 max-h-[48px] max-w-[160px] object-contain" />}
          <h1 className="text-[21px] font-extrabold">ご請求書</h1>
          <p className="mt-1 text-[14px]">{s.client_name} 様 ／ {s.deal_name}{s.brand ? `（${s.brand}）` : ''}</p>
          <p className="text-[12.5px] text-[#84787D] tabular-nums">番号 {s.invoice_number} ・ 発行日 {jpDate(s.issue_date)} ・ お振込期限 {jpDate(s.due_date)}</p>
          <div className="mt-4 rounded-[16px] bg-[#D7EFFF] p-4 text-[#33566F]"><p className="text-[12.5px]">ご請求金額（税込）</p><p className="text-[24px] font-extrabold tabular-nums">{yen(s.total_jpy)}</p></div>
          <div className="mt-2 overflow-x-auto rounded-[16px] border border-[#E2E1DA] bg-white">
            <table aria-label="明細" className="w-full text-[12.5px] tabular-nums">
              <thead><tr className="bg-[#FBFAF6] text-[11px] text-[#84787D]"><th className="px-4 py-2 text-left font-normal">商品</th><th className="px-2 py-2 text-right font-normal">数量</th><th className="px-2 py-2 text-right font-normal">単価</th><th className="px-4 py-2 text-right font-normal">金額</th></tr></thead>
              <tbody>
                {s.lines.map((l, i) => <tr key={i} className="border-t border-[#E2E1DA]"><td className="px-4 py-2 break-words">{l.name}</td><td className="whitespace-nowrap px-2 py-2 text-right">{Number(l.quantity).toLocaleString('ja-JP')}個</td><td className="whitespace-nowrap px-2 py-2 text-right">{yen(l.unit_jpy)}</td><td className="whitespace-nowrap px-4 py-2 text-right">{yen(l.net_jpy)}</td></tr>)}
                <tr className="border-t border-[#E2E1DA] bg-[#FBFAF6]"><td colSpan={3} className="px-4 py-2 text-right text-[#84787D]">小計</td><td className="whitespace-nowrap px-4 py-2 text-right">{yen(s.subtotal_jpy)}</td></tr>
                <tr className="bg-[#FBFAF6]"><td colSpan={3} className="px-4 py-2 text-right text-[#84787D]">消費税（{s.tax_rate}%）</td><td className="whitespace-nowrap px-4 py-2 text-right">{yen(s.tax_jpy)}</td></tr>
                <tr className="bg-[#FBFAF6] font-bold"><td colSpan={3} className="px-4 py-2 text-right">合計</td><td className="whitespace-nowrap px-4 py-2 text-right">{yen(s.total_jpy)}</td></tr>
              </tbody>
            </table>
          </div>
          <dl className="mt-2 rounded-[16px] border border-[#E2E1DA] bg-white p-4 text-[12.5px]">
            <dt className="text-[11px] text-[#84787D]">お振込先</dt><dd className="break-words tabular-nums">{bankLine(s.bank)}</dd>
            <dt className="mt-2 text-[11px] text-[#84787D]">発行者</dt><dd className="flex flex-wrap items-center gap-3 break-words"><span>{s.issuer.name} ／ {issuerAddress(s.issuer)}{s.issuer.registration_number ? ` ／ 登録番号 ${s.issuer.registration_number}` : ''}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {a.stamp && <img src={a.stamp} alt="角印" className="h-[56px] w-[56px] object-contain" />}</dd>
            {s.notes && <dd className="mt-2 whitespace-pre-line text-[11px] text-[#84787D]">{s.notes}</dd>}
          </dl>
          <div className="mt-4">
            {a.status === 'sent' && <AgreeButton token={token} />}
            {a.status === 'agreed' && <p role="status" className="rounded-[16px] bg-[#D7EFFF] p-4 text-[14px] font-bold text-[#33566F]">ご契約成立済みです。ありがとうございます。</p>}
            {a.status === 'cancelled' && <p role="status" className={warn}>この請求書は取り消されました。新しいメールをご確認ください。</p>}
            {a.status === 'expired' && <p role="status" className={warn}>このページは期限が切れました。担当者へご連絡ください。</p>}
          </div>
        </>
      )}
    </div>
  )
}
