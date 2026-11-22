import { loadConfirmation } from '@/lib/actions/customer-confirmation'
import { itemLines } from '@/lib/pdf/customer-confirmation'
import { ConfirmButton } from '@/components/external/confirm-button'

// 再設計 工程3: 顧客が商品内容を確認するページ（ログイン不要）。
// 開いただけでは確認にならない。「この内容で進める」ボタンを押したときだけ記録する。

export const dynamic = 'force-dynamic'

export default async function ConfirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const c = await loadConfirmation(token)
  const s = c.snapshot
  return (
    <main id="external-content" className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      {!s || c.status === 'missing' ? (
        <div className="rounded-[16px] border border-[#E2E1DA] bg-white p-6"><h1 className="text-[21px] font-extrabold">ページが見つかりません</h1><p className="mt-2 text-[14px]">リンクが正しいかご確認ください。</p></div>
      ) : (
        <>
          <h1 className="text-[21px] font-extrabold">商品内容のご確認</h1>
          <p className="mt-1 text-[14px]">{s.client_name} 様 ／ {s.deal_name}{s.brand ? `（${s.brand}）` : ''}</p>
          <p className="text-[12.5px] text-[#84787D] tabular-nums">番号 {s.deal_code}{s.desired_delivery_date ? ` ・ ご希望納期 ${s.desired_delivery_date.replace(/-/g, '/')}` : ''}</p>
          <ol aria-label="商品" className="mt-4 space-y-2">
            {s.items.map((item, i) => (
              <li key={i} className="rounded-[16px] border border-[#E2E1DA] bg-white p-4">
                <p className="text-[14px] font-bold break-words"><span className="mr-2 tabular-nums text-[#84787D]">{i + 1}</span>{item.name}</p>
                {itemLines(item).map(line => <p key={line} className="mt-1 text-[12.5px] text-[#351E28] break-words tabular-nums">{line}</p>)}
              </li>
            ))}
          </ol>
          <div className="mt-4">
            {c.status === 'pending' && <ConfirmButton token={token} />}
            {c.status === 'confirmed' && <p role="status" className="rounded-[16px] bg-[#D7EFFF] p-4 text-[14px] font-bold text-[#33566F]">この内容で確認済みです。ありがとうございます。</p>}
            {c.status === 'cancelled' && <p role="status" className="rounded-[16px] border-[1.5px] border-[#FF5C34] bg-[#FFD8C2] p-4 text-[14px] text-[#B03616]">この確認依頼は取り消されました。新しいメールをご確認ください。</p>}
            {c.status === 'expired' && <p role="status" className="rounded-[16px] border-[1.5px] border-[#FF5C34] bg-[#FFD8C2] p-4 text-[14px] text-[#B03616]">このページは期限が切れました。担当者へご連絡ください。</p>}
          </div>
        </>
      )}
    </main>
  )
}
