// Sprint 11: クライアントポータル (準備中ランディング)。
// middleware が role='client' のみ通す。

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PortalShell } from '@/components/external/portal-shell'

export default async function PortalHome() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/portal/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, email')
    .eq('id', user.id)
    .single()

  return (
    <PortalShell
      title="クライアント様ページ"
      loginPath="/portal/login"
      userLabel={profile?.display_name || profile?.email || null}
    >
      <div className="bg-white rounded-[16px] border p-8" style={{ borderColor: 'rgba(229,163,46,0.25)' }}>
        <h1 className="font-display text-[20px] font-bold mb-2">ようこそ</h1>
        <p className="text-[13px] leading-relaxed">
          クライアント様専用ページは現在準備中です。まもなく、こちらから
          <b>ご注文の進捗確認・お預かり在庫の確認・出荷のご依頼</b>ができるようになります。
        </p>
        <p className="text-[12px] text-[#84787D] mt-3">
          それまでのご用件は、担当者まで直接ご連絡ください。
        </p>
      </div>
    </PortalShell>
  )
}
