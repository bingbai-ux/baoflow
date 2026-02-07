import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { StatusDot } from '@/components/deals/status-dot'

export default async function DealsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: deals } = await supabase
    .from('deals')
    .select(`
      *,
      clients (id, company_name),
      factories (id, name),
      profiles (id, display_name)
    `)
    .order('updated_at', { ascending: false })

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

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
          Orders
        </h1>
        <Link
          href="/deals/new"
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
          + 新規案件
        </Link>
      </div>

      {/* Table Card */}
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
            <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              {['案件番号', 'クライアント', '商品名', '数量', '工場', 'ステータス', '担当者', '更新日'].map((header) => (
                <th
                  key={header}
                  style={{
                    padding: '10px 14px',
                    textAlign: 'left',
                    fontSize: '11px',
                    fontWeight: 500,
                    color: '#bbbbbb',
                    fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                  }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {deals && deals.length > 0 ? (
              deals.map((deal) => (
                <tr
                  key={deal.id}
                  style={{
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                    cursor: 'pointer',
                  }}
                  onClick={() => {}}
                >
                  <td style={{ padding: '12px 14px' }}>
                    <Link
                      href={`/deals/${deal.id}`}
                      style={{
                        fontFamily: "'Fraunces', serif",
                        fontSize: '13px',
                        color: '#0a0a0a',
                        textDecoration: 'none',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {deal.deal_number}
                    </Link>
                  </td>
                  <td
                    style={{
                      padding: '12px 14px',
                      fontSize: '12px',
                      color: '#555555',
                      fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                    }}
                  >
                    {deal.clients?.company_name || '-'}
                  </td>
                  <td
                    style={{
                      padding: '12px 14px',
                      fontSize: '12px',
                      color: '#555555',
                      fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                    }}
                  >
                    {deal.product_name}
                  </td>
                  <td
                    style={{
                      padding: '12px 14px',
                      fontSize: '13px',
                      color: '#0a0a0a',
                      fontFamily: "'Fraunces', serif",
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {deal.quantity?.toLocaleString() || '-'}
                  </td>
                  <td
                    style={{
                      padding: '12px 14px',
                      fontSize: '12px',
                      color: '#555555',
                      fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                    }}
                  >
                    {deal.factories?.name || '-'}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <StatusDot status={deal.status} />
                  </td>
                  <td
                    style={{
                      padding: '12px 14px',
                      fontSize: '12px',
                      color: '#555555',
                      fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                    }}
                  >
                    {deal.profiles?.display_name || '-'}
                  </td>
                  <td
                    style={{
                      padding: '12px 14px',
                      fontSize: '12px',
                      color: '#888888',
                      fontFamily: "'Fraunces', serif",
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatDate(deal.updated_at)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    padding: '40px 14px',
                    textAlign: 'center',
                    fontSize: '13px',
                    color: '#888888',
                    fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                  }}
                >
                  案件がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
