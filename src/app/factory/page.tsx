// Sprint 11: 工場ポータル (準備中ランディング)。role='factory' のみ。

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PortalShell } from '@/components/external/portal-shell'

export default async function FactoryHome() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/factory/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, email')
    .eq('id', user.id)
    .single()

  return (
    <PortalShell
      title="Factory Portal / 工厂端"
      loginPath="/factory/login"
      userLabel={profile?.display_name || profile?.email || null}
    >
      <div className="bg-white rounded-[16px] border p-8" style={{ borderColor: 'rgba(229,163,46,0.25)' }}>
        <h1 className="font-display text-[20px] font-bold mb-2">Welcome / 欢迎</h1>
        <p className="text-[13px] leading-relaxed">
          The factory portal is under preparation. Soon you will be able to
          <b> receive RFQs, submit quotations and update production status</b> here.
        </p>
        <p className="text-[13px] leading-relaxed mt-2">
          工厂端页面正在准备中。届时您可以在这里<b>接收询价、提交报价、更新生产状态</b>。
        </p>
        <p className="text-[12px] text-[#84787D] mt-3">
          For now, please reply to RFQ links sent by kokon staff. / 目前请通过 kokon 发送的询价链接回复。
        </p>
      </div>
    </PortalShell>
  )
}
