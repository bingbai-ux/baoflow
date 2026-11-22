'use client'

// 設定 > AIの使い分け: 用途ごとに、使うAIを選んで保存する。

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveAiModels } from '@/lib/actions/ai-settings'
import { AI_MODEL_CHOICES, type AiModels } from '@/lib/ai/models'
import { useUi } from '@/components/ui/ui-store'

const field = 'w-full min-h-[44px] rounded-[12px] border border-transparent bg-[#EFEFEA] px-3 text-[14px] text-[#351E28] outline-none focus:border-[#351E28]'
const USES = [['draft', '返信の下書き', 'トーク欄で、顧客・工場あての返信文をつくるとき'], ['catalog', 'カタログの読み取り', '商品マスターに、カタログから候補を取り込むとき']] as const

export function AiSettingsForm({ models, aiReady }: { models: AiModels; aiReady: boolean }) {
  const router = useRouter()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()
  const [value, setValue] = useState(models)
  const [error, setError] = useState<string | null>(null)
  const changed = value.draft !== models.draft || value.catalog !== models.catalog
  const save = () => { setError(null); startTransition(async () => { const r = await saveAiModels(value); if (r.error) { setError(r.error); return } toast('AIの使い分けを保存しました'); router.refresh() }) }
  return (
    <section aria-label="AIの使い分け" className="space-y-4 rounded-[16px] border border-[#E2E1DA] bg-white p-4">
      {!aiReady && <p role="alert" className="rounded-[16px] border-[1.5px] border-[#FF5C34] bg-[#FFD8C2] p-3 text-[12.5px] text-[#B03616]">AIの設定（ANTHROPIC_API_KEY）がありません。ここで選んでも、鍵を登録するまでAIは使えません。</p>}
      {error && <p role="alert" className="rounded-[16px] border-[1.5px] border-[#FF5C34] bg-[#FFD8C2] p-3 text-[12.5px] text-[#B03616] break-words">{error}</p>}
      {USES.map(([key, title, note]) => (
        <label key={key} className="block text-[15px] font-bold">{title}
          <span className="block text-[12.5px] font-normal text-[#84787D]">{note}</span>
          <select value={value[key]} onChange={e => setValue(v => ({ ...v, [key]: e.target.value }))} className={field + ' mt-1 font-normal'}>{AI_MODEL_CHOICES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
        </label>
      ))}
      <div className="flex justify-end"><button type="button" disabled={pending || !changed} onClick={save} className="min-h-[44px] rounded-full bg-[#351E28] px-5 text-[13px] font-bold text-[#C9A2B8] hover:brightness-95 disabled:opacity-40">この内容で保存する</button></div>
    </section>
  )
}
