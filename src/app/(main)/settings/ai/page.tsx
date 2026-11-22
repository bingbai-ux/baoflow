import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getAiModels } from '@/lib/actions/ai-settings'
import { aiReady } from '@/lib/ai/claude'
import { AiSettingsForm } from '@/components/process/ai-settings-form'

// 設定 > AIの使い分け。

export default async function AiSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return (
    <div className="mx-auto max-w-[720px] space-y-4 py-4">
      <Link href="/settings" className="inline-flex min-h-[44px] items-center text-[12.5px] text-[#84787D] no-underline hover:text-[#351E28]">← 設定にもどる</Link>
      <div><h1 className="text-[21px] font-extrabold">AIの使い分け</h1></div>
      <AiSettingsForm models={await getAiModels()} aiReady={aiReady()} />
    </div>
  )
}
