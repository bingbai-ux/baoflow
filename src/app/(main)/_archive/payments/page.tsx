import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/utils/format'

const directionLabels: Record<string, string> = {
  in: '入金',
  out: '出金',
}

const statusLabels: Record<string, string> = {
  pending: '未処理',
  processing: '処理中',
  completed: '完了',
  failed: '失敗',
}

const statusColors: Record<string, string> = {
  pending: '#bbbbbb',
  processing: '#e5a32e',
  completed: '#22c55e',
  failed: '#e5a32e',
}

export default async function PaymentsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .order('occurred_at', { ascending: false })

  return (
    <>
      <div className="flex justify-between items-center py-[18px]">
        <h1 className="font-display text-[22px] font-semibold text-[#0a0a0a]">
          支払い
        </h1>
        <Link
          href="/payments/new"
          className="bg-[#0a0a0a] text-white rounded-[8px] px-4 py-2 text-[13px] font-medium font-body no-underline"
        >
          + 新規支払い
        </Link>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#fafaf9] border-b border-[rgba(0,0,0,0.06)]">
              <th className="px-[14px] py-[10px] text-left text-[9px] font-medium text-[#b0b0b0] font-body uppercase tracking-wider">契約番号</th>
              <th className="px-[14px] py-[10px] text-left text-[9px] font-medium text-[#b0b0b0] font-body uppercase tracking-wider">方向</th>
              <th className="px-[14px] py-[10px] text-left text-[9px] font-medium text-[#b0b0b0] font-body uppercase tracking-wider">支払方法</th>
              <th className="px-[14px] py-[10px] text-right text-[9px] font-medium text-[#b0b0b0] font-body uppercase tracking-wider">金額 (JPY)</th>
              <th className="px-[14px] py-[10px] text-left text-[9px] font-medium text-[#b0b0b0] font-body uppercase tracking-wider">ステータス</th>
              <th className="px-[14px] py-[10px] text-left text-[9px] font-medium text-[#b0b0b0] font-body uppercase tracking-wider">日付</th>
            </tr>
          </thead>
            <tbody>
              {transactions && transactions.length > 0 ? (
                transactions.map((tx, index) => (
                  <tr
                    key={tx.id}
                    className={`${index < transactions.length - 1 ? 'border-b border-[rgba(0,0,0,0.06)]' : ''} hover:bg-[#fcfcfb] transition-colors`}
                  >
                    <td className="px-[14px] py-[12px] text-[13px] text-[#0a0a0a] font-display tabular-nums">
                      {tx.contract_number || '-'}
                    </td>
                    <td className="px-[14px] py-[12px] text-[13px] text-[#0a0a0a] font-body">
                      <span className={tx.direction === 'in' ? 'text-[#22c55e]' : 'text-[#0a0a0a]'}>
                        {directionLabels[tx.direction] || tx.direction}
                      </span>
                    </td>
                    <td className="px-[14px] py-[12px] text-[13px] text-[#0a0a0a] font-body">
                      {tx.payment_method || '-'}
                    </td>
                    <td className="px-[14px] py-[12px] text-right font-display tabular-nums font-medium text-[13px]">
                      {tx.amount_jpy ? formatCurrency(tx.amount_jpy) : '-'}
                    </td>
                    <td className="px-[14px] py-[12px]">
                      <div className="flex items-center gap-[6px]">
                        <span
                          className="w-[6px] h-[6px] rounded-full"
                          style={{ backgroundColor: statusColors[tx.status] || '#bbbbbb' }}
                        />
                        <span className="text-[12px] text-[#555] font-body">
                          {statusLabels[tx.status] || tx.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-[14px] py-[12px] font-display tabular-nums text-[13px] text-[#0a0a0a]">
                      {tx.occurred_at ? formatDate(tx.occurred_at) : formatDate(tx.created_at)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-[14px] py-[40px] text-center text-[13px] text-[#888] font-body"
                  >
                    取引がありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
      </div>
    </>
  )
}
