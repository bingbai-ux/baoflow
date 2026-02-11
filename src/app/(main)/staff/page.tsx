import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function StaffPage() {
  const supabase = await createClient()

  // Get all staff profiles (admin, sales, viewer roles)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .in('role', ['admin', 'sales', 'viewer'])
    .order('created_at', { ascending: false })

  // Get deal counts per sales user
  const { data: dealCounts } = await supabase
    .from('deals')
    .select('sales_user_id')

  // Count deals per user
  const dealCountMap: Record<string, number> = {}
  dealCounts?.forEach((deal) => {
    if (deal.sales_user_id) {
      dealCountMap[deal.sales_user_id] = (dealCountMap[deal.sales_user_id] || 0) + 1
    }
  })

  const roleLabels: Record<string, string> = {
    admin: '管理者',
    sales: '営業',
    viewer: '閲覧者',
  }

  const getInitials = (name: string | null, email: string | null) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    if (email) {
      return email[0].toUpperCase()
    }
    return 'U'
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-display font-semibold text-[#0a0a0a]">
          Staff
        </h1>
        <Link
          href="/staff/new"
          className="flex items-center gap-2 bg-[#0a0a0a] text-white rounded-[8px] px-[13px] py-[7px] text-[12px] font-body font-medium no-underline"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          新規スタッフ
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5">
          <p className="text-[11px] text-[#888] font-body mb-1">総スタッフ数</p>
          <p className="text-[28px] font-display font-semibold text-[#0a0a0a] tabular-nums">
            {profiles?.length || 0}
          </p>
        </div>
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5">
          <p className="text-[11px] text-[#888] font-body mb-1">管理者</p>
          <p className="text-[28px] font-display font-semibold text-[#0a0a0a] tabular-nums">
            {profiles?.filter((p) => p.role === 'admin').length || 0}
          </p>
        </div>
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5">
          <p className="text-[11px] text-[#888] font-body mb-1">営業</p>
          <p className="text-[28px] font-display font-semibold text-[#0a0a0a] tabular-nums">
            {profiles?.filter((p) => p.role === 'sales').length || 0}
          </p>
        </div>
        <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] p-5">
          <p className="text-[11px] text-[#888] font-body mb-1">閲覧者</p>
          <p className="text-[28px] font-display font-semibold text-[#0a0a0a] tabular-nums">
            {profiles?.filter((p) => p.role === 'viewer').length || 0}
          </p>
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)]">
        <div className="p-5 border-b border-[rgba(0,0,0,0.06)]">
          <h2 className="text-[14px] font-display font-semibold text-[#0a0a0a]">
            スタッフ一覧
          </h2>
        </div>
        {profiles && profiles.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[rgba(0,0,0,0.06)]">
                <th className="text-left py-3 px-4 text-[11px] font-medium text-[#bbb] font-body">
                  名前
                </th>
                <th className="text-left py-3 px-4 text-[11px] font-medium text-[#bbb] font-body">
                  メール
                </th>
                <th className="text-left py-3 px-4 text-[11px] font-medium text-[#bbb] font-body">
                  ロール
                </th>
                <th className="text-right py-3 px-4 text-[11px] font-medium text-[#bbb] font-body">
                  担当案件数
                </th>
                <th className="text-center py-3 px-4 text-[11px] font-medium text-[#bbb] font-body">
                  ステータス
                </th>
                <th className="text-right py-3 px-4 text-[11px] font-medium text-[#bbb] font-body"></th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => (
                <tr
                  key={profile.id}
                  className="border-b border-[rgba(0,0,0,0.06)] hover:bg-[#fcfcfb]"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#f2f2f0] flex items-center justify-center text-[11px] text-[#555] font-body font-medium">
                        {getInitials(profile.display_name, profile.email)}
                      </div>
                      <span className="text-[13px] text-[#0a0a0a] font-body font-medium">
                        {profile.display_name || profile.email?.split('@')[0] || 'Unknown'}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[12px] text-[#888] font-body">
                    {profile.email || '-'}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-[11px] font-body px-2 py-0.5 rounded-full ${
                        profile.role === 'admin'
                          ? 'bg-[#0a0a0a] text-white'
                          : profile.role === 'sales'
                            ? 'bg-[#f2f2f0] text-[#555]'
                            : 'bg-[#f2f2f0] text-[#888]'
                      }`}
                    >
                      {roleLabels[profile.role] || profile.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-display tabular-nums text-[13px] text-[#0a0a0a]">
                    {dealCountMap[profile.id] || 0}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-1.5">
                      <div className="w-[6px] h-[6px] rounded-full bg-[#22c55e]" />
                      <span className="text-[11px] text-[#555] font-body">アクティブ</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Link
                      href={`/staff/${profile.id}`}
                      className="text-[11px] text-[#888] font-body hover:text-[#0a0a0a] no-underline"
                    >
                      編集
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center">
            <p className="text-[13px] text-[#888] font-body">スタッフがいません</p>
          </div>
        )}
      </div>
    </div>
  )
}
