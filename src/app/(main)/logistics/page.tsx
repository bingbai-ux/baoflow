import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function LogisticsPage() {
  const supabase = await createClient()

  const { data: agents } = await supabase
    .from('logistics_agents')
    .select('*')
    .order('is_primary', { ascending: false })
    .order('name', { ascending: true })

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between py-[18px]">
        <h1 className="font-display text-[22px] font-semibold text-[#0a0a0a]">
          物流エージェント
        </h1>
        <Link
          href="/logistics/new"
          className="bg-[#0a0a0a] text-white rounded-[8px] px-4 py-2 text-[13px] font-medium font-body no-underline"
        >
          + 新規登録
        </Link>
      </div>

      {/* Agents Table */}
      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#fafaf9] border-b border-[rgba(0,0,0,0.06)]">
              <th className="text-left text-[9px] font-medium text-[#b0b0b0] font-body py-[10px] px-[14px] uppercase tracking-wider">
                名称
              </th>
              <th className="text-left text-[9px] font-medium text-[#b0b0b0] font-body py-[10px] px-[14px] uppercase tracking-wider">
                タイプ
              </th>
              <th className="text-left text-[9px] font-medium text-[#b0b0b0] font-body py-[10px] px-[14px] uppercase tracking-wider">
                対応サービス
              </th>
              <th className="text-left text-[9px] font-medium text-[#b0b0b0] font-body py-[10px] px-[14px] uppercase tracking-wider">
                主要担当
              </th>
              <th className="text-right text-[9px] font-medium text-[#b0b0b0] font-body py-[10px] px-[14px] uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {agents && agents.length > 0 ? (
              agents.map((agent, index) => (
                <tr
                  key={agent.id}
                  className={`${index < agents.length - 1 ? 'border-b border-[rgba(0,0,0,0.06)]' : ''} hover:bg-[#fcfcfb]`}
                >
                  <td className="py-3 px-[14px]">
                    <div>
                      <p className="text-[13px] font-body text-[#0a0a0a]">
                        {agent.name}
                      </p>
                      {agent.name_en && (
                        <p className="text-[11px] text-[#888] font-body">
                          {agent.name_en}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-[14px]">
                    <span className="text-[12px] font-body text-[#555]">
                      {agent.agent_type === 'forwarder'
                        ? 'フォワーダー'
                        : agent.agent_type === 'customs_broker'
                        ? '通関業者'
                        : 'オールインワン'}
                    </span>
                  </td>
                  <td className="py-3 px-[14px]">
                    {agent.services && agent.services.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {agent.services.map((service: string, i: number) => (
                          <span
                            key={i}
                            className="text-[10px] font-body text-[#555] bg-[#f2f2f0] px-2 py-0.5 rounded-full"
                          >
                            {service}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[12px] text-[#bbb] font-body">-</span>
                    )}
                  </td>
                  <td className="py-3 px-[14px]">
                    {agent.is_primary ? (
                      <span className="flex items-center gap-[6px] text-[11px] text-[#22c55e] font-body">
                        <span className="w-[6px] h-[6px] rounded-full bg-[#22c55e]" />
                        主要
                      </span>
                    ) : (
                      <span className="text-[12px] text-[#bbb] font-body">-</span>
                    )}
                  </td>
                  <td className="py-3 px-[14px] text-right">
                    <Link
                      href={`/logistics/${agent.id}`}
                      className="text-[11px] text-[#888] font-body hover:text-[#0a0a0a] no-underline"
                    >
                      詳細
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="py-10 text-center">
                  <p className="text-[13px] text-[#888] font-body">
                    物流エージェントはまだ登録されていません
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
