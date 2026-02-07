import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/lib/utils/format'

export default async function ClientsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: clients } = await supabase
    .from('clients')
    .select('*')
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
          Clients
        </h1>
        <Link
          href="/clients/new"
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
          + 新規顧客
        </Link>
      </div>

      {/* Clients Table */}
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
              <th style={headerCellStyle}>会社名</th>
              <th style={headerCellStyle}>担当者</th>
              <th style={headerCellStyle}>メール</th>
              <th style={headerCellStyle}>電話</th>
              <th style={headerCellStyle}>登録日</th>
              <th style={{ ...headerCellStyle, width: '80px' }}></th>
            </tr>
          </thead>
          <tbody>
            {clients && clients.length > 0 ? (
              clients.map((client) => (
                <tr
                  key={client.id}
                  style={{
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <td style={cellStyle}>
                    <Link
                      href={`/clients/${client.id}`}
                      style={{
                        color: '#0a0a0a',
                        textDecoration: 'none',
                        fontWeight: 500,
                      }}
                    >
                      {client.company_name}
                    </Link>
                  </td>
                  <td style={cellStyle}>{client.contact_name || '-'}</td>
                  <td style={cellStyle}>{client.email || '-'}</td>
                  <td style={cellStyle}>{client.phone || '-'}</td>
                  <td style={{ ...cellStyle, fontFamily: "'Fraunces', serif", fontVariantNumeric: 'tabular-nums' }}>
                    {formatDate(client.created_at)}
                  </td>
                  <td style={cellStyle}>
                    <Link
                      href={`/clients/${client.id}/edit`}
                      style={{
                        color: '#888888',
                        fontSize: '12px',
                        textDecoration: 'none',
                      }}
                    >
                      編集
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    padding: '40px 14px',
                    textAlign: 'center',
                    color: '#888888',
                    fontSize: '13px',
                    fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                  }}
                >
                  顧客がありません
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
