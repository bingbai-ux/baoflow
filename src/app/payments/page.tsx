import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
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

  const { data: payments } = await supabase
    .from('payments')
    .select(`
      *,
      deals (id, deal_number, product_name),
      clients:deals(clients(company_name))
    `)
    .order('created_at', { ascending: false })

  return (
    <div style={{ padding: '24px 26px' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <h1
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: '24px',
            fontWeight: 600,
            color: '#0a0a0a',
          }}
        >
          Payments
        </h1>
        <Link
          href="/payments/new"
          style={{
            backgroundColor: '#0a0a0a',
            color: '#ffffff',
            borderRadius: '8px',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 500,
            fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
            textDecoration: 'none',
          }}
        >
          + 新規支払い
        </Link>
      </div>

      {/* Payments Table */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          border: '1px solid rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr
              style={{
                borderBottom: '1px solid rgba(0,0,0,0.06)',
              }}
            >
              <th style={headerCellStyle}>案件番号</th>
              <th style={headerCellStyle}>クライアント</th>
              <th style={headerCellStyle}>種別</th>
              <th style={headerCellStyle}>方法</th>
              <th style={{ ...headerCellStyle, textAlign: 'right' }}>金額 (JPY)</th>
              <th style={headerCellStyle}>ステータス</th>
              <th style={headerCellStyle}>日付</th>
            </tr>
          </thead>
          <tbody>
            {payments && payments.length > 0 ? (
              payments.map((payment) => (
                <tr
                  key={payment.id}
                  style={{
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <td style={cellStyle}>
                    {payment.deals ? (
                      <Link
                        href={`/deals/${payment.deals.id}`}
                        style={{
                          color: '#0a0a0a',
                          textDecoration: 'none',
                          fontFamily: "'Fraunces', serif",
                          fontWeight: 500,
                        }}
                      >
                        {payment.deals.deal_number}
                      </Link>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td style={cellStyle}>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(payment.clients as any)?.clients?.company_name || '-'}
                  </td>
                  <td style={cellStyle}>
                    {paymentTypeLabels[payment.payment_type] || payment.payment_type}
                  </td>
                  <td style={cellStyle}>
                    {paymentMethodLabels[payment.payment_method] || payment.payment_method}
                  </td>
                  <td
                    style={{
                      ...cellStyle,
                      textAlign: 'right',
                      fontFamily: "'Fraunces', serif",
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: 500,
                    }}
                  >
                    {payment.amount_jpy ? formatCurrency(payment.amount_jpy) : '-'}
                  </td>
                  <td style={cellStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          backgroundColor: statusColors[payment.status] || '#bbbbbb',
                        }}
                      />
                      <span style={{ fontSize: '12px' }}>
                        {statusLabels[payment.status] || payment.status}
                      </span>
                    </div>
                  </td>
                  <td
                    style={{
                      ...cellStyle,
                      fontFamily: "'Fraunces', serif",
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatDate(payment.created_at)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    padding: '40px 14px',
                    textAlign: 'center',
                    color: '#888888',
                    fontSize: '13px',
                    fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                  }}
                >
                  支払いがありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const headerCellStyle: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: 500,
  color: '#bbbbbb',
  fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
}

const cellStyle: React.CSSProperties = {
  padding: '12px 14px',
  fontSize: '13px',
  color: '#0a0a0a',
  fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
}
