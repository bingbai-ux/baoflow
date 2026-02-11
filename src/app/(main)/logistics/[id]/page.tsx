import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { LogisticsAgentForm } from './logistics-form'

interface Props {
  params: Promise<{ id: string }>
}

export default async function LogisticsAgentDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: agent } = await supabase
    .from('logistics_agents')
    .select('*')
    .eq('id', id)
    .single()

  if (!agent) {
    notFound()
  }

  return (
    <div className="px-[26px] py-5">
      {/* Back Link */}
      <Link
        href="/logistics"
        className="inline-flex items-center gap-1 text-[12px] text-[#888] font-body hover:text-[#0a0a0a] no-underline mb-4"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        物流エージェント一覧に戻る
      </Link>

      <h1 className="text-[20px] font-display font-semibold text-[#0a0a0a] mb-5">
        {agent.name}
      </h1>

      <LogisticsAgentForm agent={agent} />
    </div>
  )
}
