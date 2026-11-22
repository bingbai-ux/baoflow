import { loadTalkLink } from '@/lib/actions/deal-talk'
import { FactoryTalkForm } from '@/components/external/factory-talk-form'

// 工場の返信ページ（ログイン不要）。工場が (bao) への返事と写真・動画を書き込む。開いただけでは何も記録しない。
// 見せるのは案件番号と工場名だけ（顧客名・金額・ほかのやり取りは出さない）。表示は中国語を主に、日本語を添える。

export const dynamic = 'force-dynamic'
const warn = 'rounded-[16px] border-[1.5px] border-[#FF5C34] bg-[#FFD8C2] p-4 text-[14px] text-[#B03616]'

export default async function FactoryTalkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const link = await loadTalkLink(token)
  return (
    <div lang="zh-Hans">
      {link.status === 'missing' ? (
        <div className="rounded-[16px] border border-[#E2E1DA] bg-white p-6"><h1 className="text-[21px] font-extrabold">找不到此页面</h1><p className="mt-2 text-[14px]">请确认链接是否正确。（ページが見つかりません）</p></div>
      ) : (
        <>
          <h1 className="text-[21px] font-extrabold">给 (bao) 的回复</h1>
          <p className="mt-1 text-[14px] tabular-nums">{link.factoryName} ／ 订单编号 {link.dealCode}</p>
          <p className="text-[12.5px] text-[#84787D]">(bao) への返信ページ</p>
          <div className="mt-4">
            {link.status === 'active' ? <FactoryTalkForm token={token} />
              : <p role="status" className={warn}>此页面已失效，请联系 (bao) 的负责人。（このページは使えなくなりました）</p>}
          </div>
        </>
      )}
    </div>
  )
}
