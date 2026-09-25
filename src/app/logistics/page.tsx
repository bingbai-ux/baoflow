// Sprint 11: 物流パートナーポータル (準備中ランディング)。role='logistics' のみ。

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PortalShell } from '@/components/external/portal-shell'

export default async function LogisticsHome() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/logistics/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, email')
    .eq('id', user.id)
    .single()

  return (
    <PortalShell
      title="物流パートナーページ"
      loginPath="/logistics/login"
      userLabel={profile?.display_name || profile?.email || null}
    >
      <div className="bg-white rounded-[16px] border p-8" style={{ borderColor: 'rgba(229,163,46,0.25)' }}>
        <h1 className="font-display text-[20px] font-bold mb-2">ようこそ</h1>
        <p className="text-[13px] leading-relaxed">
          物流パートナー専用ページは現在準備中です。まもなく、こちらから
          <b>入庫予定の確認・入出庫の記録・出荷指示の受け取り</b>ができるようになります。
        </p>
        <p className="text-[12px] text-[#84787D] mt-3">
          それまでの入出庫連絡は、これまで通り担当者まで直接ご連絡ください。
        </p>
      </div>
    </PortalShell>
  )
}
