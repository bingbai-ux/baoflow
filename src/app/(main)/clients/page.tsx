import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDate, formatCurrency } from '@/lib/utils/format'

export default async function ClientsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // 顧客と関連する案件を取得
  const { data: clients } = await supabase
    .from('clients')
    .select(`
      *,
      deals:deals(
        id,
        quotes:deal_quotes(total_billing_tax_jpy, status)
      )
    `)
    .order('created_at', { ascending: false })

  // 各顧客の案件数と合計売上を計算
  const clientsWithStats = clients?.map(client => {
    const dealCount = client.deals?.length || 0
    const totalSales = client.deals?.reduce((sum: number, deal: { quotes?: { total_billing_tax_jpy?: number; status?: string }[] }) => {
      const approvedQuote = deal.quotes?.find(q => q.status === 'approved')
      return sum + (approvedQuote?.total_billing_tax_jpy || 0)
    }, 0) || 0
    return { ...client, dealCount, totalSales }
  }) || []

  return (
    <>
      <div className="flex justify-between items-center py-[18px]">
        <h1 className="font-display text-[22px] font-semibold text-[#0a0a0a]">
          顧客
        </h1>
        <Link
          href="/clients/new"
          className="bg-[#0a0a0a] text-white rounded-[8px] px-4 py-2 text-[13px] font-medium font-body no-underline"
        >
          + 新規顧客
        </Link>
      </div>

      {/* Clients Table */}
      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#fafaf9] border-b border-[rgba(0,0,0,0.06)]">
              <th className="px-[14px] py-[10px] text-left text-[9px] font-medium text-[#b0b0b0] font-body uppercase tracking-wider">会社名</th>
              <th className="px-[14px] py-[10px] text-left text-[9px] font-medium text-[#b0b0b0] font-body uppercase tracking-wider">担当者</th>
              <th className="px-[14px] py-[10px] text-left text-[9px] font-medium text-[#b0b0b0] font-body uppercase tracking-wider">電話</th>
              <th className="px-[14px] py-[10px] text-left text-[9px] font-medium text-[#b0b0b0] font-body uppercase tracking-wider">メール</th>
              <th className="px-[14px] py-[10px] text-right text-[9px] font-medium text-[#b0b0b0] font-body uppercase tracking-wider">案件数</th>
              <th className="px-[14px] py-[10px] text-right text-[9px] font-medium text-[#b0b0b0] font-body uppercase tracking-wider">合計売上</th>
              <th className="px-[14px] py-[10px] text-left text-[9px] font-medium text-[#b0b0b0] font-body uppercase tracking-wider w-[60px]"></th>
            </tr>
          </thead>
          <tbody>
            {clientsWithStats.length > 0 ? (
              clientsWithStats.map((client, index) => (
                <tr
                  key={client.id}
                  className={`${index < clientsWithStats.length - 1 ? 'border-b border-[rgba(0,0,0,0.06)]' : ''} hover:bg-[#fcfcfb] transition-colors`}
                >
                  <td className="px-[14px] py-[12px]">
                    <Link
                      href={`/clients/${client.id}`}
                      className="text-[#0a0a0a] no-underline font-medium text-[13px] font-body"
                    >
                      {client.company_name}
                    </Link>
                  </td>
                  <td className="px-[14px] py-[12px] text-[13px] text-[#0a0a0a] font-body">
                    {client.contact_name || '-'}
                  </td>
                  <td className="px-[14px] py-[12px] text-[13px] text-[#0a0a0a] font-body">
                    {client.phone || '-'}
                  </td>
                  <td className="px-[14px] py-[12px] text-[13px] text-[#0a0a0a] font-body">
                    {client.email || '-'}
                  </td>
                  <td className="px-[14px] py-[12px] text-right font-display text-[13px] text-[#0a0a0a] tabular-nums">
                    {client.dealCount}
                  </td>
                  <td className="px-[14px] py-[12px] text-right font-display text-[13px] text-[#0a0a0a] tabular-nums font-medium">
                    {client.totalSales > 0 ? formatCurrency(client.totalSales) : '-'}
                  </td>
                  <td className="px-[14px] py-[12px]">
                    <Link
                      href={`/clients/${client.id}/edit`}
                      className="text-[#888] text-[12px] no-underline font-body"
                    >
                      編集
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={7}
                  className="px-[14px] py-[40px] text-center text-[13px] text-[#888] font-body"
                >
                  顧客がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
