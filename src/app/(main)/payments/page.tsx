import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/page-header'
import { formatCurrency, formatDate } from '@/lib/utils/format'

const paymentTypeLabels: Record<string, string> = {
  deposit: '前払い',
  balance: '残金',
  full: '一括',
}

const paymentMethodLabels: Record<string, string> = {
  wise: 'Wise',
  alibaba: 'Alibaba',
  bank_transfer: '銀行振込',
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  const { data: payments } = await supabase
    .from('payments')
    .select(`
      *,
      deals (id, deal_number, product_name),
      clients:deals(clients(company_name))
    `)
    .order('created_at', { ascending: false })

  return (
    <>
      <div className="flex justify-between items-center py-[18px]">
        <PageHeader title="Payments" />
          <Link
            href="/payments/new"
            className="bg-[#0a0a0a] text-white rounded-[8px] px-4 py-2 text-[13px] font-medium font-body no-underline"
          >
            + 新規支払い
          </Link>
        </div>

        {/* Payments Table */}
        <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[rgba(0,0,0,0.06)]">
                <th className="px-[14px] py-[10px] text-left text-[11px] font-medium text-[#bbb] font-body">案件番号</th>
                <th className="px-[14px] py-[10px] text-left text-[11px] font-medium text-[#bbb] font-body">クライアント</th>
                <th className="px-[14px] py-[10px] text-left text-[11px] font-medium text-[#bbb] font-body">種別</th>
                <th className="px-[14px] py-[10px] text-left text-[11px] font-medium text-[#bbb] font-body">方法</th>
                <th className="px-[14px] py-[10px] text-right text-[11px] font-medium text-[#bbb] font-body">金額 (JPY)</th>
                <th className="px-[14px] py-[10px] text-left text-[11px] font-medium text-[#bbb] font-body">ステータス</th>
                <th className="px-[14px] py-[10px] text-left text-[11px] font-medium text-[#bbb] font-body">日付</th>
              </tr>
            </thead>
            <tbody>
              {payments && payments.length > 0 ? (
                payments.map((payment, index) => (
                  <tr
                    key={payment.id}
                    className={`${index < payments.length - 1 ? 'border-b border-[rgba(0,0,0,0.06)]' : ''} hover:bg-[#fcfcfb] transition-colors`}
                  >
                    <td className="px-[14px] py-[12px]">
                      {payment.deals ? (
                        <Link
                          href={`/deals/${payment.deals.id}`}
                          className="text-[#0a0a0a] no-underline font-display font-medium text-[13px]"
                        >
                          {payment.deals.deal_number}
                        </Link>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-[14px] py-[12px] text-[13px] text-[#0a0a0a] font-body">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {(payment.clients as any)?.clients?.company_name || '-'}
                    </td>
                    <td className="px-[14px] py-[12px] text-[13px] text-[#0a0a0a] font-body">
                      {paymentTypeLabels[payment.payment_type] || payment.payment_type}
                    </td>
                    <td className="px-[14px] py-[12px] text-[13px] text-[#0a0a0a] font-body">
                      {paymentMethodLabels[payment.payment_method] || payment.payment_method}
                    </td>
                    <td className="px-[14px] py-[12px] text-right font-display tabular-nums font-medium text-[13px]">
                      {payment.amount_jpy ? formatCurrency(payment.amount_jpy) : '-'}
                    </td>
                    <td className="px-[14px] py-[12px]">
                      <div className="flex items-center gap-[6px]">
                        <span
                          className="w-[5px] h-[5px] rounded-full"
                          style={{ backgroundColor: statusColors[payment.status] || '#bbbbbb' }}
                        />
                        <span className="text-[12px] text-[#555] font-body">
                          {statusLabels[payment.status] || payment.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-[14px] py-[12px] font-display tabular-nums text-[13px] text-[#0a0a0a]">
                      {formatDate(payment.created_at)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="px-[14px] py-[40px] text-center text-[13px] text-[#888] font-body"
                  >
                    支払いがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
      </div>
    </>
  )
}
