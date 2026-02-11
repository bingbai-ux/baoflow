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
    <div className="px-[26px] py-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-[20px] font-display font-semibold text-[#0a0a0a]">
          Logistics
        </h1>
        <Link
          href="/logistics/new"
          className="flex items-center gap-2 bg-[#0a0a0a] text-white rounded-[8px] px-[13px] py-[7px] text-[12px] font-body font-medium no-underline"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          新規登録
        </Link>
      </div>

      {/* Agents Table */}
      <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[rgba(0,0,0,0.06)]">
              <th className="text-left text-[11px] font-medium text-[#bbb] font-body py-[10px] px-[14px]">
                名称
              </th>
              <th className="text-left text-[11px] font-medium text-[#bbb] font-body py-[10px] px-[14px]">
                タイプ
              </th>
              <th className="text-left text-[11px] font-medium text-[#bbb] font-body py-[10px] px-[14px]">
                対応サービス
              </th>
              <th className="text-left text-[11px] font-medium text-[#bbb] font-body py-[10px] px-[14px]">
                主要担当
              </th>
              <th className="text-right text-[11px] font-medium text-[#bbb] font-body py-[10px] px-[14px]">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {agents && agents.length > 0 ? (
              agents.map((agent) => (
                <tr
                  key={agent.id}
                  className="border-b border-[rgba(0,0,0,0.06)] hover:bg-[#fcfcfb]"
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
                            className="text-[10px] font-body text-[#555] bg-[#f2f2f0] px-2 py-0.5 rounded"
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
                      <span className="flex items-center gap-1 text-[11px] text-[#22c55e] font-body">
                        <span className="w-[5px] h-[5px] rounded-full bg-[#22c55e]" />
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
    </div>
  )
}
