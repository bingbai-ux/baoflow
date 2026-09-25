// Sprint 13: 工場ポータル本実装。自社宛の RFQ (見積依頼) 一覧と回答状況。
// role='factory' のみ (middleware)。回答は既存のトークン式フォームへ誘導する。

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PortalShell } from '@/components/external/portal-shell'
import { portalFactoryRfqs } from '@/lib/actions/portal-data'

function fmt(d: string | null): string {
  if (!d) return '—'
  const x = new Date(d)
  return `${x.getFullYear()}/${x.getMonth() + 1}/${x.getDate()}`
}

export default async function FactoryHome() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/factory/login')

  const [{ data: profile }, rfqs] = await Promise.all([
    supabase.from('profiles').select('display_name, email, factory_id').eq('id', user.id).single(),
    portalFactoryRfqs(),
  ])

  const { data: factory } = profile?.factory_id
    ? await supabase.from('factories').select('factory_name, name_cn').eq('id', profile.factory_id).single()
    : { data: null }

  const open = rfqs.filter((r) => !r.responded_at)
  const done = rfqs.filter((r) => r.responded_at)

  return (
    <PortalShell
      title="Factory Portal / 工厂端"
      wide
      loginPath="/factory/login"
      userLabel={profile?.display_name || profile?.email || null}
    >
      <div className="space-y-4">
        <div>
          <h1 className="font-display text-[20px] font-bold">
            {factory?.factory_name || 'Factory'}
            {factory?.name_cn && <span className="text-[14px] font-normal ml-2">{factory.name_cn}</span>}
          </h1>
          <p className="text-[12px] text-[#84787D] mt-0.5">
            Quotation requests from (bao). / 来自 (bao) 的询价请求。
          </p>
        </div>

        {!profile?.factory_id ? (
          <div className="bg-white rounded-[16px] border p-8" style={{ borderColor: 'rgba(229,163,46,0.25)' }}>
            <p className="text-[13px]">
              This account is not linked to a factory yet. Please contact (bao) staff.
              <br />
              此账号尚未关联工厂，请联系 (bao) 负责人。
            </p>
          </div>
        ) : (
          <>
            <section>
              <h2 className="text-[14px] font-display font-bold mb-2">
                Open RFQs / 待回复询价 ({open.length})
              </h2>
              {open.length === 0 ? (
                <p className="text-[12.5px] text-[#84787D] bg-white rounded-[16px] border border-[#E2E1DA] px-4 py-5">
                  No open requests. / 目前没有待回复的询价。
                </p>
              ) : (
                <div className="space-y-2">
                  {open.map((r) => (
                    <div key={r.invitation_id} className="bg-white rounded-[16px] border-[1.5px] border-[#E9F056] px-4 py-3">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="fc-num text-[12px] font-bold text-[#351E28]">{r.rfq_number || 'RFQ'}</span>
                        <span className="rounded-full bg-[#E9F056] text-[#666C14] text-[10px] font-bold px-2 py-[2px]">
                          NEW / 待回复
                        </span>
                        <span className="text-[11px] text-[#84787D] fc-num">
                          {r.product_count} products · sent {fmt(r.invitation_sent_at)}
                        </span>
                        <span className="flex-1" />
                        {r.response_deadline && (
                          <span className="fc-num text-[11px] text-[#B03616] font-bold">
                            Deadline / 截止 {fmt(r.response_deadline)}
                          </span>
                        )}
                      </div>
                      {r.request_message && (
                        <p className="text-[11.5px] text-[#351E28] mt-1.5">{r.request_message}</p>
                      )}
                      <div className="mt-2">
                        {r.form_token && r.form_status === 'pending' ? (
                          <a
                            href={`/external/${r.form_token}`}
                            className="inline-block rounded-full bg-[#351E28] text-[#C9A2B8] text-[12px] font-bold px-4 py-2 no-underline hover:brightness-95"
                          >
                            Submit quotation / 提交报价 →
                          </a>
                        ) : (
                          <span className="text-[11px] text-[#84787D]">
                            Form unavailable — contact (bao). / 表单不可用，请联系 (bao)。
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {done.length > 0 && (
              <details className="bg-[#FBFAF6] rounded-[16px] border border-[#E2E1DA]">
                <summary className="px-4 py-2.5 text-[12px] font-bold cursor-pointer">
                  Answered / 已回复 ({done.length})
                </summary>
                <div className="px-4 pb-3 space-y-1.5">
                  {done.map((r) => (
                    <p key={r.invitation_id} className="text-[11.5px] flex items-center gap-2 flex-wrap">
                      <span className="fc-num font-bold">{r.rfq_number || 'RFQ'}</span>
                      <span className="rounded-full bg-[#AEB8A0] text-[#4C5544] text-[10px] font-bold px-2 py-[2px]">
                        Answered / 已回复
                      </span>
                      <span className="fc-num text-[#84787D]">{fmt(r.responded_at)}</span>
                    </p>
                  ))}
                </div>
              </details>
            )}
          </>
        )}
      </div>
    </PortalShell>
  )
}
